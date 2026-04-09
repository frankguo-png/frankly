import { addMonths, format } from 'date-fns'

export interface ScenarioHire {
  count: number
  monthlyCost: number
}

export interface ScenarioDeal {
  amount: number
  month: number // month offset (1 = next month, 2 = two months from now, etc.)
}

export interface ScenarioExpenseCut {
  category: string
  monthlyAmount: number
}

export interface ScenarioInputs {
  hires: ScenarioHire[]
  deals: ScenarioDeal[]
  cutExpenses: ScenarioExpenseCut[]
  otherMonthlyChange: number
}

export interface ProjectionPoint {
  month: string
  balance: number
}

export interface ScenarioBranch {
  runway: number
  burnRate: number
  projection: ProjectionPoint[]
}

export interface ScenarioResult {
  base: ScenarioBranch
  scenario: ScenarioBranch
  delta: {
    runwayChange: number
    burnChange: number
  }
}

export interface BaseData {
  balanceNow: number
  avgMonthlyRevenue: number
  avgMonthlyExpenses: number
}

export function simulateScenario(
  baseData: BaseData,
  inputs: ScenarioInputs
): ScenarioResult {
  const { balanceNow, avgMonthlyRevenue, avgMonthlyExpenses } = baseData
  const MONTHS = 12
  const now = new Date()

  // --- Base case ---
  const baseNetBurn = avgMonthlyExpenses - avgMonthlyRevenue
  const baseProjection: ProjectionPoint[] = []
  let baseBalance = balanceNow

  for (let i = 0; i < MONTHS; i++) {
    const futureMonth = addMonths(now, i + 1)
    baseBalance -= baseNetBurn
    baseProjection.push({
      month: format(futureMonth, 'yyyy-MM'),
      balance: Math.round(baseBalance * 100) / 100,
    })
  }

  const baseRunway = baseNetBurn > 0 ? balanceNow / baseNetBurn : 999

  // --- Scenario case ---
  const additionalHireCost = inputs.hires.reduce(
    (sum, h) => sum + h.count * h.monthlyCost,
    0
  )
  const totalExpenseCuts = inputs.cutExpenses.reduce(
    (sum, c) => sum + c.monthlyAmount,
    0
  )

  // Build a map of deal revenue by month offset
  const dealRevenueByMonth = new Map<number, number>()
  for (const deal of inputs.deals) {
    const current = dealRevenueByMonth.get(deal.month) ?? 0
    dealRevenueByMonth.set(deal.month, current + deal.amount)
  }

  const scenarioMonthlyExpenses =
    avgMonthlyExpenses + additionalHireCost - totalExpenseCuts + inputs.otherMonthlyChange

  const scenarioProjection: ProjectionPoint[] = []
  let scenarioBalance = balanceNow

  for (let i = 0; i < MONTHS; i++) {
    const futureMonth = addMonths(now, i + 1)
    const monthOffset = i + 1
    const dealRevenue = dealRevenueByMonth.get(monthOffset) ?? 0
    const monthlyRevenue = avgMonthlyRevenue + dealRevenue

    scenarioBalance += monthlyRevenue - scenarioMonthlyExpenses
    scenarioProjection.push({
      month: format(futureMonth, 'yyyy-MM'),
      balance: Math.round(scenarioBalance * 100) / 100,
    })
  }

  // Compute scenario average net burn (using the steady-state, excluding one-time deal spikes)
  const scenarioNetBurn = scenarioMonthlyExpenses - avgMonthlyRevenue
  const scenarioRunway = scenarioNetBurn > 0 ? balanceNow / scenarioNetBurn : 999

  // If deals provide enough recurring offset, recalculate considering total deal impact
  // For a more accurate runway, simulate when balance hits zero
  let simulatedRunway = 999
  let simBalance = balanceNow
  for (let i = 0; i < 120; i++) {
    const monthOffset = i + 1
    const dealRevenue = dealRevenueByMonth.get(monthOffset) ?? 0
    simBalance += (avgMonthlyRevenue + dealRevenue) - scenarioMonthlyExpenses
    if (simBalance <= 0) {
      simulatedRunway = monthOffset
      break
    }
  }

  return {
    base: {
      runway: Math.round(baseRunway * 10) / 10,
      burnRate: Math.round(baseNetBurn * 100) / 100,
      projection: baseProjection,
    },
    scenario: {
      runway: Math.round(Math.min(scenarioRunway, simulatedRunway) * 10) / 10,
      burnRate: Math.round(scenarioNetBurn * 100) / 100,
      projection: scenarioProjection,
    },
    delta: {
      runwayChange:
        Math.round(
          (Math.min(scenarioRunway, simulatedRunway) - baseRunway) * 10
        ) / 10,
      burnChange: Math.round((scenarioNetBurn - baseNetBurn) * 100) / 100,
    },
  }
}
