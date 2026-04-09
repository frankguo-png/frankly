'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { FilterBreadcrumbs } from '@/components/transactions/filter-breadcrumbs'
import { SeedDataButton } from '@/components/dashboard/seed-data-button'
import { Download } from 'lucide-react'

function TransactionsContent() {
  const searchParams = useSearchParams()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [csvExporting, setCsvExporting] = useState(false)

  const filters = {
    search: searchParams.get('search') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    department: searchParams.get('department') ?? undefined,
    project: searchParams.get('project') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    type: (searchParams.get('type') as 'credit' | 'debit' | undefined) ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  }

  const handleExportCsv = useCallback(async () => {
    if (!orgId) return
    setCsvExporting(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('transactions')
        .select('date, vendor, description, amount, category, department, project')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)

      if (filters.search) {
        query = query.or(
          `description.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`
        )
      }
      if (filters.category) query = query.eq('category', filters.category)
      if (filters.department) query = query.eq('department', filters.department)
      if (filters.project) query = query.eq('project', filters.project)
      if (filters.source) query = query.eq('source', filters.source as 'plaid' | 'qbo' | 'rippling' | 'manual')
      if (filters.type === 'credit') query = query.gte('amount', 0)
      else if (filters.type === 'debit') query = query.lt('amount', 0)
      if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('date', filters.dateTo)

      query = query.order('date', { ascending: false }).limit(10000)

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const rows = data ?? []
      const escape = (val: string | null | undefined) => {
        if (val == null) return ''
        const s = String(val)
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      }

      const header = 'Date,Vendor,Description,Amount,Category,Department,Project'
      const csvRows = rows.map((r) =>
        [
          escape(r.date),
          escape(r.vendor),
          escape(r.description),
          String(r.amount ?? ''),
          escape(r.category),
          escape(r.department),
          escape(r.project),
        ].join(',')
      )
      const csvContent = [header, ...csvRows].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setCsvExporting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, searchParams])

  const fetchOrgId = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error: orgError } = await supabase
        .from('user_organizations')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (orgError) throw orgError

      if (data) {
        setOrgId(data.org_id)
      }
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrgId()
  }, [fetchOrgId])

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your financial transactions.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={() => fetchOrgId()} className="text-xs text-blue-400 hover:text-blue-300 underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your financial transactions.
          </p>
        </div>
        <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">
          Loading...
        </div>
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your financial transactions.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">
            Please sign in and join an organization to view transactions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage all your financial transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={csvExporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111d2e] px-3.5 py-2 text-sm font-medium text-[#c8d6e5] transition-all hover:bg-[#1a2b3c] hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {csvExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <SeedDataButton orgId={orgId} />
        </div>
      </div>

      <FilterBreadcrumbs />
      <TransactionFilters />
      <TransactionTable orgId={orgId} filters={filters} />

    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#e8edf4]">Transactions</h1>
            <p className="text-muted-foreground">
              View and manage all your financial transactions.
            </p>
          </div>
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  )
}
