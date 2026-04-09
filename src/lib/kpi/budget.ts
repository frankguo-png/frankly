import { createServiceClient } from '@/lib/supabase/server'

export interface BudgetLineItem {
  name: string
  budget: number
  actual: number
  variance: number
  variancePct: number
  status: 'under' | 'over' | 'on_track'
}

export interface BudgetRecord {
  id: string
  org_id: string
  category: string | null
  department: string | null
  project: string | null
  monthly_amount: number
  effective_month: string
  created_at: string
  updated_at: string
}

function computeStatus(budget: number, actual: number): 'under' | 'over' | 'on_track' {
  if (actual > budget) return 'over'
  const pctUsed = budget > 0 ? actual / budget : 0
  if (pctUsed < 0.9) return 'under'
  return 'on_track'
}

/**
 * For a given month, fetch all budgets and actual spend from transactions.
 * Groups by category, department, and project.
 */
export async function getBudgetVsActual(
  orgId: string,
  month: string // '2026-01' format
): Promise<BudgetLineItem[]> {
  const supabase = createServiceClient()

  // Fetch budgets for the given month
  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .eq('effective_month', month)

  if (budgetError) {
    throw new Error(`Failed to fetch budgets: ${budgetError.message}`)
  }

  // Compute date range for the month
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${month}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

  // Fetch actual spend for the month (negative amounts = expenses)
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, category, department, project')
    .eq('org_id', orgId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('is_duplicate', false)
    .lt('amount', 0)

  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`)
  }

  // Build actual spend maps
  const actualByCategory = new Map<string, number>()
  const actualByDepartment = new Map<string, number>()
  const actualByProject = new Map<string, number>()

  for (const tx of transactions ?? []) {
    const amount = Math.abs(tx.amount)
    if (tx.category) {
      actualByCategory.set(tx.category, (actualByCategory.get(tx.category) ?? 0) + amount)
    }
    if (tx.department) {
      actualByDepartment.set(tx.department, (actualByDepartment.get(tx.department) ?? 0) + amount)
    }
    if (tx.project) {
      actualByProject.set(tx.project, (actualByProject.get(tx.project) ?? 0) + amount)
    }
  }

  const results: BudgetLineItem[] = []

  for (const b of budgets ?? []) {
    const budgetAmount = Number(b.monthly_amount)
    let actual = 0
    let name = 'Total Budget'

    if (b.category) {
      name = b.category
      actual = actualByCategory.get(b.category) ?? 0
    } else if (b.department) {
      name = b.department
      actual = actualByDepartment.get(b.department) ?? 0
    } else if (b.project) {
      name = b.project
      actual = actualByProject.get(b.project) ?? 0
    }

    const variance = actual - budgetAmount
    const variancePct = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0
    const status = computeStatus(budgetAmount, actual)

    results.push({
      name,
      budget: budgetAmount,
      actual,
      variance,
      variancePct,
      status,
    })
  }

  return results.sort((a, b) => b.budget - a.budget)
}
