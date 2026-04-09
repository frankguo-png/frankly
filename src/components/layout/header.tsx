'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { AlertsPanel } from '@/components/alerts/alerts-panel'
import { CheckCircle2, XCircle, FileText } from 'lucide-react'

type SyncState =
  | { status: 'idle' }
  | { status: 'syncing'; source: string }
  | { status: 'done'; count: number }
  | { status: 'error' }

export function Header() {
  const router = useRouter()
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })
  const [user, setUser] = useState<User | null>(null)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch the current user on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])

  const displayName = useMemo(() => {
    if (!user) return null
    return user.user_metadata?.full_name || user.user_metadata?.name || user.email || null
  }, [user])

  const avatarInitial = useMemo(() => {
    if (displayName) return displayName.charAt(0).toUpperCase()
    return 'U'
  }, [displayName])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current)
    }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSyncAll() {
    if (revertTimer.current) {
      clearTimeout(revertTimer.current)
      revertTimer.current = null
    }

    let totalCreated = 0

    try {
      // Sync Plaid
      setSyncState({ status: 'syncing', source: 'Plaid' })
      const plaidRes = await fetch('/api/plaid/sync', { method: 'POST' })
      if (!plaidRes.ok) throw new Error('Plaid sync failed')
      const plaidResult = await plaidRes.json()
      totalCreated += plaidResult.total_created || plaidResult.records_created || 0

      // Sync QBO
      setSyncState({ status: 'syncing', source: 'QBO' })
      const qboRes = await fetch('/api/qbo/sync', { method: 'POST' })
      if (qboRes.ok) {
        const qboResult = await qboRes.json()
        totalCreated += qboResult.total_created || qboResult.records_created || 0
      }

      // Done
      setSyncState({ status: 'done', count: totalCreated })
      toast.success(`Sync complete: ${totalCreated} new transactions`)

      revertTimer.current = setTimeout(() => {
        setSyncState({ status: 'idle' })
      }, 2000)
    } catch {
      setSyncState({ status: 'error' })
      toast.error('Failed to sync')

      revertTimer.current = setTimeout(() => {
        setSyncState({ status: 'idle' })
      }, 2000)
    }
  }

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 md:px-6 glass-strong"
      style={{ borderBottom: '1px solid transparent', borderImage: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent) 1' }}
    >
      {/* Mobile logo */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <span className="text-base font-semibold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Ampliwork
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 lg:gap-3">
        <AlertsPanel />

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/report')}
          aria-label="View financial report"
          className="border-[#1e3050] bg-transparent text-[#9baab8] hover:border-blue-500/30 hover:text-white hover:bg-blue-500/5 transition-all duration-200"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Report</span>
          </span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncAll}
          disabled={syncState.status === 'syncing'}
          aria-label="Sync all connected accounts"
          className={`transition-all duration-200 ${
            syncState.status === 'done'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : syncState.status === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-[#1e3050] bg-transparent text-[#9baab8] hover:border-blue-500/30 hover:text-white hover:bg-blue-500/5'
          }`}
        >
          {syncState.status === 'syncing' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin-slow h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Syncing {syncState.source}...
            </span>
          ) : syncState.status === 'done' ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Synced
            </span>
          ) : syncState.status === 'error' ? (
            <span className="flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5" />
              Sync failed
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Sync All
            </span>
          )}
        </Button>

        <DropdownMenu onOpenChange={(open) => { if (!open) setConfirmingLogout(false) }}>
          <DropdownMenuTrigger className="outline-none" aria-label="User menu">
            <div className="flex items-center gap-2">
              {displayName && (
                <span className="hidden sm:block text-sm text-[#c8d5e3] max-w-[150px] truncate">
                  {displayName}
                </span>
              )}
              <Avatar className="h-8 w-8 cursor-pointer border border-[#1e3050] transition-all duration-200 hover:border-blue-500/40 hover:shadow-[0_0_12px_-3px_rgba(59,130,246,0.3)] hover:ring-2 hover:ring-blue-500/20">
                <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-xs font-medium text-blue-300">
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-[#1e3050] bg-[#111d2e]/95 backdrop-blur-xl">
            {confirmingLogout ? (
              <div className="px-2 py-2 space-y-2">
                <p className="text-sm text-[#c8d5e3] font-medium">Are you sure?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogout}
                    className="flex-1 rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors"
                  >
                    Yes, sign out
                  </button>
                  <button
                    onClick={() => setConfirmingLogout(false)}
                    className="flex-1 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-[#9baab8] hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => router.push('/dashboard/settings')}
                  className="text-[#9baab8] focus:text-white focus:bg-white/5 cursor-pointer"
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); setConfirmingLogout(true) }}
                  className="text-[#9baab8] focus:text-red-400 focus:bg-red-500/5 cursor-pointer"
                >
                  Log out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
