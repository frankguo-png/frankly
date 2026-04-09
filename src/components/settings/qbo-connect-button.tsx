'use client'

import { useEffect, useState, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, RefreshCw, Plus } from 'lucide-react'

interface Entity {
  id: string
  name: string
  short_code: string | null
  color: string | null
}

interface QboConnection {
  id: string
  company_name: string | null
  connection_status: string
  last_synced_at: string | null
  realm_id: string
  entity_id: string | null
}

const entitiesFetcher = (url: string) => fetch(url).then(r => r.json())

export function QboConnectButton() {
  const [connections, setConnections] = useState<QboConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const { data: entitiesData } = useSWR<{ entities: Entity[] }>('/api/entities', entitiesFetcher, {
    refreshInterval: 300000,
    revalidateOnFocus: false,
  })
  const entities = entitiesData?.entities ?? []

  const fetchConnections = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('qbo_connections')
      .select('id, company_name, connection_status, last_synced_at, realm_id, entity_id')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch QBO connections:', error)
    } else {
      setConnections(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId)
    try {
      const res = await fetch('/api/qbo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) throw new Error('Sync failed')
      const result = await res.json()
      toast.success(`Synced ${result.fetched || 0} QBO transactions`)
      await fetchConnections()
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/kpi'))
      mutate('/api/forecast')
      mutate('/api/currency')
    } catch {
      toast.error('Failed to sync QuickBooks transactions')
    } finally {
      setSyncingId(null)
    }
  }

  async function handleSyncAll() {
    setSyncingId('all')
    try {
      for (const conn of connections) {
        if (conn.connection_status === 'active') {
          const res = await fetch('/api/qbo/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: conn.id }),
          })
          if (!res.ok) {
            toast.error(`Failed to sync ${conn.company_name || conn.realm_id}`)
          }
        }
      }
      toast.success('All QuickBooks accounts synced')
      await fetchConnections()
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/kpi'))
      mutate('/api/forecast')
    } catch {
      toast.error('Failed to sync all accounts')
    } finally {
      setSyncingId(null)
    }
  }

  async function handleAssignEntity(connectionId: string, entityId: string | null) {
    setAssigningId(connectionId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('qbo_connections')
        .update({ entity_id: entityId || null })
        .eq('id', connectionId)

      if (error) throw error
      toast.success('Entity assignment updated')
      await fetchConnections()
    } catch {
      toast.error('Failed to assign entity')
    } finally {
      setAssigningId(null)
    }
  }

  function handleConnect() {
    window.location.href = '/api/qbo/auth'
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* List all connected QBO companies */}
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
        >
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-[#e8edf4] truncate">
              {conn.company_name || `QuickBooks (${conn.realm_id})`}
            </p>
            <p className="text-xs text-[#7b8fa3]">
              {conn.last_synced_at
                ? (
                  <>
                    Last synced:{' '}
                    <time
                      dateTime={conn.last_synced_at}
                      title={new Date(conn.last_synced_at).toLocaleString()}
                    >
                      {formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })}
                    </time>
                  </>
                )
                : 'Never synced'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {entities.length > 0 && (
              <select
                value={conn.entity_id || ''}
                onChange={e => handleAssignEntity(conn.id, e.target.value || null)}
                disabled={assigningId === conn.id}
                className="h-8 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 text-xs text-[#e8edf4] focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
              >
                <option value="" className="bg-[#0d1a2d]">No entity</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.id} className="bg-[#0d1a2d]">
                    {ent.name}{ent.short_code ? ` (${ent.short_code})` : ''}
                  </option>
                ))}
              </select>
            )}
            <Badge
              variant={conn.connection_status === 'active' ? 'default' : 'destructive'}
            >
              {conn.connection_status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync(conn.id)}
              disabled={syncingId !== null}
              className="h-8"
            >
              {syncingId === conn.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleConnect}
          className="flex-1"
        >
          <Plus className="size-3.5 mr-1.5" />
          {connections.length === 0 ? 'Connect QuickBooks' : 'Add Another QuickBooks'}
        </Button>
        {connections.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingId !== null}
            className="flex-1"
          >
            {syncingId === 'all' ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Syncing All...
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5 mr-1.5" />
                Sync All ({connections.length})
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
