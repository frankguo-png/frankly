'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface PendingPayment {
  id: string
  vendor: string
  description: string | null
  amount: number
  due_date: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  status: 'pending' | 'overdue' | 'paid' | 'scheduled'
  category: string | null
}

interface PendingPaymentsResponse {
  payments: PendingPayment[]
  totalPending: number
  overdueCount: number
  overdueAmount: number
  totalCount: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PRIORITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444420' },
  high: { label: 'High', color: '#f59e0b', bg: '#f59e0b20' },
  normal: { label: 'Normal', color: '#7b8fa3', bg: '#7b8fa315' },
  low: { label: 'Low', color: '#6b7f94', bg: '#6b7f9415' },
}

function getRelativeDueDate(dueDateStr: string): { text: string; urgency: 'overdue' | 'soon' | 'upcoming' } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr + 'T00:00:00')
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays)
    return {
      text: `overdue ${absDays}d`,
      urgency: 'overdue',
    }
  }
  if (diffDays === 0) {
    return { text: 'due today', urgency: 'overdue' }
  }
  if (diffDays <= 7) {
    return { text: `${diffDays}d`, urgency: 'soon' }
  }
  return { text: `${diffDays}d`, urgency: 'upcoming' }
}

const URGENCY_DOT: Record<string, string> = {
  overdue: '#ef4444',
  soon: '#f59e0b',
  upcoming: '#3b82f6',
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
      <div className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.06)] animate-shimmer" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 rounded bg-[rgba(255,255,255,0.06)] animate-shimmer" />
      </div>
      <div className="h-3 w-16 rounded bg-[rgba(255,255,255,0.06)] animate-shimmer" />
      <div className="h-3 w-12 rounded bg-[rgba(255,255,255,0.06)] animate-shimmer" />
    </div>
  )
}

interface KpiSummaryResponse {
  summary?: { bankBalance?: number }
}

export function PendingPayments() {
  const { data, error, isLoading } = useSWR<PendingPaymentsResponse>(
    '/api/pending-payments',
    fetcher,
    { refreshInterval: 120000 }
  )
  const { data: kpiData } = useSWR<KpiSummaryResponse>(
    '/api/kpi?preset=this_month',
    fetcher,
    { refreshInterval: 120000 }
  )
  const cashBalance = kpiData?.summary?.bankBalance ?? 0

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.2s both' }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
            Pending Payments
          </h3>
          {!isLoading && !error && data && data.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[#ef444420] text-[#ef4444]">
              <AlertCircle className="w-3 h-3" />
              {data.overdueCount} overdue
            </span>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-1">
            <div className="h-8 w-32 rounded bg-[rgba(255,255,255,0.06)] animate-shimmer mb-3" />
            <div className="h-3 w-24 rounded bg-[rgba(255,255,255,0.06)] animate-shimmer mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-8 h-8 text-[#ef4444] mb-3" />
            <p className="text-sm text-[#7b8fa3]">Failed to load payments</p>
            <p className="text-xs text-[#6b7f94] mt-1">Please try again later.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && data && (!data.payments || data.payments.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#22c55e] mb-3" />
            <p className="text-sm text-[#e8edf4] mb-1">No pending payments</p>
            <p className="text-xs text-[#7b8fa3]">You&apos;re all clear!</p>
          </div>
        )}

        {/* Data state */}
        {!isLoading && !error && data && data.payments && data.payments.length > 0 && (
          <>
            {/* Hero number: total pending */}
            <div className="mb-4">
              <p className="text-2xl font-semibold text-[#e8edf4] tabular-nums tracking-tight">
                {formatCompactCurrency(data.totalPending)}
              </p>
              <p className="text-xs text-[#7b8fa3] mt-0.5">
                {data.totalCount} payment{data.totalCount !== 1 ? 's' : ''} pending
                {data.overdueCount > 0 && (
                  <span className="text-[#ef4444] ml-1">
                    &middot; {formatCompactCurrency(data.overdueAmount)} overdue
                  </span>
                )}
              </p>
              {cashBalance > 0 && (
                <p className={`text-xs mt-1.5 ${
                  data.totalPending / cashBalance > 0.5
                    ? 'text-red-400'
                    : data.totalPending / cashBalance > 0.3
                    ? 'text-amber-400'
                    : 'text-[#7b8fa3]'
                }`}>
                  You owe <span className="font-semibold text-[#e8edf4]">{formatCompactCurrency(data.totalPending)}</span> of <span className="font-semibold text-[#e8edf4]">{formatCompactCurrency(cashBalance)}</span> available
                  <span className="ml-1 tabular-nums">({(data.totalPending / cashBalance * 100).toFixed(0)}%)</span>
                </p>
              )}
            </div>

            {/* Payment rows */}
            <div className="space-y-0.5">
              {data.payments.map((payment) => {
                const rel = getRelativeDueDate(payment.due_date)
                const badge = PRIORITY_BADGE[payment.priority] ?? PRIORITY_BADGE.normal

                return (
                  <div
                    key={payment.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-default group"
                  >
                    {/* Status dot */}
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: URGENCY_DOT[rel.urgency] }}
                      title={rel.urgency === 'overdue' ? 'Overdue' : rel.urgency === 'soon' ? 'Due this week' : 'Upcoming'}
                    />

                    {/* Vendor name */}
                    <span className="text-sm text-[#e8edf4] truncate flex-1 min-w-0">
                      {payment.vendor}
                    </span>

                    {/* Priority badge — only for critical/high */}
                    {(payment.priority === 'critical' || payment.priority === 'high') && (
                      <span
                        className="hidden sm:inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    )}

                    {/* Due date (relative) */}
                    <span
                      className="text-xs tabular-nums shrink-0 w-[72px] text-right"
                      style={{
                        color:
                          rel.urgency === 'overdue'
                            ? '#ef4444'
                            : rel.urgency === 'soon'
                            ? '#f59e0b'
                            : '#7b8fa3',
                      }}
                    >
                      {rel.text}
                    </span>

                    {/* Amount */}
                    <span className="text-sm font-medium text-[#e8edf4] tabular-nums shrink-0 w-[80px] text-right">
                      {formatCompactCurrency(payment.amount)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Footer: show count if more items exist */}
            {data.totalCount > data.payments.length && (
              <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                <p className="text-xs text-[#6b7f94] text-center">
                  <Clock className="w-3 h-3 inline-block mr-1 -mt-px" />
                  +{data.totalCount - data.payments.length} more pending
                </p>
              </div>
            )}

            {/* View all link */}
            <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <Link
                href="/dashboard/payments"
                className="flex items-center justify-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
