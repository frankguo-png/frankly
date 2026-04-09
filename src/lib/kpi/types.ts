export interface KpiSummary {
  cashIn: number
  cashOut: number
  netCashflow: number
  netBurn: number
  bankBalance: number
  payrollTotal: number
  payrollPercentOfSpend: number
  toolsAndSoftware: number
}

export interface AgentAllocation {
  name: string
  monthlyCost: number
  percentage: number
  status: 'active' | 'development' | 'paused'
}

export interface SpendByCategory {
  name: string
  amount: number
  percentage: number
  color: string
  agents?: AgentAllocation[]
}

export interface TimeSeriesPoint {
  date: string
  cashIn: number
  cashOut: number
  netCashflow: number
}

export interface KpiResponse {
  summary: KpiSummary
  priorSummary: KpiSummary | null
  spendByDepartment: SpendByCategory[]
  spendByProject: SpendByCategory[]
  spendByAgent: SpendByCategory[]
  timeSeries: TimeSeriesPoint[]
  period: { start: string; end: string; granularity: string }
}

export type TimePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'ytd' | 'last_quarter'
export type Granularity = 'day' | 'week' | 'month'
