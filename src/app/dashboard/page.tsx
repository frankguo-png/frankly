'use client'

import { Suspense, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import type { BudgetLineItem } from '@/lib/kpi/budget'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { HealthBanner } from '@/components/dashboard/health-banner'
import { HealthScoreBadge } from '@/components/dashboard/health-score-badge'
import { TimeFilter } from '@/components/filters/time-filter'
import { EntityFilter } from '@/components/filters/entity-filter'
import { useTimeFilter } from '@/hooks/use-time-filter'
import { useEntityFilter } from '@/hooks/use-entity-filter'
import { useKpiData } from '@/hooks/use-kpi-data'
import { useForecastData } from '@/hooks/use-forecast-data'
import { useFinancialHealth } from '@/hooks/use-financial-health'
import { Skeleton } from '@/components/ui/skeleton'
import { ExportButton, type ReportData } from '@/components/export/export-button'
import { DataTimestamp } from '@/components/dashboard/data-timestamp'
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist'

// Lazy-load heavy chart components (Recharts ~70KB, ReactFlow ~150KB)
const CashFlowChart = dynamic(() => import('@/components/dashboard/cash-flow-chart').then(m => ({ default: m.CashFlowChart })), { ssr: false })
const SpendByDepartment = dynamic(() => import('@/components/dashboard/spend-by-department').then(m => ({ default: m.SpendByDepartment })), { ssr: false })
const SpendByProject = dynamic(() => import('@/components/dashboard/spend-by-project').then(m => ({ default: m.SpendByProject })), { ssr: false })
const SpendByAgent = dynamic(() => import('@/components/dashboard/spend-by-agent').then(m => ({ default: m.SpendByAgent })), { ssr: false })
const OpexCategories = dynamic(() => import('@/components/dashboard/opex-categories').then(m => ({ default: m.OpexCategories })), { ssr: false })
const BudgetVsActual = dynamic(() => import('@/components/dashboard/budget-vs-actual').then(m => ({ default: m.BudgetVsActual })), { ssr: false })
const ForecastChart = dynamic(() => import('@/components/dashboard/forecast-chart').then(m => ({ default: m.ForecastChart })), { ssr: false })
const RunwayCard = dynamic(() => import('@/components/dashboard/runway-card').then(m => ({ default: m.RunwayCard })), { ssr: false })
const PayrollAlert = dynamic(() => import('@/components/dashboard/payroll-alert').then(m => ({ default: m.PayrollAlert })), { ssr: false })
const CurrencyWidget = dynamic(() => import('@/components/dashboard/currency-widget').then(m => ({ default: m.CurrencyWidget })), { ssr: false })
const PendingPayments = dynamic(() => import('@/components/dashboard/pending-payments').then(m => ({ default: m.PendingPayments })), { ssr: false })
const ReceivablesPipeline = dynamic(() => import('@/components/dashboard/receivables-pipeline').then(m => ({ default: m.ReceivablesPipeline })), { ssr: false })
const OrgChart = dynamic(() => import('@/components/dashboard/org-chart').then(m => ({ default: m.OrgChart })), { ssr: false })
const ReportView = dynamic(() => import('@/components/export/report-view').then(m => ({ default: m.ReportView })), { ssr: false })

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-[rgba(255,255,255,0.04)] animate-shimmer ${className ?? ''}`} style={style} />
}

function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBlock className="h-4 w-28 rounded-md" />
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(59,130,246,0.2), rgba(255,255,255,0.06), transparent)' }} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-12">
      {/* Section 1: Cash Position */}
      <div className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="space-y-6">
          {/* KPI Grid — 8 cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-5 space-y-3">
                <SkeletonBlock className="h-3 w-20 rounded-md" />
                <SkeletonBlock className="h-8 w-28 rounded-md" />
                <SkeletonBlock className="h-3 w-16 rounded-md" />
              </div>
            ))}
          </div>
          {/* Runway + Payroll row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* RunwayCard skeleton */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-3 w-24 rounded-md" />
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </div>
              <SkeletonBlock className="h-10 w-32 rounded-md" />
              <SkeletonBlock className="h-3 w-48 rounded-md" />
              <SkeletonBlock className="h-[50px] w-full rounded-md" />
              <SkeletonBlock className="h-3 w-36 rounded-md" />
            </div>
            {/* PayrollAlert skeleton */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-6 space-y-3">
              <SkeletonBlock className="h-3 w-28 rounded-md" />
              <SkeletonBlock className="h-8 w-36 rounded-md" />
              <SkeletonBlock className="h-3 w-44 rounded-md" />
              <SkeletonBlock className="h-[50px] w-full rounded-md" />
            </div>
          </div>
          {/* CurrencyWidget skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-40 rounded-md" />
              <SkeletonBlock className="h-6 w-24 rounded-full" />
            </div>
            <SkeletonBlock className="h-10 w-32 rounded-md" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.04)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <SkeletonBlock className="h-3.5 w-28 rounded-md" />
                      <SkeletonBlock className="h-2.5 w-20 rounded-md" />
                    </div>
                  </div>
                  <SkeletonBlock className="h-3.5 w-20 rounded-md" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <SkeletonBlock className="h-6 w-28 rounded-full" />
              <SkeletonBlock className="h-6 w-28 rounded-full" />
            </div>
          </div>
          {/* PendingPayments skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-32 rounded-md" />
              <SkeletonBlock className="h-5 w-20 rounded-full" />
            </div>
            <SkeletonBlock className="h-8 w-28 rounded-md" />
            <SkeletonBlock className="h-3 w-40 rounded-md" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <SkeletonBlock className="h-2 w-2 rounded-full" />
                  <SkeletonBlock className="h-3 w-28 rounded-md flex-1" />
                  <SkeletonBlock className="h-3 w-12 rounded-md" />
                  <SkeletonBlock className="h-3 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Revenue & Forecast */}
      <div className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="space-y-6">
          {/* ReceivablesPipeline skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-5 space-y-4">
            <SkeletonBlock className="h-3 w-36 rounded-md" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonBlock className="h-2.5 w-16 rounded-md" />
                  <SkeletonBlock className="h-6 w-24 rounded-md" />
                </div>
              ))}
            </div>
            <SkeletonBlock className="h-6 w-full rounded-full" />
          </div>
          {/* CashFlowChart skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-6 space-y-4">
            <SkeletonBlock className="h-3 w-32 rounded-md" />
            <div className="relative h-[300px] w-full rounded-md overflow-hidden">
              <SkeletonBlock className="absolute inset-0 rounded-md" />
              {/* Faint grid lines */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-[rgba(255,255,255,0.03)]" style={{ top: `${(i + 1) * 20}%` }} />
              ))}
            </div>
          </div>
          {/* ForecastChart skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-40 rounded-md" />
              <div className="flex items-center gap-4">
                <SkeletonBlock className="h-2 w-16 rounded-md" />
                <SkeletonBlock className="h-2 w-16 rounded-md" />
              </div>
            </div>
            <div className="relative h-[300px] w-full rounded-md overflow-hidden">
              <SkeletonBlock className="absolute inset-0 rounded-md" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-[rgba(255,255,255,0.03)]" style={{ top: `${(i + 1) * 20}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Spend Analysis */}
      <div className="space-y-4">
        <SectionHeaderSkeleton />
        <div className="space-y-6">
          {/* BudgetVsActual skeleton */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 px-6 pt-5 pb-5 space-y-4">
            <SkeletonBlock className="h-3 w-32 rounded-md" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <SkeletonBlock className="h-3 w-24 rounded-md" />
                  <SkeletonBlock className="h-4 w-20 rounded-full" />
                </div>
                <SkeletonBlock className="h-5 w-full rounded-md" />
                <SkeletonBlock className="h-5 rounded-md" style={{ width: `${65 - i * 10}%` } as React.CSSProperties} />
              </div>
            ))}
          </div>
          {/* 3-column spend charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {/* SpendByDepartment skeleton */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 px-6 pt-5 pb-5">
              <SkeletonBlock className="h-3 w-36 rounded-md mb-4" />
              <div className="flex flex-col items-center gap-4">
                <SkeletonBlock className="h-[160px] w-[160px] shrink-0 rounded-full" />
                <div className="flex w-full flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
                        <SkeletonBlock className="h-3 w-16 rounded-md" />
                      </div>
                      <SkeletonBlock className="h-3 w-12 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* SpendByProject skeleton */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 px-6 pt-5 pb-5">
              <SkeletonBlock className="h-3 w-32 rounded-md mb-4" />
              <div className="flex flex-col items-center gap-4">
                <SkeletonBlock className="h-[160px] w-[160px] shrink-0 rounded-full" />
                <div className="flex w-full flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
                        <SkeletonBlock className="h-3 w-16 rounded-md" />
                      </div>
                      <SkeletonBlock className="h-3 w-12 rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* SpendByAgent skeleton */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 px-6 pt-5 pb-5">
              <SkeletonBlock className="h-3 w-28 rounded-md mb-4" />
              <div className="space-y-4 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <SkeletonBlock className="h-3 w-24 rounded-md shrink-0" />
                    <SkeletonBlock className="h-6 rounded-md" style={{ width: `${85 - i * 15}%` } as React.CSSProperties} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const budgetFetcher = (url: string) => fetch(url).then(r => r.json())

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[13px] font-semibold text-[#7b8fa3] uppercase tracking-wider">{title}</h2>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(59,130,246,0.2), rgba(255,255,255,0.06), transparent)' }} />
    </div>
  )
}

