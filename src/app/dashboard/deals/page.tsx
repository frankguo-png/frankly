'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import useSWR from 'swr'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { formatDistanceToNow } from 'date-fns'

type DealStage = 'pitched' | 'negotiating' | 'verbal' | 'closed_won' | 'closed_lost'

interface Deal {
  id: string
  name: string
  company: string | null
  amount: number
  probability: number
  stage: DealStage
  expected_close_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface StageSummary {
  stage: DealStage
  total: number
  count: number
}

interface DealsSummary {
  totalPipeline: number
  weightedPipeline: number
  closingThisMonth: number
  winRate: number
  byStage: StageSummary[]
}

interface DealsResponse {
  deals: Deal[]
  summary: DealsSummary
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const STAGE_CONFIG: Record<DealStage, { label: string; color: string; bg: string }> = {
  pitched: { label: 'Pitched', color: '#7b8fa3', bg: 'rgba(123,143,163,0.25)' },
  negotiating: { label: 'Negotiating', color: '#3b82f6', bg: 'rgba(59,130,246,0.25)' },
  verbal: { label: 'Verbal', color: '#f59e0b', bg: 'rgba(245,158,11,0.25)' },
  closed_won: { label: 'Closed Won', color: '#22c55e', bg: 'rgba(34,197,94,0.25)' },
  closed_lost: { label: 'Closed Lost', color: '#ef4444', bg: 'rgba(239,68,68,0.25)' },
}

const STAGE_ORDER: DealStage[] = ['pitched', 'negotiating', 'verbal', 'closed_won', 'closed_lost']
const PIPELINE_STAGES: DealStage[] = ['pitched', 'negotiating', 'verbal', 'closed_won']

type SortField = 'amount' | 'probability' | 'expected_close_date'
type SortDir = 'asc' | 'desc'

function StageDropdown({
  currentStage,
  onSelect,
}: {
  currentStage: DealStage
  onSelect: (stage: DealStage) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const config = STAGE_CONFIG[currentStage]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-opacity hover:opacity-80"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        {config.label}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-40 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] shadow-xl py-1">
          {STAGE_ORDER.map((stage) => {
            const sc = STAGE_CONFIG[stage]
            return (
              <button
                key={stage}
                onClick={() => {
                  onSelect(stage)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/[0.04] transition-colors"
                style={{ color: stage === currentStage ? sc.color : '#9baab8' }}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: sc.color }}
                />
                {sc.label}
                {stage === currentStage && (
                  <span className="ml-auto text-[10px] opacity-50">current</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InlineProbability({
  value,
  onSave,
}: {
  value: number
  onSave: (val: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commit() {
    const num = parseInt(input, 10)
    if (!isNaN(num) && num >= 0 && num <= 100 && num !== value) {
      onSave(num)
    }
    setEditing(false)
    setInput(String(value))
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={100}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setEditing(false)
            setInput(String(value))
          }
        }}
        className="w-14 rounded border border-blue-500/30 bg-[#0d1a2d] px-1.5 py-0.5 text-xs text-[#e8edf4] text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500/40"
      />
    )
  }

  return (
    <button
      onClick={() => {
        setInput(String(value))
        setEditing(true)
      }}
      className="text-xs text-[#7b8fa3] tabular-nums hover:text-blue-400 transition-colors cursor-pointer"
    >
      {value}%
    </button>
  )
}

function DealsContent() {
  const { data, error, isLoading, mutate } = useSWR<DealsResponse>(
    '/api/deals?all=1',
    fetcher,
    { refreshInterval: 300000 }
  )

  const [showAdd, setShowAdd] = useState(false)
  const [stageFilter, setStageFilter] = useState<DealStage | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('amount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    amount: '',
    stage: 'pitched' as DealStage,
    probability: '',
    expected_close_date: '',
    notes: '',
  })

  // Add form state
  const [formName, setFormName] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStage, setFormStage] = useState<DealStage>('pitched')
  const [formProbability, setFormProbability] = useState('50')
  const [formCloseDate, setFormCloseDate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  async function handleStageChange(dealId: string, stage: DealStage) {
    try {
      const res = await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, stage }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(`Deal moved to ${STAGE_CONFIG[stage].label}`)
      mutate()
    } catch {
      toast.error('Failed to update deal stage')
    }
  }

  async function handleProbabilityChange(dealId: string, probability: number) {
    try {
      const res = await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, probability }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(`Probability updated to ${probability}%`)
      mutate()
    } catch {
      toast.error('Failed to update probability')
    }
  }

  async function handleDelete(dealId: string) {
    try {
      const res = await fetch('/api/deals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Deal deleted')
      setDeleteConfirm(null)
      mutate()
    } catch {
      toast.error('Failed to delete deal')
    }
  }

  function startEdit(deal: Deal) {
    setEditingId(deal.id)
    setDeleteConfirm(null)
    setEditForm({
      name: deal.name,
      company: deal.company || '',
      amount: String(deal.amount),
      stage: deal.stage,
      probability: String(deal.probability),
      expected_close_date: deal.expected_close_date ? deal.expected_close_date.slice(0, 10) : '',
      notes: deal.notes || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    if (!editingId) return
    const name = editForm.name.trim()
    if (!name) {
      toast.error('Name is required')
      return
    }
    const amount = parseFloat(editForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    const probability = parseInt(editForm.probability, 10)
    if (isNaN(probability) || probability < 0 || probability > 100) {
      toast.error('Probability must be 0-100')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name,
          company: editForm.company.trim() || null,
          amount,
          stage: editForm.stage,
          probability,
          expected_close_date: editForm.expected_close_date || null,
          notes: editForm.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Deal updated')
      setEditingId(null)
      mutate()
    } catch {
      toast.error('Failed to update deal')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDeal() {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'Name is required'
    if (!formAmount || parseFloat(formAmount) <= 0) errors.amount = 'Amount must be greater than 0'
    const prob = parseInt(formProbability, 10)
    if (isNaN(prob) || prob < 0 || prob > 100) errors.probability = 'Must be 0-100'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          company: formCompany.trim() || null,
          amount: parseFloat(formAmount),
          stage: formStage,
          probability: prob,
          expected_close_date: formCloseDate || null,
          notes: formNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      toast.success('Deal created')
      setShowAdd(false)
      setFormName('')
      setFormCompany('')
      setFormAmount('')
      setFormStage('pitched')
      setFormProbability('50')
      setFormCloseDate('')
      setFormNotes('')
      setFormErrors({})
      mutate()
    } catch {
      toast.error('Failed to create deal')
    } finally {
      setSaving(false)
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const deals = data?.deals ?? []
  const summary = data?.summary

  // Filter
  const filtered = stageFilter === 'all' ? deals : deals.filter((d) => d.stage === stageFilter)

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortField === 'amount') cmp = a.amount - b.amount
    else if (sortField === 'probability') cmp = a.probability - b.probability
    else if (sortField === 'expected_close_date') {
      const da = a.expected_close_date ? new Date(a.expected_close_date).getTime() : 0
      const db = b.expected_close_date ? new Date(b.expected_close_date).getTime() : 0
      cmp = da - db
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-block w-3">
      {sortField === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </span>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Deals Pipeline</h1>
          <p className="text-sm text-[#5a6d82] mt-1">
            Track and manage your deals from pitch to close
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Deal
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 text-sm mb-3">Failed to load deals</p>
          <button onClick={() => mutate()} className="text-xs text-blue-400 hover:text-blue-300 underline">
            Try again
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total Pipeline', value: formatCompactCurrency(summary.totalPipeline), color: 'text-[#e8edf4]' },
            { label: 'Weighted Value', value: formatCompactCurrency(summary.weightedPipeline), color: 'text-blue-400' },
            { label: 'Expected This Month', value: formatCompactCurrency(summary.closingThisMonth), color: 'text-amber-400' },
            { label: 'Win Rate', value: `${Math.round(summary.winRate * 100)}%`, color: 'text-emerald-400' },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4"
            >
              <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-1">
                {card.label}
              </p>
              <p className={`text-2xl font-bold tabular-nums tracking-tight ${card.color}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline Funnel Bar */}
      {summary && summary.byStage.length > 0 && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-5">
          <h3 className="text-xs font-semibold text-[#7b8fa3] uppercase tracking-wider mb-4">
            Pipeline Stages
          </h3>
          <div className="flex items-stretch gap-1 h-14">
            {PIPELINE_STAGES.map((stage, i) => {
              const stageData = summary.byStage.find((s) => s.stage === stage)
              const count = stageData?.count ?? 0
              const total = stageData?.total ?? 0
              const config = STAGE_CONFIG[stage]
              return (
                <div
                  key={stage}
                  className="flex-1 flex flex-col items-center justify-center rounded-lg relative"
                  style={{ backgroundColor: config.bg }}
                >
                  <span className="text-xs font-semibold" style={{ color: config.color }}>
                    {config.label}
                  </span>
                  <span className="text-[10px] text-[#7b8fa3]">
                    {count} deal{count !== 1 ? 's' : ''} &middot; {formatCompactCurrency(total)}
                  </span>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-[#3d5066]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Deal Form */}
      {showAdd && (
        <div
          className="rounded-xl border border-blue-500/20 bg-[#111d2e]/80 backdrop-blur-sm p-5"
          style={{ animation: 'slide-up 0.3s ease-out both' }}
        >
          <h3 className="text-sm font-medium text-[#e8edf4] mb-4">New Deal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); if (formErrors.name) setFormErrors((p) => { const n = { ...p }; delete n.name; return n }) }}
                placeholder="Q2 Enterprise Package"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Company</label>
              <input
                type="text"
                value={formCompany}
                onChange={(e) => setFormCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Amount *</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => { setFormAmount(e.target.value); if (formErrors.amount) setFormErrors((p) => { const n = { ...p }; delete n.amount; return n }) }}
                placeholder="25000"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40 tabular-nums"
              />
              {formErrors.amount && <p className="text-red-400 text-xs mt-1">{formErrors.amount}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Stage</label>
              <select
                value={formStage}
                onChange={(e) => setFormStage(e.target.value as DealStage)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Probability (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formProbability}
                onChange={(e) => { setFormProbability(e.target.value); if (formErrors.probability) setFormErrors((p) => { const n = { ...p }; delete n.probability; return n }) }}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40 tabular-nums"
              />
              {formErrors.probability && <p className="text-red-400 text-xs mt-1">{formErrors.probability}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Expected Close Date</label>
              <input
                type="date"
                value={formCloseDate}
                onChange={(e) => setFormCloseDate(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAddDeal}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Create Deal'}
              </button>
              <button
                onClick={() => {
                  setShowAdd(false)
                  setFormErrors({})
                }}
                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
              >
                Cancel
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#7b8fa3] mb-1">Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              placeholder="Additional context about this deal..."
              className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
            All Deals
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#6b7f94]">Stage:</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as DealStage | 'all')}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-2 py-1 text-xs text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="all">All Stages</option>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 pb-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : !sorted.length ? (
          <div className="px-6 pb-8 text-center">
            <p className="text-sm text-[#6b7f94]">
              {stageFilter !== 'all' ? 'No deals in this stage.' : 'No deals yet.'}
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Add your first deal
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
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Company
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    Amount<SortIcon field="amount" />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Stage
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors select-none"
                    onClick={() => toggleSort('probability')}
                  >
                    Probability<SortIcon field="probability" />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors select-none"
                    onClick={() => toggleSort('expected_close_date')}
                  >
                    Expected Close<SortIcon field="expected_close_date" />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((deal) => {
                  const isWon = deal.stage === 'closed_won'
                  const isLost = deal.stage === 'closed_lost'
                  const isEditing = editingId === deal.id

                  const editInputClass = 'bg-[#0a1628] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40'

                  if (isEditing) {
                    return (
                      <tr
                        key={deal.id}
                        className="border-b border-[rgba(255,255,255,0.03)] bg-blue-500/[0.04]"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      >
                        <td className="px-6 py-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className={`${editInputClass} w-full min-w-[120px]`}
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.company}
                            onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                            className={`${editInputClass} w-full min-w-[100px]`}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                            className={`${editInputClass} w-24 text-right tabular-nums`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editForm.stage}
                            onChange={(e) => setEditForm((f) => ({ ...f, stage: e.target.value as DealStage }))}
                            className={`${editInputClass} w-full min-w-[110px]`}
                          >
                            {STAGE_ORDER.map((s) => (
                              <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editForm.probability}
                            onChange={(e) => setEditForm((f) => ({ ...f, probability: e.target.value }))}
                            className={`${editInputClass} w-16 text-right tabular-nums`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editForm.expected_close_date}
                            onChange={(e) => setEditForm((f) => ({ ...f, expected_close_date: e.target.value }))}
                            className={`${editInputClass} w-full min-w-[120px]`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                            className={`${editInputClass} w-full min-w-[160px]`}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-[#7b8fa3] hover:text-[#e8edf4] transition-colors"
                              title="Cancel"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={deal.id}
                      className={`border-b border-[rgba(255,255,255,0.03)] transition-colors duration-150 ${
                        isWon
                          ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]'
                          : isLost
                          ? 'opacity-50 hover:opacity-70'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-6 py-3.5">
                        <span
                          className={`text-sm font-medium ${
                            isLost ? 'text-[#6b7f94] line-through' : 'text-[#e8edf4]'
                          }`}
                        >
                          {deal.name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs ${
                            isLost ? 'text-[#5a6d82] line-through' : 'text-[#7b8fa3]'
                          }`}
                        >
                          {deal.company || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isLost ? 'text-[#5a6d82] line-through' : 'text-[#e8edf4]'
                          }`}
                        >
                          {formatCurrency(deal.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StageDropdown
                          currentStage={deal.stage}
                          onSelect={(stage) => handleStageChange(deal.id, stage)}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <InlineProbability
                          value={deal.probability}
                          onSave={(val) => handleProbabilityChange(deal.id, val)}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-[#7b8fa3]">
                          {deal.expected_close_date
                            ? formatDistanceToNow(new Date(deal.expected_close_date), { addSuffix: true })
                            : '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="text-xs text-[#6b7f94] truncate block max-w-[160px]"
                          title={deal.notes || undefined}
                        >
                          {deal.notes ? (deal.notes.length > 40 ? deal.notes.slice(0, 40) + '...' : deal.notes) : '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {deleteConfirm === deal.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDelete(deal.id)}
                              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-[#7b8fa3] hover:text-[#9baab8] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(deal)}
                              className="text-[#5a6d82] hover:text-blue-400 transition-colors"
                              title="Edit deal"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(deal.id)}
                              className="text-[#5a6d82] hover:text-red-400 transition-colors"
                              title="Delete deal"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DealsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 rounded animate-shimmer" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-[rgba(255,255,255,0.04)] animate-shimmer" />
            ))}
          </div>
          <div className="h-[400px] rounded-xl border border-[rgba(255,255,255,0.04)] animate-shimmer" />
        </div>
      }
    >
      <DealsContent />
    </Suspense>
  )
}
