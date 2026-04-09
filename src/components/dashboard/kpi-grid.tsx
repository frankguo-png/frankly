'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { KpiCard } from './kpi-card'
import { useKpiData } from '@/hooks/use-kpi-data'
import { useTimeFilter } from '@/hooks/use-time-filter'
import { Settings, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function KpiGrid() {
  const router = useRouter()
  const { start, end, granularity } = useTimeFilter()
  const { data, error, isLoading, mutate } = useKpiData(start, end, granularity)
  const isEmpty = !isLoading && !error && (!data?.summary || (data.summary.cashIn === 0 && data.summary.cashOut === 0 && data.summary.bankBalance === 0))

  const navigateToTransactions = useCallback((params: Record<string, string>) => {
    const searchParams = new URLSearchParams(params)
    router.push(`/dashboard/transactions?${searchParams.toString()}`)
  }, [router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-red-400 text-sm mb-3">Failed to load financial data</p>
        <button onClick={() => mutate()} className="text-xs text-blue-400 hover:text-blue-300 underline">
          Try again
        </button>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#111d2e]/50 backdrop-blur-sm px-8 py-8 animate-fade-in">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]">
          <Settings className="h-7 w-7 text-blue-400" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-[#e8edf4]">
          No financial data yet
        </h3>
        <p className="mb-6 max-w-sm text-center text-sm text-[#5a6d82]">
          Connect your bank account to see real-time cash flow, spending breakdowns, and financial KPIs.
        </p>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:shadow-[0_0_24px_-3px_rgba(59,130,246,0.5)] hover:-translate-y-0.5"
        >
          Go to Settings
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const summary = data?.summary
  const priorSummary = data?.priorSummary

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
      <KpiCard
        title="Cash In"
        value={summary?.cashIn ?? 0}
        previousValue={priorSummary?.cashIn}
        format="currency"
        color="green"
        loading={isLoading}
        index={0}
        tooltip="Total money received this period from all connected accounts"
        onClick={() => navigateToTransactions({ type: 'credit' })}
      />
      <KpiCard
        title="Cash Out"
        value={summary?.cashOut ?? 0}
        previousValue={priorSummary?.cashOut}
        format="currency"
        color="red"
        invertTrend
        loading={isLoading}
        index={1}
        tooltip="Total money spent this period across all connected accounts"
        onClick={() => navigateToTransactions({ type: 'debit' })}
      />
      <KpiCard
        title="Net Cashflow"
        value={summary?.netCashflow ?? 0}
        previousValue={priorSummary?.netCashflow}
        format="currency"
        color="blue"
        loading={isLoading}
        index={2}
        tooltip="Cash In minus Cash Out. Positive means more money coming in than going out"
      />
      <KpiCard
        title="Net Burn"
        value={summary?.netBurn ?? 0}
        previousValue={priorSummary?.netBurn}
        format="currency"
        color="amber"
        invertTrend
        loading={isLoading}
        index={3}
        tooltip="Net cash decrease per month. Excludes one-time income to show true operational burn"
      />
      <KpiCard
        title="Bank Balance"
        value={summary?.bankBalance ?? 0}
        format="currency"
        color="blue"
        loading={isLoading}
        index={4}
        tooltip="Current total balance across all connected bank accounts"
      />
      <KpiCard
        title="Payroll Total"
        value={summary?.payrollTotal ?? 0}
        previousValue={priorSummary?.payrollTotal}
        format="currency"
        color="purple"
        invertTrend
        loading={isLoading}
        index={5}
        tooltip="Total payroll expense this period including salaries from connected payroll provider"
        onClick={() => navigateToTransactions({ category: 'Payroll' })}
      />
      <KpiCard
        title="Payroll %"
        value={summary?.payrollPercentOfSpend ?? 0}
        previousValue={priorSummary?.payrollPercentOfSpend}
        format="percentage"
        color="purple"
        invertTrend
        loading={isLoading}
        index={6}
        tooltip="Payroll as a percentage of total spend. High % may indicate over-reliance on headcount costs"
        onClick={() => navigateToTransactions({ category: 'Payroll' })}
      />
      <KpiCard
        title="Tools & Software"
        value={summary?.toolsAndSoftware ?? 0}
        previousValue={priorSummary?.toolsAndSoftware}
        format="currency"
        color="gray"
        invertTrend
        loading={isLoading}
        index={7}
        tooltip="Total spend on software subscriptions and tools this period"
        onClick={() => navigateToTransactions({ category: 'Tools & Software' })}
      />
    </div>
  )
}
