import { createServiceClient } from '@/lib/supabase/server'
import { format, subMonths, startOfMonth, endOfMonth, addMonths } from 'date-fns'

export interface RunwayResult {
  monthsRemaining: number
  burnRate: number
  cashInRate: number
  balanceNow: number
  runwayDate: string | null
}

export interface BurnTrendPoint {
  month: string
  burnRate: number
}

export interface CashForecastPoint {
  month: string
  projected_balance: number
  is_forecast: boolean
  /** Base case projected balance (forecast months only) */
  base?: number
  /** Best case projected balance (forecast months only) */
  best?: number
  /** Worst case projected balance (forecast months only) */
  worst?: number
}

export interface PayrollCashAlert {
  nextPayroll: number
  currentBalance: number
  coverageMonths: number
  status: 'healthy' | 'warning' | 'critical'
}

export async function getBankBalance(orgId: string, entityId?: string | null): Promise<number> {
  const supabase = createServiceClient()
  let query = supabase
    .from('bank_accounts')
    .select('current_balance')
    .eq('org_id', orgId)
    .eq('connection_status', 'active')
  if (entityId) query = query.eq('entity_id', entityId)

  const { data: bankAccounts, error } = await query

  if (error) {
    throw new Error(`Failed to fetch bank accounts: ${error.message}`)
  }

  return (bankAccounts ?? []).reduce(
    (sum, account) => sum + (account.current_balance ?? 0),
    0
  )
}

