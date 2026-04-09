'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { usePerformanceReviews } from '@/hooks/use-performance-reviews'
import {
  ClipboardCheck,
  AlertCircle,
  Star,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  FileText,
  Plus,
  X,
  ArrowRight,
  Search,
  AlertTriangle,
  Users,
  CheckCheck,
} from 'lucide-react'
import type { PerformanceReviewRow, ReviewCycleRow } from '@/app/api/performance-reviews/route'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  self_review: { label: 'Self Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  manager_review: { label: 'Manager Review', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  calibration: { label: 'Calibration', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  finalized: { label: 'Finalized', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  acknowledged: { label: 'Acknowledged', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
}

const STATUS_FLOW: Record<string, string> = {
  not_started: 'self_review',
  self_review: 'manager_review',
  manager_review: 'calibration',
  calibration: 'finalized',
  finalized: 'acknowledged',
}

const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs Improvement',
  3: 'Meets Expectations',
  4: 'Exceeds',
  5: 'Outstanding',
}

const RATING_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#3b82f6',
  4: '#22c55e',
  5: '#a855f7',
}

const INPUT_CLASS = 'w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40'
const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`

/* ---------- Shared sub-components ---------- */

function RatingStars({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-[11px] text-[#5b6e82]">--</span>
  const rounded = Math.round(rating)
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-3" fill={i < rounded ? RATING_COLORS[rounded] : 'transparent'} stroke={i < rounded ? RATING_COLORS[rounded] : '#5b6e82'} strokeWidth={1.5} />
        ))}
      </div>
      <span className="text-[10px] font-medium tabular-nums" style={{ color: RATING_COLORS[rounded] }}>{rating.toFixed(1)}</span>
    </div>
  )
}

function ClickableRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  const rounded = Math.round(display)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} type="button" onMouseEnter={() => setHover(i + 1)} onMouseLeave={() => setHover(null)} onClick={() => onChange(i + 1)} className="transition-transform hover:scale-110">
            <Star className="size-4" fill={i < (hover ?? value ?? 0) ? (RATING_COLORS[hover ?? value ?? 3]) : 'transparent'} stroke={i < (hover ?? value ?? 0) ? (RATING_COLORS[hover ?? value ?? 3]) : '#5b6e82'} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      {display > 0 && <span className="text-[10px] font-medium" style={{ color: RATING_COLORS[rounded] }}>{RATING_LABELS[rounded]}</span>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: config.bg, color: config.color }}>{config.label}</span>
}

function OverdueBadge() {
  return <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-red-500/15 text-red-400"><AlertTriangle className="size-2.5" />Overdue</span>
}

function StatCard({ icon: Icon, label, value, color, bg, subtitle }: { icon: typeof ClipboardCheck; label: string; value: string | number; color: string; bg: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-all duration-300 hover:border-[rgba(255,255,255,0.1)]">
      <div className="flex items-center justify-center size-9 rounded-lg shrink-0" style={{ backgroundColor: bg }}><Icon className="size-4" style={{ color }} /></div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-[#e8edf4] tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-[#7b8fa3] leading-tight mt-0.5 truncate">{label}</p>
        {subtitle && <p className="text-[10px] text-[#5b6e82] truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; confirmColor?: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#111d2e] p-5 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h4 className="text-sm font-semibold text-[#e8edf4] mb-2">{title}</h4>
        <p className="text-xs text-[#7b8fa3] mb-4 leading-relaxed">{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-[#7b8fa3] hover:text-[#e8edf4] transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all ${confirmColor ?? 'bg-blue-600 hover:bg-blue-500'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Calibration View ---------- */

function CalibrationView({ reviews, onUpdate, activeCycle }: {
  reviews: PerformanceReviewRow[]
  onUpdate: (reviewId: string, updates: Record<string, unknown>) => Promise<void>
  activeCycle: ReviewCycleRow | null
}) {
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Only show calibration + manager_review reviews for the active cycle
  const calibrationReviews = reviews.filter(r =>
    r.status === 'calibration' && (activeCycle ? r.cycle_id === activeCycle.id : true)
  )

  // Group by department
  const byDept = useMemo(() => {
    const map = new Map<string, PerformanceReviewRow[]>()
    for (const r of calibrationReviews) {
      const dept = r.employee_department ?? 'Unassigned'
      const list = map.get(dept) ?? []
      list.push(r)
      map.set(dept, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [calibrationReviews])

  // Rating distribution for calibration reviews
  const ratingCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of calibrationReviews) {
      if (r.overall_rating != null) counts[Math.round(r.overall_rating)]++
    }
    return counts
  }, [calibrationReviews])

  async function handleBulkFinalize() {
    setSaving(true)
    let succeeded = 0
    try {
      for (const r of calibrationReviews) {
        if (r.overall_rating != null) {
          await onUpdate(r.id, { status: 'finalized' })
          succeeded++
        }
      }
      toast.success(`${succeeded} reviews finalized`)
      setBulkConfirm(false)
    } catch {
      toast.error(`Finalized ${succeeded} reviews before error`)
    } finally {
      setSaving(false)
    }
  }

  if (calibrationReviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
        <Users className="size-8 text-[#5b6e82] mb-3" />
        <p className="text-sm text-[#c0cad8] mb-1">No reviews in calibration</p>
        <p className="text-xs text-[#7b8fa3]">Reviews must be advanced to calibration stage before they appear here.</p>
      </div>
    )
  }

  const withRating = calibrationReviews.filter(r => r.overall_rating != null).length
  const totalCal = calibrationReviews.length
  const maxCount = Math.max(...Object.values(ratingCounts), 1)

  return (
    <div className="space-y-4">
      {/* Calibration header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-[#e8edf4]">Calibration Session{activeCycle ? ` — ${activeCycle.name}` : ''}</h4>
          <p className="text-xs text-[#7b8fa3] mt-0.5">{totalCal} reviews in calibration, {withRating} have proposed ratings</p>
        </div>
        <button
          onClick={() => setBulkConfirm(true)}
          disabled={withRating === 0}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCheck className="size-3" />
          Finalize All ({withRating})
        </button>
      </div>

      {/* Inline rating distribution */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
        <p className="text-[11px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">Proposed Rating Distribution</p>
        <div className="flex items-end gap-2 h-16">
          {[1, 2, 3, 4, 5].map(rating => {
            const count = ratingCounts[rating]
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
            return (
              <div key={rating} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: RATING_COLORS[rating], opacity: 0.6 }} />
                <div className="flex items-center gap-0.5">
                  <Star className="size-2" fill={RATING_COLORS[rating]} stroke={RATING_COLORS[rating]} />
                  <span className="text-[9px] text-[#7b8fa3] tabular-nums">{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side-by-side by department */}
      {byDept.map(([dept, deptReviews]) => (
        <div key={dept} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
            <span className="text-[11px] font-medium text-[#c0cad8]">{dept}</span>
            <span className="text-[10px] text-[#5b6e82] ml-2">{deptReviews.length} reviews</span>
          </div>
          <div className="divide-y divide-[rgba(255,255,255,0.03)]">
            {deptReviews.sort((a, b) => (b.overall_rating ?? 0) - (a.overall_rating ?? 0)).map(review => (
              <CalibrationRow key={review.id} review={review} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      ))}

      {/* Bulk finalize confirm */}
      {bulkConfirm && (
        <ConfirmDialog
          title="Finalize all calibrated reviews?"
          message={`This will finalize ${withRating} reviews that have ratings and release them to employees. Reviews without ratings will be skipped. This cannot be undone.`}
          confirmLabel={`Finalize ${withRating} Reviews`}
          confirmColor="bg-emerald-600 hover:bg-emerald-500"
          onConfirm={handleBulkFinalize}
          onCancel={() => setBulkConfirm(false)}
        />
      )}
    </div>
  )
}

function CalibrationRow({ review, onUpdate }: { review: PerformanceReviewRow; onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void> }) {
  const [rating, setRating] = useState(review.overall_rating)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const initials = review.employee_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  async function handleSaveRating(newRating: number) {
    setRating(newRating)
    setDirty(true)
    setSaving(true)
    try {
      await onUpdate(review.id, { overall_rating: newRating })
      setDirty(false)
      toast.success(`${review.employee_name}: rating updated to ${newRating}`)
    } catch {
      toast.error('Failed to save rating')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex items-center justify-center size-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-[9px] font-bold text-white/90 shrink-0">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[#e8edf4] truncate">{review.employee_name}</p>
        <p className="text-[9px] text-[#5b6e82] truncate">{review.employee_title}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[9px] text-[#5b6e82]">Self:</span>
        <RatingStars rating={review.self_rating} />
      </div>
      <div className="shrink-0 w-px h-4 bg-[rgba(255,255,255,0.06)]" />
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[9px] text-[#5b6e82]">Final:</span>
        <ClickableRating value={rating} onChange={handleSaveRating} />
      </div>
      {saving && <span className="text-[9px] text-[#5b6e82] animate-pulse">saving...</span>}
    </div>
  )
}

/* ---------- Rating Distribution ---------- */

function RatingDistribution({ distribution }: { distribution: Record<number, number> }) {
  const max = Math.max(...Object.values(distribution), 1)
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">Rating Distribution</p>
      {[5, 4, 3, 2, 1].map(rating => {
        const count = distribution[rating] ?? 0
        const pct = max > 0 ? (count / max) * 100 : 0
        return (
          <div key={rating} className="flex items-center gap-2">
            <span className="text-[10px] text-[#7b8fa3] w-3 text-right tabular-nums">{rating}</span>
            <Star className="size-2.5 shrink-0" fill={RATING_COLORS[rating]} stroke={RATING_COLORS[rating]} />
            <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[rating], opacity: 0.7 }} />
            </div>
            <span className="text-[10px] text-[#7b8fa3] tabular-nums w-4 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function DepartmentProgress({ departments }: { departments: Array<{ department: string; total: number; completed: number; avgRating: number | null }> }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-[#7b8fa3] uppercase tracking-wider mb-2">By Department</p>
      {departments.map(d => {
        const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
        return (
          <div key={d.department} className="flex items-center gap-3">
            <span className="text-[11px] text-[#c0cad8] w-24 truncate">{d.department}</span>
            <div className="flex-1 h-2 rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out bg-emerald-500/60" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-[#7b8fa3] tabular-nums w-12 text-right">{d.completed}/{d.total}</span>
            {d.avgRating != null && <span className="text-[10px] tabular-nums w-6 text-right" style={{ color: RATING_COLORS[Math.round(d.avgRating)] }}>{d.avgRating}</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Review Row ---------- */

function ReviewRow({ review, expanded, onToggle, onUpdate, isOverdue }: {
  review: PerformanceReviewRow; expanded: boolean; onToggle: () => void
  onUpdate: (reviewId: string, updates: Record<string, unknown>) => Promise<void>; isOverdue: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [selfRating, setSelfRating] = useState<number | null>(review.self_rating)
  const [overallRating, setOverallRating] = useState<number | null>(review.overall_rating)
  const [strengths, setStrengths] = useState(review.strengths ?? '')
  const [improvements, setImprovements] = useState(review.areas_for_improvement ?? '')
  const [devPlan, setDevPlan] = useState(review.development_plan ?? '')
  const [managerComments, setManagerComments] = useState(review.manager_comments ?? '')
  const [confirmAdvance, setConfirmAdvance] = useState(false)

  const initials = review.employee_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const nextStatus = STATUS_FLOW[review.status]

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(review.id, {
        self_rating: selfRating, overall_rating: overallRating,
        strengths: strengths || null, areas_for_improvement: improvements || null,
        development_plan: devPlan || null, manager_comments: managerComments || null,
      })
      toast.success('Review saved')
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleAdvance() {
    if (!nextStatus) return
    setSaving(true)
    try {
      await onUpdate(review.id, { status: nextStatus })
      toast.success(`Moved to ${STATUS_CONFIG[nextStatus]?.label}`)
      setConfirmAdvance(false)
    } catch { toast.error('Failed to advance') } finally { setSaving(false) }
  }

  return (
    <div className="border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
      <button onClick={onToggle} className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors duration-200 hover:bg-[rgba(255,255,255,0.02)]">
        <div className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-[10px] font-bold text-white/90 shrink-0">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[#e8edf4] truncate">{review.employee_name}</p>
          <p className="text-[10px] text-[#7b8fa3] truncate">{review.employee_title ?? 'No title'} {review.employee_department ? `· ${review.employee_department}` : ''}</p>
        </div>
        <div className="shrink-0"><RatingStars rating={review.overall_rating} /></div>
        <div className="shrink-0 flex items-center gap-1">
          <StatusBadge status={review.status} />
          {isOverdue && <OverdueBadge />}
        </div>
        <span className="text-[10px] text-[#5b6e82] shrink-0 w-16 text-right truncate">{review.cycle_name}</span>
        {expanded ? <ChevronUp className="size-3.5 text-[#5b6e82] shrink-0" /> : <ChevronDown className="size-3.5 text-[#5b6e82] shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-[rgba(255,255,255,0.03)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1.5">Self Rating</p>
              <ClickableRating value={selfRating} onChange={setSelfRating} />
            </div>
            <div>
              <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1.5">Manager Rating</p>
              <ClickableRating value={overallRating} onChange={setOverallRating} />
            </div>
          </div>

          {review.reviewer_name && (
            <div>
              <p className="text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Reviewer</p>
              <p className="text-[11px] text-[#c0cad8]">{review.reviewer_name}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div><label className="block text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Strengths</label><textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={2} placeholder="Key strengths..." className={TEXTAREA_CLASS} /></div>
            <div><label className="block text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Areas for Improvement</label><textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={2} placeholder="Areas to improve..." className={TEXTAREA_CLASS} /></div>
            <div><label className="block text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Development Plan</label><textarea value={devPlan} onChange={e => setDevPlan(e.target.value)} rows={2} placeholder="Goals and next steps..." className={TEXTAREA_CLASS} /></div>
            <div><label className="block text-[10px] text-[#5b6e82] uppercase tracking-wider mb-1">Manager Comments</label><textarea value={managerComments} onChange={e => setManagerComments(e.target.value)} rows={2} placeholder="Additional comments..." className={TEXTAREA_CLASS} /></div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            {nextStatus && (
              <button onClick={() => setConfirmAdvance(true)} disabled={saving} className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-xs font-medium text-[#c0cad8] transition-all hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.2)] disabled:opacity-50">
                Advance to {STATUS_CONFIG[nextStatus]?.label}<ArrowRight className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {confirmAdvance && nextStatus && (
        <ConfirmDialog
          title={`Advance to ${STATUS_CONFIG[nextStatus]?.label}?`}
          message={`This will move ${review.employee_name}'s review from "${STATUS_CONFIG[review.status]?.label}" to "${STATUS_CONFIG[nextStatus]?.label}".${nextStatus === 'finalized' ? ' The review will be released to the employee.' : ''}`}
          confirmLabel={`Advance to ${STATUS_CONFIG[nextStatus]?.label}`}
          onConfirm={handleAdvance}
          onCancel={() => setConfirmAdvance(false)}
        />
      )}
    </div>
  )
}

