'use client'

import { useEffect, useState, useCallback } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function RipplingConnectButton() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [syncingEmployees, setSyncingEmployees] = useState(false)

  const refreshStatus = useCallback(async () => {
    const supabase = createClient()

    const { count } = await supabase
      .from('payroll_allocations')
      .select('*', { count: 'exact', head: true })
      .is('end_date', null)

    setEmployeeCount(count ?? 0)

    const { data: latestSync } = await supabase
      .from('sync_log')
      .select('completed_at')
      .eq('source', 'rippling')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setLastSyncTime(latestSync?.completed_at ?? null)

    // If we have any rippling sync logs or employees, it's configured
    setConfigured((count ?? 0) > 0 || latestSync !== null)
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  async function handleSyncEmployees() {
    setSyncingEmployees(true)
    try {
      const res = await fetch('/api/rippling/sync', {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Sync failed')
      }
      const result = await res.json()
      toast.success(
        `Synced ${result.employees?.synced ?? 0} employees. ${result.employees?.deactivated ?? 0} deactivated.`
      )
      await refreshStatus()
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/kpi'))
      mutate('/api/forecast')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to sync employees'
      )
    } finally {
      setSyncingEmployees(false)
    }
  }

  if (configured === null) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {employeeCount > 0
              ? `${employeeCount} active employee${employeeCount === 1 ? '' : 's'}`
              : 'No employees synced yet'}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastSyncTime
              ? (
                <>
                  Last synced:{' '}
                  <time
                    dateTime={lastSyncTime}
                    title={new Date(lastSyncTime).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
                  </time>
                </>
              )
              : 'Never synced'}
          </p>
        </div>
        <Badge variant={configured ? 'default' : 'secondary'}>
          {configured ? 'Configured' : 'API Key Required'}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Rippling uses API key authentication. Set <code className="text-xs">RIPPLING_API_KEY</code> in
        your environment variables to enable syncing.
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncEmployees}
        disabled={syncingEmployees}
        className="w-full"
      >
        {syncingEmployees ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            Syncing...
          </>
        ) : (
          <>
            <Users className="size-4 mr-2" />
            Sync Employees
          </>
        )}
      </Button>
    </div>
  )
}
