'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Entity {
  id: string
  name: string
  short_code: string | null
  currency: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [entityId, setEntityId] = useState<string>('')

  // usePlaidLink binds the initial onSuccess callback and ignores later re-memos.
  // Stash entityId in a ref so Plaid's async callback reads the latest value.
  const entityIdRef = useRef<string>('')
  useEffect(() => {
    entityIdRef.current = entityId
  }, [entityId])

  const { data: entitiesData } = useSWR<{ entities: Entity[] }>('/api/entities', fetcher)
  const entities = entitiesData?.entities ?? []

  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
        if (!res.ok) throw new Error('Failed to create link token')
        const data = await res.json()
        setLinkToken(data.link_token)
      } catch (err) {
        console.error('Failed to get link token:', err)
        toast.error('Failed to initialize bank connection')
      }
    }
    fetchLinkToken()
  }, [])

  const onSuccess = useCallback(async (publicToken: string) => {
    const currentEntityId = entityIdRef.current
    if (!currentEntityId) {
      toast.error('Please select an entity before connecting')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken, entity_id: currentEntityId }),
      })
      if (!res.ok) throw new Error('Failed to exchange token')
      toast.success('Bank account connected successfully!')
      mutate((key: string) => typeof key === 'string' && key.startsWith('/api/kpi'))
      mutate('/api/forecast')
      mutate('/api/currency')
    } catch (err) {
      console.error('Failed to exchange token:', err)
      toast.error('Failed to connect bank account')
    } finally {
      setLoading(false)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) {
        console.error('Plaid Link exit with error:', err)
        toast.error('Bank connection was interrupted. Please try again.')
      }
    },
  })

  if (entities.length === 0) {
    return (
      <p className="text-sm text-[#7b8fa3]">
        Create an entity above before connecting a bank account.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium text-[#7b8fa3]">
        Assign connection to
      </label>
      <select
        value={entityId}
        onChange={e => setEntityId(e.target.value)}
        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm text-[#e8edf4] focus:border-blue-500/50 focus:outline-none"
      >
        <option value="" className="bg-[#0d1a2d] text-[#e8edf4]">
          Select an entity…
        </option>
        {entities.map(e => (
          <option key={e.id} value={e.id} className="bg-[#0d1a2d] text-[#e8edf4]">
            {e.name}
            {e.short_code ? ` (${e.short_code})` : ''} — {e.currency}
          </option>
        ))}
      </select>
      <Button
        onClick={() => open()}
        disabled={!ready || loading || !entityId}
        className="w-full"
      >
        {loading ? 'Connecting...' : 'Connect Bank Account'}
      </Button>
    </div>
  )
}
