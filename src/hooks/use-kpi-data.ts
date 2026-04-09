'use client'
import useSWR from 'swr'
import type { KpiResponse } from '@/lib/kpi/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useKpiData(start: string, end: string, granularity?: string, entityId?: string | null) {
  const params = new URLSearchParams({ start, end })
  if (granularity) params.set('granularity', granularity)
  if (entityId) params.set('entity', entityId)

  const { data, error, isLoading, isValidating, mutate } = useSWR<KpiResponse>(
    `/api/kpi?${params.toString()}`,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  return { data, error, isLoading, isValidating, mutate }
}
