'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, Info } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: number
  previousValue?: number
  format?: 'currency' | 'percentage' | 'number'
  color?: string
  invertTrend?: boolean
  loading?: boolean
  index?: number
  onClick?: () => void
  tooltip?: string
}

function formatValue(value: number, fmt: KpiCardProps['format']) {
  switch (fmt) {
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'number':
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
    case 'currency':
    default:
      return Math.abs(value) >= 10000
        ? formatCompactCurrency(value)
        : formatCurrency(value)
  }
}

function getTrendData(value: number, previousValue?: number) {
  if (previousValue === undefined || previousValue === 0) return null
  const change = ((value - previousValue) / Math.abs(previousValue)) * 100
  return { change, isPositive: change >= 0 }
}

const COLOR_CONFIG: Record<string, {
  accentLine: string
  iconBg: string
  iconText: string
  hoverBorder: string
  hoverGlow: string
}> = {
  green: {
    accentLine: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/30',
    hoverGlow: 'hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]',
  },
  red: {
    accentLine: 'bg-red-500',
    iconBg: 'bg-red-500/10',
    iconText: 'text-red-400',
    hoverBorder: 'hover:border-red-500/30',
    hoverGlow: 'hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.15)]',
  },
  blue: {
    accentLine: 'bg-blue-500',
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-400',
    hoverBorder: 'hover:border-blue-500/30',
    hoverGlow: 'hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)]',
  },
  amber: {
    accentLine: 'bg-amber-500',
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-400',
    hoverBorder: 'hover:border-amber-500/30',
    hoverGlow: 'hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)]',
  },
  purple: {
    accentLine: 'bg-purple-500',
    iconBg: 'bg-purple-500/10',
    iconText: 'text-purple-400',
    hoverBorder: 'hover:border-purple-500/30',
    hoverGlow: 'hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)]',
  },
  gray: {
    accentLine: 'bg-slate-500',
    iconBg: 'bg-slate-500/10',
    iconText: 'text-slate-400',
    hoverBorder: 'hover:border-slate-500/30',
    hoverGlow: 'hover:shadow-[0_0_30px_-5px_rgba(100,116,139,0.15)]',
  },
}

const ICON_MAP: Record<string, React.ReactNode> = {
  green: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 7l-5-5-5 5" />
    </svg>
  ),
  red: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V2M7 17l5 5 5-5" />
    </svg>
  ),
  blue: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  amber: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  purple: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  gray: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
}

export function KpiCard({
  title,
  value,
  previousValue,
  format = 'currency',
  color = 'blue',
  invertTrend = false,
  loading = false,
  index = 0,
  onClick,
  tooltip,
}: KpiCardProps) {
  const [animate, setAnimate] = useState(false)
  const prevValueRef = useRef(value)
  const colors = COLOR_CONFIG[color] ?? COLOR_CONFIG.blue

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setAnimate(true)
      prevValueRef.current = value
      const timer = setTimeout(() => setAnimate(false), 600)
      return () => clearTimeout(timer)
    }
  }, [value])

  const trend = getTrendData(value, previousValue)

  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111d2e]/80 backdrop-blur-sm p-5"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {/* Shimmer loading state */}
        <div className="space-y-3">
          <div className="h-3 w-24 rounded-md animate-shimmer" />
          <div className="h-8 w-32 rounded-md animate-shimmer" />
          <div className="h-3 w-20 rounded-md animate-shimmer" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111d2e]/80 backdrop-blur-sm',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-0.5',
        onClick ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default',
        colors.hoverBorder,
        colors.hoverGlow,
      )}
      style={{
        animation: `slide-up 0.4s ease-out ${index * 80}ms both`,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {/* Top accent line */}
      <div className={cn('h-[3px] w-full rounded-t-xl shadow-[0_1px_6px_-1px_currentColor]', colors.accentLine, 'opacity-60')} />

      <div className="p-5">
        {/* Header row: title + icon */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#7b8fa3]">
              {title}
            </p>
            {tooltip && (
              <div className="group/tooltip relative flex items-center">
                <Info className="h-3.5 w-3.5 text-[#5a6d82] cursor-help" />
                <div className="invisible opacity-0 group-hover/tooltip:visible group-hover/tooltip:opacity-100 transition-all duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                  <div className="relative bg-[#0a1628] text-[#c8d5e3] text-xs leading-relaxed rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.5)] px-3 py-2 max-w-[220px] w-max border border-[rgba(255,255,255,0.08)]">
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#0a1628]" />
                  </div>
                </div>
              </div>
            )}
            {onClick && (
              <ArrowUpRight className="h-3 w-3 text-[#6b7f94] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
          </div>
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200',
            colors.iconBg,
            colors.iconText,
            'group-hover:shadow-[0_0_12px_-2px_currentColor]',
          )}>
            {ICON_MAP[color] ?? ICON_MAP.blue}
          </div>
        </div>

        {/* Value */}
        <p
          className={cn(
            'text-2xl font-bold tracking-tight text-[#e8edf4] tabular-nums transition-all duration-200',
            animate && 'scale-[1.02] brightness-125',
          )}
        >
          {formatValue(value, format)}
        </p>

        {/* Trend */}
        {trend ? (
          <div className="mt-2.5 flex items-center gap-1.5">
            {trend.isPositive ? (
              <TrendingUp
                className={cn(
                  'h-3.5 w-3.5 transition-colors duration-200',
                  invertTrend ? 'text-red-400' : 'text-emerald-400',
                )}
              />
            ) : (
              <TrendingDown
                className={cn(
                  'h-3.5 w-3.5 transition-colors duration-200',
                  invertTrend ? 'text-emerald-400' : 'text-red-400',
                )}
              />
            )}
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                trend.isPositive
                  ? invertTrend ? 'text-red-400' : 'text-emerald-400'
                  : invertTrend ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {Math.abs(trend.change).toFixed(1)}%
            </span>
            <span className="text-[11px] text-[#7b8fa3]">vs prior period</span>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-[#6b7f94]" />
            <span className="text-[11px] text-[#6b7f94]">No prior data</span>
          </div>
        )}
      </div>
    </div>
  )
}
