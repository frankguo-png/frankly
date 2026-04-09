'use client'

import Link from 'next/link'
import { ComposedChart, Area, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { Clock } from 'lucide-react'
import { differenceInMonths } from 'date-fns'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { RunwayResult, BurnTrendPoint, CashForecastPoint } from '@/lib/kpi/forecasting'

interface RunwayCardProps {
  runway?: RunwayResult
  burnTrend?: BurnTrendPoint[]
  cashForecast?: CashForecastPoint[]
  loading?: boolean
}

function getRunwayColor(months: number): string {
  if (months > 6) return '#22c55e'
  if (months >= 3) return '#f59e0b'
  return '#ef4444'
}

function getRunwayLabel(months: number): string {
  if (months > 6) return 'Healthy'
  if (months >= 3) return 'Monitor'
  return 'Critical'
}

/** Calculate months until a scenario hits zero from forecast data */
function scenarioRunwayMonths(
  forecast: CashForecastPoint[],
  key: 'best' | 'worst'
): number | null {
  const forecastPoints = forecast.filter((p) => p.is_forecast)
  for (let i = 0; i < forecastPoints.length; i++) {
    const val = forecastPoints[i][key]
    if (val != null && val <= 0) return i + 1
  }
  return null
}

export function RunwayCard({ runway, burnTrend, cashForecast, loading = false }: RunwayCardProps) {
  const color = runway ? getRunwayColor(runway.monthsRemaining) : '#7b8fa3'
  const label = runway ? getRunwayLabel(runway.monthsRemaining) : ''

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.1s both' }}
    >
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {/* Title + status badge */}
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
              <div className="h-5 w-16 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            </div>
            {/* Large number */}
            <div className="h-10 w-32 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            {/* Burn rate + cash-in line */}
            <div className="h-3 w-48 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            {/* Sparkline area */}
            <div className="h-[50px] w-full rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            {/* Projected date line */}
            <div className="h-3 w-36 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
        ) : !runway ? (
          <div className="flex h-[140px] flex-col items-center justify-center py-8 text-center">
            <Clock className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No runway data yet</p>
            <p className="text-xs text-[#7b8fa3] mb-3">Connect a bank account to calculate your cash runway.</p>
            <Link href="/dashboard/settings" className="text-xs text-blue-400 hover:text-blue-300 underline bg-blue-600/10 rounded-md px-3 py-1.5">
              Go to Settings
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
                Cash Runway
              </h3>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: `${color}20`,
                  color,
                }}
              >
                {label}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              {runway.monthsRemaining >= 999 ? (
                <>
                  <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ color }}
                  >
                    999+
                  </span>
                  <span className="text-lg text-[#5a6d82] font-medium">months</span>
                </>
              ) : (
                <>
                  <span
                    className="text-4xl font-bold tabular-nums tracking-tight"
                    style={{ color }}
                  >
                    {runway.monthsRemaining.toFixed(1)}
                  </span>
                  <span className="text-lg text-[#5a6d82] font-medium">months</span>
                </>
              )}
            </div>
            {runway.monthsRemaining >= 999 && (
              <p className="mt-1 text-xs text-[#7b8fa3]">
                Your cash position is very strong
              </p>
            )}

            <p className="mt-1.5 text-xs text-[#7b8fa3]">
              Burn rate: {formatCompactCurrency(runway.burnRate)}/mo
              {runway.cashInRate > 0 && (
                <span className="ml-2 text-[#22c55e]">
                  +{formatCompactCurrency(runway.cashInRate)}/mo in
                </span>
              )}
            </p>

            {cashForecast && cashForecast.length > 1 ? (
              <div className="mt-4">
                <div className="h-[56px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <ComposedChart data={cashForecast}>
                      <defs>
                        <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a2636',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          fontSize: 11,
                          color: '#c5d0dc',
                        }}
                        labelStyle={{ color: '#7b8fa3', fontSize: 10, marginBottom: 2 }}
                        formatter={(value: unknown, name: unknown) => [
                          formatCompactCurrency(Number(value)),
                          name === 'base' ? 'Base' : name === 'best' ? 'Best' : name === 'worst' ? 'Worst' : String(name),
                        ]}
                        labelFormatter={(label: unknown) => {
                          const d = new Date(String(label) + '-01')
                          return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="best"
                        fill="url(#bandFill)"
                        stroke="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="worst"
                        fill="#111d2e"
                        stroke="none"
                      />
                      <Line
                        type="monotone"
                        dataKey="base"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {(() => {
                  const bestMo = scenarioRunwayMonths(cashForecast, 'best')
                  const worstMo = scenarioRunwayMonths(cashForecast, 'worst')
                  if (!bestMo && !worstMo) return null
                  return (
                    <div className="mt-1.5 flex gap-3 text-[11px] text-[#6b7f94]">
                      {bestMo != null && <span>Best: {bestMo} mo</span>}
                      {worstMo != null && <span>Worst: {worstMo} mo</span>}
                    </div>
                  )
                })()}
              </div>
            ) : burnTrend && burnTrend.length > 1 ? (
              <div className="mt-4 h-[50px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <ComposedChart data={burnTrend}>
                    <Line
                      type="monotone"
                      dataKey="burnRate"
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {runway.runwayDate && (() => {
              const zeroDate = new Date(runway.runwayDate)
              const monthsAway = differenceInMonths(zeroDate, new Date())
              const formattedDate = zeroDate.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })
              const distance = monthsAway > 0
                ? `(${monthsAway} month${monthsAway === 1 ? '' : 's'} away)`
                : '(imminent)'
              return (
                <p className="mt-2 text-[11px] text-[#6b7f94]">
                  Projected zero: {formattedDate}{' '}
                  <span className="text-[#7b8fa3]">{distance}</span>
                </p>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
