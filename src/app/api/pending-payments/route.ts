import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

async function getAuthenticatedOrg() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: userOrg, error: orgError } = await supabase
    .from('user_organizations')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (orgError || !userOrg) {
    return { error: NextResponse.json({ error: 'Organization not found' }, { status: 404 }) }
  }

  return { supabase, orgId: userOrg.org_id }
}

export async function GET() {
  try {
    const auth = await getAuthenticatedOrg()
    if ('error' in auth && auth.error) return auth.error
    const { supabase, orgId } = auth as { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; orgId: string }

    const today = new Date().toISOString().split('T')[0]

    // Auto-mark overdue: update any pending payments whose due_date has passed
    await supabase
      .from('pending_payments')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .lt('due_date', today)

    // Fetch all non-paid payments for the full page, plus paid for filtering
    const { data: payments, error: fetchError } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('org_id', orgId)
      .order('due_date', { ascending: true })
      .limit(200)

    if (fetchError) {
      console.error('Error fetching pending payments:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch pending payments' },
        { status: 500 }
      )
    }

    const all = payments ?? []

    // Sort: overdue first, then by priority, then by due_date
    const sorted = [...all].sort((a, b) => {
      // Overdue items always come first
      if (a.status === 'overdue' && b.status !== 'overdue') return -1
      if (a.status !== 'overdue' && b.status === 'overdue') return 1

      // Paid items always last
      if (a.status === 'paid' && b.status !== 'paid') return 1
      if (a.status !== 'paid' && b.status === 'paid') return -1

      // Then by priority
      const pA = PRIORITY_ORDER[a.priority] ?? 2
      const pB = PRIORITY_ORDER[b.priority] ?? 2
      if (pA !== pB) return pA - pB

      // Then by due_date ascending (soonest first)
      return a.due_date.localeCompare(b.due_date)
    })

    const top = sorted.slice(0, 8)
    const nonPaid = all.filter((p) => p.status !== 'paid')

    const totalPending = nonPaid.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    )
    const overdueCount = all.filter(
      (p) => p.status === 'overdue'
    ).length
    const overdueAmount = all
      .filter((p) => p.status === 'overdue')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // Due this week count
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const weekFromNow = new Date(todayDate)
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    const dueThisWeekCount = nonPaid.filter((p) => {
      const due = new Date(p.due_date + 'T00:00:00')
      return due >= todayDate && due <= weekFromNow && p.status !== 'overdue'
    }).length

    const scheduledCount = all.filter((p) => p.status === 'scheduled').length

    // Aging report: bucket overdue payments by days past due
    const agingReport = { current: { count: 0, total: 0 }, days31_60: { count: 0, total: 0 }, days61_90: { count: 0, total: 0 }, days90plus: { count: 0, total: 0 } }
    const overduePayments = all.filter((p) => p.status === 'overdue')
    for (const p of overduePayments) {
      const dueDate = new Date(p.due_date + 'T00:00:00')
      const daysPast = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      const amt = Number(p.amount)
      if (daysPast <= 30) {
        agingReport.current.count++
        agingReport.current.total += amt
      } else if (daysPast <= 60) {
        agingReport.days31_60.count++
        agingReport.days31_60.total += amt
      } else if (daysPast <= 90) {
        agingReport.days61_90.count++
        agingReport.days61_90.total += amt
      } else {
        agingReport.days90plus.count++
        agingReport.days90plus.total += amt
      }
    }

    return NextResponse.json({
      payments: top,
      allPayments: sorted,
      totalPending,
      overdueCount,
      overdueAmount,
      dueThisWeekCount,
      scheduledCount,
      totalCount: nonPaid.length,
      agingReport,
    })
  } catch (error) {
    console.error('Error in pending-payments API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg()
    if ('error' in auth && auth.error) return auth.error
    const { supabase, orgId } = auth as { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; orgId: string }

    const body = await request.json()
    const { vendor, amount, due_date, priority, category, description, invoice_number, payment_terms, invoice_date, notes } = body

    if (!vendor || typeof vendor !== 'string' || !vendor.trim()) {
      return NextResponse.json({ error: 'Vendor is required and must be a non-empty string' }, { status: 400 })
    }
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Amount must be a number greater than 0' }, { status: 400 })
    }
    const validPriorities = ['critical', 'high', 'normal', 'low']
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: `Priority must be one of: ${validPriorities.join(', ')}` }, { status: 400 })
    }
    const validTerms = ['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90']
    if (payment_terms && !validTerms.includes(payment_terms)) {
      return NextResponse.json({ error: `Payment terms must be one of: ${validTerms.join(', ')}` }, { status: 400 })
    }

    // Auto-calculate due_date from payment_terms + invoice_date if no due_date provided
    let resolvedDueDate = due_date
    if (!resolvedDueDate && payment_terms && invoice_date) {
      const termsDays: Record<string, number> = { due_on_receipt: 0, net_15: 15, net_30: 30, net_45: 45, net_60: 60, net_90: 90 }
      const base = new Date(invoice_date + 'T00:00:00')
      base.setDate(base.getDate() + (termsDays[payment_terms] ?? 0))
      resolvedDueDate = base.toISOString().split('T')[0]
    }

    if (!resolvedDueDate || isNaN(Date.parse(resolvedDueDate))) {
      return NextResponse.json({ error: 'Due date is required and must be a valid date' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pending_payments')
      .insert({
        org_id: orgId,
        vendor: vendor.trim(),
        amount: Number(amount),
        due_date: resolvedDueDate,
        priority: priority || 'normal',
        category: category || null,
        description: description || null,
        invoice_number: invoice_number || null,
        payment_terms: payment_terms || null,
        invoice_date: invoice_date || null,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating payment:', error)
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
    }

    return NextResponse.json({ payment: data }, { status: 201 })
  } catch (error) {
    console.error('Error in POST pending-payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg()
    if ('error' in auth && auth.error) return auth.error
    const { supabase, orgId } = auth as { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; orgId: string }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    // Only allow updating specific fields
    const allowedFields = ['status', 'amount', 'due_date', 'priority', 'vendor', 'description', 'category', 'invoice_number', 'payment_terms', 'invoice_date', 'notes']
    const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitized[key] = updates[key]
      }
    }

    const { data, error } = await supabase
      .from('pending_payments')
      .update(sanitized)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) {
      console.error('Error updating payment:', error)
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
    }

    return NextResponse.json({ payment: data })
  } catch (error) {
    console.error('Error in PATCH pending-payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg()
    if ('error' in auth && auth.error) return auth.error
    const { supabase, orgId } = auth as { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; orgId: string }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pending_payments')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) {
      console.error('Error deleting payment:', error)
      return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE pending-payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
