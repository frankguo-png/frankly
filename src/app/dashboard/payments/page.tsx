'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import useSWR from 'swr'
import { AlertCircle, Calendar, CreditCard, Clock, Trash2, Pencil, Plus, ArrowUpDown, CheckCircle2, Check, X, FileText } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'

interface PendingPayment {
  id: string
  vendor: string
  description: string | null
  amount: number
  due_date: string
  priority: 'critical' | 'high' | 'normal' | 'low'
  status: 'pending' | 'overdue' | 'paid' | 'scheduled'
  category: string | null
  invoice_number: string | null
  payment_terms: 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'net_90' | null
  invoice_date: string | null
  notes: string | null
}

interface AgingBucket {
  count: number
  total: number
}

interface AgingReport {
  current: AgingBucket
  days31_60: AgingBucket
  days61_90: AgingBucket
  days90plus: AgingBucket
}

interface PaymentsResponse {
  allPayments: PendingPayment[]
  totalPending: number
  overdueCount: number
  overdueAmount: number
  dueThisWeekCount: number
  scheduledCount: number
  totalCount: number
  agingReport: AgingReport
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PRIORITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444420' },
  high: { label: 'High', color: '#f59e0b', bg: '#f59e0b20' },
  normal: { label: 'Normal', color: '#7b8fa3', bg: '#7b8fa315' },
  low: { label: 'Low', color: '#6b7f94', bg: '#6b7f9415' },
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  overdue: { color: '#ef4444', label: 'Overdue' },
  pending: { color: '#3b82f6', label: 'Pending' },
  scheduled: { color: '#f59e0b', label: 'Scheduled' },
  paid: { color: '#22c55e', label: 'Paid' },
}

const CATEGORIES = [
  'Software', 'Office', 'Marketing', 'Legal', 'Insurance',
  'Utilities', 'Rent', 'Consulting', 'Equipment', 'Other',
]

const NEXT_STATUS: Record<string, 'pending' | 'scheduled' | 'paid'> = {
  pending: 'scheduled',
  scheduled: 'paid',
  paid: 'pending',
  overdue: 'scheduled',
}

