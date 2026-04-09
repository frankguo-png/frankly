'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useReconciliation } from '@/hooks/use-reconciliation'
import { formatCurrency } from '@/lib/utils/currency'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeftRight,
  Check,
  X,
  Zap,
  Search,
} from 'lucide-react'
import type { TransactionRecord } from '@/lib/reconciliation/matcher'

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: typeof CheckCircle2; label: string; value: string | number; color: string; bg: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
      <div className="flex items-center justify-center size-9 rounded-lg shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="size-4" style={{ color }} />
      </div>
      <div>
        <p className="text-lg font-bold text-[#e8edf4] tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-[#7b8fa3] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const bg = pct >= 80 ? 'rgba(34,197,94,0.12)' : pct >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums" style={{ backgroundColor: bg, color }}>
      {pct}%
    </span>
  )
}

function TxCell({ tx, source }: { tx: TransactionRecord; source: 'bank' | 'accounting' }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-[#e8edf4] truncate">{tx.vendor ?? tx.description ?? 'Unknown'}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] text-[#7b8fa3]">{tx.date}</span>
        <span className={`text-[10px] font-medium tabular-nums ${tx.amount > 0 ? 'text-emerald-400' : 'text-[#e8edf4]'}`}>
          {formatCurrency(Math.abs(tx.amount))}
        </span>
        {tx.category && <span className="text-[9px] text-[#5b6e82]">{tx.category}</span>}
        <span className="text-[9px] px-1 rounded bg-[rgba(255,255,255,0.04)] text-[#5b6e82]">{source === 'bank' ? (tx.source === 'rippling' ? 'Rippling' : 'Bank') : 'QBO'}</span>
      </div>
    </div>
  )
}

type ViewTab = 'suggested' | 'unmatched_bank' | 'unmatched_qbo'

