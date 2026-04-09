'use client'

import { useState, useEffect, useCallback } from 'react'
import { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { DatabaseZap, Loader2, RefreshCw } from 'lucide-react'

interface SeedDataButtonProps {
  orgId: string
}

export function SeedDataButton({ orgId }: SeedDataButtonProps) {
  const [loading, setLoading] = useState(false)
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null)

  const checkTransactions = useCallback(async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .limit(1)

    setHasTransactions((count ?? 0) > 0)
  }, [orgId])

  useEffect(() => {
    checkTransactions()
  }, [checkTransactions])

  if (hasTransactions === null) {
    return null
  }

  const handleSeed = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to seed data')
        return
      }

      toast.success(`Loaded ${data.count} demo transactions + ${data.employeeCount ?? 12} employees`)
      setHasTransactions(true)
      // Revalidate all dashboard SWR caches instead of full page reload
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/kpi'))
      mutate('/api/forecast')
      mutate('/api/currency')
      mutate('/api/budgets')
      mutate('/api/chat/conversations')
    } catch {
      toast.error('Network error while seeding data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSeed}
      disabled={loading}
      variant={hasTransactions ? 'outline' : 'default'}
      className={hasTransactions
        ? 'border-[#1e3050] text-[#9baab8] hover:border-blue-500/30 hover:text-white hover:bg-blue-500/5'
        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-500/20'
      }
      size={hasTransactions ? 'sm' : 'lg'}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin mr-2" />
          {hasTransactions ? 'Re-seeding...' : 'Seeding...'}
        </>
      ) : hasTransactions ? (
        <>
          <RefreshCw className="size-3.5 mr-2" />
          Re-seed Demo Data
        </>
      ) : (
        <>
          <DatabaseZap className="size-4 mr-2" />
          Load Demo Data
        </>
      )}
    </Button>
  )
}
