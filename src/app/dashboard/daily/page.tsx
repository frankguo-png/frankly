'use client'

import { useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  format, parseISO, addDays, subDays,
  addWeeks, subWeeks, startOfWeek, endOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import type { DailyTransactionsResponse, DayGroup } from '@/app/api/daily-transactions/route'

type ViewMode = 'day' | 'week'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']
const fetcher = (url: string) => fetch(url).then(r => r.json())

/* ── Category colors ── */

const CAT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  'Revenue':          { dot: 'bg-emerald-400', bg: 'bg-emerald-500/8',  text: 'text-emerald-400' },
  'Payroll':          { dot: 'bg-violet-400',  bg: 'bg-violet-500/8',   text: 'text-violet-400' },
  'Tools & Software': { dot: 'bg-blue-400',    bg: 'bg-blue-500/8',     text: 'text-blue-400' },
  'Marketing':        { dot: 'bg-pink-400',    bg: 'bg-pink-500/8',     text: 'text-pink-400' },
  'Infrastructure':   { dot: 'bg-amber-400',   bg: 'bg-amber-500/8',    text: 'text-amber-400' },
  'Legal & Admin':    { dot: 'bg-slate-400',   bg: 'bg-slate-500/8',    text: 'text-slate-400' },
  'Opex':             { dot: 'bg-orange-400',   bg: 'bg-orange-500/8',  text: 'text-orange-400' },
}

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? { dot: 'bg-zinc-400', bg: 'bg-zinc-500/8', text: 'text-zinc-400' }
}

/* ── Group transactions by category ── */

interface CategoryGroup {
  category: string
  total: number
  transactions: Transaction[]
}

function groupByCategory(transactions: Transaction[]): { income: CategoryGroup[]; expenses: CategoryGroup[] } {
  const map = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const cat = tx.category ?? 'Uncategorized'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(tx)
  }

  const income: CategoryGroup[] = []
  const expenses: CategoryGroup[] = []

  for (const [category, txs] of map) {
    const total = txs.reduce((sum, tx) => sum + tx.amount, 0)
    const group = { category, total, transactions: txs }
    if (total >= 0) income.push(group)
    else expenses.push(group)
  }

  // Sort by absolute amount descending
  income.sort((a, b) => b.total - a.total)
  expenses.sort((a, b) => a.total - b.total) // most negative first

  return { income, expenses }
}

/* ── Category section ── */

