'use client'
import useSWR from 'swr'
import type {
  RunwayResult,
  BurnTrendPoint,
  CashForecastPoint,
  PayrollCashAlert,
} from '@/lib/kpi/forecasting'

interface ForecastResponse {
  runway: RunwayResult
  burnTrend: BurnTrendPoint[]
  cashForecast: CashForecastPoint[]
  payrollAlert: PayrollCashAlert
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useForecastData() {
  const { data, error, isLoading, mutate } = useSWR<ForecastResponse>(
    '/api/forecast',
    fetcher,
    { refreshInterval: 300000 }
  )

  return { data, error, isLoading, mutate }
}
