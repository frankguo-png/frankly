'use client'

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Pencil, Loader2, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'

interface BankAccount {
  id: string
  bank_name: string
  account_name: string | null
  account_type: string | null
  currency: string
  current_balance: number | null
  connection_status: 'active' | 'error' | 'disconnected'
  entity_id: string | null
}

interface Entity {
  id: string
  name: string
  short_code: string | null
  currency: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function BankAccountsManager() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBank, setEditBank] = useState('')
  const [editAccount, setEditAccount] = useState('')
  const [editEntity, setEditEntity] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: entitiesData } = useSWR<{ entities: Entity[] }>('/api/entities', fetcher)
  const entities = entitiesData?.entities ?? []

  const loadAccounts = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, account_name, account_type, currency, current_balance, connection_status, entity_id')
      .order('bank_name', { ascending: true })
      .order('currency', { ascending: true })

    if (error) {
      console.error('Failed to load bank accounts:', error.message)
      setLoading(false)
      return
    }
    setAccounts((data ?? []) as BankAccount[])
    setLoading(false)
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const startEdit = (acct: BankAccount) => {
    setEditingId(acct.id)
    setEditBank(acct.bank_name)
    setEditAccount(acct.account_name ?? '')
    setEditEntity(acct.entity_id ?? '')
  }

  const cancelEdit = () => setEditingId(null)

  const deleteAccount = async (acct: BankAccount) => {
    const displayName = acct.account_name
      ? `${acct.bank_name} – ${acct.account_name}`
      : acct.bank_name
    if (!confirm(
      `Remove "${displayName}" (${acct.currency})?\n\n` +
      `Historical transactions stay in the dashboard but get unlinked from this account. ` +
      `To keep pulling transactions you'll need to reconnect the bank.`
    )) return

    setDeletingId(acct.id)
    try {
      const res = await fetch(`/api/bank-accounts/${acct.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove account')
      }
      toast.success(`"${displayName}" removed`)
      await loadAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove account')
    } finally {
      setDeletingId(null)
    }
  }

  const saveEdit = async () => {
    if (!editingId) return
    if (!editBank.trim()) {
      toast.error('Bank name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/bank-accounts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: editBank.trim(),
          account_name: editAccount.trim() || null,
          entity_id: editEntity || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update account')
      }
      toast.success('Account updated')
      setEditingId(null)
      await loadAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const entityLabel = (id: string | null) => {
    if (!id) return <span className="text-[#566a7f]">Unassigned</span>
    const entity = entities.find(e => e.id === id)
    return entity ? `${entity.name}${entity.short_code ? ` (${entity.short_code})` : ''}` : '—'
  }

  if (loading) {
    return <p className="text-xs text-[#7b8fa3]">Loading accounts…</p>
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-[#7b8fa3]">
        No connected accounts yet. Connect a bank below to see accounts here.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {accounts.map(acct => {
        const isEditing = editingId === acct.id

        if (isEditing) {
          return (
            <div
              key={acct.id}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(59,130,246,0.04)] px-4 py-3 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Bank name</label>
                  <input
                    type="text"
                    value={editBank}
                    onChange={e => setEditBank(e.target.value)}
                    placeholder="e.g. BoA"
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">
                    Account name <span className="text-[#566a7f]">(e.g. Checking / Payroll)</span>
                  </label>
                  <input
                    type="text"
                    value={editAccount}
                    onChange={e => setEditAccount(e.target.value)}
                    placeholder={`e.g. ${acct.currency} Checking`}
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Entity</label>
                <select
                  value={editEntity}
                  onChange={e => setEditEntity(e.target.value)}
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
                >
                  <option value="" className="bg-[#0d1a2d] text-[#e8edf4]">Unassigned</option>
                  {entities.map(e => (
                    <option key={e.id} value={e.id} className="bg-[#0d1a2d] text-[#e8edf4]">
                      {e.name}{e.short_code ? ` (${e.short_code})` : ''} — {e.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (<><Loader2 className="size-3.5 animate-spin" />Saving…</>) : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3.5 py-1.5 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )
        }

        return (
          <div
            key={acct.id}
            className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 group"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e8edf4]">
                    {acct.bank_name}
                    {acct.account_name && (
                      <span className="text-[#7b8fa3]"> – {acct.account_name}</span>
                    )}
                  </span>
                  <span className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10px] font-medium text-[#7b8fa3]">
                    {acct.currency}
                  </span>
                  {acct.connection_status !== 'active' && (
                    <span className="text-[10px] font-medium text-amber-400">
                      {acct.connection_status}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#566a7f]">
                  <span>Entity: {entityLabel(acct.entity_id)}</span>
                  {typeof acct.current_balance === 'number' && (
                    <span>
                      Balance: {formatCurrency(acct.current_balance, acct.currency)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(acct)}
                  disabled={editingId !== null || deletingId === acct.id}
                  title="Edit"
                  className="p-1.5 rounded-md text-[#7b8fa3] hover:text-[#e8edf4] hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => deleteAccount(acct)}
                  disabled={editingId !== null || deletingId === acct.id}
                  title="Remove"
                  className="p-1.5 rounded-md text-[#7b8fa3] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                >
                  {deletingId === acct.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