function getRelativeDueDate(dueDateStr: string): { text: string; absolute: string; urgency: 'overdue' | 'soon' | 'upcoming' } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr + 'T00:00:00')
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const absolute = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d overdue`, absolute, urgency: 'overdue' }
  }
  if (diffDays === 0) {
    return { text: 'Due today', absolute, urgency: 'overdue' }
  }
  if (diffDays <= 7) {
    return { text: `In ${diffDays}d`, absolute, urgency: 'soon' }
  }
  return { text: `In ${diffDays}d`, absolute, urgency: 'upcoming' }
}

type SortField = 'urgency' | 'amount' | 'due_date' | 'vendor'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'net_90', label: 'Net 90' },
]

const TERMS_DAYS: Record<string, number> = { due_on_receipt: 0, net_15: 15, net_30: 30, net_45: 45, net_60: 60, net_90: 90 }

function computeDueDateFromTerms(invoiceDate: string, terms: string): string {
  const base = new Date(invoiceDate + 'T00:00:00')
  base.setDate(base.getDate() + (TERMS_DAYS[terms] ?? 0))
  return base.toISOString().split('T')[0]
}

function sortPayments(payments: PendingPayment[], field: SortField, dir: SortDir): PendingPayment[] {
  const sorted = [...payments]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'amount':
        cmp = a.amount - b.amount
        break
      case 'due_date':
        cmp = a.due_date.localeCompare(b.due_date)
        break
      case 'vendor':
        cmp = a.vendor.localeCompare(b.vendor)
        break
      case 'urgency':
      default: {
        // Overdue first, paid last
        const statusOrder: Record<string, number> = { overdue: 0, pending: 1, scheduled: 2, paid: 3 }
        cmp = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
        if (cmp === 0) cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
        if (cmp === 0) cmp = a.due_date.localeCompare(b.due_date)
        break
      }
    }
    return dir === 'desc' ? -cmp : cmp
  })
  return sorted
}

function PaymentsContent() {
  const { data, error, isLoading, mutate } = useSWR<PaymentsResponse>(
    '/api/pending-payments',
    fetcher,
    { refreshInterval: 120000 }
  )

  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formVendor, setFormVendor] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formPriority, setFormPriority] = useState<'critical' | 'high' | 'normal' | 'low'>('normal')
  const [formCategory, setFormCategory] = useState('')
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('')
  const [formPaymentTerms, setFormPaymentTerms] = useState('')
  const [formInvoiceDate, setFormInvoiceDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Validation
  const [vendorError, setVendorError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  // Sort state
  const [sortField, setSortField] = useState<SortField>('urgency')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    vendor: '',
    description: '',
    amount: '',
    due_date: '',
    priority: 'normal' as 'critical' | 'high' | 'normal' | 'low',
    category: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm({ vendor: '', description: '', amount: '', due_date: '', priority: 'normal', category: '' })
  }, [])

  function startEdit(payment: PendingPayment) {
    setEditingId(payment.id)
    setEditForm({
      vendor: payment.vendor,
      description: payment.description ?? '',
      amount: String(payment.amount),
      due_date: payment.due_date,
      priority: payment.priority,
      category: payment.category ?? '',
    })
  }

  async function handleEditSave() {
    if (!editingId) return
    if (!editForm.vendor.trim()) { toast.error('Vendor is required'); return }
    if (!editForm.amount || parseFloat(editForm.amount) <= 0) { toast.error('Amount must be greater than 0'); return }
    if (!editForm.due_date) { toast.error('Due date is required'); return }

    setEditSaving(true)
    try {
      const res = await fetch('/api/pending-payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          vendor: editForm.vendor.trim(),
          description: editForm.description.trim() || null,
          amount: parseFloat(editForm.amount),
          due_date: editForm.due_date,
          priority: editForm.priority,
          category: editForm.category || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Payment updated successfully')
      cancelEdit()
      await mutate()
    } catch {
      toast.error('Failed to update payment. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  // Escape key cancels editing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && editingId) {
        cancelEdit()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingId, cancelEdit])

  // Auto-compute due_date from payment terms + invoice date
  useEffect(() => {
    if (formPaymentTerms && formInvoiceDate) {
      setFormDueDate(computeDueDateFromTerms(formInvoiceDate, formPaymentTerms))
      if (dateError) setDateError(null)
    }
  }, [formPaymentTerms, formInvoiceDate]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSortToggle(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function clearForm() {
    setFormVendor('')
    setFormDescription('')
    setFormAmount('')
    setFormDueDate('')
    setFormPriority('normal')
    setFormCategory('')
    setFormInvoiceNumber('')
    setFormPaymentTerms('')
    setFormInvoiceDate('')
    setFormNotes('')
    setVendorError(null)
    setAmountError(null)
    setDateError(null)
  }

  async function handleAdd() {
    let hasError = false
    if (!formVendor.trim()) { setVendorError('Vendor is required'); hasError = true }
    if (!formAmount || parseFloat(formAmount) <= 0) { setAmountError('Amount must be greater than 0'); hasError = true }
    if (!formDueDate && !(formPaymentTerms && formInvoiceDate)) { setDateError('Due date is required (or set payment terms + invoice date)'); hasError = true }
    if (hasError) return

    setSaving(true)
    try {
      const res = await fetch('/api/pending-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: formVendor.trim(),
          description: formDescription.trim() || null,
          amount: parseFloat(formAmount),
          due_date: formDueDate || null,
          priority: formPriority,
          category: formCategory || null,
          invoice_number: formInvoiceNumber.trim() || null,
          payment_terms: formPaymentTerms || null,
          invoice_date: formInvoiceDate || null,
          notes: formNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      toast.success('Payment added successfully')
      clearForm()
      setShowAdd(false)
      await mutate()
    } catch {
      toast.error('Failed to add payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusCycle(payment: PendingPayment) {
    const nextStatus = NEXT_STATUS[payment.status] ?? 'pending'
    try {
      const res = await fetch('/api/pending-payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payment.id, status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(`Status changed to ${nextStatus}`)
      await mutate()
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDelete(payment: PendingPayment) {
    if (!window.confirm(`Delete payment to ${payment.vendor}?`)) return
    try {
      const res = await fetch(`/api/pending-payments?id=${payment.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Payment deleted')
      await mutate()
    } catch {
      toast.error('Failed to delete payment')
    }
  }

  // Filter and sort
  let payments = data?.allPayments ?? []
  if (statusFilter !== 'all') {
    payments = payments.filter((p) => p.status === statusFilter)
  }
  if (priorityFilter !== 'all') {
    payments = payments.filter((p) => p.priority === priorityFilter)
  }
  payments = sortPayments(payments, sortField, sortDir)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Pending Payments</h1>
          <p className="text-sm text-[#5a6d82] mt-1">
            Manage and track upcoming vendor payments
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          Add Payment
        </button>
      </div>

      {/* Summary Cards */}
      {!isLoading && !error && data && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          style={{ animation: 'slide-up 0.3s ease-out both' }}
        >
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">Total Pending</span>
            </div>
            <p className="text-xl font-semibold text-[#e8edf4] tabular-nums">{formatCompactCurrency(data.totalPending)}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">{data.totalCount} payment{data.totalCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">Overdue</span>
            </div>
            <p className="text-xl font-semibold text-red-400 tabular-nums">{data.overdueCount}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">{formatCompactCurrency(data.overdueAmount)}</p>
          </div>
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">Due This Week</span>
            </div>
            <p className="text-xl font-semibold text-amber-400 tabular-nums">{data.dueThisWeekCount}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">Next 7 days</p>
          </div>
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">Scheduled</span>
            </div>
            <p className="text-xl font-semibold text-[#e8edf4] tabular-nums">{data.scheduledCount}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">Ready to pay</p>
          </div>
        </div>
      )}

      {/* Add Payment Form */}
      {showAdd && (
        <div
          className="rounded-xl border border-blue-500/20 bg-[#111d2e]/80 backdrop-blur-sm p-5"
          style={{ animation: 'slide-up 0.3s ease-out both' }}
        >
          <h3 className="text-sm font-medium text-[#e8edf4] mb-4">New Payment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Vendor *</label>
              <input
                type="text"
                value={formVendor}
                onChange={(e) => { setFormVendor(e.target.value); if (vendorError) setVendorError(null) }}
                placeholder="e.g., AWS, Stripe"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              {vendorError && <p className="text-red-400 text-xs mt-1">{vendorError}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Description</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Amount *</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => { setFormAmount(e.target.value); if (amountError) setAmountError(null) }}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40 tabular-nums"
              />
              {amountError && <p className="text-red-400 text-xs mt-1">{amountError}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Due Date *</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => { setFormDueDate(e.target.value); if (dateError) setDateError(null) }}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              {dateError && <p className="text-red-400 text-xs mt-1">{dateError}</p>}
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as 'critical' | 'high' | 'normal' | 'low')}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                <option value="">None</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Invoice Number</label>
              <input
                type="text"
                value={formInvoiceNumber}
                onChange={(e) => setFormInvoiceNumber(e.target.value)}
                placeholder="e.g., INV-2024-001"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Payment Terms</label>
              <select
                value={formPaymentTerms}
                onChange={(e) => setFormPaymentTerms(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#7b8fa3] mb-1">Invoice Date</label>
              <input
                type="date"
                value={formInvoiceDate}
                onChange={(e) => setFormInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs text-[#7b8fa3] mb-1">Notes</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] px-3 py-2 text-sm text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Add Payment'}
            </button>
            <button
              onClick={() => { setShowAdd(false); clearForm() }}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#7b8fa3]">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111d2e] px-2.5 py-1.5 text-xs text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="scheduled">Scheduled</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#7b8fa3]">Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111d2e] px-2.5 py-1.5 text-xs text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Aging Report */}
      {!isLoading && !error && data && data.agingReport && (data.agingReport.current.count > 0 || data.agingReport.days31_60.count > 0 || data.agingReport.days61_90.count > 0 || data.agingReport.days90plus.count > 0) && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          style={{ animation: 'slide-up 0.3s ease-out 0.1s both' }}
        >
          <div className="rounded-xl border border-[#22c55e]/20 bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#22c55e]" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">Current (0-30d)</span>
            </div>
            <p className="text-xl font-semibold text-[#22c55e] tabular-nums">{data.agingReport.current.count}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">{formatCompactCurrency(data.agingReport.current.total)}</p>
          </div>
          <div className="rounded-xl border border-[#f59e0b]/20 bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">31-60 Days</span>
            </div>
            <p className="text-xl font-semibold text-[#f59e0b] tabular-nums">{data.agingReport.days31_60.count}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">{formatCompactCurrency(data.agingReport.days31_60.total)}</p>
          </div>
          <div className="rounded-xl border border-[#f97316]/20 bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#f97316]" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">61-90 Days</span>
            </div>
            <p className="text-xl font-semibold text-[#f97316] tabular-nums">{data.agingReport.days61_90.count}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">{formatCompactCurrency(data.agingReport.days61_90.total)}</p>
          </div>
          <div className="rounded-xl border border-[#ef4444]/20 bg-[#111d2e]/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#ef4444]" />
              <span className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">90+ Days</span>
            </div>
            <p className="text-xl font-semibold text-[#ef4444] tabular-nums">{data.agingReport.days90plus.count}</p>
            <p className="text-xs text-[#5a6d82] mt-0.5">{formatCompactCurrency(data.agingReport.days90plus.total)}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-[#ef4444] mb-3" />
          <p className="text-sm text-[#7b8fa3]">Failed to load payments</p>
        </div>
      )}

      {/* Payments Table */}
      {!isLoading && !error && data && (
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
              All Payments ({payments.length})
            </h3>
          </div>
          {payments.length === 0 ? (
            <div className="px-6 pb-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#22c55e] mx-auto mb-3" />
              <p className="text-sm text-[#6b7f94]">No payments match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-t border-b border-[rgba(255,255,255,0.04)]">
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider w-10">
                      Status
                    </th>
                    <th
                      className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider cursor-pointer hover:text-[#9baab8] transition-colors"
                      onClick={() => handleSortToggle('vendor')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Vendor
                        {sortField === 'vendor' && <ArrowUpDown className="w-3 h-3" />}
                      </span>
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider hidden lg:table-cell">
                      Description
                    </th>
                    <th
                      className="px-6 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider cursor-pointer hover:text-[#9baab8] transition-colors"
                      onClick={() => handleSortToggle('amount')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Amount
                        {sortField === 'amount' && <ArrowUpDown className="w-3 h-3" />}
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider cursor-pointer hover:text-[#9baab8] transition-colors"
                      onClick={() => handleSortToggle('due_date')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Due Date
                        {sortField === 'due_date' && <ArrowUpDown className="w-3 h-3" />}
                      </span>
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider hidden md:table-cell">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider hidden lg:table-cell">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-medium text-[#7b8fa3] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const rel = getRelativeDueDate(payment.due_date)
                    const badge = PRIORITY_BADGE[payment.priority] ?? PRIORITY_BADGE.normal
                    const statusInfo = STATUS_DOT[payment.status] ?? STATUS_DOT.pending
                    const isPaid = payment.status === 'paid'
                    const isEditing = editingId === payment.id

                    const editInputClass = 'bg-[#0a1628] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-sm text-[#e8edf4] focus:outline-none focus:ring-1 focus:ring-blue-500/40'

                    return (
                      <tr
                        key={payment.id}
                        className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-white/[0.02] transition-colors duration-150 ${isPaid && !isEditing ? 'opacity-50' : ''}`}
                      >
                        {/* Status dot — clickable to cycle */}
                        <td className="px-6 py-3.5">
                          <button
                            onClick={() => handleStatusCycle(payment)}
                            className="group/status flex items-center justify-center"
                            title={`${statusInfo.label} — click to change`}
                          >
                            <div
                              className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform group-hover/status:scale-125 ring-2 ring-transparent group-hover/status:ring-white/10"
                              style={{ backgroundColor: statusInfo.color }}
                            />
                          </button>
                        </td>
                        {/* Vendor */}
                        <td className="px-6 py-3.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.vendor}
                              onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                              className={editInputClass + ' w-full min-w-[100px]'}
                            />
                          ) : (
                            <div className="flex flex-col">
                              <span className={`text-sm font-medium ${isPaid ? 'line-through text-[#5a6d82]' : 'text-[#e8edf4]'}`}>
                                {payment.vendor}
                              </span>
                              {payment.invoice_number && (
                                <span className="text-[10px] text-[#5a6d82] mt-0.5">{payment.invoice_number}</span>
                              )}
                            </div>
                          )}
                        </td>
                        {/* Description */}
                        <td className="px-6 py-3.5 hidden lg:table-cell">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className={editInputClass + ' w-full min-w-[120px]'}
                            />
                          ) : (
                            <span className={`text-xs truncate max-w-[200px] block ${isPaid ? 'text-[#3d5066]' : 'text-[#7b8fa3]'}`}>
                              {payment.description || '-'}
                            </span>
                          )}
                        </td>
                        {/* Amount */}
                        <td className="px-6 py-3.5 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.amount}
                              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                              min="0.01"
                              step="0.01"
                              className={editInputClass + ' w-full min-w-[80px] text-right tabular-nums'}
                            />
                          ) : (
                            <span className={`text-sm font-semibold tabular-nums ${isPaid ? 'line-through text-[#5a6d82]' : 'text-[#e8edf4]'}`}>
                              {formatCurrency(payment.amount)}
                            </span>
                          )}
                        </td>
                        {/* Due Date */}
                        <td className="px-6 py-3.5">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.due_date}
                              onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                              className={editInputClass + ' min-w-[130px]'}
                            />
                          ) : (
                            <div className="flex flex-col">
                              <span
                                className="text-xs font-medium tabular-nums"
                                style={{
                                  color: isPaid
                                    ? '#5a6d82'
                                    : rel.urgency === 'overdue'
                                    ? '#ef4444'
                                    : rel.urgency === 'soon'
                                    ? '#f59e0b'
                                    : '#7b8fa3',
                                }}
                              >
                                {rel.text}
                              </span>
                              <span className="text-[10px] text-[#5a6d82] mt-0.5">{rel.absolute}</span>
                            </div>
                          )}
                        </td>
                        {/* Priority */}
                        <td className="px-6 py-3.5 hidden md:table-cell">
                          {isEditing ? (
                            <select
                              value={editForm.priority}
                              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as 'critical' | 'high' | 'normal' | 'low' })}
                              className={editInputClass + ' min-w-[90px]'}
                            >
                              <option value="critical">Critical</option>
                              <option value="high">High</option>
                              <option value="normal">Normal</option>
                              <option value="low">Low</option>
                            </select>
                          ) : (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: badge.bg, color: badge.color }}
                            >
                              {badge.label}
                            </span>
                          )}
                        </td>
                        {/* Category */}
                        <td className="px-6 py-3.5 hidden lg:table-cell">
                          {isEditing ? (
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className={editInputClass + ' min-w-[100px]'}
                            >
                              <option value="">None</option>
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            payment.category ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#1a2a3e] text-[#7b8fa3]">
                                {payment.category}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#3d5066]">-</span>
                            )
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleEditSave}
                                  disabled={editSaving}
                                  className="text-[#22c55e] hover:text-[#4ade80] transition-colors disabled:opacity-50"
                                  title="Save changes"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-[#5a6d82] hover:text-[#e8edf4] transition-colors"
                                  title="Cancel editing"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(payment)}
                                  className="text-[#5a6d82] hover:text-blue-400 transition-colors"
                                  title="Edit payment"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(payment)}
                                  className="text-[#5a6d82] hover:text-red-400 transition-colors"
                                  title="Delete payment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 rounded animate-shimmer" />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-[rgba(255,255,255,0.04)] animate-shimmer" />
            ))}
          </div>
          <div className="h-[400px] rounded-xl border border-[rgba(255,255,255,0.04)] animate-shimmer" />
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  )
}
