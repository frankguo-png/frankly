import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

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

    const start = searchParams.get('start') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const end = searchParams.get('end') ?? new Date().toISOString().split('T')[0]

    const service = createServiceClient()

    const { data: transactions, error: txError } = await service
      .from('transactions')
      .select('date, description, vendor, amount, currency, category, department, project, source')
      .eq('org_id', orgId)
      .eq('is_duplicate', false)
      .gte('date', start)
      .lte('date', end)

    if (txError) {
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      )
    }

    const txList = transactions ?? []

    // KPI summary
    let cashIn = 0
    let cashOut = 0
    let payrollTotal = 0
    let transactionCount = txList.length

    for (const tx of txList) {
      if (tx.amount > 0) {
        cashIn += tx.amount
      } else {
        cashOut += Math.abs(tx.amount)
        if (tx.category === 'Payroll') {
          payrollTotal += Math.abs(tx.amount)
        }
      }
    }

    // Spend by category
    const categoryMap = new Map<string, number>()
    for (const tx of txList) {
      if (tx.amount < 0) {
        const cat = tx.category ?? 'Uncategorized'
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Math.abs(tx.amount))
      }
    }
    const spendByCategory = Array.from(categoryMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Spend by department
    const departmentMap = new Map<string, number>()
    for (const tx of txList) {
      if (tx.amount < 0) {
        const dept = tx.department ?? 'Unassigned'
        departmentMap.set(dept, (departmentMap.get(dept) ?? 0) + Math.abs(tx.amount))
      }
    }
    const spendByDepartment = Array.from(departmentMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Spend by project
    const projectMap = new Map<string, number>()
    for (const tx of txList) {
      if (tx.amount < 0) {
        const proj = tx.project ?? 'Unassigned'
        projectMap.set(proj, (projectMap.get(proj) ?? 0) + Math.abs(tx.amount))
      }
    }
    const spendByProject = Array.from(projectMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Top 10 vendors by spend
    const vendorMap = new Map<string, number>()
    for (const tx of txList) {
      if (tx.amount < 0 && tx.vendor) {
        vendorMap.set(tx.vendor, (vendorMap.get(tx.vendor) ?? 0) + Math.abs(tx.amount))
      }
    }
    const topVendors = Array.from(vendorMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // Monthly totals
    const monthlyMap = new Map<string, { cashIn: number; cashOut: number }>()
    for (const tx of txList) {
      const month = tx.date.substring(0, 7) // YYYY-MM
      const bucket = monthlyMap.get(month) ?? { cashIn: 0, cashOut: 0 }
      if (tx.amount > 0) {
        bucket.cashIn += tx.amount
      } else {
        bucket.cashOut += Math.abs(tx.amount)
      }
      monthlyMap.set(month, bucket)
    }
    const monthlyTotals = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        net: data.cashIn - data.cashOut,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Fetch org name
    const { data: org } = await service
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    const report = {
      generatedAt: new Date().toISOString(),
      organization: org?.name ?? 'Organization',
      period: { start, end },
      summary: {
        cashIn,
        cashOut,
        netCashflow: cashIn - cashOut,
        payrollTotal,
        transactionCount,
      },
      spendByCategory,
      spendByDepartment,
      spendByProject,
      topVendors,
      monthlyTotals,
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
