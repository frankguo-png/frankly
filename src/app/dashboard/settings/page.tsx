'use client'

import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { PlaidLinkButton } from '@/components/settings/plaid-link-button'
import { QboConnectButton } from '@/components/settings/qbo-connect-button'
import { RipplingConnectButton } from '@/components/settings/rippling-connect-button'
import { EntityManager } from '@/components/settings/entity-manager'
import { BankAccountsManager } from '@/components/settings/bank-accounts-manager'
import { toast } from 'sonner'
import { Loader2, Sparkles, Trash2, AlertTriangle, Layers } from 'lucide-react'

export default function SettingsPage() {
  const { mutate } = useSWRConfig()
  const [categorizing, setCategorizing] = useState(false)
  const [deduping, setDeduping] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const handleDedup = async () => {
    setDeduping(true)
    try {
      const res = await fetch('/api/dedup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to dedupe')
        return
      }
      if (data.duplicates_found === 0) {
        toast.info('No duplicates found')
      } else {
        toast.success(
          `Found ${data.duplicates_found} duplicate${data.duplicates_found === 1 ? '' : 's'}` +
            (data.enriched ? ` · enriched ${data.enriched} QBO row${data.enriched === 1 ? '' : 's'}` : '')
        )
        mutate(() => true, undefined, { revalidate: true })
      }
    } catch {
      toast.error('Network error while deduping')
    } finally {
      setDeduping(false)
    }
  }

  const handleCategorize = async () => {
    setCategorizing(true)
    try {
      const res = await fetch('/api/categorize', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to run categorization')
        return
      }

      if (data.total_categorized === 0) {
        toast.info('No uncategorized transactions found')
      } else {
        toast.success(
          `Categorized ${data.total_categorized} of ${data.total_uncategorized} transactions. ${data.total_remaining} remaining.`
        )
        // Revalidate SWR caches so UI reflects new categories
        mutate(key => true, undefined, { revalidate: true })
      }
    } catch {
      toast.error('Network error while running categorization')
    } finally {
      setCategorizing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#e8edf4]">Settings</h1>
        <p className="mt-1 text-sm text-[#7b8fa3]">Manage your data connections and preferences.</p>
      </div>
      <div className="h-px bg-[rgba(255,255,255,0.06)]" />

      <div className="space-y-6">
        {/* Entities */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">Entities</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Manage subsidiaries, regions, or separate QuickBooks companies.
          </p>
          <div className="mt-4">
            <EntityManager />
          </div>
        </div>

        {/* Bank Connections */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">Bank Connections</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Connect your bank accounts to automatically import transactions.
          </p>
          <div className="mt-4 space-y-4">
            <BankAccountsManager />
            <PlaidLinkButton />
          </div>
        </div>

        {/* QuickBooks Online */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">QuickBooks Online</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Connect QuickBooks for categorized expense data.
          </p>
          <div className="mt-4">
            <QboConnectButton />
          </div>
        </div>

        {/* Rippling */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">Rippling</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Connect Rippling for payroll and employee data.
          </p>
          <div className="mt-4">
            <RipplingConnectButton />
          </div>
        </div>

        {/* Categorization */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">Categorization</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Run rule-based categorization on uncategorized transactions.
          </p>
          <div className="mt-4">
            <button
              onClick={handleCategorize}
              disabled={categorizing}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {categorizing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Run Categorization
                </>
              )}
            </button>
          </div>
        </div>

        {/* Deduplication (Plaid ↔ QBO) */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">Deduplicate Transactions</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Match Plaid bank transactions to QBO accounting records (same date ±2 days, same amount,
            similar vendor name) and mark Plaid copies as duplicates. Runs automatically after each
            sync — use this for an on-demand pass.
          </p>
          <div className="mt-4">
            <button
              onClick={handleDedup}
              disabled={deduping}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deduping ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Layers className="size-4" />
                  Run Dedup
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clear Seed Data */}
        <div className="rounded-xl border border-red-500/20 bg-[#111d2e]/60 p-5">
          <h2 className="text-base font-semibold text-[#e8edf4]">Clear All Data</h2>
          <p className="mt-1 text-sm text-[#7b8fa3]">
            Remove all seed/demo data from your organization. This deletes all transactions, employees, reviews, bonuses, deals, budgets, and payments. Use this before connecting real accounts.
          </p>
          <div className="mt-4">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3.5 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
              >
                <Trash2 className="size-4" />
                Clear All Data
              </button>
            ) : (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">This cannot be undone</p>
                    <p className="text-xs text-[#7b8fa3] mt-1">
                      All transactions, employees, org chart, performance reviews, bonuses, deals, budgets, pending payments, and reconciliation data will be permanently deleted.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setClearing(true)
                      try {
                        const res = await fetch('/api/clear-data', { method: 'POST' })
                        if (!res.ok) {
                          const data = await res.json()
                          throw new Error(data.error || 'Failed to clear data')
                        }
                        const result = await res.json()
                        toast.success(result.message || 'All data cleared successfully')
                        setConfirmClear(false)
                        mutate(() => true, undefined, { revalidate: true })
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to clear data')
                      } finally {
                        setClearing(false)
                      }
                    }}
                    disabled={clearing}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {clearing ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-4 animate-spin" />
                        Clearing...
                      </span>
                    ) : (
                      'Yes, delete everything'
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
