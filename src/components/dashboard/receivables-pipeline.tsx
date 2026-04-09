'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { TrendingUp, Target, AlertCircle } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'

type DealStage = 'pitched' | 'negotiating' | 'verbal' | 'closed_won'

interface Deal {
  id: string
  name: string
  company: string | null
  amount: number
  probability: number
  stage: DealStage
  expected_close_date: string | null
}

interface StageSummary {
  stage: DealStage
  total: number
  count: number
}

interface DealsSummary {
  totalPipeline: number
  weightedPipeline: number
  closingThisMonth: number
  byStage: StageSummary[]
}

interface DealsResponse {
  deals: Deal[]
  summary: DealsSummary
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const STAGE_CONFIG: Record<DealStage, { label: string; color: string; bg: string }> = {
  pitched: { label: 'Pitched', color: '#7b8fa3', bg: 'rgba(123,143,163,0.25)' },
  negotiating: { label: 'Negotiating', color: '#3b82f6', bg: 'rgba(59,130,246,0.25)' },
  verbal: { label: 'Verbal', color: '#f59e0b', bg: 'rgba(245,158,11,0.25)' },
  closed_won: { label: 'Won', color: '#22c55e', bg: 'rgba(34,197,94,0.25)' },
}

function StageBadge({ stage }: { stage: DealStage }) {
  const config = STAGE_CONFIG[stage]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5 space-y-5">
      <div className="h-3 w-40 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
      {/* Hero numbers */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-16 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="h-7 w-24 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
        ))}
      </div>
      {/* Bar */}
      <div className="h-6 w-full rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
      {/* Deal rows */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-3 w-32 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
              <div className="h-2.5 w-20 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            </div>
            <div className="h-3 w-16 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5">
      <h3 className="text-xs font-semibold text-[#7b8fa3] uppercase tracking-wider mb-6">
        Receivables Pipeline
      </h3>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Target className="w-8 h-8 text-[#6b7f94] mb-3" />
        <p className="text-sm text-[#7b8fa3] mb-1">No deals tracked yet.</p>
        <p className="text-xs text-[#6b7f94]">
          Add your first pitch to start tracking revenue.
        </p>
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5">
      <h3 className="text-xs font-semibold text-[#7b8fa3] uppercase tracking-wider mb-6">
        Receivables Pipeline
      </h3>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <p className="text-sm text-[#7b8fa3] mb-2">Failed to load pipeline data.</p>
        <button
          onClick={onRetry}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

function StageBar({ byStage }: { byStage: StageSummary[] }) {
  const total = byStage.reduce((sum, s) => sum + s.total, 0)
  if (total === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {byStage.map((s) => {
          const pct = (s.total / total) * 100
          if (pct < 1) return null
          const config = STAGE_CONFIG[s.stage]
          return (
            <div
              key={s.stage}
              className="relative group transition-all duration-200"
              style={{
                width: `${pct}%`,
                backgroundColor: config.bg,
                borderRight: '1px solid rgba(0,0,0,0.3)',
              }}
              title={`${config.label}: ${formatCompactCurrency(s.total)} (${s.count} deal${s.count !== 1 ? 's' : ''})`}
            >
              {pct > 12 && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold"
                  style={{ color: config.color }}
                >
                  {formatCompactCurrency(s.total)}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {byStage.map((s) => {
          const config = STAGE_CONFIG[s.stage]
          return (
            <div key={s.stage} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-[10px] text-[#6b7f94]">
                {config.label} ({s.count})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReceivablesPipeline() {
  const { data, error, isLoading, mutate } = useSWR<DealsResponse>(
    '/api/deals',
    fetcher,
    { refreshInterval: 300000 }
  )

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorState onRetry={() => mutate()} />
  if (!data || !data.deals || data.deals.length === 0) return <EmptyState />

  const { deals, summary } = data
  const topDeals = deals.slice(0, 4)

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.1s both' }}
    >
      <div className="p-5">
        <h3 className="text-xs font-semibold text-[#7b8fa3] uppercase tracking-wider mb-5">
          Receivables Pipeline
        </h3>

        {/* Hero numbers */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-1">
              Pipeline
            </p>
            <p className="text-xl lg:text-2xl font-bold text-[#e8edf4] tabular-nums tracking-tight truncate">
              {formatCompactCurrency(summary.totalPipeline)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-1">
              Weighted
            </p>
            <p className="text-xl lg:text-2xl font-bold text-blue-400 tabular-nums tracking-tight truncate">
              {formatCompactCurrency(summary.weightedPipeline)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-1">
              This Month
            </p>
            <p className="text-xl lg:text-2xl font-bold text-amber-400 tabular-nums tracking-tight truncate">
              {formatCompactCurrency(summary.closingThisMonth)}
            </p>
          </div>
        </div>

        {/* Stage bar */}
        <div className="mb-5">
          <StageBar byStage={summary.byStage} />
        </div>

        {/* Top deals */}
        <div className="space-y-0">
          <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-2">
            Top Deals
          </p>
          {topDeals.map((deal) => (
            <div
              key={deal.id}
              className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-b-0 rounded-sm hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-default px-1 -mx-1"
            >
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm font-medium text-[#e8edf4] truncate">
                  {deal.name}
                </p>
                {deal.company && (
                  <p className="text-[11px] text-[#6b7f94] truncate">{deal.company}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StageBadge stage={deal.stage} />
                <span className="text-[11px] text-[#7b8fa3] tabular-nums w-8 text-right">
                  {deal.probability}%
                </span>
                <span className="text-sm font-semibold text-[#e8edf4] tabular-nums min-w-[72px] text-right">
                  {formatCompactCurrency(deal.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* View all link */}
        <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)]">
          <Link
            href="/dashboard/deals"
            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
