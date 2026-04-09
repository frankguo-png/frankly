'use client'
import useSWR from 'swr'

interface VendorMonthlySpend {
  month: string
  spend: number
}

export interface Vendor {
  name: string
  totalSpend: number
  transactionCount: number
  avgMonthly: number
  firstSeen: string
  lastSeen: string
  topCategory: string
  trend: 'up' | 'down' | 'flat'
  monthlySpend: VendorMonthlySpend[]
}

export interface VendorSummary {
  totalVendors: number
  totalSpend: number
  avgPerVendor: number
  topVendor: string | null
}

export interface VendorResponse {
  vendors: Vendor[]
  summary: VendorSummary
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useVendorData(start?: string, end?: string) {
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)

  const queryString = params.toString()
  const url = queryString ? `/api/vendors?${queryString}` : '/api/vendors'

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<VendorResponse>(url, fetcher, {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    })

  return { data, error, isLoading, isValidating, mutate }
}
