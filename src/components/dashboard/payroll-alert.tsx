'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/utils/currency'
import type { PayrollCashAlert } from '@/lib/kpi/forecasting'

interface PayrollAlertProps {
  data?: PayrollCashAlert
  loading?: boolean
}

const STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    color: '#22c55e',
    bgColor: '#22c55e20',
  },
  warning: {
    label: 'Monitor',
    color: '#f59e0b',
    bgColor: '#f59e0b20',
  },
  critical: {
    label: 'Critical',
    color: '#ef4444',
    bgColor: '#ef444420',
  },
} as const

export function PayrollAlert({ data, loading = false }: PayrollAlertProps) {
  const config = data ? STATUS_CONFIG[data.status] : STATUS_CONFIG.healthy

  // Cap progress bar at 12 months for visual representation
  const progressPercent = data ? Math.min((data.coverageMonths / 12) * 100, 100) : 0

  return (
    <div
      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden"
      style={{ animation: 'slide-up 0.4s ease-out 0.2s both' }}
    >
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-32 rounded animate-shimmer" />
            <div className="h-6 w-24 rounded animate-shimmer" />
            <div className="h-3 w-full rounded animate-shimmer" />
            <div className="h-3 w-48 rounded animate-shimmer" />
          </div>
        ) : !data ? (
          <div className="flex h-[100px] flex-col items-center justify-center py-8 text-center">
            <Users className="w-8 h-8 text-[#6b7f94] mb-3" />
            <p className="text-sm text-[#7b8fa3] mb-1">No payroll data available</p>
            <p className="text-xs text-[#7b8fa3] mb-3">Connect your payroll provider in Settings.</p>
            <Link href="/dashboard/settings" className="text-xs text-blue-400 hover:text-blue-300 underline bg-blue-600/10 rounded-md px-3 py-1.5">
              Go to Settings
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-[#7b8fa3] uppercase tracking-wider">
                Payroll Coverage
              </h3>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: config.bgColor,
                  color: config.color,
                }}
              >
                {config.label}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-[#7b8fa3] text-xs">Monthly Payroll</p>
                  <p className="text-[#e8edf4] font-semibold tabular-nums mt-0.5">
                    {formatCompactCurrency(data.nextPayroll)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#7b8fa3] text-xs">Cash Available</p>
                  <p className="text-[#e8edf4] font-semibold tabular-nums mt-0.5">
                    {formatCompactCurrency(data.currentBalance)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#7b8fa3]">Payroll cycles covered</span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: config.color }}
                  >
                    {data.coverageMonths >= 999 ? '12+' : data.coverageMonths.toFixed(1)} months
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#0a1628] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: config.color,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[#6b7f94]">
                  <span>0</span>
                  <span>3mo</span>
                  <span>6mo</span>
                  <span>12mo</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
