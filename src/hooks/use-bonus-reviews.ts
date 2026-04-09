'use client'
import useSWR from 'swr'
import type { BonusReviewsResponse } from '@/app/api/bonus-reviews/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useBonusReviews() {
  const { data, error, isLoading, mutate } = useSWR<BonusReviewsResponse>(
    '/api/bonus-reviews',
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true }
  )

  return { data, error, isLoading, mutate }
}