export default function ReconciliationPage() {
  const { data, error, isLoading, mutate } = useReconciliation(3)
  const [activeTab, setActiveTab] = useState<ViewTab>('suggested')
  const [saving, setSaving] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  async function handleConfirmMatch(bankTxId: string, accountingTxId: string, confidence: number) {
    setSaving(bankTxId)
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_match', bank_tx_id: bankTxId, accounting_tx_id: accountingTxId, confidence }),
      })
      if (!res.ok) throw new Error()
      toast.success('Match confirmed')
      mutate()
    } catch { toast.error('Failed to confirm match') } finally { setSaving(null) }
  }

  async function handleDismiss(bankTxId?: string, accountingTxId?: string) {
    setSaving(bankTxId ?? accountingTxId ?? '')
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', bank_tx_id: bankTxId, accounting_tx_id: accountingTxId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dismissed')
      mutate()
    } catch { toast.error('Failed to dismiss') } finally { setSaving(null) }
  }

  async function handleAutoMatchAll() {
    if (!data?.suggestedMatches?.length) return
    setSaving('bulk')
    try {
      const matches = data.suggestedMatches.map((m: { bankTx: TransactionRecord; accountingTx: TransactionRecord; confidence: number }) => ({
        bankTxId: m.bankTx.id,
        accountingTxId: m.accountingTx.id,
        confidence: m.confidence,
      }))
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_match_all', matches }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast.success(`${result.confirmed} matches confirmed automatically`)
      mutate()
    } catch { toast.error('Failed to auto-match') } finally { setSaving(null) }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-semibold text-[#e8edf4]">Reconciliation</h1></div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[72px] rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] animate-shimmer" />)}
        </div>
        <div className="h-[400px] rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] animate-shimmer" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-semibold text-[#e8edf4]">Reconciliation</h1></div>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="size-6 text-red-400/80 mb-3" />
          <p className="text-sm text-red-400 mb-3">Failed to load reconciliation data</p>
          <button onClick={() => mutate()} className="text-xs text-blue-400 hover:text-blue-300 underline">Try again</button>
        </div>
      </div>
    )
  }

  const summary = data?.summary ?? { matchedCount: 0, unmatchedBankCount: 0, unmatchedAccountingCount: 0, alreadyMatchedCount: 0, overallMatchRate: 0 }
  const suggestedMatches = data?.suggestedMatches ?? []
  const unmatchedBank: TransactionRecord[] = data?.unmatchedBank ?? []
  const unmatchedAccounting: TransactionRecord[] = data?.unmatchedAccounting ?? []
  const highConfidenceCount = suggestedMatches.filter((m: { confidence: number }) => m.confidence >= 0.7).length

  // Filter
  const filterTx = (tx: TransactionRecord) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (tx.vendor ?? '').toLowerCase().includes(q) || (tx.description ?? '').toLowerCase().includes(q)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#e8edf4]">Reconciliation</h1>
        <p className="text-sm text-[#7b8fa3] mt-0.5">Match bank transactions to accounting records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Already Matched" value={summary.alreadyMatchedCount} color="#22c55e" bg="rgba(34,197,94,0.08)" />
        <StatCard icon={ArrowLeftRight} label="Suggested Matches" value={suggestedMatches.length} color="#3b82f6" bg="rgba(59,130,246,0.08)" />
        <StatCard icon={AlertTriangle} label="Unmatched (Bank/Rippling)" value={summary.unmatchedBankCount} color="#f59e0b" bg="rgba(245,158,11,0.08)" />
        <StatCard icon={XCircle} label="Unmatched (QBO)" value={summary.unmatchedAccountingCount} color="#ef4444" bg="rgba(239,68,68,0.08)" />
      </div>

      {/* Match rate bar */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#7b8fa3] uppercase tracking-wider">Overall Match Rate</span>
          <span className="text-sm font-semibold text-[#e8edf4] tabular-nums">{summary.overallMatchRate}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[rgba(255,255,255,0.04)] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500/60 transition-all duration-700" style={{ width: `${summary.overallMatchRate}%` }} />
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] p-0.5 border border-[rgba(255,255,255,0.04)]">
          {([
            { key: 'suggested' as const, label: 'Suggested Matches', count: suggestedMatches.length },
            { key: 'unmatched_bank' as const, label: 'Unmatched (Bank/Rippling)', count: unmatchedBank.length },
            { key: 'unmatched_qbo' as const, label: 'Unmatched (QBO)', count: unmatchedAccounting.length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${activeTab === tab.key ? 'bg-[rgba(255,255,255,0.1)] text-[#e8edf4] shadow-sm' : 'text-[#7b8fa3] hover:text-[#c0cad8]'}`}>
              {tab.label}
              {tab.count > 0 && <span className="min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[9px] font-semibold leading-none px-1">{tab.count}</span>}
            </button>
          ))}
        </div>
        {activeTab === 'suggested' && highConfidenceCount > 0 && (
          <button onClick={handleAutoMatchAll} disabled={saving === 'bulk'} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50">
            <Zap className="size-3" />
            Auto-Match All ({highConfidenceCount})
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[#5b6e82]" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by vendor..." className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] pl-7 pr-3 py-1.5 text-[11px] text-[#e8edf4] placeholder:text-[#5b6e82] focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
      </div>

      {/* Content */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
        {activeTab === 'suggested' && (
          <>
            {suggestedMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="size-8 text-emerald-400 mb-3" />
                <p className="text-sm text-[#c0cad8]">No suggested matches</p>
                <p className="text-xs text-[#7b8fa3] mt-1">All transactions are either matched or have no candidates.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {/* Header */}
                <div className="flex items-center gap-4 px-4 py-2 bg-[rgba(255,255,255,0.01)]">
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider flex-1">Bank Transaction</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-8 text-center shrink-0" />
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider flex-1">QBO Transaction</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-12 text-center shrink-0">Match</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-16 shrink-0">Actions</span>
                </div>
                {suggestedMatches
                  .filter((m: { bankTx: TransactionRecord; accountingTx: TransactionRecord }) => filterTx(m.bankTx) || filterTx(m.accountingTx))
                  .map((match: { bankTx: TransactionRecord; accountingTx: TransactionRecord; confidence: number }) => (
                  <div key={`${match.bankTx.id}-${match.accountingTx.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-[rgba(255,255,255,0.01)]">
                    <div className="flex-1"><TxCell tx={match.bankTx} source="bank" /></div>
                    <ArrowLeftRight className="size-3 text-[#5b6e82] shrink-0" />
                    <div className="flex-1"><TxCell tx={match.accountingTx} source="accounting" /></div>
                    <div className="w-12 text-center shrink-0"><ConfidenceBadge confidence={match.confidence} /></div>
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <button onClick={() => handleConfirmMatch(match.bankTx.id, match.accountingTx.id, match.confidence)} disabled={saving === match.bankTx.id} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors disabled:opacity-50" title="Confirm match"><Check className="size-3.5" /></button>
                      <button onClick={() => handleDismiss(match.bankTx.id, match.accountingTx.id)} disabled={saving === match.bankTx.id} className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50" title="Dismiss"><X className="size-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'unmatched_bank' && (
          <>
            {unmatchedBank.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="size-8 text-emerald-400 mb-3" />
                <p className="text-sm text-[#c0cad8]">All bank transactions matched</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-4 px-4 py-2 bg-[rgba(255,255,255,0.01)]">
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider flex-1">Transaction</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-20 text-right">Amount</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-16">Actions</span>
                </div>
                {unmatchedBank.filter(filterTx).map(tx => (
                  <div key={tx.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[rgba(255,255,255,0.01)]">
                    <div className="flex-1"><TxCell tx={tx} source="bank" /></div>
                    <span className={`text-[11px] font-medium tabular-nums w-20 text-right ${tx.amount > 0 ? 'text-emerald-400' : 'text-[#e8edf4]'}`}>{formatCurrency(Math.abs(tx.amount))}</span>
                    <div className="w-16"><button onClick={() => handleDismiss(tx.id)} className="p-1 rounded hover:bg-[rgba(255,255,255,0.04)] text-[#5b6e82] transition-colors text-[10px]">Dismiss</button></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'unmatched_qbo' && (
          <>
            {unmatchedAccounting.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="size-8 text-emerald-400 mb-3" />
                <p className="text-sm text-[#c0cad8]">All QBO transactions matched</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-4 px-4 py-2 bg-[rgba(255,255,255,0.01)]">
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider flex-1">Transaction</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-20 text-right">Amount</span>
                  <span className="text-[10px] text-[#5b6e82] uppercase tracking-wider w-16">Actions</span>
                </div>
                {unmatchedAccounting.filter(filterTx).map(tx => (
                  <div key={tx.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[rgba(255,255,255,0.01)]">
                    <div className="flex-1"><TxCell tx={tx} source="accounting" /></div>
                    <span className={`text-[11px] font-medium tabular-nums w-20 text-right ${tx.amount > 0 ? 'text-emerald-400' : 'text-[#e8edf4]'}`}>{formatCurrency(Math.abs(tx.amount))}</span>
                    <div className="w-16"><button onClick={() => handleDismiss(undefined, tx.id)} className="p-1 rounded hover:bg-[rgba(255,255,255,0.04)] text-[#5b6e82] transition-colors text-[10px]">Dismiss</button></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