export async function getMonthlyTotals(
  orgId: string,
  monthsBack: number,
  entityId?: string | null
): Promise<{ month: string; cashIn: number; cashOut: number }[]> {
  const supabase = createServiceClient()
  const now = new Date()
  const results: { month: string; cashIn: number; cashOut: number }[] = []

  for (let i = monthsBack; i >= 1; i--) {
    const monthDate = subMonths(now, i)
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(monthDate), 'yyyy-MM-dd')

    let query = supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .gte('date', start)
      .lte('date', end)
      .eq('is_duplicate', false)
    if (entityId) query = query.eq('entity_id', entityId)

    const { data: transactions, error } = await query

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`)
    }

    let cashIn = 0
    let cashOut = 0
    for (const tx of transactions ?? []) {
      if (tx.amount > 0) {
        cashIn += tx.amount
      } else {
        cashOut += Math.abs(tx.amount)
      }
    }

    results.push({ month: format(monthDate, 'yyyy-MM'), cashIn, cashOut })
  }

  return results
}

export async function calculateRunway(orgId: string, entityId?: string | null): Promise<RunwayResult> {
  const [balanceNow, monthlyTotals] = await Promise.all([
    getBankBalance(orgId, entityId),
    getMonthlyTotals(orgId, 3, entityId),
  ])

  const totalBurn = monthlyTotals.reduce((sum, m) => sum + m.cashOut, 0)
  const totalIn = monthlyTotals.reduce((sum, m) => sum + m.cashIn, 0)
  const months = monthlyTotals.length || 1

  const burnRate = totalBurn / months
  const cashInRate = totalIn / months
  const netBurn = burnRate - cashInRate

  const monthsRemaining = netBurn > 0 ? balanceNow / netBurn : 999

  let runwayDate: string | null = null
  if (netBurn > 0 && monthsRemaining < 999) {
    runwayDate = format(addMonths(new Date(), Math.floor(monthsRemaining)), 'yyyy-MM-dd')
  }

  return {
    monthsRemaining: Math.round(monthsRemaining * 10) / 10,
    burnRate,
    cashInRate,
    balanceNow,
    runwayDate,
  }
}

export async function calculateBurnTrend(orgId: string, entityId?: string | null): Promise<BurnTrendPoint[]> {
  const monthlyTotals = await getMonthlyTotals(orgId, 6, entityId)

  return monthlyTotals.map((m) => ({
    month: m.month,
    burnRate: m.cashOut - m.cashIn,
  }))
}

export async function forecastCashPosition(
  orgId: string,
  months: number = 6,
  entityId?: string | null
): Promise<CashForecastPoint[]> {
  const [balanceNow, monthlyTotals] = await Promise.all([
    getBankBalance(orgId, entityId),
    getMonthlyTotals(orgId, 3, entityId),
  ])

  const totalNetBurn = monthlyTotals.reduce((sum, m) => sum + (m.cashOut - m.cashIn), 0)
  const avgMonthlyNetBurn = monthlyTotals.length > 0 ? totalNetBurn / monthlyTotals.length : 0

  // Build actuals: reconstruct balance going backwards
  const points: CashForecastPoint[] = []
  let runningBalance = balanceNow

  // Calculate actuals in reverse to reconstruct historical balances
  const actualsReversed: CashForecastPoint[] = []
  for (let i = monthlyTotals.length - 1; i >= 0; i--) {
    const m = monthlyTotals[i]
    actualsReversed.push({
      month: m.month,
      projected_balance: runningBalance,
      is_forecast: false,
    })
    // Go back by adding net burn (since we're going backwards)
    runningBalance += (m.cashOut - m.cashIn)
  }

  // Reverse to chronological order
  points.push(...actualsReversed.reverse())

  // Calculate average revenue and expenses for scenario modelling
  const avgRevenue = monthlyTotals.length > 0
    ? monthlyTotals.reduce((sum, m) => sum + m.cashIn, 0) / monthlyTotals.length
    : 0
  const avgExpenses = monthlyTotals.length > 0
    ? monthlyTotals.reduce((sum, m) => sum + m.cashOut, 0) / monthlyTotals.length
    : 0

  // Build forecast forward with best/worst/base scenarios
  let baseBalance = balanceNow
  let bestBalance = balanceNow
  let worstBalance = balanceNow

  let bestRevenue = avgRevenue
  let worstRevenue = avgRevenue
  let worstExpenses = avgExpenses

  const now = new Date()
  for (let i = 0; i < months; i++) {
    const futureMonth = addMonths(now, i + 1)

    // Base case: current trend continues
    baseBalance -= avgMonthlyNetBurn

    // Best case: revenue grows 15% MoM, expenses stay flat
    bestRevenue *= 1.15
    bestBalance += bestRevenue - avgExpenses

    // Worst case: revenue drops 15% MoM, expenses grow 5% MoM
    worstRevenue *= 0.85
    worstExpenses *= 1.05
    worstBalance += worstRevenue - worstExpenses

    const roundedBase = Math.round(baseBalance * 100) / 100
    points.push({
      month: format(futureMonth, 'yyyy-MM'),
      projected_balance: roundedBase,
      is_forecast: true,
      base: roundedBase,
      best: Math.round(bestBalance * 100) / 100,
      worst: Math.round(worstBalance * 100) / 100,
    })
  }

  return points
}

export async function getPayrollVsCashAlert(orgId: string, entityId?: string | null): Promise<PayrollCashAlert> {
  const supabase = createServiceClient()

  const [balanceNow, { data: allocations, error }] = await Promise.all([
    getBankBalance(orgId, entityId),
    supabase
      .from('payroll_allocations')
      .select('annual_salary')
      .eq('org_id', orgId)
      .is('end_date', null),
  ])

  if (error) {
    throw new Error(`Failed to fetch payroll allocations: ${error.message}`)
  }

  const monthlyPayroll = (allocations ?? []).reduce(
    (sum, a) => sum + ((a.annual_salary ?? 0) / 12),
    0
  )

  const coverageMonths = monthlyPayroll > 0 ? balanceNow / monthlyPayroll : 999

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (coverageMonths < 2) {
    status = 'critical'
  } else if (coverageMonths < 4) {
    status = 'warning'
  }

  return {
    nextPayroll: monthlyPayroll,
    currentBalance: balanceNow,
    coverageMonths: Math.round(coverageMonths * 10) / 10,
    status,
  }
}
