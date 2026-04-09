'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/currency'
import { BudgetVsActual } from '@/components/dashboard/budget-vs-actual'
import { toast } from 'sonner'
import { AlertTriangle, Trash2 } from 'lucide-react'
import type { BudgetLineItem } from '@/lib/kpi/budget'

interface BudgetRecord {
  id: string
  org_id: string
  category: string | null
  department: string | null
  project: string | null
  monthly_amount: number
  effective_month: string
  created_at: string
  updated_at: string
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function BudgetsContent() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [comparison, setComparison] = useState<BudgetLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  // New budget line state
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState<'category' | 'department' | 'project'>('category')
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [editAmountError, setEditAmountError] = useState<string | null>(null)

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/budgets?month=${month}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setBudgets(data.budgets ?? [])
      setComparison(data.comparison ?? [])
    } catch (err) {
      console.error('Failed to fetch budgets:', err)
      setFetchError('Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  async function handleSave(budgetId: string, newAmount: number) {
    if (newAmount <= 0) {
      setEditAmountError('Amount must be positive')
      return
    }
    setEditAmountError(null)
    setSaving(true)
    try {
      const budget = budgets.find((b) => b.id === budgetId)
      if (!budget) return

      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: budgetId,
          category: budget.category,
          department: budget.department,
          project: budget.project,
          monthly_amount: newAmount,
          effective_month: budget.effective_month,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')

      setEditingId(null)
      setEditAmount('')
      await fetchBudgets()
    } catch (err) {
      console.error('Failed to save budget:', err)
      toast.error('Failed to save budget. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    let hasError = false
    if (!newName.trim()) {
      setNameError('Name is required')
      hasError = true
    }
    if (!newAmount || parseFloat(newAmount) <= 0) {
      setAmountError('Amount must be positive')
      hasError = true
    }
    if (hasError) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        monthly_amount: parseFloat(newAmount),
        effective_month: month,
      }

      if (newType === 'category') body.category = newName.trim()
      else if (newType === 'department') body.department = newName.trim()
      else if (newType === 'project') body.project = newName.trim()

      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed to create')

      setShowAdd(false)
      setNewName('')
      setNewAmount('')
      await fetchBudgets()
    } catch (err) {
      console.error('Failed to add budget:', err)
      toast.error('Failed to add budget. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(budgetId: string) {
    if (!window.confirm('Delete this budget line?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/budgets?id=${budgetId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Budget line deleted')
      if (editingId === budgetId) {
        setEditingId(null)
        setEditAmount('')
        setEditAmountError(null)
      }
      await fetchBudgets()
    } catch (err) {
      console.error('Failed to delete budget:', err)
      toast.error('Failed to delete budget. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function getBudgetLabel(b: BudgetRecord): string {
    if (b.category) return b.category
    if (b.department) return b.department
    if (b.project) return b.project
    return 'Total Budget'
  }

  function getBudgetType(b: BudgetRecord): string {
    if (b.category) return 'Category'
    if (b.department) return 'Department'
    if (b.project) return 'Project'
    return 'Total'
  }

  // Generate month options for the selector (past 12 months + next 3)
  const monthOptions: string[] = []
  const now = new Date()
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    monthOptions.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Budgets</h1>
          <p className="text-sm text-[#5a6d82] mt-1">
            Track budget vs actual spend by category
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111d2e] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                })}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Budget
          </button>
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 text-sm mb-3">{fetchError}</p>
          <button onClick={() => fetchBudgets()} className="text-xs text-blue-400 hover:text-blue-300 underline">
            Try again
          </button>
        </div>
      )}

      {/* Budget vs Actual Chart */}
      <BudgetVsActual data={comparison} loading={loading} />

      {/* Overage summary banner */}
      {!loading && comparison.length > 0 && (() => {
        const overBudgetCount = comparison.filter(c => c.budget > 0 && c.actual >= c.budget).length
        const nearingLimitCount = comparison.filter(c => c.budget > 0 && c.actual >= c.budget * 0.8 && c.actual < c.budget).length
        if (overBudgetCount === 0 && nearingLimitCount === 0) return null
        return (
          <div
            className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 ${
              overBudgetCount > 0
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-amber-500/30 bg-amber-500/10'
            }`}
          >
            <AlertTriangle className={`h-5 w-5 shrink-0 ${overBudgetCount > 0 ? 'text-red-400' : 'text-amber-400'}`} />
            <div className="text-sm">
              {overBudgetCount > 0 && (
                <span className="font-medium text-red-400">
                  {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} over budget this month
                </span>
              )}
              {overBudgetCount > 0 && nearingLimitCount > 0 && (
                <span className="text-[#7b8fa3] mx-1.5">&middot;</span>
              )}
              {nearingLimitCount > 0 && (
                <span className="font-medium text-amber-400">
                  {nearingLimitCount} nearing limit
                </span>
              )}
            </div>
          </div>
        )
      })()}

      {/* Add new budget row */}
      {showAdd && (
        <div
          className="rounded-xl border border-blue-500/20 bg-[#111d2e]/80 backdrop-blur-sm p-5"
          style={{ animation: 'slide-up 0.3s ease-out both' }}
        >
          <h3 className="text-sm font-medium text-[#e8edf4] mb-4">
            New Budget Line
          </h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[#7b8fa3] mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as 'category' | 'department' | 'project')
                }
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                <option value="category">Category</option>
                <option value="department">Department</option>
                <option value="project">Project</option>
              </select>
            </div>
            <div className="flex-[2]">
              <label className="block text-xs text-[#7b8fa3] mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  if (nameError) setNameError(null)
                }}
                placeholder="e.g., Payroll, Engineering, LNER"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[#7b8fa3] mb-1">
                Monthly Amount
              </label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => {
                  setNewAmount(e.target.value)
                  if (amountError) setAmountError(null)
                }}
                placeholder="10000"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40 tabular-nums"
              />
              {amountError && <p className="text-red-400 text-xs mt-1">{amountError}</p>}
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
            <button
              onClick={() => {
                setShowAdd(false)
                setNewName('')
                setNewAmount('')
                setNameError(null)
                setAmountError(null)
              }}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Budget Table */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
            Budget Lines
          </h3>
        </div>
        {loading ? (
          <div className="px-6 pb-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : !budgets.length ? (
          <div className="px-6 pb-8 text-center">
            <p className="text-sm text-[#6b7f94]">
              No budgets set for this month.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Add your first budget line
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-b border-[rgba(255,255,255,0.04)]">
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Monthly Budget
                  </th>
                  <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr
                    key={budget.id}
                    className="border-b border-[rgba(255,255,255,0.03)] hover:bg-white/[0.02] transition-colors duration-150"
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-medium text-[#e8edf4]">
                        {getBudgetLabel(budget)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#1a2a3e] text-[#7b8fa3]">
                        {getBudgetType(budget)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {editingId === budget.id ? (
                        <div>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => {
                              setEditAmount(e.target.value)
                              if (editAmountError) setEditAmountError(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editAmount) {
                                handleSave(budget.id, parseFloat(editAmount))
                              }
                              if (e.key === 'Escape') {
                                setEditingId(null)
                                setEditAmount('')
                                setEditAmountError(null)
                              }
                            }}
                            autoFocus
                            className="w-32 rounded-lg border border-blue-500/30 bg-[#0d1a2d] px-3 py-1 text-sm text-[#e8edf4] text-right focus:outline-none focus:ring-1 focus:ring-blue-500/40 tabular-nums"
                          />
                          {editAmountError && <p className="text-red-400 text-xs mt-1">{editAmountError}</p>}
                        </div>
                      ) : (
                        <span className="text-sm font-semibold tabular-nums text-[#e8edf4]">
                          {formatCurrency(Number(budget.monthly_amount))}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {(() => {
                        const label = getBudgetLabel(budget)
                        const comp = comparison.find(c => c.name === label)
                        if (!comp || comp.budget <= 0) return <span className="text-[#5a6d82] text-xs">--</span>
                        const pct = comp.actual / comp.budget
                        if (pct >= 1) {
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                              <AlertTriangle className="h-3 w-3" />
                              Over budget
                            </span>
                          )
                        }
                        if (pct >= 0.8) {
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="h-3 w-3" />
                              Nearing limit
                            </span>
                          )
                        }
                        return (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            On track
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {editingId === budget.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              if (editAmount) {
                                handleSave(budget.id, parseFloat(editAmount))
                              }
                            }}
                            disabled={saving || !editAmount}
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null)
                              setEditAmount('')
                              setEditAmountError(null)
                            }}
                            className="text-xs text-[#7b8fa3] hover:text-[#9baab8] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(budget.id)}
                            disabled={saving}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors ml-1"
                            title="Delete budget line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(budget.id)
                            setEditAmount(String(budget.monthly_amount))
                          }}
                          className="text-xs text-[#7b8fa3] hover:text-blue-400 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BudgetsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 rounded animate-shimmer" />
          <div className="h-[300px] rounded-xl border border-[rgba(255,255,255,0.04)] animate-shimmer" />
          <div className="h-[400px] rounded-xl border border-[rgba(255,255,255,0.04)] animate-shimmer" />
        </div>
      }
    >
      <BudgetsContent />
    </Suspense>
  )
}
