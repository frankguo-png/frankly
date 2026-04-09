'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import type { Database, Json } from '@/types/database'

type PayrollAllocation = Database['public']['Tables']['payroll_allocations']['Row']
type EmploymentType = NonNullable<PayrollAllocation['employment_type']>

interface AllocationTableProps {
  orgId: string
}

const DEPARTMENTS = ['Product', 'Engineering', 'Marketing', 'Sales', 'Operations', 'Admin'] as const
const PROJECTS = ['LNER', 'PWC', 'IWAKI', 'Brookfield', 'Internal'] as const
const AGENTS_BY_PROJECT: Record<string, string[]> = {
  LNER: ['Delay-Repay', 'TIVA', 'AVID', 'SAM', 'LUMA'],
  Brookfield: ['OSLO', 'EMMA'],
  PWC: ['Tax Data'],
  Internal: ['Agent Portal', 'Amp-Extract', 'Amp-Explore'],
  IWAKI: [],
}

const EMPLOYMENT_TYPE_CONFIG: Record<EmploymentType, { label: string; className: string }> = {
  full_time: { label: 'FT', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  contractor: { label: 'Contractor', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  part_time: { label: 'PT', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  intern: { label: 'Intern', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  hourly: { label: 'Hourly', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

interface RowState {
  department: string
  allocations: Record<string, number>
  saving: boolean
  dirty: boolean
}

interface NewEmployeeRow {
  employee_name: string
  employment_type: EmploymentType
  department: string
  annual_salary: string
  allocations: Record<string, number>
}

function getAllocationsFromJson(json: Json): Record<string, number> {
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    const result: Record<string, number> = {}
    for (const key of PROJECTS) {
      const val = (json as Record<string, Json | undefined>)[key]
      result[key] = typeof val === 'number' ? val : 0
    }
    return result
  }
  return Object.fromEntries(PROJECTS.map((p) => [p, 0]))
}

function allocationSum(allocs: Record<string, number>): number {
  return Object.values(allocs).reduce((sum, v) => sum + (v || 0), 0)
}

function isAllocationValid(allocs: Record<string, number>): boolean {
  const sum = allocationSum(allocs)
  return sum === 0 || sum === 100
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 8 }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-4 rounded animate-shimmer" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function AllocationTable({ orgId }: AllocationTableProps) {
  const [employees, setEmployees] = useState<PayrollAllocation[]>([])
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [loading, setLoading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [filterProject, setFilterProject] = useState<string | null>(null)
  const [filterAgent, setFilterAgent] = useState<string | null>(null)
  const [newRow, setNewRow] = useState<NewEmployeeRow>({
    employee_name: '',
    employment_type: 'full_time',
    department: 'Engineering',
    annual_salary: '',
    allocations: Object.fromEntries(PROJECTS.map((p) => [p, 0])),
  })
  const [savingNew, setSavingNew] = useState(false)

  const fetchEmployees = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('payroll_allocations')
      .select('*')
      .eq('org_id', orgId)
      .is('end_date', null)
      .order('department', { ascending: true })
      .order('employee_name', { ascending: true })

    if (error) {
      console.error('Failed to fetch payroll allocations:', error.message)
      setLoading(false)
      return
    }

    setEmployees(data ?? [])

    const states: Record<string, RowState> = {}
    for (const emp of data ?? []) {
      states[emp.id] = {
        department: emp.department ?? '',
        allocations: getAllocationsFromJson(emp.project_allocations),
        saving: false,
        dirty: false,
      }
    }
    setRowStates(states)
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  function updateRowDepartment(id: string, dept: string) {
    setRowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], department: dept, dirty: true },
    }))
  }

  function updateRowAllocation(id: string, project: string, value: string) {
    const num = value === '' ? 0 : Math.max(0, Math.min(100, parseInt(value, 10) || 0))
    setRowStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        allocations: { ...prev[id].allocations, [project]: num },
        dirty: true,
      },
    }))
  }

  async function saveRow(id: string) {
    const state = rowStates[id]
    if (!state || !state.dirty) return

    if (!isAllocationValid(state.allocations)) return

    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], saving: true } }))

    const supabase = createClient()
    const { error } = await supabase
      .from('payroll_allocations')
      .update({
        department: state.department || null,
        project_allocations: state.allocations as unknown as Json,
      })
      .eq('id', id)

    if (error) {
      console.error('Failed to save:', error.message)
    }

    setRowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], saving: false, dirty: !error },
    }))

    if (!error) {
      setRowStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], dirty: false },
      }))
    }
  }

  async function addEmployee() {
    if (!newRow.employee_name.trim() || !newRow.annual_salary) return
    if (!isAllocationValid(newRow.allocations)) return

    setSavingNew(true)
    const supabase = createClient()
    const { error } = await supabase.from('payroll_allocations').insert({
      org_id: orgId,
      employee_id: `manual_${Date.now()}`,
      employee_name: newRow.employee_name.trim(),
      employment_type: newRow.employment_type,
      department: newRow.department,
      annual_salary: parseFloat(newRow.annual_salary),
      project_allocations: newRow.allocations as unknown as Json,
      effective_date: new Date().toISOString().split('T')[0],
    })

    if (error) {
      console.error('Failed to add employee:', error.message)
      setSavingNew(false)
      return
    }

    setSavingNew(false)
    setAddingNew(false)
    setNewRow({
      employee_name: '',
      employment_type: 'full_time',
      department: 'Engineering',
      annual_salary: '',
      allocations: Object.fromEntries(PROJECTS.map((p) => [p, 0])),
    })
    fetchEmployees()
  }

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (filterProject) {
      const allocs = getAllocationsFromJson(emp.project_allocations)
      if (!allocs[filterProject] || allocs[filterProject] <= 0) return false
    }
    if (filterAgent) {
      const agents = (emp as any).ai_agents as string[] | null
      if (!agents || !agents.includes(filterAgent)) return false
    }
    return true
  })

  const totalSalary = filteredEmployees.reduce((sum, e) => sum + (e.annual_salary ?? 0), 0)
  const totalMonthlyCost = totalSalary / 12

  const activeFilters = (filterProject ? 1 : 0) + (filterAgent ? 1 : 0)

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
            Employee Allocations
          </h3>
        </div>
        {activeFilters > 0 && (
          <button
            onClick={() => { setFilterProject(null); setFilterAgent(null) }}
            className="text-[11px] text-[#7b8fa3] hover:text-[#c8d6e5] transition-colors duration-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filter pills - project + agent inline */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7b8fa3] uppercase tracking-wider font-medium shrink-0">Project</span>
          <div className="flex gap-1">
            {PROJECTS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (filterProject === p) {
                    setFilterProject(null)
                    setFilterAgent(null)
                  } else {
                    setFilterProject(p)
                    setFilterAgent(null)
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                  filterProject === p
                    ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                    : 'text-[#7b8fa3] hover:text-[#c8d6e5] hover:bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Agent pills - smooth horizontal reveal */}
          {filterProject && (AGENTS_BY_PROJECT[filterProject]?.length ?? 0) > 0 && (
            <>
              <div
                className="w-px h-5 shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  animation: 'agent-fade-in 0.3s ease-out both',
                }}
              />
              <span
                className="text-[10px] text-[#7b8fa3] uppercase tracking-wider font-medium shrink-0"
                style={{ animation: 'agent-fade-in 0.3s ease-out 0.05s both' }}
              >
                Agent
              </span>
              {(AGENTS_BY_PROJECT[filterProject] ?? []).map((a, i) => (
                <button
                  key={a}
                  onClick={() => setFilterAgent(filterAgent === a ? null : a)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
                    filterAgent === a
                      ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                      : 'text-[#7b8fa3] hover:text-[#c8d6e5] hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                  style={{
                    animation: `agent-pill-in 0.35s ease-out ${0.06 + i * 0.04}s both`,
                  }}
                >
                  {a}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.06)] hover:bg-transparent">
              <TableHead className="text-[#7b8fa3] text-xs font-medium">Employee</TableHead>
              <TableHead className="text-[#7b8fa3] text-xs font-medium">Type</TableHead>
              <TableHead className="text-[#7b8fa3] text-xs font-medium">Department</TableHead>
              <TableHead className="text-[#7b8fa3] text-xs font-medium text-right">Compensation</TableHead>
              <TableHead className="text-[#7b8fa3] text-xs font-medium text-center">Hrs/Wk</TableHead>
              <TableHead className="text-[#7b8fa3] text-xs font-medium text-right">Monthly Cost</TableHead>
              <TableHead className="text-[#7b8fa3] text-xs font-medium">AI Agents</TableHead>
              {PROJECTS.map((p) => (
                <TableHead key={p} className="text-[#5a6d82] text-xs font-medium text-center w-20">
                  {p} %
                </TableHead>
              ))}
              <TableHead className="text-[#7b8fa3] text-xs font-medium w-20" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : filteredEmployees.length === 0 && !addingNew ? (
              <TableRow>
                <TableCell
                  colSpan={9 + PROJECTS.length}
                  className="text-center py-16 text-[#6b7f94] text-sm"
                >
                  No employees synced yet. Connect Rippling or add manually.
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => {
                const state = rowStates[emp.id]
                if (!state) return null
                const sum = allocationSum(state.allocations)
                const valid = isAllocationValid(state.allocations)

                return (
                  <TableRow
                    key={emp.id}
                    className="border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]"
                  >
                    <TableCell className="text-sm text-[#c8d6e5] font-medium">
                      {emp.employee_name}
                    </TableCell>
                    <TableCell>
                      {emp.employment_type && (
                        <Badge
                          className={`text-[10px] px-2 py-0.5 border ${EMPLOYMENT_TYPE_CONFIG[emp.employment_type]?.className ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
                        >
                          {EMPLOYMENT_TYPE_CONFIG[emp.employment_type]?.label ?? emp.employment_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={state.department}
                        onValueChange={(val) => val && updateRowDepartment(emp.id, val)}
                      >
                        <SelectTrigger size="sm" className="w-32 h-7 text-xs bg-transparent border-[rgba(255,255,255,0.08)]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {emp.hourly_rate ? (
                        <span className="text-sm text-[#c8d6e5]">${emp.hourly_rate}/hr</span>
                      ) : (
                        <span className="text-sm text-[#c8d6e5]">{formatCurrency(emp.annual_salary ?? 0)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-[#7b8fa3] text-center tabular-nums">
                      {emp.hours_per_week ?? 40}
                    </TableCell>
                    <TableCell className="text-sm text-[#7b8fa3] text-right tabular-nums">
                      {emp.hourly_rate
                        ? formatCurrency(emp.hourly_rate * (emp.hours_per_week ?? 40) * 52 / 12)
                        : formatCurrency((emp.annual_salary ?? 0) / 12)
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {((emp as any).ai_agents as string[] ?? []).map((agent: string) => (
                          <span
                            key={agent}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(139,92,246,0.1)] text-purple-400 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors"
                            onClick={() => setFilterAgent(filterAgent === agent ? null : agent)}
                          >
                            {agent}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    {PROJECTS.map((p) => (
                      <TableCell key={p} className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={state.allocations[p] || ''}
                          onChange={(e) => updateRowAllocation(emp.id, p, e.target.value)}
                          className={`w-16 h-7 text-xs text-center mx-auto bg-transparent border-[rgba(255,255,255,0.08)] tabular-nums ${
                            !valid ? 'border-red-500/60 text-red-400' : ''
                          }`}
                          placeholder="0"
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!valid && (
                          <span className="text-[10px] text-red-400 whitespace-nowrap">
                            {sum}%
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!state.dirty || !valid || state.saving}
                          onClick={() => saveRow(emp.id)}
                          className="h-7 px-3 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-30"
                        >
                          {state.saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}

            {addingNew && (
              <TableRow className="border-[rgba(255,255,255,0.04)] bg-[rgba(59,130,246,0.04)]">
                <TableCell>
                  <Input
                    value={newRow.employee_name}
                    onChange={(e) => setNewRow((prev) => ({ ...prev, employee_name: e.target.value }))}
                    placeholder="Employee name"
                    className="h-7 text-xs bg-transparent border-[rgba(255,255,255,0.08)] w-36"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newRow.employment_type}
                    onValueChange={(val) =>
                      setNewRow((prev) => ({ ...prev, employment_type: val as EmploymentType }))
                    }
                  >
                    <SelectTrigger size="sm" className="w-28 h-7 text-xs bg-transparent border-[rgba(255,255,255,0.08)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_TYPE_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={newRow.department}
                    onValueChange={(val) => setNewRow((prev) => ({ ...prev, department: val ?? '' }))}
                  >
                    <SelectTrigger size="sm" className="w-32 h-7 text-xs bg-transparent border-[rgba(255,255,255,0.08)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={newRow.annual_salary}
                    onChange={(e) => setNewRow((prev) => ({ ...prev, annual_salary: e.target.value }))}
                    placeholder="Salary"
                    className="h-7 text-xs text-right bg-transparent border-[rgba(255,255,255,0.08)] w-28 tabular-nums"
                  />
                </TableCell>
                <TableCell className="text-sm text-[#7b8fa3] text-right tabular-nums">
                  {newRow.annual_salary
                    ? formatCurrency(parseFloat(newRow.annual_salary) / 12)
                    : '-'}
                </TableCell>
                {PROJECTS.map((p) => (
                  <TableCell key={p} className="text-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={newRow.allocations[p] || ''}
                      onChange={(e) => {
                        const num = e.target.value === '' ? 0 : Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
                        setNewRow((prev) => ({
                          ...prev,
                          allocations: { ...prev.allocations, [p]: num },
                        }))
                      }}
                      className={`w-16 h-7 text-xs text-center mx-auto bg-transparent border-[rgba(255,255,255,0.08)] tabular-nums ${
                        !isAllocationValid(newRow.allocations) ? 'border-red-500/60 text-red-400' : ''
                      }`}
                      placeholder="0"
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!isAllocationValid(newRow.allocations) && (
                      <span className="text-[10px] text-red-400">
                        {allocationSum(newRow.allocations)}%
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={
                        !newRow.employee_name.trim() ||
                        !newRow.annual_salary ||
                        !isAllocationValid(newRow.allocations) ||
                        savingNew
                      }
                      onClick={addEmployee}
                      className="h-7 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    >
                      {savingNew ? '...' : 'Add'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingNew(false)}
                      className="h-7 px-2 text-xs text-[#7b8fa3] hover:text-[#c8d6e5] hover:bg-white/5"
                    >
                      Cancel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {filteredEmployees.length > 0 && (
            <TableFooter>
              <TableRow className="border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                <TableCell className="text-xs font-semibold text-[#7b8fa3]">
                  Total ({filteredEmployees.length}{activeFilters > 0 ? ` of ${employees.length}` : ''} employees)
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-xs font-semibold text-[#c8d6e5] text-right tabular-nums">
                  {formatCurrency(totalSalary)}
                </TableCell>
                <TableCell className="text-xs font-semibold text-[#c8d6e5] text-right tabular-nums">
                  {formatCurrency(totalMonthlyCost)}
                </TableCell>
                {PROJECTS.map((p) => (
                  <TableCell key={p} />
                ))}
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.04)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddingNew(true)}
          disabled={addingNew}
          className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
        >
          + Add Employee
        </Button>
      </div>
    </div>
  )
}
