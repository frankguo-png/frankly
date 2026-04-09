'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { CalendarDays, AlertCircle } from 'lucide-react'
import {
  format,
  parseISO,
  isToday,
  startOfWeek,
  getDay,
  addDays,
} from 'date-fns'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { DailyCashflowPoint } from '@/app/api/daily-cashflow/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function getHeatColor(net: number, maxAbs: number): string {
  if (maxAbs === 0) return 'bg-[rgba(255,255,255,0.04)]'
  const ratio = Math.min(Math.abs(net) / maxAbs, 1)

  if (net > 0) {
    if (ratio > 0.66) return 'bg-emerald-500/60'
    if (ratio > 0.33) return 'bg-emerald-500/35'
    return 'bg-emerald-500/15'
  }
  if (net < 0) {
    if (ratio > 0.66) return 'bg-red-500/60'
    if (ratio > 0.33) return 'bg-red-500/35'
    return 'bg-red-500/15'
  }
  return 'bg-[rgba(255,255,255,0.04)]'
}

function formatNet(value: number): string {
  const prefix = value >= 0 ? '+' : ''
  return prefix + formatCompactCurrency(value)
}

interface CalendarCell {
  date: string
  dayNumber: number
  cashIn: number
  cashOut: number
  net: number
  transactionCount: number
  isPlaceholder: boolean
}

function buildCalendarGrid(data: DailyCashflowPoint[]): CalendarCell[][] {
  if (!data.length) return []

  // We want a grid that starts on Sunday of the first week
  const firstDate = parseISO(data[0].date)
  const lastDate = parseISO(data[data.length - 1].date)

  // Start from the Sunday of the week containing the first date
  const gridStart = startOfWeek(firstDate, { weekStartsOn: 0 })

  // Build a lookup map
  const dataMap = new Map<string, DailyCashflowPoint>()
  for (const d of data) {
    dataMap.set(d.date, d)
  }

  // Build rows (weeks). Each row has 7 cells (Sun-Sat)
  const rows: CalendarCell[][] = []
  let current = gridStart
  let currentRow: CalendarCell[] = []

  while (current <= lastDate || currentRow.length > 0) {
    const dateStr = format(current, 'yyyy-MM-dd')
    const point = dataMap.get(dateStr)
    const isInRange = current >= firstDate && current <= lastDate

    currentRow.push({
      date: dateStr,
      dayNumber: current.getDate(),
      cashIn: point?.cashIn ?? 0,
      cashOut: point?.cashOut ?? 0,
      net: point?.net ?? 0,
      transactionCount: point?.transactionCount ?? 0,
      isPlaceholder: !isInRange,
    })

    if (currentRow.length === 7) {
      rows.push(currentRow)
      currentRow = []
      // Stop if we've passed the last date
      if (current > lastDate) break
    }

    current = addDays(current, 1)
  }

  // Push any remaining partial row
  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      const dateStr = format(current, 'yyyy-MM-dd')
      currentRow.push({
        date: dateStr,
        dayNumber: current.getDate(),
        cashIn: 0,
        cashOut: 0,
        net: 0,
        transactionCount: 0,
        isPlaceholder: true,
      })
      current = addDays(current, 1)
    }
    rows.push(currentRow)
  }

  return rows
}

