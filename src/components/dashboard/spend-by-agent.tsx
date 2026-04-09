'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import Link from 'next/link'
import { Bot } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { SpendByCategory } from '@/lib/kpi/types'

interface SpendByAgentProps {
  data?: SpendByCategory[]
  loading?: boolean
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: SpendByCategory }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-xs font-medium text-[#e8edf4]">{item.name}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums text-[#e8edf4]">
          {formatCompactCurrency(item.amount)}
        </span>
        <span className="text-[11px] text-[#7b8fa3]">
          {item.percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

export function SpendByAgent({
  data,
  loading = false,
}: SpendByAgentProps) {
  const router = useRouter()
  const sorted = data ? [...data].sort((a, b) => b.amount - a.amount) : []

  const handleAgentClick = useCallback((agentName: string) => {
    const params = new URLSearchParams({ search: agentName })
    router.push(`/dashboard/transactions?${params.toString()}`)
  }, [router])

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm"
      style={{ animation: 'slide-up 0.4s ease-out 0.5s both' }}
    >
      <div className="p-5">
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Spend by AI Agent
        </h3>
        {loading ? (
          <div className="h-[300px] space-y-5 pt-4">
            {/* Horizontal bar placeholders with labels */}
            {[85, 65, 45, 30].map((width, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-24 shrink-0 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                <div className="h-7 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        ) : !sorted.length ? (
          <div className="flex h-[300px] flex-col items-center justify-center py-8 text-center">
            <Bot className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No agent spending tracked yet</p>
            <p className="text-xs text-[#7b8fa3] mb-3">Add agents in the Agents page to track their costs.</p>
            <Link href="/dashboard/agents" className="text-xs text-blue-400 hover:text-blue-300 underline">
              Go to Agents
            </Link>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                  tick={{ fill: '#7b8fa3', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fill: '#7b8fa3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar
                  dataKey="amount"
                  radius={[0, 6, 6, 0]}
                  animationBegin={500}
                  animationDuration={800}
                  animationEasing="ease-out"
                  className="cursor-pointer"
                  onClick={(barData) => {
                    if (barData?.name) handleAgentClick(barData.name)
                  }}
                >
                  {sorted.map((entry, index) => (
                    <Cell key={index} fill={entry.color} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
