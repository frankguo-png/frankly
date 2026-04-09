'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useBonusReviews } from '@/hooks/use-bonus-reviews'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils/currency'
import {
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gift,
  TrendingUp,
  Banknote,
  BarChart3,
  Star,
  Plus,
  X,
  ArrowRight,
  Search,
  Calculator,
} from 'lucide-react'
import type { BonusRow } from '@/app/api/bonus-reviews/route'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  pending_approval: { label: 'Pending Approval', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  scheduled: { label: 'Scheduled', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  paid: { label: 'Paid', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
}

const STATUS_FLOW: Record<string, string[]> = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'rejected'],
  approved: ['scheduled', 'paid'],
  scheduled: ['paid'],
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Gift; color: string }> = {
  annual_performance: { label: 'Annual Performance', icon: Star, color: '#a855f7' },
  spot: { label: 'Spot Bonus', icon: Gift, color: '#f59e0b' },
  retention: { label: 'Retention', icon: TrendingUp, color: '#22c55e' },
  signing: { label: 'Signing', icon: Banknote, color: '#3b82f6' },
  project_completion: { label: 'Project', icon: CheckCircle2, color: '#06b6d4' },
  referral: { label: 'Referral', icon: Gift, color: '#f472b6' },
}

const INPUT_CLASS = 'w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40'

