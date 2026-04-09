import { createServiceClient } from '@/lib/supabase/server'
import type { KpiSummary, SpendByCategory, TimeSeriesPoint, Granularity } from './types'
import { format, startOfWeek, startOfMonth } from 'date-fns'

const DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: '#3b82f6',
  Product: '#8b5cf6',
  Marketing: '#f59e0b',
  Sales: '#22c55e',
  Operations: '#6366f1',
  Admin: '#ec4899',
  Uncategorized: '#64748b',
}

const PROJECT_COLORS: Record<string, string> = {
  LNER: '#3b82f6',
  PWC: '#22c55e',
  IWAKI: '#f59e0b',
  Brookfield: '#8b5cf6',
  Internal: '#06b6d4',
  Unassigned: '#64748b',
}

export async function getKpiSummary(
  orgId: string,
  start: string,
  end: string,
  entityId?: string | null
): Promise<KpiSummary> {
  const supabase = createServiceClient()

  let txQuery = supabase
    .from('transactions')
    .select('amount, category')
    .eq('org_id', orgId)
    .gte('date', start)
    .lte('date', end)
    .eq('is_duplicate', false)
  if (entityId) txQuery = txQuery.eq('entity_id', entityId)

  const { data: transactions, error: txError } = await txQuery

  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`)
  }

  let cashIn = 0
  let cashOut = 0
  let payrollTotal = 0
  let toolsAndSoftware = 0

  for (const tx of transactions ?? []) {
    if (tx.amount > 0) {
      cashIn += tx.amount
    } else {
      cashOut += Math.abs(tx.amount)
      if (tx.category === 'Payroll') {
        payrollTotal += Math.abs(tx.amount)
      }
      if (tx.category === 'Tools & Software') {
        toolsAndSoftware += Math.abs(tx.amount)
      }
    }
  }

  let bankQuery = supabase
    .from('bank_accounts')
    .select('current_balance')
    .eq('org_id', orgId)
    .eq('connection_status', 'active')
  if (entityId) bankQuery = bankQuery.eq('entity_id', entityId)

  const { data: bankAccounts, error: bankError } = await bankQuery

  if (bankError) {
    throw new Error(`Failed to fetch bank accounts: ${bankError.message}`)
  }

  const bankBalance = (bankAccounts ?? []).reduce(
    (sum, account) => sum + (account.current_balance ?? 0),
    0
  )

  return {
    cashIn,
    cashOut,
    netCashflow: cashIn - cashOut,
    netBurn: cashOut - cashIn,
    bankBalance,
    payrollTotal,
    payrollPercentOfSpend: cashOut > 0 ? (payrollTotal / cashOut) * 100 : 0,
    toolsAndSoftware,
  }
}

export async function getPayrollByDepartment(
  orgId: string,
  _start: string,
  _end: string
): Promise<{ department: string; monthlyCost: number; employeeCount: number }[]> {
  const supabase = createServiceClient()

  const { data: allocations, error } = await supabase
    .from('payroll_allocations')
    .select('annual_salary, department')
    .eq('org_id', orgId)
    .is('end_date', null)

  if (error) {
    throw new Error(`Failed to fetch payroll by department: ${error.message}`)
  }

  const deptMap = new Map<string, { monthlyCost: number; employeeCount: number }>()

  for (const emp of allocations ?? []) {
    const dept = emp.department ?? 'Uncategorized'
    const existing = deptMap.get(dept) ?? { monthlyCost: 0, employeeCount: 0 }
    existing.monthlyCost += (emp.annual_salary ?? 0) / 12
    existing.employeeCount += 1
    deptMap.set(dept, existing)
  }

  return Array.from(deptMap.entries())
    .map(([department, data]) => ({
      department,
      monthlyCost: data.monthlyCost,
      employeeCount: data.employeeCount,
    }))
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
}

export async function getPayrollByProject(
  orgId: string,
  _start: string,
  _end: string
): Promise<{ project: string; monthlyCost: number; employeeCount: number }[]> {
  const supabase = createServiceClient()

  const { data: allocations, error } = await supabase
    .from('payroll_allocations')
    .select('annual_salary, project_allocations')
    .eq('org_id', orgId)
    .is('end_date', null)

  if (error) {
    throw new Error(`Failed to fetch payroll by project: ${error.message}`)
  }

  const projMap = new Map<string, { monthlyCost: number; employees: Set<number> }>()
  let empIndex = 0

  for (const emp of allocations ?? []) {
    const monthly = (emp.annual_salary ?? 0) / 12
    const allocs = emp.project_allocations
    let allocatedPct = 0

    if (typeof allocs === 'object' && allocs !== null && !Array.isArray(allocs)) {
      for (const [proj, pct] of Object.entries(allocs as Record<string, unknown>)) {
        if (typeof pct === 'number' && pct > 0) {
          const existing = projMap.get(proj) ?? { monthlyCost: 0, employees: new Set<number>() }
          existing.monthlyCost += monthly * (pct / 100)
          existing.employees.add(empIndex)
          projMap.set(proj, existing)
          allocatedPct += pct
        }
      }
    }

    if (allocatedPct < 100) {
      const unassigned = projMap.get('Unassigned') ?? { monthlyCost: 0, employees: new Set<number>() }
      unassigned.monthlyCost += monthly * ((100 - allocatedPct) / 100)
      unassigned.employees.add(empIndex)
      projMap.set('Unassigned', unassigned)
    }

    empIndex++
  }

  return Array.from(projMap.entries())
    .map(([project, data]) => ({
      project,
      monthlyCost: data.monthlyCost,
      employeeCount: data.employees.size,
    }))
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
}

export async function getSpendByDepartment(
  orgId: string,
  start: string,
  end: string,
  entityId?: string | null
): Promise<SpendByCategory[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('transactions')
    .select('amount, department')
    .eq('org_id', orgId)
    .gte('date', start)
    .lte('date', end)
    .eq('is_duplicate', false)
    .lt('amount', 0)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data: transactions, error } = await query

  if (error) {
    throw new Error(`Failed to fetch department spend: ${error.message}`)
  }

  const departmentMap = new Map<string, number>()

  for (const tx of transactions ?? []) {
    const dept = tx.department ?? 'Uncategorized'
    departmentMap.set(dept, (departmentMap.get(dept) ?? 0) + Math.abs(tx.amount))
  }

  // Merge payroll allocation costs into department spend
  try {
    const payrollByDept = await getPayrollByDepartment(orgId, start, end)
    for (const entry of payrollByDept) {
      departmentMap.set(
        entry.department,
        (departmentMap.get(entry.department) ?? 0) + entry.monthlyCost
      )
    }
  } catch {
    // If payroll fetch fails, continue with transaction-only data
  }

  const totalSpend = Array.from(departmentMap.values()).reduce((a, b) => a + b, 0)

  return Array.from(departmentMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
      color: DEPARTMENT_COLORS[name] ?? '#64748b',
    }))
    .sort((a, b) => b.amount - a.amount)
}

export async function getSpendByProject(
  orgId: string,
  start: string,
  end: string,
  entityId?: string | null
): Promise<SpendByCategory[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('transactions')
    .select('amount, project, metadata')
    .eq('org_id', orgId)
    .gte('date', start)
    .lte('date', end)
    .eq('is_duplicate', false)
    .lt('amount', 0)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data: transactions, error } = await query

  if (error) {
    throw new Error(`Failed to fetch project spend: ${error.message}`)
  }

  const projectMap = new Map<string, number>()

  for (const tx of transactions ?? []) {
    const proj = tx.project ?? 'Unassigned'
    projectMap.set(proj, (projectMap.get(proj) ?? 0) + Math.abs(tx.amount))
  }

  // Merge payroll allocation costs into project spend
  try {
    const payrollByProject = await getPayrollByProject(orgId, start, end)
    for (const entry of payrollByProject) {
      projectMap.set(
        entry.project,
        (projectMap.get(entry.project) ?? 0) + entry.monthlyCost
      )
    }
  } catch {
    // If payroll fetch fails, continue with transaction-only data
  }

  // Fetch AI agent costs from transactions with metadata.ai_agent
  const agentsByProject = new Map<string, Map<string, { cost: number; status: string }>>()
  for (const tx of transactions ?? []) {
    const meta = tx.metadata as Record<string, unknown> | null
    if (meta && typeof meta.ai_agent === 'string') {
      const proj = tx.project ?? 'Internal'
      if (!agentsByProject.has(proj)) agentsByProject.set(proj, new Map())
      const agentMap = agentsByProject.get(proj)!
      const existing = agentMap.get(meta.ai_agent) ?? { cost: 0, status: (meta.agent_status as string) ?? 'active' }
      existing.cost += Math.abs(tx.amount)
      agentMap.set(meta.ai_agent, existing)
    }
  }

  const totalSpend = Array.from(projectMap.values()).reduce((a, b) => a + b, 0)

  return Array.from(projectMap.entries())
    .map(([name, amount]) => {
      const projectAgentMap = agentsByProject.get(name)
      const agents = projectAgentMap
        ? Array.from(projectAgentMap.entries())
            .map(([agentName, info]) => ({
              name: agentName,
              monthlyCost: info.cost,
              percentage: 0,
              status: (info.status as 'active' | 'development' | 'paused') ?? 'active',
            }))
            .sort((a, b) => b.monthlyCost - a.monthlyCost)
        : []
      const agentTotal = agents.reduce((s, a) => s + a.monthlyCost, 0)
      for (const a of agents) {
        a.percentage = agentTotal > 0 ? (a.monthlyCost / agentTotal) * 100 : 0
      }
      return {
        name,
        amount,
        percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
        color: PROJECT_COLORS[name] ?? '#64748b',
        agents,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

const AGENT_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e879f9',
]

export async function getSpendByAgent(
  orgId: string,
  start: string,
  end: string,
  entityId?: string | null
): Promise<SpendByCategory[]> {
  const supabase = createServiceClient()

  // AI agents are tracked via metadata.ai_agent on transactions
  // This tracks costs per AI agent role deployed on projects
  let query = supabase
    .from('transactions')
    .select('amount, metadata')
    .eq('org_id', orgId)
    .gte('date', start)
    .lte('date', end)
    .eq('is_duplicate', false)
    .lt('amount', 0)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data: transactions, error: txError } = await query

  if (txError) {
    throw new Error(`Failed to fetch agent transactions: ${txError.message}`)
  }

  const agentMap = new Map<string, number>()

  for (const tx of transactions ?? []) {
    const meta = tx.metadata as Record<string, unknown> | null
    if (meta && typeof meta === 'object' && typeof meta.ai_agent === 'string') {
      const agentName = meta.ai_agent
      agentMap.set(agentName, (agentMap.get(agentName) ?? 0) + Math.abs(tx.amount))
    }
  }

  const totalSpend = Array.from(agentMap.values()).reduce((a, b) => a + b, 0)

  return Array.from(agentMap.entries())
    .map(([name, amount], index) => ({
      name,
      amount,
      percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
      color: AGENT_COLORS[index % AGENT_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount)
}

function getTimeBucketKey(dateStr: string, granularity: Granularity): string {
  const date = new Date(dateStr)
  switch (granularity) {
    case 'day':
      return format(date, 'yyyy-MM-dd')
    case 'week':
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    case 'month':
      return format(startOfMonth(date), 'yyyy-MM-dd')
  }
}

export async function getTimeSeries(
  orgId: string,
  start: string,
  end: string,
  granularity: Granularity,
  entityId?: string | null
): Promise<TimeSeriesPoint[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('transactions')
    .select('date, amount')
    .eq('org_id', orgId)
    .gte('date', start)
    .lte('date', end)
    .eq('is_duplicate', false)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data: transactions, error } = await query

  if (error) {
    throw new Error(`Failed to fetch time series data: ${error.message}`)
  }

  const bucketMap = new Map<string, { cashIn: number; cashOut: number }>()

  for (const tx of transactions ?? []) {
    const key = getTimeBucketKey(tx.date, granularity)
    const bucket = bucketMap.get(key) ?? { cashIn: 0, cashOut: 0 }

    if (tx.amount > 0) {
      bucket.cashIn += tx.amount
    } else {
      bucket.cashOut += Math.abs(tx.amount)
    }

    bucketMap.set(key, bucket)
  }

  return Array.from(bucketMap.entries())
    .map(([date, { cashIn, cashOut }]) => ({
      date,
      cashIn,
      cashOut,
      netCashflow: cashIn - cashOut,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
