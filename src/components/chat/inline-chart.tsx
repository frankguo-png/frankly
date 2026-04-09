'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface ChartDataPoint {
  label: string
  value?: number
  [key: string]: string | number | undefined
}

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'horizontal-bar'
  title?: string
  data: ChartDataPoint[]
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ec4899', '#ef4444', '#6366f1', '#14b8a6', '#f97316',
]

/* ── Formatting helpers ── */

function fmtValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toLocaleString()}`
}

function fmtFull(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── Detect multi-series keys ── */

function getSeriesKeys(data: ChartDataPoint[]): string[] {
  if (!data.length) return ['value']
  const first = data[0]
  const keys = Object.keys(first).filter(k => k !== 'label' && typeof first[k] === 'number')
  return keys.length > 0 ? keys : ['value']
}

const SERIES_COLORS: Record<string, string> = {
  value: '#3b82f6',
  cashIn: '#10b981',
  cashOut: '#ef4444',
  budget: '#6366f1',
  actual: '#3b82f6',
  revenue: '#10b981',
  expenses: '#ef4444',
  net: '#3b82f6',
}

function getSeriesColor(key: string, idx: number): string {
  return SERIES_COLORS[key] ?? COLORS[idx % COLORS.length]
}

function getSeriesLabel(key: string): string {
  const labels: Record<string, string> = {
    value: 'Amount',
    cashIn: 'Cash In',
    cashOut: 'Cash Out',
    budget: 'Budget',
    actual: 'Actual',
    revenue: 'Revenue',
    expenses: 'Expenses',
    net: 'Net',
  }
  return labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/* ── Custom tooltip ── */

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2.5 shadow-xl" style={{
      background: '#0d1a2d',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#7b8fa3' }}>{label}</p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[11px]" style={{ color: '#7b8fa3' }}>{getSeriesLabel(entry.dataKey)}</span>
            </div>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#e8edf4' }}>
              {fmtFull(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Table view ── */

function TableView({ data, seriesKeys }: { data: ChartDataPoint[]; seriesKeys: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th className="text-left py-2 px-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: '#7b8fa3' }}>
              Name
            </th>
            {seriesKeys.map(key => (
              <th key={key} className="text-right py-2 px-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: '#7b8fa3' }}>
                {getSeriesLabel(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
              }}
            >
              <td className="py-2 px-3 text-[13px]" style={{ color: '#c8d5e3' }}>{row.label}</td>
              {seriesKeys.map(key => (
                <td key={key} className="py-2 px-3 text-right text-[13px] font-medium tabular-nums" style={{ color: '#e8edf4' }}>
                  {typeof row[key] === 'number' ? fmtFull(row[key] as number) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {data.length > 1 && seriesKeys.length === 1 && (
          <tfoot>
            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <td className="py-2 px-3 text-[12px] font-semibold" style={{ color: '#7b8fa3' }}>Total</td>
              <td className="py-2 px-3 text-right text-[13px] font-bold tabular-nums" style={{ color: '#e8edf4' }}>
                {fmtFull(data.reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/* ── Main component ── */

export function InlineChart({ chartData }: { chartData: ChartData }) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  const data = useMemo(() =>
    chartData.data.map(d => ({ ...d, name: d.label })),
    [chartData.data]
  )

  const seriesKeys = useMemo(() => getSeriesKeys(chartData.data), [chartData.data])
  const isMultiSeries = seriesKeys.length > 1 || seriesKeys[0] !== 'value'
  const chartHeight = chartData.type === 'horizontal-bar' ? Math.max(200, data.length * 36) : 220
  // Calculate Y-axis width for horizontal bars based on longest label
  const yAxisWidth = chartData.type === 'horizontal-bar'
    ? Math.min(200, Math.max(100, ...data.map(d => (d.name?.length ?? 0) * 7.5 + 10)))
    : 60

  return (
    <div
      className="rounded-xl my-4 overflow-hidden"
      style={{
        background: 'rgba(13, 22, 38, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Header: title + view toggle */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        {chartData.title ? (
          <h4 className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#7b8fa3' }}>
            {chartData.title}
          </h4>
        ) : <div />}
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setViewMode('chart')}
            className="px-2.5 py-1 text-[10px] font-medium transition-colors"
            style={{
              background: viewMode === 'chart' ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: viewMode === 'chart' ? '#93b4f4' : '#5a6d82',
            }}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className="px-2.5 py-1 text-[10px] font-medium transition-colors"
            style={{
              background: viewMode === 'table' ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: viewMode === 'table' ? '#93b4f4' : '#5a6d82',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Table
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        {viewMode === 'table' ? (
          <TableView data={chartData.data} seriesKeys={seriesKeys} />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            {/* ── Bar Chart ── */}
            {(chartData.type === 'bar') ? (
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  interval={data.length > 10 ? Math.floor(data.length / 8) : 0}
                  angle={data.length > 6 ? -35 : 0}
                  textAnchor={data.length > 6 ? 'end' : 'middle'}
                  height={data.length > 6 ? 60 : 30}
                />
                <YAxis
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtValue}
                  width={60}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.04)' }} />
                {isMultiSeries && (
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: '#7b8fa3', paddingBottom: 4 }}
                  />
                )}
                {seriesKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={getSeriesLabel(key)}
                    fill={getSeriesColor(key, i)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>

            /* ── Horizontal Bar Chart ── */
            ) : chartData.type === 'horizontal-bar' ? (
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  tickFormatter={fmtValue}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#c8d5e3', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={yAxisWidth}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.04)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>

            /* ── Line Chart ── */
            ) : chartData.type === 'line' ? (
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtValue}
                  width={60}
                />
                <Tooltip content={<ChartTooltip />} />
                {isMultiSeries && (
                  <Legend verticalAlign="top" align="right" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#7b8fa3', paddingBottom: 4 }} />
                )}
                {seriesKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={getSeriesLabel(key)}
                    stroke={getSeriesColor(key, i)}
                    strokeWidth={2}
                    dot={{ fill: getSeriesColor(key, i), r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: getSeriesColor(key, i), stroke: '#0d1a2d', strokeWidth: 2 }}
                  />
                ))}
              </LineChart>

            /* ── Area Chart ── */
            ) : chartData.type === 'area' ? (
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                <defs>
                  {seriesKeys.map((key, i) => (
                    <linearGradient key={key} id={`areaGrad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={getSeriesColor(key, i)} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={getSeriesColor(key, i)} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtValue}
                  width={60}
                />
                <Tooltip content={<ChartTooltip />} />
                {isMultiSeries && (
                  <Legend verticalAlign="top" align="right" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#7b8fa3', paddingBottom: 4 }} />
                )}
                {seriesKeys.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={getSeriesLabel(key)}
                    stroke={getSeriesColor(key, i)}
                    strokeWidth={2}
                    fill={`url(#areaGrad-${key})`}
                  />
                ))}
              </AreaChart>

            /* ── Pie Chart ── */
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            )}
          </ResponsiveContainer>
        )}

        {/* Pie legend */}
        {viewMode === 'chart' && chartData.type === 'pie' && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: '#7b8fa3' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name}: {fmtValue(d.value ?? 0)}
              </div>
            ))}
          </div>
        )}

        {/* Summary line for bar charts */}
        {viewMode === 'chart' && (chartData.type === 'bar' || chartData.type === 'horizontal-bar') && seriesKeys.length === 1 && data.length > 1 && (
          <div className="mt-3 pt-2 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#5a6d82' }}>
            <span>{data.length} items</span>
            <span className="font-medium" style={{ color: '#7b8fa3' }}>
              Total: {fmtFull(data.reduce((sum, d) => sum + (d.value ?? 0), 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Parse chart blocks from message content. Returns segments of text and chart data. */
export function parseChartBlocks(content: string): Array<{ type: 'text'; content: string } | { type: 'chart'; data: ChartData }> {
  const segments: Array<{ type: 'text'; content: string } | { type: 'chart'; data: ChartData }> = []
  const chartRegex = /```chart\s*\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = chartRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) })
    }
    try {
      const chartData = JSON.parse(match[1].trim()) as ChartData
      if (chartData.type && chartData.data) {
        segments.push({ type: 'chart', data: chartData })
      }
    } catch {
      segments.push({ type: 'text', content: match[0] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content }]
}
