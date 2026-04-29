'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// --- Types ---

interface PayrollSummary {
  salariedMonthlyPayroll: number
  contractorMonthlyCost: number
  hourlyMonthlyCost: number
  totalMonthlyCost: number
  salariedCount: number
  contractorCount: number
  hourlyCount: number
  employeeCount: number
  avgSalary: number
  payrollPctOfSpend: number
}

interface DepartmentBreakdown {
  department: string
  cost: number
  count: number
}

interface EmploymentTypeBreakdown {
  type: string
  cost: number
  count: number
}

interface MonthlyTrend {
  month: string
  cost: number
  headcount: number
}

interface RosterEmployee {
  id: string
  employee_id: string
  employee_name: string
  title: string | null
  location_type: string | null
  country: string | null
  salary_effective_date: string | null
  entity_id: string | null
  department: string | null
  employment_type: 'full_time' | 'part_time' | 'contractor' | 'hourly' | 'intern' | null
  annual_salary: number | null
  hourly_rate: number | null
  hours_per_week: number | null
  currency: string
  monthly_cost: number       // native currency
  monthly_cost_usd: number   // FX-converted
  projects: string[]
  effective_date: string
  pending_bonus_count: number
  pending_bonus_total: number
}

function wasRecentlyChanged(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const daysAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  return daysAgo <= 90 && daysAgo >= 0
}

interface PayrollData {
  summary: PayrollSummary
  departmentBreakdown: DepartmentBreakdown[]
  employmentTypeBreakdown: EmploymentTypeBreakdown[]
  monthlyTrend: MonthlyTrend[]
  roster: RosterEmployee[]
  orgId: string
}

// --- Constants ---

import { getDeptHex } from '@/lib/utils/department-colors'

const TYPE_COLORS: Record<string, string> = {
  full_time: '#22c55e',
  contractor: '#3b82f6',
  intern: '#f59e0b',
  part_time: '#8b5cf6',
  hourly: '#64748b',
  unknown: '#475569',
}

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  contractor: 'Contractor',
  intern: 'Intern',
  part_time: 'Part-time',
  hourly: 'Hourly',
  unknown: 'Other',
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  full_time: 'bg-green-500/20 text-green-400 border-green-500/30',
  contractor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  intern: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  part_time: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  hourly: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// --- Skeleton Components ---

function SummaryCardSkeleton() {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5">
      <div className="h-3 w-24 rounded animate-shimmer mb-3" />
      <div className="h-7 w-32 rounded animate-shimmer" />
    </div>
  )
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <div className="h-4 w-40 rounded animate-shimmer" />
      </div>
      <div className="px-6 pb-5">
        <div className={`rounded-lg animate-shimmer`} style={{ height }} />
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
      <div className="px-6 pt-5 pb-4">
        <div className="h-4 w-32 rounded animate-shimmer mb-3" />
      </div>
      <div className="px-6 pb-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded animate-shimmer" />
        ))}
      </div>
    </div>
  )
}

// --- Summary Card ---

