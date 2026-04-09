'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { ArrowUpRight, Target } from 'lucide-react'
import Link from 'next/link'
import type { BudgetLineItem } from '@/lib/kpi/budget'

interface BudgetVsActualProps {
  data?: BudgetLineItem[]
  loading?: boolean
}

const STATUS_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  under: { bar: '#22c55e', text: '#4ade80', bg: 'rgba(34,197,94,0.08)' },
  over: { bar: '#ef4444', text: '#f87171', bg: 'rgba(239,68,68,0.08)' },
  on_track: { bar: '#3b82f6', text: '#60a5fa', bg: 'rgba(59,130,246,0.08)' },
}

function formatVariance(variance: number): string {
  const abs = Math.abs(variance)
  const formatted = formatCompactCurrency(abs)
  if (variance > 0) return `+${formatted} over`
  if (variance < 0) return `-${formatted} under`
  return 'On budget'
}

export function BudgetVsActual({ data, loading = false }: BudgetVsActualProps) {
  const router = useRouter()
  const maxAmount = data?.reduce(
    (max, item) => Math.max(max, item.budget, item.actual),
    0
  ) ?? 0

  const handleCategoryClick = useCallback((categoryName: string) => {
    const params = new URLSearchParams({ category: categoryName })
    router.push(`/dashboard/transactions?${params.toString()}`)
  }, [router])

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.2s both' }}
    >
      <div className="p-5">
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Budget vs Actual
        </h3>
        {loading ? (
          <div className="space-y-4 pt-2">
            {[90, 75, 60, 45].map((budgetW, i) => (
              <div key={i} className="space-y-1.5 rounded-lg px-2 py-2 -mx-2">
                {/* Label row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="h-3 w-24 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                  <div className="h-4 w-20 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                </div>
                {/* Budget bar */}
                <div className="relative h-5 w-full rounded-md bg-[#0d1a2d]/60 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" style={{ width: `${budgetW}%` }} />
                </div>
                {/* Actual bar */}
                <div className="relative h-5 w-full rounded-md bg-[#0d1a2d]/60 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" style={{ width: `${budgetW - 15}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.length ? (
          <div className="flex h-[280px] flex-col items-center justify-center py-8 text-center">
            <Target className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No budgets set for this month</p>
            <p className="text-xs text-[#7b8fa3] mb-3">Create a budget to track spending against targets.</p>
            <Link href="/dashboard/budgets" className="text-xs text-blue-400 hover:text-blue-300 underline">
              Go to Budgets
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {data.map((item) => {
              const colors = STATUS_COLORS[item.status]
              const budgetWidth = maxAmount > 0 ? (item.budget / maxAmount) * 100 : 0
              const actualWidth = maxAmount > 0 ? (item.actual / maxAmount) * 100 : 0

              return (
                <div
                  key={item.name}
                  className="group/row cursor-pointer rounded-lg px-2 py-2 -mx-2 transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)]"
                  onClick={() => handleCategoryClick(item.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCategoryClick(item.name) }}
                >
                  {/* Label row */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs font-medium text-[#9baab8] group-hover/row:text-[#e8edf4] transition-colors duration-200 truncate">
                        {item.name}
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-[#6b7f94] opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 shrink-0" />
                    </div>
                    <span
                      className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                      style={{ color: colors.text, backgroundColor: colors.bg }}
                    >
                      {formatVariance(item.variance)}
                    </span>
                  </div>

                  {/* Bars */}
                  <div className="space-y-1">
                    {/* Budget bar (gray) */}
                    <div className="relative h-5 w-full rounded-md bg-[#0d1a2d]/60 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-[#1e2d40] transition-all duration-500 ease-out"
                        style={{ width: `${budgetWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[10px] font-medium text-[#7b8fa3] tabular-nums">
                          Budget: {formatCompactCurrency(item.budget)}
                        </span>
                      </div>
                    </div>

                    {/* Actual bar (colored + striped pattern for accessibility) */}
                    <div className="relative h-5 w-full rounded-md bg-[#0d1a2d]/60 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out"
                        style={{
                          width: `${actualWidth}%`,
                          backgroundColor: colors.bar,
                          opacity: 0.7,
                        }}
                      />
                      {/* Subtle diagonal stripe overlay for colorblind differentiation */}
                      <svg className="absolute inset-y-0 left-0 h-full rounded-md overflow-hidden" style={{ width: `${actualWidth}%` }} aria-hidden="true">
                        <defs>
                          <pattern id={`actualStripe-${item.name}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#actualStripe-${item.name})`} />
                      </svg>
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[10px] font-medium text-[#e8edf4] tabular-nums">
                          Actual: {formatCompactCurrency(item.actual)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
