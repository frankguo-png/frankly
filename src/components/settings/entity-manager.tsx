'use client'

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react'

interface Entity {
  id: string
  org_id: string
  name: string
  short_code: string | null
  currency: string
  color: string | null
  created_at: string
}

interface QboConnection {
  id: string
  company_name: string | null
  realm_id: string
  entity_id: string | null
}

interface BankAccount {
  id: string
  bank_name: string
  account_name: string | null
  entity_id: string | null
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR', 'BRL', 'MXN']

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function EntityManager() {
  const { data, mutate } = useSWR<{ entities: Entity[] }>('/api/entities', fetcher)
  const entities = data?.entities ?? []

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [color, setColor] = useState(PRESET_COLORS[0])

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editShortCode, setEditShortCode] = useState('')
  const [editCurrency, setEditCurrency] = useState('USD')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch QBO connections and bank accounts for entity assignment display
  const [qboConnections, setQboConnections] = useState<QboConnection[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const fetchRelated = useCallback(async () => {
    const supabase = createClient()
    const [qboRes, bankRes] = await Promise.all([
      supabase
        .from('qbo_connections')
        .select('id, company_name, realm_id, entity_id')
        .order('created_at', { ascending: true }),
      supabase
        .from('bank_accounts')
        .select('id, bank_name, account_name, entity_id')
        .order('created_at', { ascending: true }),
    ])
    if (qboRes.data) setQboConnections(qboRes.data)
    if (bankRes.data) setBankAccounts(bankRes.data)
  }, [])

  useEffect(() => {
    fetchRelated()
  }, [fetchRelated])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Entity name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          short_code: shortCode.trim() || null,
          currency,
          color,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create entity')
      }
      toast.success(`Entity "${name.trim()}" created`)
      setName('')
      setShortCode('')
      setCurrency('USD')
      setColor(PRESET_COLORS[0])
      setShowForm(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create entity')
    } finally {
      setSaving(false)
    }
  }

  const getEntityQboConnections = (entityId: string) =>
    qboConnections.filter(c => c.entity_id === entityId)

  const getEntityBankAccounts = (entityId: string) =>
    bankAccounts.filter(b => b.entity_id === entityId)

  const startEdit = (entity: Entity) => {
    setEditingId(entity.id)
    setEditName(entity.name)
    setEditShortCode(entity.short_code ?? '')
    setEditCurrency(entity.currency)
    setEditColor(entity.color ?? PRESET_COLORS[0])
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async () => {
    if (!editingId) return
    if (!editName.trim()) {
      toast.error('Entity name is required')
      return
    }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/entities/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          short_code: editShortCode.trim() || null,
          currency: editCurrency,
          color: editColor,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update entity')
      }
      toast.success('Entity updated')
      setEditingId(null)
      mutate()
      fetchRelated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update entity')
    } finally {
      setEditSaving(false)
    }
  }

  const deleteEntity = async (entity: Entity) => {
    const linkCount =
      getEntityQboConnections(entity.id).length +
      getEntityBankAccounts(entity.id).length
    const warning = linkCount > 0
      ? `Delete "${entity.name}"? ${linkCount} connection${linkCount === 1 ? '' : 's'} will be left unassigned (they won't be deleted).`
      : `Delete "${entity.name}"?`
    if (!confirm(warning)) return

    setDeletingId(entity.id)
    try {
      const res = await fetch(`/api/entities/${entity.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete entity')
      }
      toast.success(`Entity "${entity.name}" deleted`)
      mutate()
      fetchRelated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entity')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Entity list */}
      {entities.length === 0 ? (
        <p className="text-sm text-[#7b8fa3]">
          No entities yet. Create entities to track multiple QuickBooks companies, subsidiaries, or regions.
        </p>
      ) : (
        <div className="space-y-2">
          {entities.map(entity => {
            const entityQbo = getEntityQboConnections(entity.id)
            const entityBanks = getEntityBankAccounts(entity.id)
            const isEditing = editingId === entity.id
            const isDeleting = deletingId === entity.id

            if (isEditing) {
              return (
                <div
                  key={entity.id}
                  className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(59,130,246,0.04)] px-4 py-3 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Short Code</label>
                      <input
                        type="text"
                        value={editShortCode}
                        onChange={e => setEditShortCode(e.target.value.toUpperCase().slice(0, 4))}
                        maxLength={4}
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Currency</label>
                      <select
                        value={editCurrency}
                        onChange={e => setEditCurrency(e.target.value)}
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
                      >
                        {CURRENCIES.map(c => (
                          <option key={c} value={c} className="bg-[#0d1a2d] text-[#e8edf4]">{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Color</label>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className="h-6 w-6 rounded-full border-2 transition-all"
                            style={{
                              backgroundColor: c,
                              borderColor: editColor === c ? '#fff' : 'transparent',
                              transform: editColor === c ? 'scale(1.15)' : 'scale(1)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={editSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editSaving ? (
                        <><Loader2 className="size-3.5 animate-spin" />Saving…</>
                      ) : 'Save'}
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
                key={entity.id}
                className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3 group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: entity.color || '#6b7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#e8edf4]">{entity.name}</span>
                      {entity.short_code && (
                        <span className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10px] font-medium text-[#7b8fa3]">
                          {entity.short_code}
                        </span>
                      )}
                      <span className="text-[10px] text-[#566a7f]">{entity.currency}</span>
                    </div>
                    {(entityQbo.length > 0 || entityBanks.length > 0) && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {entityQbo.map(c => (
                          <span key={c.id} className="text-[10px] text-[#566a7f]">
                            QBO: {c.company_name || c.realm_id}
                          </span>
                        ))}
                        {entityBanks.map(b => (
                          <span key={b.id} className="text-[10px] text-[#566a7f]">
                            Bank: {b.account_name || b.bank_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(entity)}
                      disabled={editingId !== null || isDeleting}
                      title="Edit"
                      className="p-1.5 rounded-md text-[#7b8fa3] hover:text-[#e8edf4] hover:bg-white/5 transition-colors disabled:opacity-30"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => deleteEntity(entity)}
                      disabled={editingId !== null || isDeleting}
                      title="Delete"
                      className="p-1.5 rounded-md text-[#7b8fa3] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                    >
                      {isDeleting ? (
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
      )}

      {/* Add entity form */}
      {showForm ? (
        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme US"
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] placeholder:text-[#566a7f] focus:border-blue-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Short Code</label>
              <input
                type="text"
                value={shortCode}
                onChange={e => setShortCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="e.g. US"
                maxLength={4}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] placeholder:text-[#566a7f] focus:border-blue-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c} className="bg-[#0d1a2d] text-[#e8edf4]">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#7b8fa3] mb-1">Color</label>
              <div className="flex items-center gap-1.5 pt-0.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? '#fff' : 'transparent',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Entity'
              )}
            </button>
            <button
              onClick={() => { setShowForm(false); setName(''); setShortCode(''); setCurrency('USD'); setColor(PRESET_COLORS[0]) }}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3.5 py-1.5 text-sm text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] px-3.5 py-2 text-sm font-medium text-[#7b8fa3] transition-all hover:text-[#e8edf4] hover:border-[rgba(255,255,255,0.15)]"
        >
          <Plus className="size-3.5" />
          Add Entity
        </button>
      )}
    </div>
  )
}
