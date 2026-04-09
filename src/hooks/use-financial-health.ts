'use client'

import { useMemo } from 'react'
import type { KpiSummary } from '@/lib/kpi/types'
import type { RunwayResult, PayrollCashAlert } from '@/lib/kpi/forecasting'

export type HealthLevel = 'healthy' | 'monitor' | 'critical'
export type BannerLevel = 'red' | 'amber' | null

export interface HealthScore {
  score: number
  level: HealthLevel
  label: string
}

export interface HealthBanner {
  level: 'red' | 'amber'
  message: string
}

interface HealthInput {
  summary?: KpiSummary | null
  runway?: RunwayResult | null
  payrollAlert?: PayrollCashAlert | null
  overdueAmount?: number
  overdueCount?: number
}

/**
 * Compute a financial health score from 0-100.
 *
 * Weights:
 *   - Runway months: 40%
 *   - Net cashflow positive/negative: 30%
 *   - Payroll % of spend: 15%
 *   - Overdue payments: 15%
 */
export function computeHealthScore(input: HealthInput): HealthScore {
  const { summary, runway, overdueAmount = 0 } = input

  // Runway score (40%): 12+ months = 100, 0 months = 0
  const runwayMonths = runway?.monthsRemaining ?? 999
  const runwayScore = Math.min(100, Math.max(0, (runwayMonths / 12) * 100))

  // Net cashflow score (30%): positive = 100, break-even = 50, very negative = 0
  let cashflowScore = 50
  if (summary) {
    if (summary.netCashflow > 0) {
      cashflowScore = 100
    } else if (summary.cashIn > 0) {
      // Ratio of net loss to revenue — the worse it is, the lower the score
      const ratio = Math.abs(summary.netCashflow) / summary.cashIn
      cashflowScore = Math.max(0, 50 - ratio * 50)
    } else if (summary.cashOut > 0) {
      cashflowScore = 0
    }
  }

  // Payroll % of spend score (15%): <50% = 100, >90% = 0
  let payrollScore = 80
  if (summary && summary.payrollPercentOfSpend > 0) {
    const pct = summary.payrollPercentOfSpend
    if (pct <= 50) {
      payrollScore = 100
    } else if (pct >= 90) {
      payrollScore = 0
    } else {
      payrollScore = Math.round(((90 - pct) / 40) * 100)
    }
  }

  // Overdue payments score (15%): $0 overdue = 100, $50K+ = 0
  let overdueScore = 100
  if (overdueAmount > 0) {
    overdueScore = Math.max(0, Math.round(100 - (overdueAmount / 50000) * 100))
  }

  const score = Math.round(
    runwayScore * 0.4 +
    cashflowScore * 0.3 +
    payrollScore * 0.15 +
    overdueScore * 0.15
  )

  let level: HealthLevel = 'healthy'
  let label = 'Healthy'
  if (score < 40) {
    level = 'critical'
    label = 'Critical'
  } else if (score <= 70) {
    level = 'monitor'
    label = 'Monitor'
  }

  return { score, level, label }
}

/**
 * Determine which warning banner(s) to show.
 */
export function computeBanners(input: HealthInput): HealthBanner | null {
  const { summary, runway, overdueAmount = 0 } = input
  const runwayMonths = runway?.monthsRemaining ?? 999
  const burnExceedsRevenue = summary
    ? summary.cashOut > summary.cashIn
    : false
  const burnExceedsRevenue50 = summary
    ? summary.cashOut > summary.cashIn * 1.5
    : false

  // RED conditions
  if (runwayMonths < 3) {
    return {
      level: 'red',
      message: `Runway is critically low at ${runwayMonths} months. Take action now.`,
    }
  }
  if (overdueAmount > 10000) {
    return {
      level: 'red',
      message: `Overdue payments exceed $${Math.round(overdueAmount / 1000)}K. Take action now.`,
    }
  }
  if (burnExceedsRevenue50) {
    return {
      level: 'red',
      message: 'Monthly burn exceeds revenue by over 50%. Take action now.',
    }
  }

  // AMBER conditions
  if (runwayMonths < 6) {
    return {
      level: 'amber',
      message: `Runway is at ${runwayMonths} months. Consider extending it.`,
    }
  }
  if (overdueAmount > 0) {
    return {
      level: 'amber',
      message: `You have overdue payments totalling $${Math.round(overdueAmount / 1000)}K.`,
    }
  }
  if (burnExceedsRevenue) {
    return {
      level: 'amber',
      message: 'Monthly burn exceeds revenue. Monitor your cash position.',
    }
  }

  return null
}

/**
 * React hook that computes health score and banner from dashboard data.
 */
export function useFinancialHealth(input: HealthInput) {
  const healthScore = useMemo(() => computeHealthScore(input), [input])
  const banner = useMemo(() => computeBanners(input), [input])
  return { healthScore, banner }
}
