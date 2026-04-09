'use client'

import { useEffect, useState } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { differenceInHours, differenceInDays, formatDistanceToNow } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

interface BankAccount {
  id: string
  bank_name: string
  account_name: string | null
  account_type: string | null
  currency: string
  current_balance: number | null
  connection_status: string
  last_synced_at: string | null
}

function StaleDataWarning({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  if (!lastSyncedAt) return null

  const now = new Date()
  const lastSynced = new Date(lastSyncedAt)
  const hoursAgo = differenceInHours(now, lastSynced)
  const daysAgo = differenceInDays(now, lastSynced)

  if (hoursAgo < 24) return null

  const isStale = daysAgo >= 7

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      isStale ? 'text-red-400' : 'text-amber-400'
    }`}>
      <AlertTriangle className="h-3 w-3" />
      {daysAgo === 0 ? 'Data is < 1 day old' : `Data is ${daysAgo} day${daysAgo === 1 ? '' : 's'} old`}
      {isStale && ' — sync recommended'}
    </span>
  )
}

export function ConnectionStatus() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAccounts() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, account_name, account_type, currency, current_balance, connection_status, last_synced_at')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Failed to fetch accounts:', error)
      } else {
        setAccounts(data || [])
      }
      setLoading(false)
    }
    fetchAccounts()
  }, [])

  async function handleSync(accountId: string) {
    setSyncing(accountId)
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId: accountId }),
      })
      if (!res.ok) throw new Error('Sync failed')
      const result = await res.json()
      toast.success(`Synced ${result.records_created || 0} new transactions`)
      // Refresh account list in-place
      const supabase = createClient()
      const { data } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, account_name, account_type, currency, current_balance, connection_status, last_synced_at')
        .order('created_at', { ascending: true })
      if (data) setAccounts(data)
      // Revalidate dashboard SWR caches
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/kpi'))
      mutate('/api/forecast')
      mutate('/api/currency')
    } catch {
      toast.error('Failed to sync transactions')
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No bank accounts connected yet. Use the button below to connect one.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <Card key={account.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {account.bank_name}
                {account.account_name && (
                  <span className="text-muted-foreground font-normal"> - {account.account_name}</span>
                )}
              </CardTitle>
              <Badge
                variant={account.connection_status === 'active' ? 'default' : 'destructive'}
              >
                {account.connection_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                {account.current_balance !== null && (
                  <p className="text-lg font-semibold">
                    {formatCurrency(account.current_balance, account.currency)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {account.last_synced_at
                      ? (
                        <>
                          Last synced:{' '}
                          <time
                            dateTime={account.last_synced_at}
                            title={new Date(account.last_synced_at).toLocaleString()}
                          >
                            {formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}
                          </time>
                        </>
                      )
                      : 'Never synced'}
                  </p>
                  <StaleDataWarning lastSyncedAt={account.last_synced_at} />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync(account.id)}
                disabled={syncing === account.id}
              >
                {syncing === account.id ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
