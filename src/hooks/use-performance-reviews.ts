'use client'
import useSWR from 'swr'
import type { PerformanceReviewsResponse } from '@/app/api/performance-reviews/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function usePerformanceReviews() {
  const { data, error, isLoading, mutate } = useSWR<PerformanceReviewsResponse>(
    '/api/performance-reviews',
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true }
  )

  return { data, error, isLoading, mutate }
}
