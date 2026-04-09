'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { TimeSeriesPoint } from '@/lib/kpi/types'
import { CashflowDrillPopover } from './cashflow-drill-popover'
import { format, parseISO, addDays, addWeeks, addMonths } from 'date-fns'

interface CashFlowChartProps {
  data?: TimeSeriesPoint[]
  loading?: boolean
  granularity?: 'day' | 'week' | 'month'
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const formattedDate = (() => {
    try {
      return format(parseISO(label ?? ''), 'MMM d, yyyy')
    } catch {
      return label
    }
  })()

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-5 py-3 shadow-2xl shadow-black/40">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3]">{formattedDate}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-[#7b8fa3]">
                {entry.dataKey === 'cashIn'
                  ? 'Cash In'
                  : entry.dataKey === 'cashOut'
                    ? 'Cash Out'
                    : 'Net'}
              </span>
            </div>
            <span className="text-xs font-semibold tabular-nums text-[#e8edf4]">
              {formatCompactCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatXAxisDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'MMM d')
  } catch {
    return dateStr
  }
}

function formatYAxisValue(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

function QuickMetrics({ data }: { data: TimeSeriesPoint[] }) {
  const metrics = useMemo(() => {
    const totalIn = data.reduce((sum, d) => sum + (d.cashIn ?? 0), 0)
    const totalOut = data.reduce((sum, d) => sum + (d.cashOut ?? 0), 0)
    const net = totalIn - totalOut
    const days = data.length || 1
    const dailyAvg = totalOut / days

    // Find peak day (highest single-day outflow)
    let peakDay = data[0]
    for (const d of data) {
      if ((d.cashOut ?? 0) > (peakDay?.cashOut ?? 0)) peakDay = d
    }

    return { totalIn, totalOut, net, dailyAvg, peakDay }
  }, [data])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div className="flex items-center gap-2 rounded-lg bg-[#0a1628]/60 px-3 py-2.5">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-[#7b8fa3] uppercase tracking-wider">Cash In</p>
          <p className="text-sm font-semibold text-emerald-400 tabular-nums">{formatCompactCurrency(metrics.totalIn)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-[#0a1628]/60 px-3 py-2.5">
        <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-[#7b8fa3] uppercase tracking-wider">Cash Out</p>
          <p className="text-sm font-semibold text-red-400 tabular-nums">{formatCompactCurrency(metrics.totalOut)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-[#0a1628]/60 px-3 py-2.5">
        <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-[#7b8fa3] uppercase tracking-wider">Net</p>
          <p className={`text-sm font-semibold tabular-nums ${metrics.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {metrics.net >= 0 ? '+' : ''}{formatCompactCurrency(metrics.net)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-[#0a1628]/60 px-3 py-2.5">
        <TrendingDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-[#7b8fa3] uppercase tracking-wider">Daily Avg Out</p>
          <p className="text-sm font-semibold text-amber-400 tabular-nums">{formatCompactCurrency(metrics.dailyAvg)}</p>
        </div>
      </div>
    </div>
  )
}

export function CashFlowChart({ data, loading = false, granularity = 'day' }: CashFlowChartProps) {
  const [drillData, setDrillData] = useState<{ date: string; dateTo: string; x: number; y: number } | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = useCallback((barData: any, _index: number, event: React.MouseEvent) => {
    if (!barData?.date) return
    try {
      const dateFrom = barData.date
      let dateTo: string
      const parsed = parseISO(dateFrom)
      if (granularity === 'month') {
        dateTo = format(addMonths(parsed, 1), 'yyyy-MM-dd')
      } else if (granularity === 'week') {
        dateTo = format(addWeeks(parsed, 1), 'yyyy-MM-dd')
      } else {
        dateTo = format(addDays(parsed, 1), 'yyyy-MM-dd')
      }
      setDrillData({ date: dateFrom, dateTo, x: event.clientX, y: event.clientY })
    } catch {
      // ignore invalid dates
    }
  }, [granularity])

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.3s both' }}
    >
      <div className="p-5">
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Cash Flow
        </h3>
        {!loading && data && data.length > 0 && (
          <QuickMetrics data={data} />
        )}
        {loading ? (
          <div className="flex h-[350px] items-center justify-center">
            <div className="h-full w-full rounded-lg animate-shimmer" />
          </div>
        ) : !data?.length ? (
          <div className="flex h-[350px] flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No transactions found for this period</p>
            <p className="text-xs text-[#7b8fa3] mb-3">Connect a bank account or adjust your date range.</p>
            <Link href="/dashboard/settings" className="text-xs text-blue-400 hover:text-blue-300 underline">
              Go to Settings
            </Link>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350} minWidth={0}>
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="cashInGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="cashOutGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2} />
                </linearGradient>
                {/* Accessibility patterns for colorblind users */}
                <pattern id="cashInPattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="url(#cashInGradient)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                </pattern>
                <pattern id="cashOutPattern" patternUnits="userSpaceOnUse" width="5" height="5">
                  <rect width="5" height="5" fill="url(#cashOutGradient)" />
                  <circle cx="2.5" cy="2.5" r="0.8" fill="rgba(255,255,255,0.2)" />
                </pattern>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e3050"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxisDate}
                tick={{ fill: '#7b8fa3', fontSize: 12 }}
                axisLine={{ stroke: '#1e3050', strokeOpacity: 0.5 }}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tickFormatter={formatYAxisValue}
                tick={{ fill: '#7b8fa3', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
                dx={-4}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(59,130,246,0.03)' }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconSize={7}
                wrapperStyle={{ fontSize: 11, color: '#7b8fa3', paddingBottom: 8 }}
                content={({ payload }) => (
                  <div className="flex items-center justify-end gap-4 pb-2">
                    {payload?.map((entry) => {
                      const labels: Record<string, string> = {
                        cashIn: 'Cash In',
                        cashOut: 'Cash Out',
                        netCashflow: 'Net',
                      }
                      return (
                        <div key={entry.value} className="flex items-center gap-1.5">
                          {entry.value === 'cashIn' ? (
                            <svg width="14" height="10" className="shrink-0">
                              <defs>
                                <pattern id="legendCashIn" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                                  <rect width="4" height="4" fill="#22c55e" />
                                  <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                </pattern>
                              </defs>
                              <rect width="14" height="10" rx="2" fill="url(#legendCashIn)" />
                            </svg>
                          ) : entry.value === 'cashOut' ? (
                            <svg width="14" height="10" className="shrink-0">
                              <defs>
                                <pattern id="legendCashOut" patternUnits="userSpaceOnUse" width="4" height="4">
                                  <rect width="4" height="4" fill="#ef4444" />
                                  <circle cx="2" cy="2" r="0.7" fill="rgba(255,255,255,0.35)" />
                                </pattern>
                              </defs>
                              <rect width="14" height="10" rx="2" fill="url(#legendCashOut)" />
                            </svg>
                          ) : (
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                          )}
                          <span className="text-[11px] text-[#7b8fa3]">
                            {(entry.value ? labels[entry.value] : undefined) ?? entry.value ?? ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              />
              <Bar
                dataKey="cashIn"
                fill="url(#cashInPattern)"
                radius={[4, 4, 0, 0]}
                barSize={18}
                className="cursor-pointer"
                onClick={handleBarClick}
              />
              <Bar
                dataKey="cashOut"
                fill="url(#cashOutPattern)"
                radius={[4, 4, 0, 0]}
                barSize={18}
                className="cursor-pointer"
                onClick={handleBarClick}
              />
              <Line
                type="monotone"
                dataKey="netCashflow"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#111d2e', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {drillData && (
        <CashflowDrillPopover
          date={drillData.date}
          dateTo={drillData.dateTo}
          position={{ x: drillData.x, y: drillData.y }}
          onClose={() => setDrillData(null)}
        />
      )}
    </div>
  )
}
