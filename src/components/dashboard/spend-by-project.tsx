'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowUpRight, FolderKanban } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils/currency'
import type { SpendByCategory } from '@/lib/kpi/types'

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  active: { label: 'Live', color: '#22c55e' },
  development: { label: 'Dev', color: '#f59e0b' },
  paused: { label: 'Paused', color: '#64748b' },
}

interface SpendByProjectProps {
  data?: SpendByCategory[]
  loading?: boolean
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload: SpendByCategory }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#0a1425] px-4 py-3 shadow-2xl shadow-black/60 z-50">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="text-xs font-semibold text-white">{item.name}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-sm font-bold tabular-nums text-white">
          {formatCompactCurrency(item.amount)}
        </span>
        <span className="text-[11px] text-[#7b8fa3]">{item.percentage.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// Accessibility patterns for colorblind users — each slice gets a distinct texture
const PROJECT_PATTERNS = [
  // Diagonal lines (////)
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <rect width="6" height="6" fill={color} />
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
    </pattern>
  ),
  // Dots
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="5" height="5">
      <rect width="5" height="5" fill={color} />
      <circle cx="2.5" cy="2.5" r="0.8" fill="rgba(255,255,255,0.2)" />
    </pattern>
  ),
  // Crosshatch
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill={color} />
      <line x1="0" y1="0" x2="6" y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="6" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    </pattern>
  ),
  // Horizontal lines
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="4">
      <rect width="6" height="4" fill={color} />
      <line x1="0" y1="2" x2="6" y2="2" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
    </pattern>
  ),
  // Backslash lines (\\\\)
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
      <rect width="6" height="6" fill={color} />
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
    </pattern>
  ),
  // Dense dots
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="4" height="4">
      <rect width="4" height="4" fill={color} />
      <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.2)" />
      <circle cx="3" cy="3" r="0.5" fill="rgba(255,255,255,0.2)" />
    </pattern>
  ),
  // Vertical lines
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="4" height="6">
      <rect width="4" height="6" fill={color} />
      <line x1="2" y1="0" x2="2" y2="6" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
    </pattern>
  ),
  // Diamond grid
  (id: string, color: string) => (
    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" fill={color} />
      <path d="M4 0L8 4L4 8L0 4Z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    </pattern>
  ),
]

function getProjectLegendSwatch(index: number, color: string) {
  const patternId = `legendProj${index}`
  const patternFn = PROJECT_PATTERNS[index % PROJECT_PATTERNS.length]
  return (
    <svg width="10" height="10" className="shrink-0 rounded-full">
      <defs>{patternFn(patternId, color)}</defs>
      <circle cx="5" cy="5" r="5" fill={`url(#${patternId})`} />
    </svg>
  )
}

function LegendItem({ item, itemIndex, onProjectClick }: { item: SpendByCategory; itemIndex: number; onProjectClick: (name: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const agents = item.agents ?? []

  return (
    <div
      className="relative flex items-center justify-between group/item cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors duration-200 hover:bg-[rgba(255,255,255,0.04)] min-w-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onProjectClick(item.name)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onProjectClick(item.name) }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <div className="transition-transform duration-200 group-hover/item:scale-125 shrink-0">
          {getProjectLegendSwatch(itemIndex, item.color)}
        </div>
        <span className="text-[11px] text-[#7b8fa3] transition-colors duration-200 group-hover/item:text-[#c8d6e5] truncate">
          {item.name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <span className="text-[11px] font-semibold tabular-nums text-[#e8edf4]">
          {formatCompactCurrency(item.amount)}
        </span>
        <span className="text-[10px] tabular-nums text-[#7b8fa3]">
          {item.percentage.toFixed(0)}%
        </span>
        <ArrowUpRight className="h-3 w-3 text-[#6b7f94] opacity-0 group-hover/item:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Agent tooltip on hover - appears to the left */}
      {hovered && agents.length > 0 && (
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 z-50 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0a1425] px-4 py-3 shadow-2xl shadow-black/60 min-w-[240px] pointer-events-none">
          <span className="text-[10px] uppercase tracking-wider text-[#7b8fa3] font-semibold">AI Agents</span>
          <div className="mt-2 flex flex-col gap-1.5">
            {agents.map((agent) => {
              const st = STATUS_STYLES[agent.status] ?? STATUS_STYLES.active
              return (
                <div key={agent.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                    <span className="text-[11px] text-white font-medium">{agent.name}</span>
                    <span
                      className="text-[9px] px-1 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${st.color}20`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#7b8fa3]">
                    {formatCurrency(agent.monthlyCost)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function SpendByProject({ data, loading = false }: SpendByProjectProps) {
  const router = useRouter()
  const total = data?.reduce((sum, d) => sum + d.amount, 0) ?? 0

  const handleProjectClick = useCallback((projectName: string) => {
    const params = new URLSearchParams({ project: projectName })
    router.push(`/dashboard/transactions?${params.toString()}`)
  }, [router])

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm h-full flex flex-col"
      style={{ animation: 'slide-up 0.4s ease-out 0.45s both' }}
    >
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-4">
          Spend by Project
        </h3>
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Donut placeholder */}
            <div className="h-[160px] w-[160px] shrink-0 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            {/* Legend items */}
            <div className="flex w-full flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                    <div className="h-3 w-16 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-12 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                    <div className="h-3 w-6 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !data?.length ? (
          <div className="flex h-[280px] flex-col items-center justify-center py-8 text-center">
            <FolderKanban className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No project spending tracked yet</p>
            <p className="text-xs text-[#7b8fa3]">Assign transactions to projects to see spending breakdown.</p>
          </div>
        ) : (
          <div className="flex flex-row items-center gap-4 overflow-visible relative flex-1 my-auto">
            {/* Donut Chart */}
            <div className="relative h-[220px] w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <defs>
                    {data.map((entry, index) => {
                      const patternFn = PROJECT_PATTERNS[index % PROJECT_PATTERNS.length]
                      return patternFn(`projPattern${index}`, entry.color)
                    })}
                  </defs>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={98}
                    paddingAngle={3}
                    dataKey="amount"
                    stroke="none"
                    animationBegin={400}
                    animationDuration={800}
                    animationEasing="ease-out"
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      if (data[index]) handleProjectClick(data[index].name)
                    }}
                  >
                    {data.map((_, index) => (
                      <Cell key={index} fill={`url(#projPattern${index})`} className="cursor-pointer hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 50 }} offset={20} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] uppercase tracking-wider text-[#7b8fa3]">Total</span>
                <span className="text-base font-bold tabular-nums text-[#e8edf4]">
                  {formatCompactCurrency(total)}
                </span>
              </div>
            </div>

            {/* Legend with agent tooltips */}
            <div className="relative flex w-full flex-col gap-1 overflow-visible min-w-0">
              {data.map((item, index) => (
                <LegendItem key={item.name} item={item} itemIndex={index} onProjectClick={handleProjectClick} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
