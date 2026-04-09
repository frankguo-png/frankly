import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { getKpiSummary } from '@/lib/kpi/calculator'
import { getBudgetVsActual } from '@/lib/kpi/budget'
import { calculateRunway } from '@/lib/kpi/forecasting'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

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
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgId = userOrg.org_id
    const service = createServiceClient()
    const now = new Date()
    const currentMonthStr = format(now, 'yyyy-MM')
    const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const currentMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

    // Build 3-month historical date ranges
    const historicalMonths: { month: string; start: string; end: string }[] = []
    for (let i = 2; i >= 0; i--) {
      const d = subMonths(now, i)
      historicalMonths.push({
        month: format(d, 'yyyy-MM'),
        start: format(startOfMonth(d), 'yyyy-MM-dd'),
        end: format(endOfMonth(d), 'yyyy-MM-dd'),
      })
    }

    // Fetch everything in parallel
    const [
      kpiSummary,
      runway,
      bankAccountsRes,
      dealsRes,
      pendingPaymentsRes,
      budgetComparison,
      payrollAllocationsRes,
      recentTransactionsRes,
      // 3 months of historical data
      hist0Res,
      hist1Res,
      hist2Res,
      // Current month category breakdown
      currentMonthTxRes,
    ] = await Promise.all([
      getKpiSummary(orgId, currentMonthStart, currentMonthEnd),
      calculateRunway(orgId),
      service
        .from('bank_accounts')
        .select('id, bank_name, account_name, current_balance, currency')
        .eq('org_id', orgId)
        .eq('connection_status', 'active'),
      service
        .from('deals')
        .select('*')
        .eq('org_id', orgId)
        .neq('stage', 'closed_lost')
        .order('amount', { ascending: false })
        .limit(20),
      service
        .from('pending_payments')
        .select('*')
        .eq('org_id', orgId)
        .neq('status', 'paid')
        .order('due_date', { ascending: true })
        .limit(20),
      getBudgetVsActual(orgId, currentMonthStr),
      service
        .from('payroll_allocations')
        .select('annual_salary, department')
        .eq('org_id', orgId)
        .is('end_date', null),
      service
        .from('transactions')
        .select('id, date, description, amount, category, department')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .order('date', { ascending: false })
        .limit(10),
      // Historical months transactions
      service
        .from('transactions')
        .select('amount')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .gte('date', historicalMonths[0].start)
        .lte('date', historicalMonths[0].end),
      service
        .from('transactions')
        .select('amount')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .gte('date', historicalMonths[1].start)
        .lte('date', historicalMonths[1].end),
      service
        .from('transactions')
        .select('amount')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .gte('date', historicalMonths[2].start)
        .lte('date', historicalMonths[2].end),
      // Current month with category for breakdown
      service
        .from('transactions')
        .select('amount, category')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .gte('date', currentMonthStart)
        .lte('date', currentMonthEnd),
    ])

    // Process bank accounts
    const bankAccounts = (bankAccountsRes.data ?? []).map((a) => ({
      name: a.account_name ?? a.bank_name ?? 'Account',
      balance: a.current_balance ?? 0,
      currency: a.currency ?? 'GBP',
    }))
    const totalBankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0)

    // Process deals pipeline
    const deals = (dealsRes.data ?? []) as Array<{
      id: string
      name: string
      company: string | null
      amount: number
      probability: number
      stage: string
      expected_close_date: string | null
    }>
    const totalPipeline = deals.reduce((s, d) => s + Number(d.amount), 0)
    const weightedPipeline = deals.reduce(
      (s, d) => s + Number(d.amount) * (Number(d.probability) / 100),
      0
    )
    const topDeals = deals.slice(0, 5).map((d) => ({
      name: d.name,
      company: d.company,
      amount: Number(d.amount),
      probability: Number(d.probability),
      stage: d.stage,
      expectedClose: d.expected_close_date,
    }))

    // Process pending payments
    const payments = (pendingPaymentsRes.data ?? []) as Array<{
      id: string
      vendor: string
      amount: number
      due_date: string
      status: string
      priority: string
    }>
    const totalPending = payments.reduce((s, p) => s + Number(p.amount), 0)
    const overduePayments = payments.filter((p) => p.status === 'overdue')
    const overdueCount = overduePayments.length
    const topOverdue = overduePayments.slice(0, 5).map((p) => ({
      vendor: p.vendor,
      amount: Number(p.amount),
      dueDate: p.due_date,
      priority: p.priority,
    }))

    // Process payroll
    const allocations = payrollAllocationsRes.data ?? []
    const headcount = allocations.length
    const monthlyPayroll = allocations.reduce(
      (s, a) => s + ((a.annual_salary ?? 0) / 12),
      0
    )
    const payrollPctOfSpend =
      kpiSummary.cashOut > 0 ? (monthlyPayroll / kpiSummary.cashOut) * 100 : 0

    // Department breakdown for payroll
    const deptMap = new Map<string, { cost: number; count: number }>()
    for (const a of allocations) {
      const dept = a.department ?? 'Uncategorized'
      const existing = deptMap.get(dept) ?? { cost: 0, count: 0 }
      existing.cost += (a.annual_salary ?? 0) / 12
      existing.count += 1
      deptMap.set(dept, existing)
    }
    const departmentBreakdown = Array.from(deptMap.entries())
      .map(([department, data]) => ({
        department,
        monthlyCost: data.cost,
        headcount: data.count,
      }))
      .sort((a, b) => b.monthlyCost - a.monthlyCost)

    // Process 3-month history
    function aggregateMonth(txns: { amount: number }[] | null) {
      let cashIn = 0
      let cashOut = 0
      for (const tx of txns ?? []) {
        if (tx.amount > 0) cashIn += tx.amount
        else cashOut += Math.abs(tx.amount)
      }
      return { cashIn, cashOut, net: cashIn - cashOut }
    }

    const historicalAggregates = [
      { month: historicalMonths[0].month, ...aggregateMonth(hist0Res.data) },
      { month: historicalMonths[1].month, ...aggregateMonth(hist1Res.data) },
      { month: historicalMonths[2].month, ...aggregateMonth(hist2Res.data) },
    ]

    // Current month category breakdown
    const categoryMap = new Map<string, { cashIn: number; cashOut: number }>()
    for (const tx of currentMonthTxRes.data ?? []) {
      const cat = tx.category ?? 'Uncategorized'
      const existing = categoryMap.get(cat) ?? { cashIn: 0, cashOut: 0 }
      if (tx.amount > 0) existing.cashIn += tx.amount
      else existing.cashOut += Math.abs(tx.amount)
      categoryMap.set(cat, existing)
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        net: data.cashIn - data.cashOut,
      }))
      .sort((a, b) => b.cashOut - a.cashOut)

    // Recent transactions
    const recentTransactions = (recentTransactionsRes.data ?? []).map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: t.category,
      department: t.department,
    }))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      reportMonth: currentMonthStr,
      periodStart: currentMonthStart,
      periodEnd: currentMonthEnd,

      executiveSummary: {
        cashPosition: totalBankBalance,
        monthlyBurnRate: runway.burnRate,
        runwayMonths: runway.monthsRemaining,
        revenue: kpiSummary.cashIn,
        netCashflow: kpiSummary.netCashflow,
      },

      bankAccounts,

      cashFlow: {
        historicalAggregates,
        categoryBreakdown,
      },

      pipeline: {
        totalPipeline,
        weightedPipeline,
        topDeals,
      },

      outstandingPayments: {
        totalPending,
        overdueCount,
        topOverdue,
      },

      teamAndPayroll: {
        headcount,
        monthlyPayroll,
        payrollPctOfSpend,
        departmentBreakdown,
      },

      budgetPerformance: budgetComparison,

      recentTransactions,
    })
  } catch (error) {
    console.error('Error generating board report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
