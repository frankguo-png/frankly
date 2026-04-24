'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/currency'
import { getPreference, setPreference, PREF_TX_SORT } from '@/lib/utils/preferences'
import { toast } from 'sonner'
import type { Database } from '@/types/database'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, Tags, Building2, X, Pencil } from 'lucide-react'

type Transaction = Database['public']['Tables']['transactions']['Row']

interface TransactionFilters {
  search?: string
  category?: string
  department?: string
  project?: string
  source?: string
  type?: 'credit' | 'debit'
  dateFrom?: string
  dateTo?: string
}

interface TransactionTableProps {
  orgId: string
  filters?: TransactionFilters
}

type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 25

const categoryColors: Record<string, string> = {
  'Payroll': 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
  'Tools & Software': 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  'Marketing': 'bg-pink-500/15 text-pink-400 border border-pink-500/20',
  'Infrastructure': 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  'Legal & Admin': 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
  'Opex': 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  'Revenue': 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  'Uncategorized': 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
}

const departmentColors: Record<string, string> = {
  'Product': 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  'Engineering': 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
  'Marketing': 'bg-pink-500/15 text-pink-400 border border-pink-500/20',
  'Sales': 'bg-green-500/15 text-green-400 border border-green-500/20',
  'Operations': 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  'Admin': 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
}

const projectColors: Record<string, string> = {
  'LNER': 'bg-sky-500/15 text-sky-400 border border-sky-500/20',
  'PWC': 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
  'IWAKI': 'bg-teal-500/15 text-teal-400 border border-teal-500/20',
  'Brookfield': 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
}

const sourceColors: Record<string, string> = {
  'plaid': 'bg-emerald-500/10 text-emerald-500',
  'qbo': 'bg-blue-500/10 text-blue-500',
  'rippling': 'bg-violet-500/10 text-violet-500',
  'manual': 'bg-zinc-500/10 text-zinc-500',
}

const CATEGORY_OPTIONS = [
  'Payroll',
  'Tools & Software',
  'Marketing',
  'Infrastructure',
  'Legal & Admin',
  'Opex',
  'Revenue',
  'Uncategorized',
]

const DEPARTMENT_OPTIONS = [
  'Product',
  'Engineering',
  'Marketing',
  'Sales',
  'Operations',
  'Admin',
]

function SelectCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={() => onChange(!checked)}
      className="size-[18px] rounded-[5px] flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0"
      style={{
        background: checked || indeterminate ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(255,255,255,0.04)',
        border: checked || indeterminate ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.12)',
        boxShadow: checked || indeterminate ? '0 0 8px rgba(59,130,246,0.25)' : 'none',
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M3 6H9" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

function BulkActionBar({
  selectedCount,
  onRecategorize,
  onAssignDepartment,
  onClearSelection,
}: {
  selectedCount: number
  onRecategorize: (category: string) => void
  onAssignDepartment: (department: string) => void
  onClearSelection: () => void
}) {
  return (
    <div className="sticky top-0 z-10 bg-[#1a2b3c] border border-blue-500/30 rounded-lg p-3 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-blue-400">
        {selectedCount} selected
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
            <Tags className="size-3.5" />
            Recategorize
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          {CATEGORY_OPTIONS.map((cat) => (
            <DropdownMenuItem key={cat} onClick={() => onRecategorize(cat)}>
              <span className={`inline-block size-2 rounded-full mr-2 ${categoryColors[cat]?.split(' ')[0] ?? 'bg-zinc-500/15'}`} />
              {cat}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
            <Building2 className="size-3.5" />
            Assign Department
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          {DEPARTMENT_OPTIONS.map((dept) => (
            <DropdownMenuItem key={dept} onClick={() => onAssignDepartment(dept)}>
              <span className={`inline-block size-2 rounded-full mr-2 ${departmentColors[dept]?.split(' ')[0] ?? 'bg-zinc-500/15'}`} />
              {dept}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={onClearSelection}
        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-3" />
        Clear Selection
      </button>
    </div>
  )
}

function BadgePill({ label, colorClass }: { label: string; colorClass?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass ?? 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20'}`}
    >
      {label}
    </span>
  )
}

/** Inline click-to-edit badge with dropdown */
function EditableBadge({
  value,
  options,
  colorMap,
  fieldLabel,
  onSave,
}: {
  value: string | null
  options: string[]
  colorMap: Record<string, string>
  fieldLabel: string
  onSave: (newValue: string) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSelect = async (option: string) => {
    if (option === value) {
      setIsOpen(false)
      return
    }
    setIsOpen(false)
    await onSave(option)
  }

  if (isOpen) {
    return (
      <div ref={containerRef} className="relative">
        <div className="opacity-50 pointer-events-none">
          {value ? (
            <BadgePill label={value} colorClass={colorMap[value]} />
          ) : (
            <span className="text-muted-foreground/50 text-xs">-</span>
          )}
        </div>
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[160px] max-h-[220px] overflow-y-auto rounded-md border border-[rgba(255,255,255,0.1)] bg-[#111d2e] py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#e8edf4] hover:bg-[rgba(255,255,255,0.06)] transition-colors ${option === value ? 'bg-[rgba(255,255,255,0.04)] font-medium' : ''}`}
            >
              <span className={`inline-block size-2 rounded-full shrink-0 ${colorMap[option]?.split(' ')[0] ?? 'bg-zinc-500/15'}`} />
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="group/badge inline-flex items-center gap-1 cursor-pointer rounded-full transition-all hover:underline hover:decoration-dashed hover:underline-offset-2"
      title={`Click to edit ${fieldLabel}`}
    >
      {value ? (
        <BadgePill label={value} colorClass={colorMap[value]} />
      ) : (
        <span className="text-muted-foreground/50 text-xs hover:text-muted-foreground transition-colors">-</span>
      )}
      <Pencil className="size-3 text-muted-foreground/0 group-hover/badge:text-muted-foreground/60 transition-colors" />
    </button>
  )
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TransactionTable({ orgId, filters }: TransactionTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Restore saved sort preference on mount
  useEffect(() => {
    const saved = getPreference<{ column: SortField; direction: SortDirection } | null>(PREF_TX_SORT, null)
    if (saved?.column && saved?.direction) {
      setSortField(saved.column)
      setSortDirection(saved.direction)
    }
  }, [])

  // Derive unique category/department options from loaded data merged with known keys
  const categoryOptions = useMemo(() => {
    const fromData = transactions
      .map((tx) => tx.category)
      .filter((c): c is string => c !== null)
    const merged = new Set([...CATEGORY_OPTIONS, ...fromData])
    return Array.from(merged).sort()
  }, [transactions])

  const departmentOptions = useMemo(() => {
    const fromData = transactions
      .map((tx) => tx.department)
      .filter((d): d is string => d !== null)
    const merged = new Set([...DEPARTMENT_OPTIONS, ...fromData])
    return Array.from(merged).sort()
  }, [transactions])

  const updateTransactionField = useCallback(
    async (txId: string, field: 'category' | 'department', newValue: string) => {
      const txIndex = transactions.findIndex((t) => t.id === txId)
      if (txIndex === -1) return
      const oldValue = transactions[txIndex][field]

      // Optimistic update
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId ? { ...t, [field]: newValue } : t
        )
      )

      const supabase = createClient()
      const { error } = await supabase
        .from('transactions')
        .update({ [field]: newValue, categorization_status: 'manual' as const })
        .eq('id', txId)

      if (error) {
        console.error(`Error updating ${field}:`, error)
        // Revert on error
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === txId ? { ...t, [field]: oldValue } : t
          )
        )
        toast.error(`Failed to update ${field}`)
      } else {
        const label = field === 'category' ? 'Category' : 'Department'
        toast.success(`${label} updated`)
      }
    },
    [transactions]
  )

  // Clear selection when filters or page changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters, page])

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(transactions.map((tx) => tx.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [transactions]
  )

  const toggleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('is_duplicate', false)

    if (filters?.search) {
      query = query.or(
        `description.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`
      )
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.department) {
      query = query.eq('department', filters.department)
    }
    if (filters?.project) {
      query = query.eq('project', filters.project)
    }
    if (filters?.source) {
      query = query.eq('source', filters.source as 'plaid' | 'qbo' | 'rippling' | 'manual')
    }
    if (filters?.type === 'credit') {
      query = query.gte('amount', 0)
    } else if (filters?.type === 'debit') {
      query = query.lt('amount', 0)
    }
    if (filters?.dateFrom) {
      query = query.gte('date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('date', filters.dateTo)
    }

    query = query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching transactions:', error)
      setTransactions([])
      setTotalCount(0)
    } else {
      setTransactions(data ?? [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [orgId, filters, page, sortField, sortDirection])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    setPage(0)
  }, [filters])

  // Attribution maps: bank accounts, qbo connections, entities — for showing
  // which Plaid account / QBO company each transaction came from.
  const [bankAccountsMap, setBankAccountsMap] = useState<Map<string, {
    bank_name: string
    account_name: string | null
    currency: string
  }>>(new Map())
  const [qboByEntityMap, setQboByEntityMap] = useState<Map<string, {
    company_name: string | null
    realm_id: string
  }>>(new Map())
  const [entityShortCodeMap, setEntityShortCodeMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()
    ;(async () => {
      const [banksRes, qboRes, entitiesRes] = await Promise.all([
        supabase
          .from('bank_accounts')
          .select('id, bank_name, account_name, currency')
          .eq('org_id', orgId),
        supabase
          .from('qbo_connections')
          .select('company_name, realm_id, entity_id')
          .eq('org_id', orgId),
        supabase
          .from('entities')
          .select('id, short_code')
          .eq('org_id', orgId),
      ])

      const banks = new Map<string, { bank_name: string; account_name: string | null; currency: string }>()
      for (const b of (banksRes.data ?? [])) {
        banks.set(b.id, { bank_name: b.bank_name, account_name: b.account_name, currency: b.currency })
      }
      setBankAccountsMap(banks)

      const qbo = new Map<string, { company_name: string | null; realm_id: string }>()
      for (const c of (qboRes.data ?? [])) {
        if (c.entity_id) qbo.set(c.entity_id, { company_name: c.company_name, realm_id: c.realm_id })
      }
      setQboByEntityMap(qbo)

      const short = new Map<string, string>()
      for (const e of (entitiesRes.data ?? [])) {
        if (e.short_code) short.set(e.id, e.short_code)
      }
      setEntityShortCodeMap(short)
    })()
  }, [orgId])

  const getSourceAttribution = useCallback(
    (tx: Transaction): string | null => {
      const shortCode = tx.entity_id ? entityShortCodeMap.get(tx.entity_id) ?? null : null
      const short = shortCode ? ` · ${shortCode}` : ''

      if (tx.source === 'plaid' && tx.bank_account_id) {
        const acct = bankAccountsMap.get(tx.bank_account_id)
        if (acct) {
          const label = acct.account_name && acct.account_name !== acct.bank_name
            ? `${acct.bank_name} – ${acct.account_name}`
            : acct.bank_name
          return `${label}${short}`
        }
      }

      if (tx.source === 'qbo' && tx.entity_id) {
        const conn = qboByEntityMap.get(tx.entity_id)
        if (conn) return `${conn.company_name ?? conn.realm_id}${short}`
      }

      return shortCode ?? null
    },
    [bankAccountsMap, qboByEntityMap, entityShortCodeMap]
  )

  const handleBulkUpdate = useCallback(
    async (field: 'category' | 'department', value: string) => {
      if (selectedIds.size === 0) return
      setBulkUpdating(true)
      try {
        const supabase = createClient()
        const ids = Array.from(selectedIds)
        const { error } = await supabase
          .from('transactions')
          .update({ [field]: value, categorization_status: 'manual' as const })
          .in('id', ids)
          .eq('org_id', orgId)

        if (error) throw error

        toast.success(
          `Updated ${field} to "${value}" for ${ids.length} transaction${ids.length > 1 ? 's' : ''}`
        )
        setSelectedIds(new Set())
        fetchTransactions()
      } catch (err) {
        console.error('Bulk update failed:', err)
        toast.error(`Failed to update ${field}. Please try again.`)
      } finally {
        setBulkUpdating(false)
      }
    },
    [selectedIds, orgId, fetchTransactions]
  )

  const toggleSort = (field: SortField) => {
    let newField: SortField
    let newDirection: SortDirection
    if (sortField === field) {
      newField = field
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      newField = field
      newDirection = 'desc'
    }
    setSortField(newField)
    setSortDirection(newDirection)
    setPreference(PREF_TX_SORT, { column: newField, direction: newDirection })
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground/70 w-10" />
              <TableHead className="text-muted-foreground/70">Date</TableHead>
              <TableHead className="text-muted-foreground/70">Description</TableHead>
              <TableHead className="text-muted-foreground/70">Vendor</TableHead>
              <TableHead className="text-muted-foreground/70 text-right">Amount</TableHead>
              <TableHead className="text-muted-foreground/70">Category</TableHead>
              <TableHead className="text-muted-foreground/70">Department</TableHead>
              <TableHead className="text-muted-foreground/70">Project</TableHead>
              <TableHead className="text-muted-foreground/70">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i} className="border-border/30">
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (transactions.length === 0 && page === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card flex flex-col items-center justify-center py-20 px-6">
        <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <svg className="size-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm text-center">
          No transactions yet. Connect a bank account to get started.
        </p>
      </div>
    )
  }

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < transactions.length

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onRecategorize={(cat) => handleBulkUpdate('category', cat)}
          onAssignDepartment={(dept) => handleBulkUpdate('department', dept)}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}
      {bulkUpdating && (
        <div className="text-xs text-blue-400 animate-pulse px-1">Updating transactions...</div>
      )}
      <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent bg-muted/30">
              <TableHead className="text-muted-foreground/70 w-10">
                <SelectCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-muted-foreground/70">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  Date
                  <ArrowUpDown className="size-3" />
                </button>
              </TableHead>
              <TableHead className="text-muted-foreground/70">Description</TableHead>
              <TableHead className="text-muted-foreground/70">Vendor</TableHead>
              <TableHead className="text-muted-foreground/70 text-right">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                  onClick={() => toggleSort('amount')}
                >
                  Amount
                  <ArrowUpDown className="size-3" />
                </button>
              </TableHead>
              <TableHead className="text-muted-foreground/70">Category</TableHead>
              <TableHead className="text-muted-foreground/70">Department</TableHead>
              <TableHead className="text-muted-foreground/70">Project</TableHead>
              <TableHead className="text-muted-foreground/70">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow
                key={tx.id}
                className={`border-border/30 hover:bg-muted/20 transition-colors ${selectedIds.has(tx.id) ? 'bg-blue-500/5' : ''}`}
              >
                <TableCell>
                  <SelectCheckbox
                    checked={selectedIds.has(tx.id)}
                    onChange={(checked) => toggleSelectOne(tx.id, checked)}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(tx.date)}
                </TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {tx.description ?? '-'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {tx.vendor ?? '-'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  <span className={tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                  </span>
                </TableCell>
                <TableCell>
                  <EditableBadge
                    value={tx.category}
                    options={categoryOptions}
                    colorMap={categoryColors}
                    fieldLabel="category"
                    onSave={(val) => updateTransactionField(tx.id, 'category', val)}
                  />
                </TableCell>
                <TableCell>
                  <EditableBadge
                    value={tx.department}
                    options={departmentOptions}
                    colorMap={departmentColors}
                    fieldLabel="department"
                    onSave={(val) => updateTransactionField(tx.id, 'department', val)}
                  />
                </TableCell>
                <TableCell>
                  {tx.project ? (
                    <BadgePill label={tx.project} colorClass={projectColors[tx.project]} />
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`self-start inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sourceColors[tx.source] ?? 'bg-zinc-500/10 text-zinc-500'}`}
                    >
                      {tx.source}
                    </span>
                    {(() => {
                      const attr = getSourceAttribution(tx)
                      return attr ? (
                        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[160px]">
                          {attr}
                        </span>
                      ) : null
                    })()}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
