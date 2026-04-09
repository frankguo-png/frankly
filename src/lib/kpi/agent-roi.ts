import { createServiceClient } from '@/lib/supabase/server'

export interface AgentMetric {
  name: string
  project: string
  status: 'active' | 'development' | 'paused'
  totalCost: number
  monthlyCost: number
  costTrend: number[]
  revenueImpact: number
  roi: number
}

export interface AgentMetricsResponse {
  agents: AgentMetric[]
  summary: {
    totalAgentSpend: number
    avgRoi: number
    activeCount: number
    devCount: number
  }
}

export async function getAgentMetrics(orgId: string): Promise<AgentMetricsResponse> {
  const supabase = createServiceClient()

  // Fetch all transactions with ai_agent metadata (expenses)
  const { data: agentTxns, error: agentError } = await supabase
    .from('transactions')
    .select('amount, date, project, metadata')
    .eq('org_id', orgId)
    .eq('is_duplicate', false)
    .lt('amount', 0)

  if (agentError) {
    throw new Error(`Failed to fetch agent transactions: ${agentError.message}`)
  }

  // Fetch revenue transactions per project (for ROI calculation)
  const { data: revenueTxns, error: revError } = await supabase
    .from('transactions')
    .select('amount, project')
    .eq('org_id', orgId)
    .eq('is_duplicate', false)
    .gt('amount', 0)

  if (revError) {
    throw new Error(`Failed to fetch revenue transactions: ${revError.message}`)
  }

  // Calculate total revenue per project
  const projectRevenue = new Map<string, number>()
  for (const tx of revenueTxns ?? []) {
    const proj = tx.project ?? 'Internal'
    projectRevenue.set(proj, (projectRevenue.get(proj) ?? 0) + tx.amount)
  }

  // Calculate total cost per project (all expenses, not just agents)
  const projectTotalCost = new Map<string, number>()
  for (const tx of agentTxns ?? []) {
    const proj = tx.project ?? 'Internal'
    projectTotalCost.set(proj, (projectTotalCost.get(proj) ?? 0) + Math.abs(tx.amount))
  }

  // Group agent transactions by agent name
  const now = new Date()
  const agentMap = new Map<
    string,
    {
      project: string
      status: string
      totalCost: number
      monthBuckets: Map<number, number> // monthsAgo -> cost
    }
  >()

  for (const tx of agentTxns ?? []) {
    const meta = tx.metadata as Record<string, unknown> | null
    if (!meta || typeof meta.ai_agent !== 'string') continue

    const agentName = meta.ai_agent
    const agentStatus = (meta.agent_status as string) ?? 'active'
    const txProject = tx.project ?? 'Internal'
    const cost = Math.abs(tx.amount)

    if (!agentMap.has(agentName)) {
      agentMap.set(agentName, {
        project: txProject,
        status: agentStatus,
        totalCost: 0,
        monthBuckets: new Map(),
      })
    }

    const agent = agentMap.get(agentName)!
    agent.totalCost += cost

    // Determine which month bucket (0 = current, 1 = last month, 2 = two months ago)
    const txDate = new Date(tx.date)
    const monthsAgo =
      (now.getFullYear() - txDate.getFullYear()) * 12 +
      (now.getMonth() - txDate.getMonth())
    const bucket = Math.min(Math.max(monthsAgo, 0), 2)
    agent.monthBuckets.set(bucket, (agent.monthBuckets.get(bucket) ?? 0) + cost)
  }

  // Build agent metrics
  const agents: AgentMetric[] = []

  for (const [name, data] of agentMap) {
    // costTrend: [2 months ago, 1 month ago, current month]
    const costTrend = [
      data.monthBuckets.get(2) ?? 0,
      data.monthBuckets.get(1) ?? 0,
      data.monthBuckets.get(0) ?? 0,
    ]

    // monthlyCost: most recent month with data
    const monthlyCost = costTrend[2] > 0 ? costTrend[2] : costTrend[1] > 0 ? costTrend[1] : costTrend[0]

    // Revenue impact: proportional share of project revenue based on agent cost share
    const projRevenue = projectRevenue.get(data.project) ?? 0
    const projCost = projectTotalCost.get(data.project) ?? 1
    const agentCostShare = data.totalCost / projCost
    const revenueImpact = projRevenue * agentCostShare

    // ROI: (revenueImpact - totalCost) / totalCost * 100
    const roi = data.totalCost > 0 ? ((revenueImpact - data.totalCost) / data.totalCost) * 100 : 0

    agents.push({
      name,
      project: data.project,
      status: data.status as 'active' | 'development' | 'paused',
      totalCost: data.totalCost,
      monthlyCost,
      costTrend,
      revenueImpact,
      roi,
    })
  }

  // Sort by cost descending by default
  agents.sort((a, b) => b.totalCost - a.totalCost)

  const totalAgentSpend = agents.reduce((sum, a) => sum + a.totalCost, 0)
  const activeAgents = agents.filter((a) => a.status === 'active')
  const devAgents = agents.filter((a) => a.status === 'development')
  const avgRoi = agents.length > 0 ? agents.reduce((sum, a) => sum + a.roi, 0) / agents.length : 0

  return {
    agents,
    summary: {
      totalAgentSpend,
      avgRoi,
      activeCount: activeAgents.length,
      devCount: devAgents.length,
    },
  }
}