interface PendingPaymentsSummary {
  overdueCount: number
  overdueAmount: number
  totalPending: number
  totalCount: number
}

function DashboardTimestamp() {
  const { start, end, granularity } = useTimeFilter()
  const { entityId } = useEntityFilter()
  const { data, isValidating, mutate } = useKpiData(start, end, granularity, entityId)
  return <DataTimestamp isValidating={isValidating} mutate={() => mutate()} hasData={!!data} />
}

function DashboardHealthBadge() {
  const { start, end, granularity } = useTimeFilter()
  const { entityId } = useEntityFilter()
  const { data } = useKpiData(start, end, granularity, entityId)
  const { data: forecast } = useForecastData()
  const { data: pendingData } = useSWR<PendingPaymentsSummary>(
    '/api/pending-payments',
    budgetFetcher,
    { refreshInterval: 300000 }
  )

  const { healthScore } = useFinancialHealth({
    summary: data?.summary,
    runway: forecast?.runway,
    payrollAlert: forecast?.payrollAlert,
    overdueAmount: pendingData?.overdueAmount ?? 0,
    overdueCount: pendingData?.overdueCount ?? 0,
  })

  // Don't render until we have at least some data
  if (!data && !forecast) return null

  return <HealthScoreBadge health={healthScore} />
}