function SummaryCard({
  label,
  value,
  subtext,
  trend,
}: {
  label: string
  value: string
  subtext?: string
  trend?: { value: number; label: string } | null
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5">
      <p className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-semibold text-[#e8edf4] tabular-nums">{value}</p>
        {trend && trend.value !== 0 && (
          <span
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
              trend.value > 0
                ? 'bg-green-500/15 text-green-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-[#7b8fa3] mt-1">{subtext}</p>
      )}
    </div>
  )
}

// --- Monthly Payroll Card (split by comp type) ---
//
// Displays salaried monthly payroll as the headline figure, with contractor
// and hourly/intern costs surfaced as secondary rows so they're not conflated
// with recurring monthly payroll.
function MonthlyPayrollCard({
  salariedMonthly,
  contractorMonthly,
  hourlyMonthly,
  salariedCount,
  contractorCount,
  hourlyCount,
  trend,
}: {
  salariedMonthly: number
  contractorMonthly: number
  hourlyMonthly: number
  salariedCount: number
  contractorCount: number
  hourlyCount: number
  trend?: { value: number; label: string } | null
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5">
      <p className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider mb-1">
        Monthly Payroll
      </p>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-semibold text-[#e8edf4] tabular-nums">
          {formatCompactCurrency(salariedMonthly)}
        </p>
        {trend && trend.value !== 0 && (
          <span
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
              trend.value > 0
                ? 'bg-green-500/15 text-green-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs text-[#7b8fa3] mt-1">
        Salaried · {formatCurrency(salariedMonthly * 12)}/yr
      </p>
      {(contractorCount > 0 || hourlyCount > 0) && (
        <div className="mt-2.5 space-y-1 border-t border-[rgba(255,255,255,0.04)] pt-2">
          {contractorCount > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#7b8fa3]">
                + Contractors ({contractorCount})
              </span>
              <span className="text-[#c8d6e5] tabular-nums">
                {formatCompactCurrency(contractorMonthly)}/mo
              </span>
            </div>
          )}
          {hourlyCount > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#7b8fa3]">
                + Hourly / intern ({hourlyCount})
              </span>
              <span className="text-[#c8d6e5] tabular-nums">
                {formatCompactCurrency(hourlyMonthly)}/mo
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Chart Tooltip ---

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3]">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload
          .filter((entry) => entry.value > 0)
          .map((entry) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-[#7b8fa3]">{entry.name}</span>
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

function PieTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { fill: string } }>
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0]

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
        <span className="text-xs text-[#7b8fa3]">{entry.name}</span>
      </div>
      <p className="text-sm font-semibold text-[#e8edf4] mt-1 tabular-nums">
        {formatCompactCurrency(entry.value)}/mo
      </p>
    </div>
  )
}

// --- Department Cost Breakdown Chart ---

function DepartmentCostChart({ data }: { data: DepartmentBreakdown[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-[#6b7f94]">
        No department data available
      </div>
    )
  }

  const chartData = data.map((d) => ({
    department: d.department,
    cost: Math.round(d.cost),
    count: d.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={300} minWidth={0}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        layout="horizontal"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1e3050"
          strokeOpacity={0.4}
          vertical={false}
        />
        <XAxis
          dataKey="department"
          tick={{ fill: '#7b8fa3', fontSize: 11 }}
          axisLine={{ stroke: '#1e3050', strokeOpacity: 0.5 }}
          tickLine={false}
          dy={8}
        />
        <YAxis
          tickFormatter={(v: number) => {
            if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
            if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
            return `$${v}`
          }}
          tick={{ fill: '#7b8fa3', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          dx={-4}
        />
        <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(59,130,246,0.03)' }} />
        <Bar
          dataKey="cost"
          name="Monthly Cost"
          radius={[4, 4, 0, 0]}
          barSize={36}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.department}
              fill={getDeptHex(entry.department)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Payroll Trend Chart ---

function DualAxisTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d]/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3]">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload
          .filter((entry) => entry.value > 0)
          .map((entry) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-[#7b8fa3]">{entry.name}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-[#e8edf4]">
                {entry.dataKey === 'headcount'
                  ? `${entry.value} people`
                  : formatCompactCurrency(entry.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

function PayrollTrendChart({ data }: { data: MonthlyTrend[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-[#6b7f94]">
        No trend data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300} minWidth={0}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1e3050"
          strokeOpacity={0.4}
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: '#7b8fa3', fontSize: 11 }}
          axisLine={{ stroke: '#1e3050', strokeOpacity: 0.5 }}
          tickLine={false}
          dy={8}
        />
        <YAxis
          yAxisId="cost"
          tickFormatter={(v: number) => {
            if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
            if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
            return `$${v}`
          }}
          tick={{ fill: '#7b8fa3', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          dx={-4}
        />
        <YAxis
          yAxisId="headcount"
          orientation="right"
          tick={{ fill: '#7b8fa3', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          dx={4}
          allowDecimals={false}
        />
        <Tooltip content={<DualAxisTooltipContent />} cursor={{ stroke: 'rgba(59,130,246,0.2)' }} />
        <Line
          yAxisId="cost"
          type="monotone"
          dataKey="cost"
          name="Monthly Payroll"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4, fill: '#3b82f6', stroke: '#0d1a2d', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#3b82f6', stroke: '#0d1a2d', strokeWidth: 2 }}
        />
        <Line
          yAxisId="headcount"
          type="monotone"
          dataKey="headcount"
          name="Headcount"
          stroke="#22c55e"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={{ r: 3, fill: '#22c55e', stroke: '#0d1a2d', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: '#22c55e', stroke: '#0d1a2d', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// --- Cost Distribution Pie ---

function CostDistributionPie({ data }: { data: EmploymentTypeBreakdown[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-[#6b7f94]">
        No distribution data available
      </div>
    )
  }

  const pieData = data.map((d) => ({
    name: TYPE_LABELS[d.type] ?? d.type,
    value: Math.round(d.cost),
    count: d.count,
    fill: TYPE_COLORS[d.type] ?? '#64748b',
  }))

  const total = pieData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="100%" height={260} minWidth={0}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="none"
          >
            {pieData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2.5 pr-4 min-w-[140px]">
        {pieData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
            <div className="flex flex-col">
              <span className="text-xs text-[#c8d6e5] font-medium">{entry.name}</span>
              <span className="text-[11px] text-[#7b8fa3] tabular-nums">
                {formatCompactCurrency(entry.value)} ({total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Team Roster Table ---

type SortField = 'employee_name' | 'department' | 'monthly_cost'
type SortDir = 'asc' | 'desc'

function TeamRoster({ roster }: { roster: RosterEmployee[] }) {
  const [sortField, setSortField] = useState<SortField>('employee_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  const departments = useMemo(() => {
    const depts = new Set<string>()
    roster.forEach((e) => { if (e.department) depts.add(e.department) })
    return Array.from(depts).sort()
  }, [roster])

  const sorted = useMemo(() => {
    let filtered = roster
    if (deptFilter !== 'all') {
      filtered = roster.filter((e) => e.department === deptFilter)
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'employee_name') {
        cmp = a.employee_name.localeCompare(b.employee_name)
      } else if (sortField === 'department') {
        cmp = (a.department ?? '').localeCompare(b.department ?? '')
      } else if (sortField === 'monthly_cost') {
        // Sort in USD so different-currency rows order sensibly.
        cmp = a.monthly_cost_usd - b.monthly_cost_usd
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [roster, sortField, sortDir, deptFilter])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'monthly_cost' ? 'desc' : 'asc')
    }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-[#3a4f65] ml-1">&#x2195;</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
          Team Roster
        </h3>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs bg-[#0d1a2d] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-1.5 text-[#c8d6e5] focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-t border-[rgba(255,255,255,0.06)]">
              <th
                className="px-6 py-3 text-left text-[#7b8fa3] text-xs font-medium cursor-pointer hover:text-[#c8d6e5] transition-colors select-none"
                onClick={() => toggleSort('employee_name')}
              >
                Name {sortIcon('employee_name')}
              </th>
              <th
                className="px-4 py-3 text-left text-[#7b8fa3] text-xs font-medium cursor-pointer hover:text-[#c8d6e5] transition-colors select-none"
                onClick={() => toggleSort('department')}
              >
                Department {sortIcon('department')}
              </th>
              <th className="px-4 py-3 text-left text-[#7b8fa3] text-xs font-medium">
                Role
              </th>
              <th
                className="px-4 py-3 text-right text-[#7b8fa3] text-xs font-medium cursor-pointer hover:text-[#c8d6e5] transition-colors select-none"
                onClick={() => toggleSort('monthly_cost')}
              >
                Monthly Cost {sortIcon('monthly_cost')}
              </th>
              <th className="px-4 py-3 text-left text-[#7b8fa3] text-xs font-medium">
                Projects
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#6b7f94] text-sm">
                  No employees match the selected filter.
                </td>
              </tr>
            ) : (
              sorted.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-t border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                >
                  <td className="px-6 py-3 text-sm text-[#c8d6e5] font-medium">
                    <div className="flex items-center gap-2">
                      <span>{emp.employee_name}</span>
                      {emp.pending_bonus_count > 0 && (
                        <span
                          title={`${emp.pending_bonus_count} pending bonus${emp.pending_bonus_count > 1 ? 'es' : ''} — ${formatCurrency(emp.pending_bonus_total)}`}
                          className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] border border-amber-500/40"
                        >
                          $
                        </span>
                      )}
                      {wasRecentlyChanged(emp.salary_effective_date) && (
                        <span
                          title={`Compensation changed on ${emp.salary_effective_date}`}
                          className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] border border-sky-500/40"
                        >
                          Δ
                        </span>
                      )}
                      {emp.location_type === 'REMOTE' && (
                        <span
                          title="Remote"
                          className="text-[9px] font-medium text-[#7b8fa3] uppercase tracking-wider"
                        >
                          remote
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#7b8fa3]">
                    {emp.department ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-[#c8d6e5]">
                        {emp.title ?? <span className="text-[#3a4f65]">—</span>}
                      </span>
                      {emp.employment_type && (
                        <span
                          className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            TYPE_BADGE_CLASSES[emp.employment_type] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          {TYPE_LABELS[emp.employment_type] ?? emp.employment_type}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#c8d6e5] text-right tabular-nums">
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(emp.monthly_cost, emp.currency)}</span>
                      {emp.currency !== 'USD' && (
                        <span className="text-[10px] text-[#566a7f] font-normal">
                          ≈ {formatCurrency(emp.monthly_cost_usd, 'USD')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#7b8fa3] max-w-[250px]">
                    {emp.projects.length > 0 ? emp.projects.join(', ') : (
                      <span className="text-[#3a4f65]">Unallocated</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] flex items-center justify-between">
          <span className="text-xs text-[#7b8fa3]">
            {sorted.length} employee{sorted.length !== 1 ? 's' : ''}
            {deptFilter !== 'all' ? ` in ${deptFilter}` : ''}
          </span>
          <span className="text-xs font-semibold text-[#c8d6e5] tabular-nums">
            Total: {formatCompactCurrency(sorted.reduce((s, e) => s + e.monthly_cost_usd, 0))}/mo USD
          </span>
        </div>
      )}
    </div>
  )
}

// --- Main Content ---

function PayrollContent() {
  const [data, setData] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/payroll')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      console.error('Failed to load payroll data:', err)
      setError(err.message || 'Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Compute trend badges from monthly trend data
  const trends = useMemo(() => {
    if (!data?.monthlyTrend || data.monthlyTrend.length < 2) return null
    const curr = data.monthlyTrend[data.monthlyTrend.length - 1]
    const prev = data.monthlyTrend[data.monthlyTrend.length - 2]
    if (!prev || prev.cost === 0) return null

    const costChange = ((curr.cost - prev.cost) / prev.cost) * 100
    const headcountChange = prev.headcount > 0
      ? ((curr.headcount - prev.headcount) / prev.headcount) * 100
      : 0

    const currAvgCost = curr.headcount > 0 ? curr.cost / curr.headcount : 0
    const prevAvgCost = prev.headcount > 0 ? prev.cost / prev.headcount : 0
    const avgCostChange = prevAvgCost > 0
      ? ((currAvgCost - prevAvgCost) / prevAvgCost) * 100
      : 0

    return { costChange, headcountChange, avgCostChange }
  }, [data])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#e8edf4]">Payroll</h1>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Manage payroll allocations across departments and projects.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SummaryCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton height={260} />
        </div>
        <TableSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#e8edf4]">Payroll</h1>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Manage payroll allocations across departments and projects.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={() => load()} className="text-xs text-blue-400 hover:text-blue-300 underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data?.orgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#e8edf4]">Payroll</h1>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Manage payroll allocations across departments and projects.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">
            Please sign in and join an organization to view payroll data.
          </p>
        </div>
      </div>
    )
  }

  const summary = data.summary

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#e8edf4]">Payroll</h1>
        <p className="mt-1 text-sm text-[#7b8fa3]">
          Manage payroll allocations across departments and projects.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MonthlyPayrollCard
          salariedMonthly={summary.salariedMonthlyPayroll}
          contractorMonthly={summary.contractorMonthlyCost}
          hourlyMonthly={summary.hourlyMonthlyCost}
          salariedCount={summary.salariedCount}
          contractorCount={summary.contractorCount}
          hourlyCount={summary.hourlyCount}
          trend={trends ? { value: trends.costChange, label: 'vs last month' } : null}
        />
        <SummaryCard
          label="Employee Count"
          value={String(summary.employeeCount)}
          subtext={`${summary.salariedCount} salaried · ${summary.contractorCount} contractor · ${summary.hourlyCount} hourly`}
          trend={trends ? { value: trends.headcountChange, label: 'vs last month' } : null}
        />
        <SummaryCard
          label="Average Salary"
          value={formatCompactCurrency(summary.avgSalary)}
          subtext={`Salaried employees (${summary.salariedCount})`}
        />
        <SummaryCard
          label="Payroll % of Spend"
          value={`${summary.payrollPctOfSpend.toFixed(1)}%`}
          subtext="All comp vs total spend"
        />
        <SummaryCard
          label="Avg Cost / Employee"
          value={summary.employeeCount > 0 ? formatCompactCurrency(summary.totalMonthlyCost / summary.employeeCount) : '$0'}
          subtext="Monthly cost per head"
          trend={trends ? { value: trends.avgCostChange, label: 'vs last month' } : null}
        />
      </div>

      {/* Department Cost Breakdown + Cost Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Department Cost Breakdown */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
              Department Cost Breakdown
            </h3>
            <p className="text-xs text-[#4a5f75] mt-0.5">Monthly payroll by department</p>
          </div>
          <div className="px-6 pb-5">
            <DepartmentCostChart data={data.departmentBreakdown} />
          </div>
        </div>

        {/* Cost Distribution Pie */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
              Cost Distribution by Type
            </h3>
            <p className="text-xs text-[#4a5f75] mt-0.5">Full-time vs contractor vs intern split</p>
          </div>
          <div className="px-6 pb-5">
            <CostDistributionPie data={data.employmentTypeBreakdown} />
          </div>
        </div>
      </div>

      {/* Team Roster */}
      <TeamRoster roster={data.roster} />

      {/* Payroll Trend */}
      {data.monthlyTrend.length > 1 && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 pt-5 pb-2">
            <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
              Payroll Trend
            </h3>
            <p className="text-xs text-[#4a5f75] mt-0.5">
              Monthly payroll cost <span className="text-blue-400/60">(solid)</span> and headcount <span className="text-green-400/60">(dashed)</span> over time
            </p>
          </div>
          <div className="px-6 pb-5">
            <PayrollTrendChart data={data.monthlyTrend} />
          </div>
        </div>
      )}

    </div>
  )
}

export default function PayrollPage() {
  return (
    <div className="animate-fade-in">
      <Suspense
        fallback={
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#e8edf4]">Payroll</h1>
              <p className="mt-1 text-sm text-[#7b8fa3]">
                Manage payroll allocations across departments and projects.
              </p>
            </div>
          </div>
        }
      >
        <PayrollContent />
      </Suspense>
    </div>
  )
}