function HeatmapTooltip({ cell }: { cell: CalendarCell }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40 whitespace-nowrap">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3] mb-2">
          {format(parseISO(cell.date), 'EEE, MMM d, yyyy')}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6">
            <span className="text-xs text-[#7b8fa3]">Cash In</span>
            <span className="text-xs font-semibold tabular-nums text-emerald-400">
              {formatCompactCurrency(cell.cashIn)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-xs text-[#7b8fa3]">Cash Out</span>
            <span className="text-xs font-semibold tabular-nums text-red-400">
              {formatCompactCurrency(cell.cashOut)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-6 border-t border-[rgba(255,255,255,0.06)] pt-1 mt-1">
            <span className="text-xs text-[#7b8fa3]">Net</span>
            <span className={`text-xs font-semibold tabular-nums ${cell.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatNet(cell.net)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="text-xs text-[#7b8fa3]">Transactions</span>
            <span className="text-xs font-semibold tabular-nums text-[#e8edf4]">
              {cell.transactionCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-[rgba(255,255,255,0.04)] animate-shimmer"
          />
        ))}
      </div>
      <div className="flex items-center gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 w-32 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <CalendarDays className="w-8 h-8 text-[#6b7f94] mb-3" />
      <p className="text-sm text-[#7b8fa3] mb-1">No daily cashflow data</p>
      <p className="text-xs text-[#7b8fa3]">
        Connect a bank account to see your daily activity.
      </p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertCircle className="w-8 h-8 text-red-400/70 mb-3" />
      <p className="text-sm text-[#7b8fa3] mb-1">Failed to load daily cashflow</p>
      <button
        onClick={onRetry}
        className="text-xs text-blue-400 hover:text-blue-300 underline"
      >
        Retry
      </button>
    </div>
  )
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DailyCashflow() {
  const { data, error, isLoading, mutate } = useSWR<DailyCashflowPoint[]>(
    '/api/daily-cashflow?days=30',
    fetcher,
    { refreshInterval: 300_000 }
  )

  const router = useRouter()

  const grid = useMemo(() => {
    if (!data?.length) return []
    return buildCalendarGrid(data)
  }, [data])

  const maxAbsNet = useMemo(() => {
    if (!data?.length) return 0
    return Math.max(...data.map(d => Math.abs(d.net)), 1)
  }, [data])

  const summaryStats = useMemo(() => {
    if (!data?.length) return null

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayData = data.find(d => d.date === todayStr)

    // This week: from most recent Sunday
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 0 })
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    let weekNet = 0
    for (const d of data) {
      if (d.date >= weekStartStr && d.date <= todayStr) {
        weekNet += d.net
      }
    }

    // Best day
    let bestDay = data[0]
    for (const d of data) {
      if (d.net > bestDay.net) bestDay = d
    }

    return { todayData, weekNet, bestDay }
  }, [data])

  const handleCellClick = (cell: CalendarCell) => {
    if (cell.isPlaceholder) return
    router.push(`/dashboard/daily?date=${cell.date}`)
  }

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.35s both' }}
    >
      <div className="p-5">
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Daily Cashflow
        </h3>

        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState onRetry={() => mutate()} />
        ) : !data?.length ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {/* Day-of-week labels */}
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map(label => (
                <div
                  key={label}
                  className="text-center text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider pb-1"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {grid.flat().map((cell) => {
                const todayHighlight = isToday(parseISO(cell.date))
                const heatColor = cell.isPlaceholder
                  ? 'bg-transparent'
                  : getHeatColor(cell.net, maxAbsNet)

                return (
                  <div
                    key={cell.date}
                    className={`group relative aspect-square rounded-lg flex items-center justify-center transition-all ${
                      cell.isPlaceholder
                        ? 'cursor-default'
                        : 'cursor-pointer hover:ring-1 hover:ring-[rgba(255,255,255,0.15)]'
                    } ${heatColor} ${
                      todayHighlight
                        ? 'ring-2 ring-blue-400/70'
                        : ''
                    }`}
                    onClick={() => handleCellClick(cell)}
                  >
                    {!cell.isPlaceholder && (
                      <>
                        <span
                          className={`text-[11px] tabular-nums ${
                            todayHighlight
                              ? 'font-semibold text-blue-300'
                              : 'font-medium text-[#c0cdd8]'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {/* Tooltip on hover */}
                        <div className="hidden group-hover:block">
                          <HeatmapTooltip cell={cell} />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <span className="text-[10px] text-[#7b8fa3] mr-1">Less</span>
              <div className="w-3 h-3 rounded-sm bg-red-500/60" />
              <div className="w-3 h-3 rounded-sm bg-red-500/35" />
              <div className="w-3 h-3 rounded-sm bg-red-500/15" />
              <div className="w-3 h-3 rounded-sm bg-[rgba(255,255,255,0.04)]" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/15" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/35" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
              <span className="text-[10px] text-[#7b8fa3] ml-1">More</span>
            </div>

            {/* Summary row */}
            {summaryStats && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                <div className="text-xs text-[#7b8fa3]">
                  <span className="text-[#e8edf4] font-medium">Today: </span>
                  {summaryStats.todayData ? (
                    <>
                      <span className={summaryStats.todayData.net >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {formatNet(summaryStats.todayData.net)}
                      </span>
                      <span className="text-[#7b8fa3]">
                        {' '}({summaryStats.todayData.transactionCount} txns)
                      </span>
                    </>
                  ) : (
                    <span className="text-[#7b8fa3]">No data</span>
                  )}
                </div>
                <div className="text-xs text-[#7b8fa3]">
                  <span className="text-[#e8edf4] font-medium">This week: </span>
                  <span className={summaryStats.weekNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatNet(summaryStats.weekNet)}
                  </span>
                </div>
                <div className="text-xs text-[#7b8fa3]">
                  <span className="text-[#e8edf4] font-medium">Best day: </span>
                  <span className="text-emerald-400">
                    {format(parseISO(summaryStats.bestDay.date), 'MMM d')} ({formatNet(summaryStats.bestDay.net)})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
