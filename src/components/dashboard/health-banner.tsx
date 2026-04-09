'use client'

import Link from 'next/link'
import { AlertTriangle, AlertCircle } from 'lucide-react'
import type { HealthBanner as HealthBannerType } from '@/hooks/use-financial-health'

interface HealthBannerProps {
  banner: HealthBannerType
}

export function HealthBanner({ banner }: HealthBannerProps) {
  const isRed = banner.level === 'red'

  return (
    <div
      className={`w-full rounded-xl px-4 py-3 flex items-center gap-3 ${
        isRed
          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
      }`}
    >
      {isRed ? (
        <AlertTriangle className="h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0" />
      )}
      <span className="text-sm font-semibold flex-1">{banner.message}</span>
      <Link
        href="/dashboard/chat"
        className={`text-xs font-medium shrink-0 rounded-md px-3 py-1.5 transition-colors ${
          isRed
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
        }`}
      >
        Ask Frankly for help
      </Link>
    </div>
  )
}
