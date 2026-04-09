'use client'

import { useState } from 'react'
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
import type { ScenarioResult } from '@/lib/kpi/scenario-engine'

interface HireRow {
  id: string
  count: number
  monthlyCost: number
}

interface DealRow {
  id: string
  amount: number
  month: number
}

interface CutRow {
  id: string
  category: string
  monthlyAmount: number
}

let rowCounter = 0
function nextId() {
  return `row-${++rowCounter}`
}

function formatMonth(monthStr: string) {
  try {
    const [year, month] = monthStr.split('-')
    return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
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

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

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
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: entry.dataKey === 'base' ? '#5a6d82' : '#3b82f6',
              }}
            />
            <span className="text-xs text-[#7b8fa3]">
              {entry.dataKey === 'base' ? 'Current' : 'Scenario'}
            </span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-[#e8edf4]">
              {formatCompactCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ScenariosPage() {
  const [hires, setHires] = useState<HireRow[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [cuts, setCuts] = useState<CutRow[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addHire() {
    setHires([...hires, { id: nextId(), count: 1, monthlyCost: 8000 }])
  }

  function removeHire(id: string) {
    setHires(hires.filter((h) => h.id !== id))
  }

  function updateHire(id: string, field: 'count' | 'monthlyCost', value: number) {
    setHires(hires.map((h) => (h.id === id ? { ...h, [field]: value } : h)))
  }

  function addDeal() {
    setDeals([...deals, { id: nextId(), amount: 50000, month: 1 }])
  }

  function removeDeal(id: string) {
    setDeals(deals.filter((d) => d.id !== id))
  }

  function updateDeal(id: string, field: 'amount' | 'month', value: number) {
    setDeals(deals.map((d) => (d.id === id ? { ...d, [field]: value } : d)))
  }

  function addCut() {
    setCuts([...cuts, { id: nextId(), category: '', monthlyAmount: 1000 }])
  }

  function removeCut(id: string) {
    setCuts(cuts.filter((c) => c.id !== id))
  }

  function updateCut(id: string, field: 'category' | 'monthlyAmount', value: string | number) {
    setCuts(cuts.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  async function runScenario() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/scenarios/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hires: hires.map(({ count, monthlyCost }) => ({ count, monthlyCost })),
          deals: deals.map(({ amount, month }) => ({ amount, month })),
          cutExpenses: cuts.map(({ category, monthlyAmount }) => ({ category, monthlyAmount })),
          otherMonthlyChange: 0,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to simulate scenario')
      }
      const data: ScenarioResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Merge base and scenario projections for the chart
  const chartData = result
    ? result.base.projection.map((bp, i) => ({
        month: bp.month,
        base: bp.balance,
        scenario: result.scenario.projection[i]?.balance ?? 0,
      }))
    : []

  const runwayDecreased = result && result.delta.runwayChange < 0

  const inputClass =
    'w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0a1220] px-3 py-2 text-sm text-[#e8edf4] placeholder-[#3d5066] focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#e8edf4]">Scenario Builder</h1>
        <p className="mt-1 text-sm text-[#7b8fa3]">
          Model the impact of business decisions on your runway
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Input form */}
        <div className="space-y-4">
          {/* Hire People */}
          <div
            className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
            style={{ animation: 'slide-up 0.4s ease-out both' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
                Hire People
              </h3>
              <button
                onClick={addHire}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add
              </button>
            </div>
            {hires.length === 0 && (
              <p className="text-xs text-[#3d5066]">No hires added yet</p>
            )}
            <div className="space-y-2">
              {hires.map((hire) => (
                <div key={hire.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[#5a7089] mb-0.5 block">Count</label>
                    <input
                      type="number"
                      min={1}
                      value={hire.count}
                      onChange={(e) =>
                        updateHire(hire.id, 'count', parseInt(e.target.value) || 1)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-[#5a7089] mb-0.5 block">
                      Monthly cost / person
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={hire.monthlyCost}
                      onChange={(e) =>
                        updateHire(hire.id, 'monthlyCost', parseInt(e.target.value) || 0)
                      }
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={() => removeHire(hire.id)}
                    className="mt-4 text-[#5a6d82] hover:text-red-400 transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Close Deals */}
          <div
            className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
            style={{ animation: 'slide-up 0.4s ease-out 0.1s both' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
                Close Deals
              </h3>
              <button
                onClick={addDeal}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add
              </button>
            </div>
            {deals.length === 0 && (
              <p className="text-xs text-[#3d5066]">No deals added yet</p>
            )}
            <div className="space-y-2">
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[#5a7089] mb-0.5 block">
                      Deal value ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={deal.amount}
                      onChange={(e) =>
                        updateDeal(deal.id, 'amount', parseInt(e.target.value) || 0)
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-[#5a7089] mb-0.5 block">
                      Closes in month #
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={deal.month}
                      onChange={(e) =>
                        updateDeal(deal.id, 'month', parseInt(e.target.value) || 1)
                      }
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={() => removeDeal(deal.id)}
                    className="mt-4 text-[#5a6d82] hover:text-red-400 transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cut Expenses */}
          <div
            className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
            style={{ animation: 'slide-up 0.4s ease-out 0.2s both' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
                Cut Expenses
              </h3>
              <button
                onClick={addCut}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add
              </button>
            </div>
            {cuts.length === 0 && (
              <p className="text-xs text-[#3d5066]">No expense cuts added yet</p>
            )}
            <div className="space-y-2">
              {cuts.map((cut) => (
                <div key={cut.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[#5a7089] mb-0.5 block">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cancel SaaS tool"
                      value={cut.category}
                      onChange={(e) => updateCut(cut.id, 'category', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] text-[#5a7089] mb-0.5 block">
                      Monthly savings ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cut.monthlyAmount}
                      onChange={(e) =>
                        updateCut(cut.id, 'monthlyAmount', parseInt(e.target.value) || 0)
                      }
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={() => removeCut(cut.id)}
                    className="mt-4 text-[#5a6d82] hover:text-red-400 transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Run Scenario Button */}
          <button
            onClick={runScenario}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Simulating...' : 'Run Scenario'}
          </button>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          {!result && !loading && (
            <div
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-12 flex flex-col items-center justify-center text-center"
              style={{ animation: 'slide-up 0.4s ease-out 0.3s both' }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#3d5066] mb-4"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <p className="text-sm text-[#7b8fa3] mb-1">No scenario results yet</p>
              <p className="text-xs text-[#5a7089]">
                Add inputs on the left and click &quot;Run Scenario&quot; to see projections.
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-12 flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="ml-3 text-sm text-[#7b8fa3]">Simulating scenario...</span>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Comparison Cards */}
              <div
                className="grid grid-cols-2 gap-4"
                style={{ animation: 'slide-up 0.4s ease-out both' }}
              >
                {/* Runway */}
                <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4">
                  <p className="text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">
                    Runway
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-[#5a6d82] line-through">
                      {result.base.runway === 999 ? '99+' : result.base.runway}mo
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#5a6d82]"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                    <span className="text-lg font-semibold text-[#e8edf4]">
                      {result.scenario.runway === 999
                        ? '99+'
                        : result.scenario.runway}
                      mo
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 font-medium ${
                      result.delta.runwayChange > 0
                        ? 'text-green-400'
                        : result.delta.runwayChange < 0
                        ? 'text-red-400'
                        : 'text-[#7b8fa3]'
                    }`}
                  >
                    {result.delta.runwayChange > 0 ? '+' : ''}
                    {result.delta.runwayChange === 0
                      ? 'No change'
                      : `${result.delta.runwayChange} months`}
                  </p>
                </div>

                {/* Net Burn */}
                <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4">
                  <p className="text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">
                    Net Burn
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-[#5a6d82] line-through">
                      {formatCompactCurrency(result.base.burnRate)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#5a6d82]"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                    <span className="text-lg font-semibold text-[#e8edf4]">
                      {formatCompactCurrency(result.scenario.burnRate)}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 font-medium ${
                      result.delta.burnChange < 0
                        ? 'text-green-400'
                        : result.delta.burnChange > 0
                        ? 'text-red-400'
                        : 'text-[#7b8fa3]'
                    }`}
                  >
                    {result.delta.burnChange > 0 ? '+' : ''}
                    {result.delta.burnChange === 0
                      ? 'No change'
                      : `${formatCompactCurrency(result.delta.burnChange)}/mo`}
                  </p>
                </div>
              </div>

              {/* Warning */}
              {runwayDecreased && (
                <div
                  className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3"
                  style={{ animation: 'slide-up 0.4s ease-out 0.1s both' }}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <p className="text-xs text-red-400">
                    This scenario reduces your runway by{' '}
                    {Math.abs(result.delta.runwayChange)} months. Consider offsetting with
                    additional revenue or expense cuts.
                  </p>
                </div>
              )}

              {/* Projection Chart */}
              <div
                className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
                style={{ animation: 'slide-up 0.4s ease-out 0.2s both' }}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
                      12-Month Cash Projection
                    </h3>
                    <div className="flex items-center gap-4 text-[11px] text-[#7b8fa3]">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-4 rounded-sm bg-[#5a6d82]" />
                        Current
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-4 rounded-sm bg-[#3b82f6]" />
                        Scenario
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300} minWidth={0}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="scenarioGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="baseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#5a6d82" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#5a6d82" stopOpacity={0.02} />
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
                        tickFormatter={formatMonth}
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
                        content={<ChartTooltip />}
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
                      <Area
                        type="monotone"
                        dataKey="base"
                        stroke="#5a6d82"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        fill="url(#baseGradient)"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="scenario"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#scenarioGradient)"
                        dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
