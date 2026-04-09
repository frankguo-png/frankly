import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgId = userOrg.org_id
    const searchParams = request.nextUrl.searchParams

    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const category = searchParams.get('category')
    const department = searchParams.get('department')
    const project = searchParams.get('project')

    let query = supabase
      .from('transactions')
      .select('date, description, vendor, amount, currency, category, department, project, source')
      .eq('org_id', orgId)
      .eq('is_duplicate', false)
      .order('date', { ascending: false })

    if (start) {
      query = query.gte('date', start)
    }
    if (end) {
      query = query.lte('date', end)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (department) {
      query = query.eq('department', department)
    }
    if (project) {
      query = query.eq('project', project)
    }

    const { data: transactions, error: txError } = await query

    if (txError) {
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      )
    }

    const headers = ['Date', 'Description', 'Vendor', 'Amount', 'Currency', 'Category', 'Department', 'Project', 'Source']

    function escapeCsvField(value: string | null | undefined): string {
      if (value == null) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = (transactions ?? []).map((tx) =>
      [
        tx.date,
        tx.description,
        tx.vendor,
        tx.amount?.toString(),
        tx.currency,
        tx.category,
        tx.department,
        tx.project,
        tx.source,
      ]
        .map(escapeCsvField)
        .join(',')
    )

    const csv = [headers.join(','), ...rows].join('\n')

    const filename = `transactions-${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting transactions:', error)
    return NextResponse.json(
      { error: 'Failed to export transactions' },
      { status: 500 }
    )
  }
}
