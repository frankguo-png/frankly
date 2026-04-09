'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useReconciliation(months = 3) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/reconciliation?months=${months}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true }
  )

  return { data, error, isLoading, mutate }
}
