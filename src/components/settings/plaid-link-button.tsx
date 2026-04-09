'use client'

import { useCallback, useEffect, useState } from 'react'
import { mutate } from 'swr'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      })
      if (!res.ok) throw new Error('Failed to exchange token')
      toast.success('Bank account connected successfully!')
      // Revalidate dashboard SWR caches so new connection data appears
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

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || loading}
      className="w-full"
    >
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </Button>
  )
}
