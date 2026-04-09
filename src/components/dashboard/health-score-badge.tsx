'use client'

import type { HealthScore } from '@/hooks/use-financial-health'

interface HealthScoreBadgeProps {
  health: HealthScore
}

const LEVEL_STYLES = {
  healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  monitor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
} as const

export function HealthScoreBadge({ health }: HealthScoreBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-default ${LEVEL_STYLES[health.level]}`}
      title={`Financial Health: ${health.score}/100 — ${health.label}`}
    >
      {health.label}
    </span>
  )
}
