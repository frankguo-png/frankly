'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { Alert } from '@/lib/alerts/detector'

function getAlertActionLink(alert: Alert): string {
  switch (alert.type) {
    case 'spend_spike':
    case 'low_balance':
      return '/dashboard'
    case 'payroll_change':
      return '/dashboard/payroll'
    case 'unusual_transaction':
    case 'new_vendor':
    case 'duplicate_charge':
      return '/dashboard/transactions'
    default:
      return '/dashboard'
  }
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/alerts')
      if (!res.ok) return
      const data = await res.json()
      setAlerts(data.alerts ?? [])
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Load dismissed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed-alerts')
      if (stored) {
        setDismissed(new Set(JSON.parse(stored)))
      }
    } catch {
      // ignore
    }
  }, [])

  const handleDismiss = async (alertId: string) => {
    const next = new Set(dismissed)
    next.add(alertId)
    setDismissed(next)
    try {
      localStorage.setItem('dismissed-alerts', JSON.stringify([...next]))
    } catch {
      // ignore
    }
    // Fire and forget the API call
    fetch('/api/alerts/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    }).catch(() => {
      toast.error('Failed to dismiss alert on server')
    })
  }

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id))
  const alertCount = visibleAlerts.length

  const handleActionClick = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex items-center justify-center rounded-md p-2 border border-[#1e3050] bg-transparent text-[#9baab8] hover:border-blue-500/30 hover:text-white hover:bg-blue-500/5 transition-all duration-200 cursor-pointer"
      >
        {/* Bell icon */}
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 max-h-[480px] overflow-y-auto border-[#1e3050] bg-[#111d2e]/95 backdrop-blur-xl p-0"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1e3050] bg-[#111d2e]/95 backdrop-blur-xl px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            Alerts & Anomalies
          </h3>
          {alertCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
              {alertCount}
            </span>
          )}
        </div>

        {loading && alerts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <svg
              className="h-5 w-5 animate-spin text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <svg
              className="h-8 w-8 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm text-[#9baab8]">
              No alerts &mdash; all looking good
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
                onActionClick={handleActionClick}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function SeverityIcon({ severity }: { severity: Alert['severity'] }) {
  switch (severity) {
    case 'critical':
      return (
        <svg
          className="h-4 w-4 shrink-0 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    case 'warning':
      return (
        <svg
          className="h-4 w-4 shrink-0 text-amber-400"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="12" r="10" opacity="0.2" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
    case 'info':
      return (
        <svg
          className="h-4 w-4 shrink-0 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
  }
}

function AlertCard({
  alert,
  onDismiss,
  onActionClick,
}: {
  alert: Alert
  onDismiss: (id: string) => void
  onActionClick: (href: string) => void
}) {
  const severityBg = {
    critical: 'border-red-500/20 bg-red-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
  }

  const actionHref = getAlertActionLink(alert)

  let relativeTime: string | null = null
  if (alert.date) {
    try {
      relativeTime = formatDistanceToNow(new Date(alert.date), {
        addSuffix: true,
      })
    } catch {
      // ignore invalid dates
    }
  }

  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 ${severityBg[alert.severity]}`}
    >
      <div className="mt-0.5">
        <SeverityIcon severity={alert.severity} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-white leading-tight">
            {alert.title}
          </p>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss(alert.id)
            }}
            className="opacity-0 group-hover:opacity-100 -mt-1 -mr-1 h-6 w-6 shrink-0 p-0 text-[#9baab8] hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#9baab8]">
          {alert.description}
        </p>
        {alert.amount !== null && (
          <p className="mt-1 text-[11px] font-medium text-white/70">
            ${Math.round(alert.amount).toLocaleString()}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          {relativeTime && alert.date && (
            <time
              dateTime={alert.date}
              title={new Date(alert.date).toLocaleString()}
              className="text-[#7b8fa3] text-xs"
            >
              {relativeTime}
            </time>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onActionClick(actionHref)
            }}
            className="text-blue-400 hover:text-blue-300 text-xs transition-colors duration-150 cursor-pointer"
          >
            View &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
