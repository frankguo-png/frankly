'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, TrendingUp, TrendingDown, RefreshCw, DollarSign, ArrowUpRight } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { OpexCategoriesResponse } from '@/app/api/opex-categories/route'

interface OpexCategoriesProps {
  start: string
  end: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function TrendBadge({ change, spike }: { change: number; spike: boolean }) {
  const isUp = change > 0
  const isDown = change < 0
  const isFlat = change === 0

  if (isFlat) {
    return (
      <span className="text-[10px] tabular-nums text-[#7b8fa3]">--</span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${
        isUp ? (spike ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {Math.abs(change).toFixed(0)}%
      {spike && <AlertTriangle className="ml-0.5 h-3 w-3 text-red-400" />}
    </span>
  )
}

function OpexSkeleton() {
  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
      style={{ animation: 'slide-up 0.4s ease-out 0.4s both' }}
    >
      <div className="h-3 w-36 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer mb-4" />
      {/* Hero number skeleton */}
      <div className="mb-4">
        <div className="h-8 w-32 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
        <div className="h-3 w-20 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer mt-1.5" />
      </div>
      {/* List skeleton */}
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="h-4 w-4 rounded bg-[rgba(255,255,255,0.04)] animate-shimmer shrink-0" />
            <div className="h-3 w-20 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="flex-1" />
            <div className="h-3 w-14 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="h-3 w-8 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="h-3 w-10 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OpexCategories({ start, end }: OpexCategoriesProps) {
  const router = useRouter()
  const params = new URLSearchParams({ start, end })
  const { data, error, isLoading, mutate } = useSWR<OpexCategoriesResponse>(
    `/api/opex-categories?${params.toString()}`,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  if (isLoading) {
    return <OpexSkeleton />
  }

  if (error || (data && 'error' in data)) {
    return (
      <div
        className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
        style={{ animation: 'slide-up 0.4s ease-out 0.4s both' }}
      >
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Operating Expenses
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400/60 mb-3" />
          <p className="text-sm text-[#7b8fa3] mb-3">Failed to load expense data</p>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  const categories = data?.categories ?? []
  const topCategories = categories.slice(0, 6)
  const maxAmount = topCategories.length > 0 ? topCategories[0].amount : 0

  if (!data || categories.length === 0) {
    return (
      <div
        className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
        style={{ animation: 'slide-up 0.4s ease-out 0.4s both' }}
      >
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Operating Expenses
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <DollarSign className="w-8 h-8 text-[#6b7f94] mb-3" />
          <p className="text-sm text-[#7b8fa3] mb-1">No expense data yet</p>
          <p className="text-xs text-[#7b8fa3] mb-3">Connect accounts to see your operating expenses.</p>
          <Link href="/dashboard/settings" className="text-xs text-blue-400 hover:text-blue-300 underline">
            Go to Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
      style={{ animation: 'slide-up 0.4s ease-out 0.4s both' }}
    >
      <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
        Operating Expenses
      </h3>

      {/* Hero total */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-[#e8edf4]">
            {formatCompactCurrency(data.totalOpex)}
          </span>
          <TrendBadge change={data.totalChange} spike={data.totalChange > 20} />
        </div>
        <p className="text-[10px] text-[#7b8fa3] mt-0.5">
          {data.previousTotalOpex > 0
            ? `vs ${formatCompactCurrency(data.previousTotalOpex)} prev period`
            : 'current period total'}
        </p>
      </div>

      {/* Ranked category list */}
      <div className="space-y-1">
        {topCategories.map((cat, index) => {
          const barWidth = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0
          const isSpike = cat.monthOverMonthChange > 20

          return (
            <div
              key={cat.category}
              onClick={() => router.push(`/dashboard/transactions?category=${encodeURIComponent(cat.category)}`)}
              className="group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer"
            >
              {/* Progress bar background */}
              <div
                className="absolute inset-y-0 left-0 rounded-lg bg-[rgba(255,255,255,0.03)] transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />

              {/* Rank number */}
              <span className="relative z-10 w-4 text-[10px] font-medium tabular-nums text-[#7b8fa3] text-center shrink-0">
                {index + 1}
              </span>

              {/* Category name */}
              <span className="relative z-10 text-xs text-[#c8d6e5] truncate min-w-0 flex-1">
                {cat.category}
              </span>

              {/* Amount */}
              <span className="relative z-10 text-xs font-semibold tabular-nums text-[#e8edf4] shrink-0">
                {formatCompactCurrency(cat.amount)}
              </span>

              {/* Percentage of total */}
              <span className="relative z-10 text-[10px] tabular-nums text-[#7b8fa3] w-8 text-right shrink-0">
                {cat.percentOfTotal.toFixed(0)}%
              </span>

              {/* Trend badge */}
              <span className="relative z-10 w-12 text-right shrink-0">
                <TrendBadge change={cat.monthOverMonthChange} spike={isSpike} />
              </span>

              {/* Drill-down arrow on hover */}
              <ArrowUpRight className="relative z-10 h-3.5 w-3.5 shrink-0 text-[#7b8fa3] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          )
        })}
      </div>

      {/* Show count of remaining categories if more than 6 */}
      {categories.length > 6 && (
        <p className="text-[10px] text-[#7b8fa3] mt-2 pl-2">
          +{categories.length - 6} more categories
        </p>
      )}
    </div>
  )
}
