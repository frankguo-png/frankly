'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface StatusData {
  runwayMonths: number
  overduePayments: number
  overdueAmount: number
  healthColor: 'green' | 'amber' | 'red'
}

function useStatus() {
  const [status, setStatus] = useState<StatusData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setStatus(data)
      } catch {
        // silently fail — sidebar badges are non-critical
      }
    }
    fetchStatus()
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return status
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/dashboard/transactions',
    label: 'Transactions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    href: '/dashboard/daily',
    label: 'Activity',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
        <path d="M16 18h.01" />
      </svg>
    ),
  },
  {
    href: '/dashboard/budgets',
    label: 'Budgets',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/payments',
    label: 'Payments',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/deals',
    label: 'Deals',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m11 17 2 2a1 1 0 1 0 3-3" />
        <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
        <path d="m21 3 1 11h-2" />
        <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
        <path d="M3 4h8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/payroll',
    label: 'Payroll',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M12 8v8" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/vendors',
    label: 'Vendors',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/dashboard/team',
    label: 'Team',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/dashboard/scenarios',
    label: 'Scenarios',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href: '/dashboard/reconciliation',
    label: 'Reconciliation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        <line x1="9" y1="9" x2="15" y2="15" />
        <line x1="15" y1="9" x2="9" y2="15" />
      </svg>
    ),
  },
  {
    href: '/dashboard/agents',
    label: 'Agents',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <line x1="9" y1="2" x2="9" y2="4" />
        <line x1="15" y1="2" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="22" />
        <line x1="15" y1="20" x2="15" y2="22" />
        <line x1="2" y1="9" x2="4" y2="9" />
        <line x1="2" y1="15" x2="4" y2="15" />
        <line x1="20" y1="9" x2="22" y2="9" />
        <line x1="20" y1="15" x2="22" y2="15" />
      </svg>
    ),
  },
  {
    href: '/dashboard/report',
    label: 'Reports',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/chat',
    label: 'Chat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const status = useStatus()

  const DOT_COLORS: Record<string, string> = {
    green: 'bg-green-500 shadow-green-500/40',
    amber: 'bg-amber-500 shadow-amber-500/40',
    red: 'bg-red-500 shadow-red-500/40',
  }

  return (
    <aside className="hidden md:flex md:w-52 lg:w-60 md:flex-col md:fixed md:inset-y-0 glass-sidebar" aria-label="Main navigation">
      {/* Logo area */}
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          {/* Logo icon */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Ampliwork
          </span>
        </Link>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#1e3050] to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          // Dashboard health dot
          const showHealthDot = item.href === '/dashboard' && status?.healthColor
          // Payments overdue badge
          const showOverdueBadge = item.href === '/dashboard/payments' && status && status.overduePayments > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'text-white bg-[rgba(59,130,246,0.06)]'
                  : 'text-[#5a6d82] hover:text-[#9baab8] hover:bg-[rgba(255,255,255,0.03)]'
              )}
            >
              {/* Active left border indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ boxShadow: 'inset 3px 0 8px -2px rgba(59,130,246,0.3), 0 0 8px rgba(59,130,246,0.5)' }} />
              )}
              <span className={cn(
                'transition-colors duration-200',
                isActive ? 'text-blue-400' : 'text-[#5a6d82]'
              )}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {showHealthDot && (
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shadow-sm shrink-0',
                    DOT_COLORS[status.healthColor] ?? DOT_COLORS.green
                  )}
                  title={`Runway: ${status.runwayMonths} months`}
                  aria-label={`Financial health: ${status.healthColor}, ${status.runwayMonths} months runway`}
                  role="status"
                />
              )}
              {showOverdueBadge && (
                <span
                  className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500/90 text-[10px] font-semibold text-white leading-none px-1 shrink-0"
                  aria-label={`${status.overduePayments} overdue payments`}
                  role="status"
                >
                  {status.overduePayments}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[#1e3050] to-transparent" />

      {/* Bottom section */}
      <div className="px-4 py-4 space-y-1">
        <a
          href="mailto:support@ampliwork.com"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#7b8fa3] transition-colors duration-200 hover:text-[#7b8fa3]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Help & Support
        </a>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] text-[#3d5066]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>⌘K to search</span>
        </div>
      </div>
    </aside>
  )
}