function CategorySection({ group }: { group: CategoryGroup }) {
  const colors = catColor(group.category)
  const isIncome = group.total >= 0

  return (
    <div className="py-3">
      {/* Category header */}
      <div className="flex items-center justify-between px-5 mb-2">
        <div className="flex items-center gap-2">
          <div className={`size-2.5 rounded-full ${colors.dot}`} />
          <span className="text-sm font-medium text-[#e8edf4]">{group.category}</span>
          <span className="text-xs text-[#5a6d82]">({group.transactions.length})</span>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
          {isIncome ? '+' : ''}{formatCurrency(group.total)}
        </span>
      </div>

      {/* Transactions under this category */}
      <div className="space-y-px">
        {group.transactions.map(tx => (
          <div
            key={tx.id}
            className="flex items-center justify-between px-5 pl-10 py-2 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <span className="text-sm text-[#c8d5e3]">{tx.vendor ?? tx.description ?? 'Unknown'}</span>
              {tx.description && tx.vendor && (
                <span className="text-xs text-[#5a6d82] ml-2">{tx.description}</span>
              )}
            </div>
            <span className={`text-sm tabular-nums font-medium shrink-0 ml-4 ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
              {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  Main content                                                     */
/* ────────────────────────────────────────────────────────────────── */

function ActivityContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateParam = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
  const viewParam = (searchParams.get('view') ?? 'day') as ViewMode

  const { data, error, isLoading } = useSWR<DailyTransactionsResponse>(
    `/api/daily-transactions?date=${dateParam}&view=${viewParam}`,
    fetcher,
    { refreshInterval: 300_000 }
  )

  const currentDate = parseISO(dateParam)

  /* Navigation */
  const push = (date: Date, view: ViewMode) => {
    router.push(`/dashboard/daily?date=${format(date, 'yyyy-MM-dd')}&view=${view}`)
  }

  const setView = (v: ViewMode) => push(currentDate, v)

  const prev = () => {
    if (viewParam === 'day') push(subDays(currentDate, 1), 'day')
    else push(subWeeks(currentDate, 1), 'week')
  }

  const next = () => {
    if (viewParam === 'day') push(addDays(currentDate, 1), 'day')
    else push(addWeeks(currentDate, 1), 'week')
  }

  /* Date label */
  const dateLabel = useMemo(() => {
    if (viewParam === 'day') return format(currentDate, 'EEEE, MMMM d')
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
    const we = endOfWeek(currentDate, { weekStartsOn: 1 })
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d')}`
  }, [currentDate, viewParam])

  /* Group day-view transactions by category */
  const dayGroups = useMemo(() => {
    if (!data?.transactions) return null
    return groupByCategory(data.transactions)
  }, [data])

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ═══ TOP BAR: toggle + date nav ═══ */}
      <div className="flex items-center justify-between">
        {/* Segmented control */}
        <div className="inline-flex bg-[#0a1628] rounded-lg p-0.5">
          {(['day', 'week'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                viewParam === v
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[#7b8fa3] hover:text-[#e8edf4]'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1.5 rounded-md text-[#7b8fa3] hover:text-[#e8edf4] hover:bg-[rgba(255,255,255,0.04)] transition-all">
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-sm font-semibold text-[#e8edf4] px-3 min-w-[180px] text-center">
            {dateLabel}
          </span>
          <button onClick={next} className="p-1.5 rounded-md text-[#7b8fa3] hover:text-[#e8edf4] hover:bg-[rgba(255,255,255,0.04)] transition-all">
            <ChevronRight className="size-5" />
          </button>
          <button
            onClick={() => push(new Date(), viewParam)}
            className="ml-2 rounded-full px-3 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* ═══ Loading ═══ */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] p-5">
                <div className="h-3 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse mb-3" />
                <div className="h-7 w-24 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Error ═══ */}
      {error && !isLoading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-red-400 text-sm">Failed to load transactions.</p>
        </div>
      )}

      {/* ═══ DATA ═══ */}
      {data && !isLoading && (
        <>
          {/* 3 summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3] mb-1">Money In</p>
              <p className="text-xl font-bold tabular-nums text-emerald-400">{formatCompactCurrency(data.totalIn)}</p>
            </div>
            <div className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3] mb-1">Money Out</p>
              <p className="text-xl font-bold tabular-nums text-red-400">{formatCompactCurrency(data.totalOut)}</p>
            </div>
            <div className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3] mb-1">Net</p>
              <p className={`text-xl font-bold tabular-nums ${data.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.net >= 0 ? '+' : ''}{formatCompactCurrency(data.net)}
              </p>
            </div>
          </div>

          {/* Empty state */}
          {data.count === 0 && (
            <div className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] p-12 text-center">
              <p className="text-[#7b8fa3] text-sm">No transactions for this {viewParam}.</p>
            </div>
          )}

          {/* ═══ DAY VIEW: grouped by category ═══ */}
          {viewParam === 'day' && dayGroups && data.count > 0 && (
            <div className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] overflow-hidden divide-y divide-[rgba(255,255,255,0.06)]">
              {/* Income categories */}
              {dayGroups.income.length > 0 && (
                <div>
                  <div className="px-5 pt-4 pb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">Income</span>
                  </div>
                  {dayGroups.income.map(g => (
                    <CategorySection key={g.category} group={g} />
                  ))}
                </div>
              )}
              {/* Expense categories */}
              {dayGroups.expenses.length > 0 && (
                <div>
                  <div className="px-5 pt-4 pb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-red-400">Expenses</span>
                  </div>
                  {dayGroups.expenses.map(g => (
                    <CategorySection key={g.category} group={g} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ WEEK VIEW: one card per day, transactions grouped by category ═══ */}
          {viewParam === 'week' && data.dayGroups && data.count > 0 && (
            <div className="space-y-3">
              {data.dayGroups.map((dg: DayGroup) => {
                const { income, expenses } = groupByCategory(dg.transactions)
                return (
                  <div key={dg.date} className="rounded-xl bg-[#111d2e]/80 border border-[rgba(255,255,255,0.06)] overflow-hidden">
                    {/* Day header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                      <span className="text-sm font-semibold text-[#e8edf4]">
                        {format(parseISO(dg.date), 'EEEE, MMM d')}
                      </span>
                      <div className="flex items-center gap-4 text-sm tabular-nums">
                        <span className="text-emerald-400">+{formatCompactCurrency(dg.totalIn)}</span>
                        <span className="text-red-400">-{formatCompactCurrency(dg.totalOut)}</span>
                        <span className={`font-medium ${dg.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {dg.net >= 0 ? '+' : ''}{formatCompactCurrency(dg.net)}
                        </span>
                      </div>
                    </div>
                    {/* Category groups */}
                    {[...income, ...expenses].map(g => (
                      <CategorySection key={g.category} group={g} />
                    ))}
                  </div>
                )
              })}
            </div>
          )}

        </>
      )}
    </div>
  )
}

/* ── Page ── */

export default function DailyPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-[#e8edf4] mb-6">Activity</h1>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <div className="size-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <ActivityContent />
      </Suspense>
    </div>
  )
}