function DashboardContent() {
  const { start, end, granularity } = useTimeFilter()
  const { entityId } = useEntityFilter()
  const { data, isLoading, isValidating, mutate } = useKpiData(start, end, granularity, entityId)
  const { data: forecast, error: forecastError, isLoading: forecastLoading, mutate: mutateForecast } = useForecastData()

  const month = useMemo(() => getCurrentMonth(), [])
  const { data: budgetRes, isLoading: budgetLoading } = useSWR<{ comparison: BudgetLineItem[] }>(
    `/api/budgets?month=${month}`,
    budgetFetcher,
    { refreshInterval: 300000 }
  )

  const { data: pendingData } = useSWR<PendingPaymentsSummary>(
    '/api/pending-payments',
    budgetFetcher,
    { refreshInterval: 300000 }
  )

  const { healthScore, banner } = useFinancialHealth({
    summary: data?.summary,
    runway: forecast?.runway,
    payrollAlert: forecast?.payrollAlert,
    overdueAmount: pendingData?.overdueAmount ?? 0,
    overdueCount: pendingData?.overdueCount ?? 0,
  })

  return (
    <div className="space-y-12">
      {/* Health Warning Banner */}
      {banner && <HealthBanner banner={banner} />}
      {/* Section 1: Cash Position */}
      <div id="cash-position" className="space-y-4">
        <SectionHeader title="Cash Position" />
        <div className="space-y-6">
          <KpiGrid />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RunwayCard
              runway={forecast?.runway}
              burnTrend={forecast?.burnTrend}
              cashForecast={forecast?.cashForecast}
              loading={forecastLoading}
            />
            <PayrollAlert data={forecast?.payrollAlert} loading={forecastLoading} />
          </div>
          <CurrencyWidget />
          <PendingPayments />
        </div>
      </div>

      {/* Section 2: Revenue & Forecast */}
      <div id="revenue-forecast" className="space-y-4">
        <SectionHeader title="Revenue & Forecast" />
        <div className="space-y-6">
          <ReceivablesPipeline />
          <CashFlowChart data={data?.timeSeries} loading={isLoading} granularity={granularity} />
          <ForecastChart data={forecast?.cashForecast} loading={forecastLoading} error={forecastError} onRetry={() => mutateForecast()} />
        </div>
      </div>

      {/* Section 3: Spend Analysis */}
      <div id="spend-analysis" className="space-y-4">
        <SectionHeader title="Spend Analysis" />
        <div className="space-y-6">
          <BudgetVsActual data={budgetRes?.comparison} loading={budgetLoading} />
          <OpexCategories start={start} end={end} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SpendByDepartment data={data?.spendByDepartment} loading={isLoading} />
            <SpendByProject data={data?.spendByProject} loading={isLoading} />
            <SpendByAgent data={data?.spendByAgent} loading={isLoading} />
          </div>
        </div>
      </div>

      {/* Section 4: Team */}
      <div id="team" className="space-y-4">
        <SectionHeader title="Team" />
        <div className="space-y-6">
          <OrgChart />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)

  const handleReportData = useCallback((data: ReportData) => {
    setReportData(data)
  }, [])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-[#e8edf4]">
              Dashboard
            </h1>
            <Suspense fallback={null}>
              <DashboardHealthBadge />
            </Suspense>
          </div>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Your financial overview at a glance.
          </p>
          <Suspense fallback={null}>
            <DashboardTimestamp />
          </Suspense>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ExportButton onReportData={handleReportData} />
          <Suspense fallback={null}>
            <EntityFilter />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-8 w-96 rounded-lg animate-shimmer" />}>
            <TimeFilter />
          </Suspense>
        </div>
      </div>

      {/* Onboarding checklist — shown above dashboard when setup is incomplete */}
      <OnboardingChecklist />

      {/* Main content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>

      {reportData && (
        <ReportView data={reportData} onClose={() => setReportData(null)} />
      )}
    </div>
  )
}
