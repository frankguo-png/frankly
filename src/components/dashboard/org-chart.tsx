'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Users, Building2, UserPlus, AlertCircle, TrendingUp } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import type {
  OrgChartNode,
  DepartmentSummary,
  OrgChartResponse,
} from '@/app/api/org-chart/route'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/* ---------- Department color system (shared) ---------- */
import { DEPARTMENT_COLORS, DEFAULT_DEPT_COLOR, getDeptColor, DEPT_ACCENT_ORDER } from '@/lib/utils/department-colors'

/* ---------- CSS keyframes injected once ---------- */
const ORG_CHART_STYLES = `
@keyframes org-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.org-card-enter {
  animation: org-fade-in 0.4s ease-out both;
}
.org-card-hover:hover {
  box-shadow: 0 0 20px 2px rgba(96,165,250,0.12), 0 4px 24px rgba(0,0,0,0.3);
}
`

function AnimationStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ORG_CHART_STYLES }} />
}

/* ---------- Hero stats ---------- */
function HeroStats({
  total,
  departments,
  newThisMonth,
}: {
  total: number
  departments: number
  newThisMonth: number
}) {
  const stats = [
    {
      label: 'Total team',
      value: total,
      icon: Users,
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.08)',
    },
    {
      label: 'Departments',
      value: departments,
      icon: Building2,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.08)',
    },
    {
      label: 'New this month',
      value: newThisMonth,
      icon: UserPlus,
      color: '#34d399',
      bg: 'rgba(52,211,153,0.08)',
      trend: newThisMonth > 0 ? `+${newThisMonth}` : null,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="group relative flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-all duration-300 hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)] org-card-enter"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div
            className="flex items-center justify-center size-9 rounded-lg shrink-0"
            style={{ backgroundColor: s.bg }}
          >
            <s.icon className="size-4" style={{ color: s.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-lg font-bold text-[#e8edf4] tabular-nums leading-none">
                {s.value}
              </p>
              {'trend' in s && s.trend && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-400">
                  <TrendingUp className="size-2.5" />
                  {s.trend}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#7b8fa3] leading-tight mt-0.5 truncate">
              {s.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- View toggle ---------- */
function ViewTabs({
  active,
  onChange,
}: {
  active: 'chart' | 'departments'
  onChange: (v: 'chart' | 'departments') => void
}) {
  const tabs = ['chart', 'departments'] as const
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index
    if (e.key === 'ArrowRight') { e.preventDefault(); next = (index + 1) % tabs.length }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); next = (index - 1 + tabs.length) % tabs.length }
    else return
    onChange(tabs[next])
    const btn = e.currentTarget.parentElement?.querySelectorAll('button')[next] as HTMLElement
    btn?.focus()
  }
  return (
    <div role="tablist" aria-label="Org chart views" className="flex gap-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] p-0.5 border border-[rgba(255,255,255,0.04)]">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          tabIndex={active === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={`px-3.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
            active === tab
              ? 'bg-[rgba(255,255,255,0.1)] text-[#e8edf4] shadow-sm'
              : 'text-[#7b8fa3] hover:text-[#c0cad8]'
          }`}
        >
          {tab === 'chart' ? 'Chart' : 'Departments'}
        </button>
      ))}
    </div>
  )
}

/* ---------- React Flow: Custom PersonNode ---------- */
type PersonNodeData = {
  name: string
  title: string | null
  department: string | null
}

function PersonNode({ data }: NodeProps<Node<PersonNodeData>>) {
  const dept = getDeptColor(data.department)
  const initials = data.name
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-2 !h-2" />
      <div
        className="flex items-center gap-2.5 rounded-xl border bg-[#111d2e] px-3 py-2 w-44 cursor-default transition-all duration-200 hover:shadow-[0_0_20px_2px_rgba(96,165,250,0.12)] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.18)]"
      >
        {/* Avatar */}
        <div
          className={`shrink-0 flex items-center justify-center size-8 rounded-full bg-gradient-to-br ${dept.gradient} text-[10px] font-bold text-white/90 shadow-lg`}
        >
          {initials}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#e8edf4] leading-tight truncate">
            {data.name}
          </p>
          {data.title && (
            <p className="text-[10px] text-[#7b8fa3] leading-tight truncate mt-0.5">
              {data.title}
            </p>
          )}
          {data.department && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`inline-block size-1.5 rounded-full ${dept.dot}`} />
              <span className="text-[9px] font-medium" style={{ color: dept.accent }}>
                {data.department}
              </span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-2 !h-2" />
    </>
  )
}

const nodeTypes = { person: PersonNode }

/* ---------- Dagre layout ---------- */
const NODE_WIDTH = 176
const NODE_HEIGHT = 70

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  nodes.forEach((node) => g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((edge) => g.setEdge(edge.source, edge.target))

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } }
  })

  return { nodes: layoutedNodes, edges }
}

/* ---------- Convert OrgChartNode tree to React Flow nodes/edges ---------- */
function treeToElements(tree: OrgChartNode[]) {
  const nodes: Node<PersonNodeData>[] = []
  const edges: Edge[] = []

  function walk(node: OrgChartNode, parentId?: string) {
    nodes.push({
      id: node.id,
      type: 'person',
      data: { name: node.name, title: node.title, department: node.department },
      position: { x: 0, y: 0 },
    })
    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'smoothstep',
        style: { stroke: 'rgba(96,165,250,0.25)', strokeWidth: 2 },
      })
    }
    for (const child of node.children) {
      walk(child, node.id)
    }
  }

  for (const root of tree) {
    walk(root)
  }

  return getLayoutedElements(nodes, edges)
}

