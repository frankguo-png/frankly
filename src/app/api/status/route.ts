import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgId = userOrg.org_id

    // Fetch bank balances, current month transactions, and overdue payments in parallel
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]

    const [bankResult, txResult, overdueResult] = await Promise.all([
      supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('org_id', orgId),
      supabase
        .from('transactions')
        .select('amount')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .lt('amount', 0)
        .gte('date', monthStart),
      supabase
        .from('pending_payments')
        .select('amount, status')
        .eq('org_id', orgId)
        .eq('status', 'overdue'),
    ])

    const totalBalance = (bankResult.data ?? []).reduce(
      (sum, a) => sum + Number(a.current_balance ?? 0),
      0
    )

    const monthlyBurn = (txResult.data ?? []).reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0
    )

    const overduePayments = overdueResult.data ?? []
    const overdueCount = overduePayments.length
    const overdueAmount = overduePayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    )

    // Runway in months (avoid division by zero)
    const runwayMonths = monthlyBurn > 0 ? totalBalance / monthlyBurn : 99

    // Health color logic
    let healthColor: 'green' | 'amber' | 'red' = 'green'
    if (runwayMonths < 3) {
      healthColor = 'red'
    } else if (runwayMonths < 6 || overdueCount > 0) {
      healthColor = 'amber'
    }

    return NextResponse.json({
      runwayMonths: Math.round(runwayMonths * 10) / 10,
      overduePayments: overdueCount,
      overdueAmount,
      healthColor,
    })
  } catch (err) {
    console.error('Status API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