/* ---------- Sub-views toggle ---------- */

type ReviewView = 'overview' | 'calibration'

/* ---------- Main Component ---------- */

export function PerformanceReviews() {
  const { data, error, isLoading, mutate } = usePerformanceReviews()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<ReviewView>('overview')

  // Create cycle form
  const [showCreateCycle, setShowCreateCycle] = useState(false)
  const [cycleName, setCycleName] = useState('')
  const [cyclePeriodStart, setCyclePeriodStart] = useState('')
  const [cyclePeriodEnd, setCyclePeriodEnd] = useState('')
  const [cycleSelfDeadline, setCycleSelfDeadline] = useState('')
  const [cycleManagerDeadline, setCycleManagerDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  async function handleCreateCycle() {
    const errors: Record<string, string> = {}
    if (!cycleName.trim()) errors.name = 'Name is required'
    if (!cyclePeriodStart) errors.period_start = 'Start date is required'
    if (!cyclePeriodEnd) errors.period_end = 'End date is required'
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }

    setSaving(true)
    try {
      const res = await fetch('/api/performance-reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_cycle', name: cycleName.trim(), period_start: cyclePeriodStart, period_end: cyclePeriodEnd, self_review_deadline: cycleSelfDeadline || null, manager_review_deadline: cycleManagerDeadline || null }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Review cycle created — reviews assigned to all employees')
      setShowCreateCycle(false); setCycleName(''); setCyclePeriodStart(''); setCyclePeriodEnd(''); setCycleSelfDeadline(''); setCycleManagerDeadline(''); setFormErrors({}); mutate()
    } catch { toast.error('Failed to create review cycle') } finally { setSaving(false) }
  }

  async function handleUpdateReview(reviewId: string, updates: Record<string, unknown>) {
    const res = await fetch('/api/performance-reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_review', review_id: reviewId, ...updates }),
    })
    if (!res.ok) throw new Error('Failed')
    mutate()
  }

  // Compute overdue reviews
  const overdueIds = useMemo(() => {
    const ids = new Set<string>()
    if (!data) return ids
    const today = new Date().toISOString().split('T')[0]
    for (const cycle of data.cycles) {
      if (cycle.status === 'closed' || cycle.status === 'finalized') continue
      for (const r of data.reviews) {
        if (r.cycle_id !== cycle.id) continue
        if (r.status === 'self_review' && cycle.self_review_deadline && today > cycle.self_review_deadline) ids.add(r.id)
        if (r.status === 'manager_review' && cycle.manager_review_deadline && today > cycle.manager_review_deadline) ids.add(r.id)
        if (r.status === 'calibration' && cycle.calibration_deadline && today > cycle.calibration_deadline) ids.add(r.id)
      }
    }
    return ids
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[72px] rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] animate-shimmer" />)}</div>
        <div className="h-[300px] rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] animate-shimmer" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="size-6 text-red-400/80 mb-3" />
        <p className="text-sm text-red-400 mb-3">Failed to load reviews</p>
        <button onClick={() => mutate()} className="text-xs text-blue-400 hover:text-blue-300 underline">Try again</button>
      </div>
    )
  }

  const hasData = data && data.reviews.length > 0
  const summary = data?.summary
  const reviews = data?.reviews ?? []
  const activeCycle = data?.cycles.find(c => c.status === 'active') ?? null
  const overdueCount = overdueIds.size

  const filtered = reviews.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (deptFilter !== 'all' && (r.employee_department ?? 'Unassigned') !== deptFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.employee_name.toLowerCase().includes(q) && !(r.employee_title ?? '').toLowerCase().includes(q) && !(r.employee_department ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const completedCount = (summary?.byStatus.finalized ?? 0) + (summary?.byStatus.acknowledged ?? 0)
  const inProgressCount = (summary?.byStatus.self_review ?? 0) + (summary?.byStatus.manager_review ?? 0) + (summary?.byStatus.calibration ?? 0)
  const departments = [...new Set(reviews.map(r => r.employee_department ?? 'Unassigned'))]
  const calibrationCount = summary?.byStatus.calibration ?? 0

  return (
    <div className="space-y-5">
      {/* Top bar: view toggle + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] p-0.5 border border-[rgba(255,255,255,0.04)]">
          <button onClick={() => setView('overview')} className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${view === 'overview' ? 'bg-[rgba(255,255,255,0.1)] text-[#e8edf4] shadow-sm' : 'text-[#7b8fa3] hover:text-[#c0cad8]'}`}>
            Overview
          </button>
          <button onClick={() => setView('calibration')} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${view === 'calibration' ? 'bg-[rgba(255,255,255,0.1)] text-[#e8edf4] shadow-sm' : 'text-[#7b8fa3] hover:text-[#c0cad8]'}`}>
            Calibration
            {calibrationCount > 0 && <span className="min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-purple-500/80 text-[9px] font-semibold text-white leading-none px-1">{calibrationCount}</span>}
          </button>
        </div>
        <button onClick={() => setShowCreateCycle(!showCreateCycle)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-blue-500">
          {showCreateCycle ? <X className="size-3" /> : <Plus className="size-3" />}
          {showCreateCycle ? 'Cancel' : 'New Review Cycle'}
        </button>
      </div>

      {/* Create Cycle Form */}
      {showCreateCycle && (
        <div className="rounded-xl border border-blue-500/20 bg-[#111d2e]/80 backdrop-blur-sm p-5" style={{ animation: 'slide-up 0.3s ease-out both' }}>
          <h3 className="text-sm font-medium text-[#e8edf4] mb-1">New Review Cycle</h3>
          <p className="text-xs text-[#7b8fa3] mb-4">Creates reviews for all active employees and assigns their manager as reviewer.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Cycle Name *</label>
              <input type="text" value={cycleName} onChange={e => { setCycleName(e.target.value); if (formErrors.name) setFormErrors(p => { const n = { ...p }; delete n.name; return n }) }} placeholder="H1 2026" className={INPUT_CLASS} />
              {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Period Start *</label>
              <input type="date" value={cyclePeriodStart} onChange={e => { setCyclePeriodStart(e.target.value); if (formErrors.period_start) setFormErrors(p => { const n = { ...p }; delete n.period_start; return n }) }} className={INPUT_CLASS} />
              {formErrors.period_start && <p className="text-red-400 text-xs mt-1">{formErrors.period_start}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Period End *</label>
              <input type="date" value={cyclePeriodEnd} onChange={e => { setCyclePeriodEnd(e.target.value); if (formErrors.period_end) setFormErrors(p => { const n = { ...p }; delete n.period_end; return n }) }} className={INPUT_CLASS} />
              {formErrors.period_end && <p className="text-red-400 text-xs mt-1">{formErrors.period_end}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div><label className="block text-xs text-[#7b8fa3] mb-1">Self-Review Deadline</label><input type="date" value={cycleSelfDeadline} onChange={e => setCycleSelfDeadline(e.target.value)} className={INPUT_CLASS} /></div>
            <div><label className="block text-xs text-[#7b8fa3] mb-1">Manager Review Deadline</label><input type="date" value={cycleManagerDeadline} onChange={e => setCycleManagerDeadline(e.target.value)} className={INPUT_CLASS} /></div>
            <div className="flex items-end gap-2">
              <button onClick={handleCreateCycle} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Creating...' : 'Create Cycle'}</button>
              <button onClick={() => { setShowCreateCycle(false); setFormErrors({}) }} className="rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasData && !showCreateCycle && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80">
          <div className="flex items-center justify-center size-12 rounded-xl bg-[rgba(168,85,247,0.08)] mb-4"><ClipboardCheck className="size-6 text-purple-400" /></div>
          <p className="text-sm font-medium text-[#c0cad8] mb-1">No performance reviews yet</p>
          <p className="text-xs text-[#7b8fa3] max-w-[280px] mb-4">Create a review cycle to get started. Reviews will be automatically assigned to all active employees.</p>
          <button onClick={() => setShowCreateCycle(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-blue-500"><Plus className="size-3" />New Review Cycle</button>
        </div>
      )}

      {/* Main content */}
      {hasData && summary && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard icon={FileText} label="Total Reviews" value={summary.total} color="#a855f7" bg="rgba(168,85,247,0.08)" />
            <StatCard icon={CheckCircle2} label="Completed" value={completedCount} color="#22c55e" bg="rgba(34,197,94,0.08)" subtitle={`${summary.total > 0 ? Math.round((completedCount / summary.total) * 100) : 0}% done`} />
            <StatCard icon={Clock} label="In Progress" value={inProgressCount} color="#f59e0b" bg="rgba(245,158,11,0.08)" />
            <StatCard icon={Star} label="Avg Rating" value={summary.avgRating?.toFixed(1) ?? '--'} color="#3b82f6" bg="rgba(59,130,246,0.08)" subtitle={summary.avgRating ? RATING_LABELS[Math.round(summary.avgRating)] : undefined} />
            <StatCard icon={AlertTriangle} label="Overdue" value={overdueCount} color={overdueCount > 0 ? '#ef4444' : '#64748b'} bg={overdueCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(100,116,139,0.08)'} />
          </div>

          {/* Calibration view */}
          {view === 'calibration' && (
            <CalibrationView reviews={reviews} onUpdate={handleUpdateReview} activeCycle={activeCycle} />
          )}

          {/* Overview view */}
          {view === 'overview' && (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4"><RatingDistribution distribution={summary.ratingDistribution} /></div>
                <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4"><DepartmentProgress departments={summary.byDepartment} /></div>
              </div>

              {/* Search + Filters + Review list */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#5b6e82]" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, title, department..." className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] pl-7 pr-3 py-1.5 text-[11px] text-[#e8edf4] placeholder:text-[#5b6e82] focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
                  </div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent text-[11px] text-[#c0cad8] border border-[rgba(255,255,255,0.08)] rounded-md px-2 py-1 outline-none focus:border-[rgba(255,255,255,0.2)]">
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-transparent text-[11px] text-[#c0cad8] border border-[rgba(255,255,255,0.08)] rounded-md px-2 py-1 outline-none focus:border-[rgba(255,255,255,0.2)]">
                    <option value="all">All Departments</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="text-[10px] text-[#5b6e82] ml-auto tabular-nums">{filtered.length} reviews</span>
                </div>

                <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-8 shrink-0" />
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider flex-1">Employee</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider shrink-0 w-24">Rating</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider shrink-0 w-32">Status</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider shrink-0 w-16 text-right">Cycle</span>
                  <span className="w-3.5 shrink-0" />
                </div>

                <div className="max-h-[480px] overflow-y-auto">
                  {filtered.map(review => (
                    <ReviewRow key={review.id} review={review} expanded={expandedId === review.id} onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)} onUpdate={handleUpdateReview} isOverdue={overdueIds.has(review.id)} />
                  ))}
                  {filtered.length === 0 && <div className="flex items-center justify-center py-8"><p className="text-xs text-[#5b6e82]">No reviews match the current filters</p></div>}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
