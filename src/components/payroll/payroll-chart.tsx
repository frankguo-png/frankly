'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCompactCurrency } from '@/lib/utils/currency'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, subMonths, startOfMonth } from 'date-fns'
import type { Database, Json } from '@/types/database'

type PayrollAllocation = Database['public']['Tables']['payroll_allocations']['Row']

interface PayrollChartProps {
  orgId: string
}

const DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: '#3b82f6',
  Product: '#8b5cf6',
  Marketing: '#f59e0b',
  Sales: '#22c55e',
  Operations: '#6366f1',
  Admin: '#ec4899',
  Uncategorized: '#64748b',
}

const PROJECT_COLORS: Record<string, string> = {
  LNER: '#3b82f6',
  PWC: '#22c55e',
  IWAKI: '#f59e0b',
  Brookfield: '#8b5cf6',
  Unallocated: '#64748b',
}

function getAllocationsFromJson(json: Json): Record<string, number> {
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    const result: Record<string, number> = {}
    for (const [key, val] of Object.entries(json)) {
      if (typeof val === 'number') {
        result[key] = val
      }
    }
    return result
  }
  return {}
}

function formatYAxisValue(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

function CustomTooltip({
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

export function PayrollChart({ orgId }: PayrollChartProps) {
  const [employees, setEmployees] = useState<PayrollAllocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('payroll_allocations')
        .select('*')
        .eq('org_id', orgId)
        .is('end_date', null)

      if (error) {
        console.error('Failed to fetch payroll data:', error.message)
        setLoading(false)
        return
      }

      setEmployees(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [orgId])

  const { departmentData, projectData, allDepartments, allProjects } = useMemo(() => {
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const month = startOfMonth(subMonths(now, i))
      months.push(format(month, 'MMM yyyy'))
    }

    // Build department chart data
    const deptMap = new Map<string, number>()
    for (const emp of employees) {
      const dept = emp.department ?? 'Uncategorized'
      const monthly = (emp.annual_salary ?? 0) / 12
      deptMap.set(dept, (deptMap.get(dept) ?? 0) + monthly)
    }

    const allDepts = Array.from(deptMap.keys()).sort()

    // For simplicity, repeat same monthly cost across last 6 months
    // (payroll allocations don't have per-month history, they represent current state)
    const deptData = months.map((month) => {
      const row: Record<string, string | number> = { month }
      for (const dept of allDepts) {
        row[dept] = Math.round((deptMap.get(dept) ?? 0) * 100) / 100
      }
      return row
    })

    // Build project chart data
    const projMap = new Map<string, number>()
    for (const emp of employees) {
      const monthly = (emp.annual_salary ?? 0) / 12
      const allocs = getAllocationsFromJson(emp.project_allocations)
      const allocSum = Object.values(allocs).reduce((s, v) => s + v, 0)

      for (const [proj, pct] of Object.entries(allocs)) {
        if (pct > 0) {
          projMap.set(proj, (projMap.get(proj) ?? 0) + monthly * (pct / 100))
        }
      }

      if (allocSum < 100) {
        const unallocated = monthly * ((100 - allocSum) / 100)
        if (unallocated > 0) {
          projMap.set('Unallocated', (projMap.get('Unallocated') ?? 0) + unallocated)
        }
      }
    }

    const allProjs = Array.from(projMap.keys()).sort()

    const projData = months.map((month) => {
      const row: Record<string, string | number> = { month }
      for (const proj of allProjs) {
        row[proj] = Math.round((projMap.get(proj) ?? 0) * 100) / 100
      }
      return row
    })

    return {
      departmentData: deptData,
      projectData: projData,
      allDepartments: allDepts,
      allProjects: allProjs,
    }
  }, [employees])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Department chart */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
            Payroll by Department
          </h3>
        </div>
        <div className="px-6 pb-5">
          {loading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="h-full w-full rounded-lg animate-shimmer" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#6b7f94]">
              No payroll data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={departmentData}
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
                  tickFormatter={formatYAxisValue}
                  tick={{ fill: '#7b8fa3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.03)' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#7b8fa3', paddingBottom: 8 }}
                />
                {allDepartments.map((dept) => (
                  <Bar
                    key={dept}
                    dataKey={dept}
                    stackId="dept"
                    fill={DEPARTMENT_COLORS[dept] ?? '#64748b'}
                    radius={0}
                    barSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Project chart */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
            Payroll by Project
          </h3>
        </div>
        <div className="px-6 pb-5">
          {loading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="h-full w-full rounded-lg animate-shimmer" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-[#6b7f94]">
              No payroll data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={projectData}
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
                  tickFormatter={formatYAxisValue}
                  tick={{ fill: '#7b8fa3', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.03)' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#7b8fa3', paddingBottom: 8 }}
                />
                {allProjects.map((proj) => (
                  <Bar
                    key={proj}
                    dataKey={proj}
                    stackId="proj"
                    fill={PROJECT_COLORS[proj] ?? '#64748b'}
                    radius={0}
                    barSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
