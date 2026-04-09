import { createServiceClient } from '@/lib/supabase/server'
import { format, subMonths, subDays } from 'date-fns'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  type:
    | 'spend_spike'
    | 'unusual_transaction'
    | 'new_vendor'
    | 'payroll_change'
    | 'duplicate_charge'
    | 'low_balance'
  severity: AlertSeverity
  title: string
  description: string
  amount: number | null
  date: string
  dismissed: boolean
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export function sortAlertsBySeverity(alerts: Alert[]): Alert[] {
  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )
}

export async function detectAnomalies(orgId: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  const now = new Date()
  const thisMonthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  const thisMonthEnd = format(now, 'yyyy-MM-dd')

  const threeMonthsAgo = format(subMonths(now, 3), 'yyyy-MM-dd')
  const lastMonthStart = format(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    'yyyy-MM-dd'
  )
  const lastMonthEnd = format(
    new Date(now.getFullYear(), now.getMonth(), 0),
    'yyyy-MM-dd'
  )

  const supabase = createServiceClient()

  // Fetch this month's transactions
  const { data: thisMonthTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, category, date, description')
    .eq('org_id', orgId)
    .gte('date', thisMonthStart)
    .lte('date', thisMonthEnd)
    .eq('is_duplicate', false)

  // Fetch last 3 months of transactions (excluding this month)
  const { data: historicalTx } = await supabase
    .from('transactions')
    .select('id, amount, vendor, category, date, description')
    .eq('org_id', orgId)
    .gte('date', threeMonthsAgo)
    .lt('date', thisMonthStart)
    .eq('is_duplicate', false)

  // Fetch bank accounts for balance check
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('current_balance')
    .eq('org_id', orgId)
    .eq('connection_status', 'active')

  const currentTx = thisMonthTx ?? []
  const pastTx = historicalTx ?? []

  // (a) Spend spikes: category spend this month vs 3-month average
  detectSpendSpikes(currentTx, pastTx, alerts, thisMonthStart)

  // (b) Unusual transactions: single tx > 2x vendor average
  detectUnusualTransactions(currentTx, pastTx, alerts)

  // (c) New vendors with amounts > $500
  detectNewVendors(currentTx, pastTx, alerts)

  // (d) Payroll changes: >10% difference from last period
  await detectPayrollChanges(
    orgId,
    supabase,
    thisMonthStart,
    thisMonthEnd,
    lastMonthStart,
    lastMonthEnd,
    alerts
  )

  // (e) Duplicate charges: same vendor + similar amount within 3 days
  detectDuplicateCharges(currentTx, alerts)

  // (f) Low balance warning: bank balance < 2x monthly burn
  detectLowBalance(currentTx, bankAccounts ?? [], alerts, thisMonthEnd)

  return sortAlertsBySeverity(alerts)
}

interface TxRow {
  id: string
  amount: number
  vendor: string | null
  category: string | null
  date: string
  description: string | null
}

function detectSpendSpikes(
  currentTx: TxRow[],
  pastTx: TxRow[],
  alerts: Alert[],
  thisMonthStart: string
) {
  // Build category spend for this month
  const thisMonthByCategory = new Map<string, number>()
  for (const tx of currentTx) {
    if (tx.amount < 0 && tx.category) {
      thisMonthByCategory.set(
        tx.category,
        (thisMonthByCategory.get(tx.category) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  // Build 3-month average by category
  const historicalByCategory = new Map<string, number>()
  for (const tx of pastTx) {
    if (tx.amount < 0 && tx.category) {
      historicalByCategory.set(
        tx.category,
        (historicalByCategory.get(tx.category) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  for (const [category, currentSpend] of thisMonthByCategory) {
    const historicalTotal = historicalByCategory.get(category) ?? 0
    const monthlyAvg = historicalTotal / 3
    if (monthlyAvg > 0 && currentSpend > monthlyAvg * 1.5) {
      const pctIncrease = Math.round(((currentSpend - monthlyAvg) / monthlyAvg) * 100)
      alerts.push({
        id: `spend-spike-${category.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'spend_spike',
        severity: pctIncrease > 100 ? 'critical' : 'warning',
        title: `${category} spend spike`,
        description: `${category} spending is ${pctIncrease}% above the 3-month average ($${Math.round(currentSpend).toLocaleString()} vs $${Math.round(monthlyAvg).toLocaleString()}/mo avg)`,
        amount: currentSpend,
        date: thisMonthStart,
        dismissed: false,
      })
    }
  }
}

function detectUnusualTransactions(
  currentTx: TxRow[],
  pastTx: TxRow[],
  alerts: Alert[]
) {
  // Build vendor averages from history
  const vendorTotals = new Map<string, { total: number; count: number }>()
  for (const tx of pastTx) {
    if (tx.vendor && tx.amount < 0) {
      const existing = vendorTotals.get(tx.vendor) ?? { total: 0, count: 0 }
      existing.total += Math.abs(tx.amount)
      existing.count += 1
      vendorTotals.set(tx.vendor, existing)
    }
  }

  for (const tx of currentTx) {
    if (tx.vendor && tx.amount < 0) {
      const stats = vendorTotals.get(tx.vendor)
      if (stats && stats.count >= 2) {
        const avg = stats.total / stats.count
        const txAmount = Math.abs(tx.amount)
        if (txAmount > avg * 2) {
          alerts.push({
            id: `unusual-tx-${tx.id}`,
            type: 'unusual_transaction',
            severity: 'warning',
            title: `Unusual charge from ${tx.vendor}`,
            description: `$${Math.round(txAmount).toLocaleString()} is ${Math.round(txAmount / avg)}x the average ($${Math.round(avg).toLocaleString()}) for this vendor`,
            amount: txAmount,
            date: tx.date,
            dismissed: false,
          })
        }
      }
    }
  }
}

function detectNewVendors(
  currentTx: TxRow[],
  pastTx: TxRow[],
  alerts: Alert[]
) {
  const knownVendors = new Set<string>()
  for (const tx of pastTx) {
    if (tx.vendor) knownVendors.add(tx.vendor)
  }

  for (const tx of currentTx) {
    if (tx.vendor && !knownVendors.has(tx.vendor) && tx.amount < 0) {
      const txAmount = Math.abs(tx.amount)
      if (txAmount > 500) {
        alerts.push({
          id: `new-vendor-${tx.id}`,
          type: 'new_vendor',
          severity: 'info',
          title: `New vendor: ${tx.vendor}`,
          description: `First-time payment of $${Math.round(txAmount).toLocaleString()} to ${tx.vendor}`,
          amount: txAmount,
          date: tx.date,
          dismissed: false,
        })
      }
    }
  }
}

async function detectPayrollChanges(
  orgId: string,
  supabase: ReturnType<typeof createServiceClient>,
  thisMonthStart: string,
  thisMonthEnd: string,
  lastMonthStart: string,
  lastMonthEnd: string,
  alerts: Alert[]
) {
  const { data: thisPayroll } = await supabase
    .from('transactions')
    .select('amount')
    .eq('org_id', orgId)
    .eq('category', 'Payroll')
    .gte('date', thisMonthStart)
    .lte('date', thisMonthEnd)
    .eq('is_duplicate', false)

  const { data: lastPayroll } = await supabase
    .from('transactions')
    .select('amount')
    .eq('org_id', orgId)
    .eq('category', 'Payroll')
    .gte('date', lastMonthStart)
    .lte('date', lastMonthEnd)
    .eq('is_duplicate', false)

  const thisTotal = (thisPayroll ?? []).reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  )
  const lastTotal = (lastPayroll ?? []).reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  )

  if (lastTotal > 0) {
    const changePct = Math.abs(thisTotal - lastTotal) / lastTotal
    if (changePct > 0.1) {
      const direction = thisTotal > lastTotal ? 'increased' : 'decreased'
      alerts.push({
        id: `payroll-change-${thisMonthStart}`,
        type: 'payroll_change',
        severity: changePct > 0.25 ? 'critical' : 'warning',
        title: `Payroll ${direction} ${Math.round(changePct * 100)}%`,
        description: `Payroll ${direction} from $${Math.round(lastTotal).toLocaleString()} to $${Math.round(thisTotal).toLocaleString()} compared to last period`,
        amount: thisTotal,
        date: thisMonthStart,
        dismissed: false,
      })
    }
  }
}

function detectDuplicateCharges(currentTx: TxRow[], alerts: Alert[]) {
  const expenses = currentTx
    .filter((tx) => tx.amount < 0 && tx.vendor)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i]
      const b = expenses[j]

      if (a.vendor !== b.vendor) continue

      const daysDiff = Math.abs(
        (new Date(b.date).getTime() - new Date(a.date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
      if (daysDiff > 3) continue

      const amtA = Math.abs(a.amount)
      const amtB = Math.abs(b.amount)
      const similarity = Math.min(amtA, amtB) / Math.max(amtA, amtB)

      if (similarity > 0.9) {
        alerts.push({
          id: `duplicate-${a.id}-${b.id}`,
          type: 'duplicate_charge',
          severity: 'warning',
          title: `Possible duplicate: ${a.vendor}`,
          description: `Two charges of ~$${Math.round(amtA).toLocaleString()} to ${a.vendor} within ${Math.round(daysDiff)} day(s)`,
          amount: amtA,
          date: b.date,
          dismissed: false,
        })
      }
    }
  }
}

function detectLowBalance(
  currentTx: TxRow[],
  bankAccounts: { current_balance: number | null }[],
  alerts: Alert[],
  today: string
) {
  const totalBalance = bankAccounts.reduce(
    (sum, acc) => sum + (acc.current_balance ?? 0),
    0
  )

  const monthlyBurn = currentTx
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  if (monthlyBurn > 0 && totalBalance < monthlyBurn * 2) {
    const monthsRunway = monthlyBurn > 0 ? totalBalance / monthlyBurn : 0
    alerts.push({
      id: `low-balance-${today}`,
      type: 'low_balance',
      severity: monthsRunway < 1 ? 'critical' : 'warning',
      title: 'Low balance warning',
      description: `Bank balance ($${Math.round(totalBalance).toLocaleString()}) is less than 2x monthly burn ($${Math.round(monthlyBurn).toLocaleString()}). Approximately ${monthsRunway.toFixed(1)} months of runway.`,
      amount: totalBalance,
      date: today,
      dismissed: false,
    })
  }
}
