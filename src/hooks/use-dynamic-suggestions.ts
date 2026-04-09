'use client'

import useSWR from 'swr'
import { useMemo } from 'react'

interface KpiSummaryData {
  summary?: {
    cashIn: number
    cashOut: number
    netCashflow: number
  }
}

interface ForecastSummaryData {
  runway?: {
    monthsRemaining: number
  }
}

interface PendingPaymentsData {
  overdueCount: number
  overdueAmount: number
}

export interface DynamicSuggestion {
  title: string
  description: string
  icon: 'clock' | 'dollar' | 'cut' | 'chart'
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const DEFAULT_SUGGESTIONS: DynamicSuggestion[] = [
  {
    title: 'Give Me a Financial Health Check',
    description: 'Overall health score, risks, and recommendations',
    icon: 'clock',
  },
  {
    title: 'Show Spending Breakdown',
    description: 'Where money is going by department and category',
    icon: 'cut',
  },
  {
    title: 'What Should I Focus On This Week?',
    description: 'Top priorities, risks, and actions ranked by impact',
    icon: 'clock',
  },
  {
    title: 'What If We Close Our Top 3 Deals?',
    description: 'Model pipeline impact on runway and cash position',
    icon: 'dollar',
  },
]

export function useDynamicSuggestions(): {
  suggestions: DynamicSuggestion[]
  isLoading: boolean
} {
  const { data: forecastData, isLoading: forecastLoading } = useSWR<ForecastSummaryData>(
    '/api/forecast',
    fetcher,
    { refreshInterval: 300000, revalidateOnFocus: false }
  )

  const { data: pendingData, isLoading: pendingLoading } = useSWR<PendingPaymentsData>(
    '/api/pending-payments',
    fetcher,
    { refreshInterval: 300000, revalidateOnFocus: false }
  )

  // Use the forecast data for a quick KPI-like check (it already has runway + burn info)
  const { data: kpiData, isLoading: kpiLoading } = useSWR<KpiSummaryData>(
    '/api/kpi?preset=this_month',
    fetcher,
    { refreshInterval: 300000, revalidateOnFocus: false }
  )

  const isLoading = forecastLoading || pendingLoading || kpiLoading

  const suggestions = useMemo(() => {
    if (isLoading || (!forecastData && !pendingData && !kpiData)) {
      return DEFAULT_SUGGESTIONS
    }

    const result: DynamicSuggestion[] = []
    const runwayMonths = forecastData?.runway?.monthsRemaining ?? 999
    const overdueCount = pendingData?.overdueCount ?? 0
    const netCashflow = kpiData?.summary?.netCashflow ?? 0
    const cashIn = kpiData?.summary?.cashIn ?? 0

    // Prioritize based on financial state
    if (runwayMonths < 6) {
      result.push({
        title: 'How Do We Extend Our Runway?',
        description: `Runway is at ${runwayMonths} months — explore options`,
        icon: 'clock',
      })
    }

    if (overdueCount > 0) {
      result.push({
        title: 'What Should We Pay First?',
        description: `${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''} need attention`,
        icon: 'dollar',
      })
    }

    if (netCashflow < 0) {
      result.push({
        title: 'Where Can We Cut Costs?',
        description: 'Find savings with dollar impact on burn and runway',
        icon: 'cut',
      })
    }

    if (cashIn > 0) {
      result.push({
        title: 'What If We Close Our Top Deals?',
        description: 'Model pipeline impact on runway and cash position',
        icon: 'chart',
      })
    }

    // Fill remaining slots with defaults
    const defaultFallbacks: DynamicSuggestion[] = [
      {
        title: 'Give Me a Financial Health Check',
        description: 'Overall health score, risks, and recommendations',
        icon: 'clock',
      },
      {
        title: 'Show Spending Breakdown',
        description: 'Where money is going by department and category',
        icon: 'cut',
      },
      {
        title: 'What Should I Focus On This Week?',
        description: 'Top priorities, risks, and actions ranked by impact',
        icon: 'clock',
      },
      {
        title: 'What If We Close Our Top 3 Deals?',
        description: 'Model pipeline impact on runway and cash position',
        icon: 'dollar',
      },
    ]

    for (const fallback of defaultFallbacks) {
      if (result.length >= 4) break
      if (!result.some((r) => r.title === fallback.title)) {
        result.push(fallback)
      }
    }

    return result.slice(0, 4)
  }, [isLoading, forecastData, pendingData, kpiData])

  return { suggestions, isLoading }
}