/* ---------- Dark theme overrides for React Flow ---------- */
const REACT_FLOW_DARK_STYLES = `
.react-flow__controls button {
  background: rgba(0,0,0,0.6) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 6px !important;
  fill: rgba(255,255,255,0.7) !important;
  color: rgba(255,255,255,0.7) !important;
}
.react-flow__controls button:hover {
  background: rgba(0,0,0,0.8) !important;
  fill: rgba(255,255,255,0.9) !important;
}
.react-flow__controls {
  box-shadow: none !important;
}
`

/* ---------- Chart view (React Flow + dagre) ---------- */
const CHART_HEIGHT = 480

function ChartView({
  tree,
}: {
  tree: OrgChartNode[]
  totalEmployees: number
}) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => treeToElements(tree),
    [tree]
  )

  return (
    <div
      className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.15)]"
      style={{ height: CHART_HEIGHT }}
    >
      <style dangerouslySetInnerHTML={{ __html: REACT_FLOW_DARK_STYLES }} />
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.02)" gap={20} />
        <Controls
          showInteractive={false}
          style={{
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
      </ReactFlow>
    </div>
  )
}

/* ---------- Departments view ---------- */
function DepartmentsView({
  departments,
}: {
  departments: DepartmentSummary[]
}) {
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0) || 1
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-3">
      {departments.map((dept, i) => {
        const pct = Math.round((dept.headcount / totalHeadcount) * 100)
        const accent = DEPARTMENT_COLORS[dept.department]?.accent ?? DEPT_ACCENT_ORDER[i % DEPT_ACCENT_ORDER.length]

        return (
          <div
            key={dept.department}
            className="org-card-enter org-card-hover group relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.1)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Top accent bar */}
            <div className="h-[3px]" style={{ background: accent }} />

            <div className="p-3.5">
              <p className="text-[12px] font-semibold text-[#e8edf4] mb-2">
                {dept.department}
              </p>

              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] text-[#7b8fa3] tabular-nums">
                  {dept.headcount} {dept.headcount === 1 ? 'person' : 'people'}
                </span>
                {dept.totalCost > 0 && (
                  <span className="text-[11px] text-[#7b8fa3] tabular-nums">
                    {formatCompactCurrency(dept.totalCost)}/yr
                  </span>
                )}
              </div>

              {/* Proportion bar */}
              <div className="h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: loaded ? `${pct}%` : '0%',
                    backgroundColor: accent,
                    opacity: 0.65,
                  }}
                />
              </div>
              <p className="text-[9px] text-[#5b6e82] mt-1 tabular-nums text-right">
                {pct}% of team
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Loading skeleton ---------- */
function OrgChartSkeleton() {
  return (
    <div className="space-y-5">
      {/* Hero stats skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
          >
            <div className="size-9 rounded-lg bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div>
              <div className="h-5 w-10 rounded bg-[rgba(255,255,255,0.04)] animate-shimmer mb-1" />
              <div className="h-3 w-16 rounded bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
      {/* Tree skeleton */}
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-14 w-[160px] rounded-xl bg-[rgba(255,255,255,0.03)] animate-shimmer" />
        <div className="w-[2px] h-5 rounded-full bg-[rgba(255,255,255,0.04)]" />
        <div className="flex gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className="h-14 w-[160px] rounded-xl bg-[rgba(255,255,255,0.03)] animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Empty state ---------- */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex items-center justify-center size-12 rounded-xl bg-[rgba(96,165,250,0.08)] mb-4">
        <Users className="size-6 text-[#60a5fa]" />
      </div>
      <p className="text-sm font-medium text-[#c0cad8] mb-1">No team data yet</p>
      <p className="text-xs text-[#7b8fa3] mb-4 max-w-[240px]">
        Connect Rippling or add employees to see your org chart.
      </p>
      <Link
        href="/dashboard/settings"
        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
      >
        Go to Settings
      </Link>
    </div>
  )
}

/* ---------- Error state ---------- */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex items-center justify-center size-12 rounded-xl bg-[rgba(239,68,68,0.08)] mb-4">
        <AlertCircle className="size-6 text-red-400/80" />
      </div>
      <p className="text-sm font-medium text-red-400 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
      >
        Try again
      </button>
    </div>
  )
}

/* ---------- Main component ---------- */
export function OrgChart() {
  const [view, setView] = useState<'chart' | 'departments'>('chart')
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<OrgChartResponse>('/api/org-chart', fetcher, {
    refreshInterval: 300_000,
  })

  const hasData = data && typeof data.totalEmployees === 'number' && data.totalEmployees > 0

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm"
      style={{ animation: 'slide-up 0.4s ease-out 0.6s both' }}
    >
      <AnimationStyles />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
            Team Overview
          </h3>
          {hasData && <ViewTabs active={view} onChange={setView} />}
        </div>

        {/* Content */}
        {isLoading ? (
          <OrgChartSkeleton />
        ) : error ? (
          <ErrorState
            message="Failed to load team data"
            onRetry={() => mutate()}
          />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <>
            <HeroStats
              total={data.totalEmployees}
              departments={data.totalDepartments}
              newThisMonth={data.newThisMonth}
            />
            {view === 'chart' ? (
              <ChartView
                tree={data.tree}
                totalEmployees={data.totalEmployees}
              />
            ) : (
              <DepartmentsView departments={data.departments} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