interface EmployeeOption {
  id: string
  name: string
  title: string | null
  department: string | null
  salary: number | null
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_LABELS[type] ?? TYPE_LABELS.spot
  const Icon = config.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${config.color}15`, color: config.color }}
    >
      <Icon className="size-2.5" />
      {config.label}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  subtitle,
}: {
  icon: typeof DollarSign
  label: string
  value: string | number
  color: string
  bg: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-all duration-300 hover:border-[rgba(255,255,255,0.1)]">
      <div className="flex items-center justify-center size-9 rounded-lg shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="size-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-[#e8edf4] tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-[#7b8fa3] leading-tight mt-0.5 truncate">{label}</p>
        {subtitle && <p className="text-[10px] text-[#5b6e82] truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function TypeBreakdown({ byType }: { byType: Record<string, { count: number; amount: number }> }) {
  const entries = Object.entries(byType).sort(([, a], [, b]) => b.amount - a.amount)
  const maxAmount = Math.max(...entries.map(([, v]) => v.amount), 1)

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">By Type</p>
      {entries.map(([type, { count, amount }]) => {
        const config = TYPE_LABELS[type] ?? TYPE_LABELS.spot
        const pct = (amount / maxAmount) * 100
        return (
          <div key={type} className="flex items-center gap-2">
            <span className="text-[10px] text-[#c0cad8] w-28 truncate">{config.label}</span>
            <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: config.color, opacity: 0.6 }}
              />
            </div>
            <span className="text-[10px] text-[#7b8fa3] tabular-nums w-16 text-right">{formatCompactCurrency(amount)}</span>
            <span className="text-[10px] text-[#5b6e82] tabular-nums w-4 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function DepartmentBreakdown({
  departments,
}: {
  departments: Array<{ department: string; count: number; totalAmount: number; avgAmount: number }>
}) {
  const maxAmount = Math.max(...departments.map(d => d.totalAmount), 1)

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">By Department</p>
      {departments.map((d) => {
        const pct = (d.totalAmount / maxAmount) * 100
        return (
          <div key={d.department} className="flex items-center gap-2">
            <span className="text-[11px] text-[#c0cad8] w-24 truncate">{d.department}</span>
            <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out bg-cyan-500/50"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-[#7b8fa3] tabular-nums w-16 text-right">{formatCompactCurrency(d.totalAmount)}</span>
            <span className="text-[10px] text-[#5b6e82] tabular-nums w-10 text-right">avg {formatCompactCurrency(d.avgAmount)}</span>
          </div>
        )
      })}
    </div>
  )
}

function ConfirmDialogWithComment({ title, message, confirmLabel, confirmColor, requireComment, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; confirmColor?: string; requireComment?: boolean
  onConfirm: (comment: string) => void; onCancel: () => void
}) {
  const [comment, setComment] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#111d2e] p-5 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h4 className="text-sm font-semibold text-[#e8edf4] mb-2">{title}</h4>
        <p className="text-xs text-[#7b8fa3] mb-3 leading-relaxed">{message}</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={requireComment ? 'Required: reason for this decision...' : 'Optional comment...'}
          rows={2}
          className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#5b6e82] focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none mb-3"
        />
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-[#7b8fa3] hover:text-[#e8edf4] transition-colors">Cancel</button>
          <button onClick={() => onConfirm(comment)} disabled={requireComment && !comment.trim()} className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${confirmColor ?? 'bg-blue-600 hover:bg-blue-500'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function BonusRowItem({
  bonus,
  expanded,
  onToggle,
  onStatusChange,
}: {
  bonus: BonusRow
  expanded: boolean
  onToggle: () => void
  onStatusChange: (bonusId: string, newStatus: string, comment?: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const initials = bonus.employee_name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const nextStatuses = STATUS_FLOW[bonus.status] ?? []

  async function handleConfirmedAction(comment: string) {
    if (!confirmAction) return
    setSaving(true)
    try {
      await onStatusChange(bonus.id, confirmAction, comment || undefined)
      toast.success(`Bonus ${STATUS_CONFIG[confirmAction]?.label.toLowerCase()}${comment ? ` — ${comment}` : ''}`)
      setConfirmAction(null)
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors duration-200 hover:bg-[rgba(255,255,255,0.02)]"
      >
        <div className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 text-[10px] font-bold text-white/90 shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#e8edf4] truncate">{bonus.employee_name}</p>
          <p className="text-[10px] text-[#7b8fa3] truncate">
            {bonus.employee_title ?? 'No title'} {bonus.employee_department ? `· ${bonus.employee_department}` : ''}
          </p>
        </div>
        <div className="shrink-0">
          <TypeBadge type={bonus.bonus_type} />
        </div>
        <span className="text-[12px] font-semibold tabular-nums text-[#e8edf4] shrink-0 w-20 text-right">
          {formatCurrency(bonus.amount)}
        </span>
        <div className="shrink-0">
          <StatusBadge status={bonus.status} />
        </div>
        {expanded ? (
          <ChevronUp className="size-3.5 text-[#5b6e82] shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-[#5b6e82] shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-[rgba(255,255,255,0.03)]">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bonus.percentage_of_salary != null && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">% of Salary</p>
                <p className="text-[11px] text-[#c0cad8] tabular-nums">{bonus.percentage_of_salary.toFixed(1)}%</p>
              </div>
            )}
            {bonus.base_salary_at_time != null && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Base Salary</p>
                <p className="text-[11px] text-[#c0cad8] tabular-nums">{formatCurrency(bonus.base_salary_at_time)}</p>
              </div>
            )}
            {bonus.performance_rating_at_time != null && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Perf. Rating</p>
                <p className="text-[11px] text-[#c0cad8] tabular-nums">{bonus.performance_rating_at_time.toFixed(1)}</p>
              </div>
            )}
            {bonus.effective_date && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Effective Date</p>
                <p className="text-[11px] text-[#c0cad8]">{bonus.effective_date}</p>
              </div>
            )}
            {bonus.payout_date && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Payout Date</p>
                <p className="text-[11px] text-[#c0cad8]">{bonus.payout_date}</p>
              </div>
            )}
            {bonus.proposed_by_name && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Proposed By</p>
                <p className="text-[11px] text-[#c0cad8]">{bonus.proposed_by_name}</p>
              </div>
            )}
            {bonus.fiscal_year && (
              <div>
                <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Fiscal Period</p>
                <p className="text-[11px] text-[#c0cad8] tabular-nums">
                  FY{bonus.fiscal_year}{bonus.fiscal_quarter ? ` Q${bonus.fiscal_quarter}` : ''}
                </p>
              </div>
            )}
          </div>
          {bonus.reason && (
            <div>
              <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Criteria / Justification</p>
              <p className="text-[11px] text-[#c0cad8] leading-relaxed bg-[rgba(255,255,255,0.02)] rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.04)]">{bonus.reason}</p>
            </div>
          )}

          {/* Status actions with confirmation */}
          {nextStatuses.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              {nextStatuses.map((ns) => {
                const isReject = ns === 'rejected'
                return (
                  <button
                    key={ns}
                    onClick={() => setConfirmAction(ns)}
                    disabled={saving}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50 ${
                      isReject
                        ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                  >
                    {isReject ? 'Reject' : STATUS_CONFIG[ns]?.label ?? ns}
                    {!isReject && <ArrowRight className="size-3" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {confirmAction && (
        <ConfirmDialogWithComment
          title={`${confirmAction === 'rejected' ? 'Reject' : STATUS_CONFIG[confirmAction]?.label} this bonus?`}
          message={`${formatCurrency(bonus.amount)} ${TYPE_LABELS[bonus.bonus_type]?.label ?? bonus.bonus_type} bonus for ${bonus.employee_name}.${confirmAction === 'rejected' ? ' A rejection reason is required.' : ''}`}
          confirmLabel={confirmAction === 'rejected' ? 'Reject Bonus' : STATUS_CONFIG[confirmAction]?.label ?? confirmAction}
          confirmColor={confirmAction === 'rejected' ? 'bg-red-600 hover:bg-red-500' : undefined}
          requireComment={confirmAction === 'rejected'}
          onConfirm={handleConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

export function BonusReviews() {
  const { data, error, isLoading, mutate } = useBonusReviews()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Create bonus form
  const [showCreate, setShowCreate] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [formEmployee, setFormEmployee] = useState('')
  const [formType, setFormType] = useState('spot')
  const [formAmount, setFormAmount] = useState('')
  const [formPct, setFormPct] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formEffectiveDate, setFormEffectiveDate] = useState('')
  const [formPayoutDate, setFormPayoutDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch employees for the dropdown (with salary for % calc)
  useEffect(() => {
    if (!showCreate) return
    fetch('/api/org-chart')
      .then(r => r.json())
      .then(orgData => {
        const list: EmployeeOption[] = []
        function walk(node: { id: string; name: string; title: string | null; department: string | null; children?: unknown[] }) {
          list.push({ id: node.id, name: node.name, title: node.title, department: node.department, salary: null })
          if (Array.isArray(node.children)) {
            for (const child of node.children) walk(child as typeof node)
          }
        }
        for (const root of orgData.tree ?? []) walk(root)
        // Fetch salaries separately from employees endpoint (org-chart doesn't include salary)
        fetch('/api/performance-reviews')
          .then(r => r.json())
          .then(() => {
            // Enrich with salary from bonus data if available
            if (data?.bonuses) {
              for (const emp of list) {
                const bonus = data.bonuses.find(b => b.employee_id === emp.id && b.base_salary_at_time != null)
                if (bonus) emp.salary = bonus.base_salary_at_time
              }
            }
            setEmployees(list.sort((a, b) => a.name.localeCompare(b.name)))
          })
          .catch(() => setEmployees(list.sort((a, b) => a.name.localeCompare(b.name))))
      })
      .catch(() => {})
  }, [showCreate, data])

  // Selected employee salary for % calculator
  const selectedEmpSalary = useMemo(() => {
    if (!formEmployee) return null
    const emp = employees.find(e => e.id === formEmployee)
    if (emp?.salary) return emp.salary
    // Fallback: check bonus history
    if (data) {
      const bonus = data.bonuses.find(b => b.employee_id === formEmployee && b.base_salary_at_time != null)
      if (bonus?.base_salary_at_time) return bonus.base_salary_at_time
    }
    return null
  }, [formEmployee, employees, data])

  function handlePctChange(pct: string) {
    setFormPct(pct)
    if (selectedEmpSalary && pct) {
      const amount = (selectedEmpSalary * parseFloat(pct)) / 100
      if (!isNaN(amount)) setFormAmount(amount.toFixed(0))
    }
  }

  async function handleCreateBonus() {
    const errors: Record<string, string> = {}
    if (!formEmployee) errors.employee = 'Employee is required'
    if (!formAmount || parseFloat(formAmount) <= 0) errors.amount = 'Amount must be greater than 0'
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/bonus-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_bonus',
          employee_id: formEmployee,
          bonus_type: formType,
          amount: parseFloat(formAmount),
          reason: formReason.trim() || null,
          effective_date: formEffectiveDate || null,
          payout_date: formPayoutDate || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Bonus proposed')
      setShowCreate(false)
      setFormEmployee('')
      setFormType('spot')
      setFormAmount('')
      setFormReason('')
      setFormEffectiveDate('')
      setFormPayoutDate('')
      setFormErrors({})
      mutate()
    } catch {
      toast.error('Failed to create bonus')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(bonusId: string, newStatus: string, comment?: string) {
    const res = await fetch('/api/bonus-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_bonus', bonus_id: bonusId, status: newStatus, comment }),
    })
    if (!res.ok) throw new Error('Failed')
    mutate()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] animate-shimmer" />
          ))}
        </div>
        <div className="h-[300px] rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] animate-shimmer" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="size-6 text-red-400/80 mb-3" />
        <p className="text-sm text-red-400 mb-3">Failed to load bonuses</p>
        <button onClick={() => mutate()} className="text-xs text-blue-400 hover:text-blue-300 underline">Try again</button>
      </div>
    )
  }

  const hasData = data && data.bonuses.length > 0
  const summary = data?.summary
  const bonuses = data?.bonuses ?? []

  const filtered = bonuses.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (typeFilter !== 'all' && b.bonus_type !== typeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!b.employee_name.toLowerCase().includes(q) && !(b.employee_title ?? '').toLowerCase().includes(q) && !(b.employee_department ?? '').toLowerCase().includes(q) && !(b.reason ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* Create button */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-blue-500"
        >
          {showCreate ? <X className="size-3" /> : <Plus className="size-3" />}
          {showCreate ? 'Cancel' : 'Propose Bonus'}
        </button>
      </div>

      {/* Create Bonus Form */}
      {showCreate && (
        <div
          className="rounded-xl border border-blue-500/20 bg-[#111d2e]/80 backdrop-blur-sm p-5"
          style={{ animation: 'slide-up 0.3s ease-out both' }}
        >
          <h3 className="text-sm font-medium text-[#e8edf4] mb-4">Propose Bonus</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Employee *</label>
              <select
                value={formEmployee}
                onChange={(e) => { setFormEmployee(e.target.value); if (formErrors.employee) setFormErrors(p => { const n = { ...p }; delete n.employee; return n }) }}
                className={INPUT_CLASS}
              >
                <option value="">Select employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}{e.department ? ` (${e.department})` : ''}</option>
                ))}
              </select>
              {formErrors.employee && <p className="text-red-400 text-xs mt-1">{formErrors.employee}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Bonus Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value)} className={INPUT_CLASS}>
                {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Amount *</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => { setFormAmount(e.target.value); setFormPct(''); if (formErrors.amount) setFormErrors(p => { const n = { ...p }; delete n.amount; return n }) }}
                placeholder="5000"
                className={`${INPUT_CLASS} tabular-nums`}
              />
              {formErrors.amount && <p className="text-red-400 text-xs mt-1">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs text-[#7b8fa3] mb-1"><Calculator className="size-3" />% of Salary</label>
              <input
                type="number"
                value={formPct}
                onChange={(e) => handlePctChange(e.target.value)}
                placeholder={selectedEmpSalary ? `of ${formatCurrency(selectedEmpSalary)}` : 'Select employee first'}
                disabled={!selectedEmpSalary}
                className={`${INPUT_CLASS} tabular-nums disabled:opacity-40`}
              />
              {selectedEmpSalary && formPct && <p className="text-[10px] text-[#5b6e82] mt-0.5">{formPct}% of {formatCurrency(selectedEmpSalary)} = {formatCurrency(parseFloat(formAmount) || 0)}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Effective Date</label>
              <input type="date" value={formEffectiveDate} onChange={(e) => setFormEffectiveDate(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Payout Date</label>
              <input type="date" value={formPayoutDate} onChange={(e) => setFormPayoutDate(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-[#7b8fa3] mb-1">Reason / Justification</label>
              <input
                type="text"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Exceptional Q1 delivery..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateBonus}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Propose Bonus'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setFormErrors({}) }}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasData && !showCreate && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80">
          <div className="flex items-center justify-center size-12 rounded-xl bg-[rgba(6,182,212,0.08)] mb-4">
            <DollarSign className="size-6 text-cyan-400" />
          </div>
          <p className="text-sm font-medium text-[#c0cad8] mb-1">No bonuses yet</p>
          <p className="text-xs text-[#7b8fa3] max-w-[280px] mb-4">
            Propose bonuses for team members to start tracking compensation decisions and approvals.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-blue-500"
          >
            <Plus className="size-3" />
            Propose Bonus
          </button>
        </div>
      )}

      {/* Data views */}
      {hasData && summary && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Gift} label="Total Bonuses" value={summary.total} color="#06b6d4" bg="rgba(6,182,212,0.08)" />
            <StatCard icon={DollarSign} label="Total Amount" value={formatCompactCurrency(summary.totalAmount)} color="#22c55e" bg="rgba(34,197,94,0.08)" />
            <StatCard icon={Clock} label="Pending Approval" value={summary.pendingApprovalCount} color="#f59e0b" bg="rgba(245,158,11,0.08)" subtitle="Action required" />
            <StatCard icon={Banknote} label="Paid This Year" value={formatCompactCurrency(summary.paidThisYear)} color="#a855f7" bg="rgba(168,85,247,0.08)" />
          </div>

          {/* Analytics row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
              <TypeBreakdown byType={summary.byType} />
            </div>
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
              <DepartmentBreakdown departments={summary.byDepartment} />
            </div>
          </div>

          {/* Filters + List */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#5b6e82]" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, department, reason..." className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] pl-7 pr-3 py-1.5 text-[11px] text-[#e8edf4] placeholder:text-[#5b6e82] focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-[11px] text-[#c0cad8] border border-[rgba(255,255,255,0.08)] rounded-md px-2 py-1 outline-none focus:border-[rgba(255,255,255,0.2)]">
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-transparent text-[11px] text-[#c0cad8] border border-[rgba(255,255,255,0.08)] rounded-md px-2 py-1 outline-none focus:border-[rgba(255,255,255,0.2)]">
                <option value="all">All Types</option>
                {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <span className="text-[10px] text-[#5b6e82] ml-auto tabular-nums">{filtered.length} bonuses</span>
            </div>

            <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
              <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-8 shrink-0" />
              <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider flex-1">Employee</span>
              <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider shrink-0 w-28">Type</span>
              <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider shrink-0 w-20 text-right">Amount</span>
              <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider shrink-0 w-24">Status</span>
              <span className="w-3.5 shrink-0" />
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {filtered.map((bonus) => (
                <BonusRowItem
                  key={bonus.id}
                  bonus={bonus}
                  expanded={expandedId === bonus.id}
                  onToggle={() => setExpandedId(expandedId === bonus.id ? null : bonus.id)}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {filtered.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-xs text-[#5b6e82]">No bonuses match the current filters</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
