'use client'

import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { CashForecastPoint } from '@/lib/kpi/forecasting'

interface ForecastChartProps {
  data?: CashForecastPoint[]
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; payload: Record<string, unknown> }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload
  const isForecast = point.is_forecast as boolean

  const formattedMonth = (() => {
    try {
      const [year, month] = (label ?? '').split('-')
      return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return label
    }
  })()

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3]">
        {formattedMonth}
      </p>
      {!isForecast ? (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          <span className="text-xs text-[#7b8fa3]">Actual</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-[#e8edf4]">
            {formatCompactCurrency(point.actual as number)}
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#22c55e]" />
            <span className="text-xs text-[#7b8fa3]">Best</span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-[#e8edf4]">
              {formatCompactCurrency(point.best as number)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
            <span className="text-xs text-[#7b8fa3]">Base</span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-[#e8edf4]">
              {formatCompactCurrency(point.base as number)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#ef4444]" />
            <span className="text-xs text-[#7b8fa3]">Worst</span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-[#e8edf4]">
              {formatCompactCurrency(point.worst as number)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatXAxisMonth(monthStr: string) {
  try {
    const [year, month] = monthStr.split('-')
    return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
      month: 'short',
    })
  } catch {
    return monthStr
  }
}

function formatYAxisValue(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export function ForecastChart({ data, loading = false, error, onRetry }: ForecastChartProps) {
  // Split data into actuals and forecast for different styling
  const actuals = useMemo(() => data?.filter((d) => !d.is_forecast) ?? [], [data])
  const forecasts = useMemo(() => data?.filter((d) => d.is_forecast) ?? [], [data])

  // For the chart, we need a combined dataset with separate keys
  const chartData = useMemo(() => (data ?? []).map((point) => ({
    month: point.month,
    is_forecast: point.is_forecast,
    actual: point.is_forecast ? undefined : point.projected_balance,
    base: point.is_forecast ? point.base : undefined,
    best: point.is_forecast ? point.best : undefined,
    worst: point.is_forecast ? point.worst : undefined,
    // Bridge point: last actual appears in forecast series for line continuity
    ...(point === actuals[actuals.length - 1] && forecasts.length > 0
      ? {
          base: point.projected_balance,
          best: point.projected_balance,
          worst: point.projected_balance,
        }
      : {}),
  })), [data, actuals, forecasts])

  // Find the lowest forecast point (worst case)
  const lowestForecast = forecasts.length > 0
    ? forecasts.reduce((min, p) => {
        const worstVal = p.worst ?? p.projected_balance
        const minVal = min.worst ?? min.projected_balance
        return worstVal < minVal ? p : min
      }, forecasts[0])
    : null

  const lowestValue = lowestForecast
    ? (lowestForecast.worst ?? lowestForecast.projected_balance)
    : null

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.4s both' }}
    >
      <div className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider shrink-0">
            Cash Position Forecast
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#7b8fa3]">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-sm bg-[#3b82f6] shrink-0" />
              Actual
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-4 rounded-sm bg-[#3b82f6] opacity-60 shrink-0" />
              Base
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-4 rounded-sm shrink-0"
                style={{
                  background: 'repeating-linear-gradient(90deg, #22c55e 0, #22c55e 3px, transparent 3px, transparent 6px)',
                }}
              />
              Best
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-4 rounded-sm shrink-0"
                style={{
                  background: 'repeating-linear-gradient(90deg, #ef4444 0, #ef4444 3px, transparent 3px, transparent 6px)',
                }}
              />
              Worst
            </div>
          </div>
        </div>
        {error ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <p className="text-red-400 text-sm mb-3">Failed to load forecast data</p>
            {onRetry && (
              <button onClick={onRetry} className="text-xs text-blue-400 hover:text-blue-300 underline">
                Try again
              </button>
            )}
          </div>
        ) : loading ? (
          <div className="relative h-[300px] w-full rounded-md overflow-hidden">
            <div className="absolute inset-0 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            {/* Faint grid lines */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-[rgba(255,255,255,0.03)]" style={{ top: `${(i + 1) * 20}%` }} />
            ))}
            {/* X-axis ticks */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-between px-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-2 w-8 rounded-md bg-[rgba(255,255,255,0.03)]" />
              ))}
            </div>
          </div>
        ) : !data?.length ? (
          <div className="flex h-[300px] flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">Not enough data to generate a forecast</p>
            <p className="text-xs text-[#7b8fa3]">At least 2 months of transaction history is needed.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300} minWidth={0}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="bestGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="worstGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e3050"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickFormatter={formatXAxisMonth}
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
                cursor={{ stroke: 'rgba(59,130,246,0.15)' }}
              />
              <ReferenceLine
                y={0}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                label={{
                  value: 'Danger Zone',
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 10,
                  opacity: 0.7,
                }}
              />
              {/* Best case band — rendered first so it's behind */}
              <Area
                type="monotone"
                dataKey="best"
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                fill="url(#bestGradient)"
                connectNulls={false}
              />
              {/* Worst case band */}
              <Area
                type="monotone"
                dataKey="worst"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                fill="url(#worstGradient)"
                connectNulls={false}
              />
              {/* Actual historical data */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#actualGradient)"
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                connectNulls={false}
              />
              {/* Base case forecast — on top as primary focus */}
              <Area
                type="monotone"
                dataKey="base"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="none"
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {lowestValue != null && lowestValue < 0 && (
          <p className="mt-2 text-xs text-[#ef4444] flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            Cash projected to go negative by{' '}
            {new Date((lowestForecast?.month ?? '') + '-01').toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
        {forecasts.length > 0 && (
          <p className="mt-3 text-[11px] text-[#5a7089]">
            Best case assumes 15% revenue growth. Worst case assumes 15% revenue decline + 5% cost increase.
          </p>
        )}
      </div>
    </div>
  )
}
