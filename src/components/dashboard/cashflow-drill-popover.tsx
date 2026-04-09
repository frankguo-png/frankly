'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { format, parseISO } from 'date-fns'
import { TrendingUp, TrendingDown, ArrowRight, X, Loader2 } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  vendor: string | null
  description: string | null
  amount: number
  category: string | null
}

interface CashflowDrillPopoverProps {
  date: string
  dateTo: string
  position: { x: number; y: number }
  onClose: () => void
}

export function CashflowDrillPopover({ date, dateTo, position, onClose }: CashflowDrillPopoverProps) {
  const router = useRouter()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totals, setTotals] = useState({ cashIn: 0, cashOut: 0 })
  const [adjustedPos, setAdjustedPos] = useState(position)

  // Fetch transactions for the date range
  useEffect(() => {
    let cancelled = false
    async function fetchTransactions() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return

        const { data: orgData } = await supabase
          .from('user_organizations')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!orgData || cancelled) return

        const { data, error } = await supabase
          .from('transactions')
          .select('id, date, vendor, description, amount, category')
          .eq('org_id', orgData.org_id)
          .eq('is_duplicate', false)
          .gte('date', date)
          .lt('date', dateTo)
          .order('amount', { ascending: true })
          .limit(50)

        if (error || cancelled) return

        const rows = data ?? []
        let cashIn = 0
        let cashOut = 0
        for (const row of rows) {
          if (row.amount >= 0) cashIn += row.amount
          else cashOut += Math.abs(row.amount)
        }

        if (!cancelled) {
          setTransactions(rows.slice(0, 10))
          setTotals({ cashIn, cashOut })
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTransactions()
    return () => { cancelled = true }
  }, [date, dateTo])

  // Boundary detection: adjust position so popover stays in viewport
  useEffect(() => {
    if (!popoverRef.current) return
    const rect = popoverRef.current.getBoundingClientRect()
    const pad = 16
    let { x, y } = position

    if (x + rect.width + pad > window.innerWidth) {
      x = window.innerWidth - rect.width - pad
    }
    if (x < pad) x = pad
    if (y + rect.height + pad > window.innerHeight) {
      y = position.y - rect.height - 8
    }
    if (y < pad) y = pad

    setAdjustedPos({ x, y })
  }, [position, loading, transactions])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Use setTimeout to avoid the click that opened the popover from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [onClose])

  const handleViewAll = useCallback(() => {
    const params = new URLSearchParams({ dateFrom: date, dateTo })
    router.push(`/dashboard/transactions?${params.toString()}`)
    onClose()
  }, [router, date, dateTo, onClose])

  const formattedDate = (() => {
    try {
      const from = parseISO(date)
      const to = parseISO(dateTo)
      const fromStr = format(from, 'MMM d, yyyy')
      // If the range is a single day, just show the one date
      const diffMs = to.getTime() - from.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      if (diffDays <= 1) return fromStr
      const toStr = format(to, 'MMM d, yyyy')
      return `${format(from, 'MMM d')} – ${toStr}`
    } catch {
      return date
    }
  })()

  const net = totals.cashIn - totals.cashOut

  return (
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-[360px] max-h-[480px] overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0d1a2d]/95 backdrop-blur-xl shadow-2xl shadow-black/50"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        animation: 'fade-in 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3]">
          {formattedDate}
        </p>
        <button
          onClick={onClose}
          className="rounded-md p-0.5 text-[#7b8fa3] hover:text-[#e8edf4] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 text-[#7b8fa3] animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="px-4 pb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-xs text-[#7b8fa3]">Cash In</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-emerald-400">
                {formatCompactCurrency(totals.cashIn)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3 w-3 text-red-400" />
                <span className="text-xs text-[#7b8fa3]">Cash Out</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-red-400">
                {formatCompactCurrency(totals.cashOut)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-blue-400" />
                <span className="text-xs text-[#7b8fa3]">Net</span>
              </div>
              <span className={`text-xs font-semibold tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {net >= 0 ? '+' : ''}{formatCompactCurrency(net)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-[rgba(255,255,255,0.06)]" />

          {/* Transaction list */}
          {transactions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-[#7b8fa3]">No transactions for this period</p>
            </div>
          ) : (
            <div className="px-4 py-2.5 space-y-0.5">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#e8edf4] truncate">
                      {txn.vendor || txn.description || 'Unknown'}
                    </p>
                    {txn.category && (
                      <p className="text-[10px] text-[#7b8fa3] truncate">{txn.category}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold tabular-nums shrink-0 ${
                      txn.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* View all link */}
          <div className="px-4 pb-3 pt-1">
            <button
              onClick={handleViewAll}
              className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-[rgba(255,255,255,0.06)] transition-all text-center"
            >
              View all transactions
            </button>
          </div>
        </>
      )}
    </div>
  )
}
