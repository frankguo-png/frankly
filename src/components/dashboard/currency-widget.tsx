'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Wallet } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

interface CurrencyAccount {
  id: string
  bankName: string
  accountName: string
  accountType: string
  currency: string
  nativeBalance: number
  usdBalance: number
  connectionStatus: string
}

interface CurrencyData {
  rates: Record<string, number>
  ratesTimestamp: number
  accounts: CurrencyAccount[]
  totalUSD: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CURRENCY_FLAGS: Record<string, string> = {
  USD: 'US',
  GBP: 'GB',
  CAD: 'CA',
  EUR: 'EU',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '\u00a3',
  CAD: 'C$',
  EUR: '\u20ac',
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function CurrencyWidget() {
  const [showUSD, setShowUSD] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<CurrencyData>('/api/currency', fetcher, {
    refreshInterval: 300000,
  })

  if (isLoading) {
    return (
      <div
        className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
        style={{ animation: 'slide-up 0.4s ease-out 0.15s both' }}
      >
        <div className="h-[2px] w-full bg-[rgba(255,255,255,0.04)]" />
        <div className="p-6 space-y-4">
          {/* Title + toggle button row */}
          <div className="flex items-center justify-between">
            <div className="h-3 w-40 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="h-6 w-24 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
          {/* Total amount */}
          <div className="space-y-1.5">
            <div className="h-10 w-32 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="h-3 w-36 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
          {/* Account rows */}
          <div className="space-y-2">
            {[28, 24, 20].map((nameW, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                  <div className="space-y-1.5">
                    <div className={`h-3.5 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer`} style={{ width: `${nameW * 4}px` }} />
                    <div className="h-2.5 w-20 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
                  </div>
                </div>
                <div className="h-3.5 w-20 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
              </div>
            ))}
          </div>
          {/* FX Rates line */}
          <div className="flex gap-3">
            <div className="h-6 w-28 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
            <div className="h-6 w-28 rounded-full bg-[rgba(255,255,255,0.04)] animate-shimmer" />
          </div>
          {/* Last updated */}
          <div className="h-3 w-24 rounded-md bg-[rgba(255,255,255,0.04)] animate-shimmer" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
        style={{ animation: 'slide-up 0.4s ease-out 0.15s both' }}
      >
        <div className="p-5">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-red-400 text-sm mb-3">Failed to load currency data</p>
            <button onClick={() => mutate()} className="text-xs text-blue-400 hover:text-blue-300 underline">
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.accounts || data.accounts.length === 0) {
    return (
      <div
        className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
        style={{ animation: 'slide-up 0.4s ease-out 0.15s both' }}
      >
        <div className="p-5">
          <div className="flex h-[140px] flex-col items-center justify-center py-8 text-center">
            <Wallet className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No bank accounts connected</p>
            <p className="text-xs text-[#7b8fa3] mb-3">Connect a bank to see your balances.</p>
            <Link href="/dashboard/settings" className="text-xs text-blue-400 hover:text-blue-300 underline">
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const nonUsdAccounts = data.accounts.filter((a) => a.currency !== 'USD')
  const hasMultipleCurrencies = nonUsdAccounts.length > 0

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.15s both' }}
    >
      {/* Top accent line */}
      <div className="h-[2px] w-full bg-cyan-500 opacity-60" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
            Multi-Currency Balances
          </h3>
          {hasMultipleCurrencies && (
            <button
              onClick={() => setShowUSD((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200',
                showUSD
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-[rgba(255,255,255,0.06)] text-[#5a6d82] hover:text-[#8a9db2]'
              )}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              {showUSD ? 'Show native' : 'Show in USD'}
            </button>
          )}
        </div>

        {/* Consolidated total */}
        <div className="mt-3 mb-5">
          <p className="text-4xl font-bold tabular-nums tracking-tight text-[#e8edf4]">
            {formatCompactCurrency(data.totalUSD)}
          </p>
          <p className="mt-1 text-xs text-[#7b8fa3]">
            Total consolidated (USD)
          </p>
        </div>

        {/* Account list */}
        <div className="space-y-2">
          {data.accounts.map((account) => {
            const isNonUsd = account.currency !== 'USD'
            const displayBalance =
              showUSD || !isNonUsd ? account.usdBalance : account.nativeBalance
            const displayCurrency =
              showUSD || !isNonUsd ? 'USD' : account.currency

            return (
              <div
                key={account.id}
                className="group flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-all duration-200 hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Currency indicator */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.06)] text-xs font-bold text-[#8a9db2]">
                    {CURRENCY_SYMBOLS[account.currency] ?? account.currency}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#c8d5e4] truncate">
                      {account.accountName}
                    </p>
                    <p className="text-[11px] text-[#7b8fa3] truncate">
                      {account.bankName}

                      {isNonUsd && (
                        <span className="ml-1.5 text-[#5a6d82]">
                          {account.currency}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-semibold tabular-nums text-[#e8edf4]">
                    {formatCurrency(displayBalance, displayCurrency)}
                  </p>
                  {isNonUsd && !showUSD && (
                    <p className="text-[11px] tabular-nums text-[#7b8fa3]">
                      {formatCompactCurrency(account.usdBalance)} USD
                    </p>
                  )}
                  {isNonUsd && showUSD && (
                    <p className="text-[11px] tabular-nums text-[#7b8fa3]">
                      {formatCurrency(account.nativeBalance, account.currency)}{' '}
                      native
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* FX Rates */}
        {hasMultipleCurrencies && (
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(data.rates)
              .filter(([code]) => code !== 'USD')
              .map(([code, rate]) => (
                <div
                  key={code}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-1"
                >
                  <span className="text-[11px] font-medium text-[#7b8fa3]">
                    1 USD
                  </span>
                  <span className="text-[11px] text-[#6b7f94]">=</span>
                  <span className="text-[11px] font-semibold tabular-nums text-[#8a9db2]">
                    {rate.toFixed(4)} {code}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Last updated */}
        <p className="mt-3 text-[11px] text-[#6b7f94]">
          Last updated: {getTimeAgo(data.ratesTimestamp)}
        </p>
      </div>
    </div>
  )
}
