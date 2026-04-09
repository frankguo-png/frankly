'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, X } from 'lucide-react'
import { useMemo, useCallback } from 'react'

interface FilterChip {
  paramKey: string
  label: string
  value: string
}

function formatDateLabel(dateFrom?: string, dateTo?: string): string | null {
  if (!dateFrom && !dateTo) return null

  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (dateFrom && dateTo) return `${fmt(dateFrom)} - ${fmt(dateTo)}`
  if (dateFrom) return `From ${fmt(dateFrom)}`
  return `Until ${fmt(dateTo!)}`
}

const FILTER_LABELS: Record<string, string> = {
  department: 'Department',
  category: 'Category',
  project: 'Project',
  source: 'Source',
  type: 'Type',
  search: 'Search',
}

export function FilterBreadcrumbs() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const chips = useMemo(() => {
    const result: FilterChip[] = []

    for (const [key, label] of Object.entries(FILTER_LABELS)) {
      const value = searchParams.get(key)
      if (value) {
        const displayValue = key === 'type'
          ? value.charAt(0).toUpperCase() + value.slice(1)
          : value
        result.push({ paramKey: key, label, value: displayValue })
      }
    }

    const dateFrom = searchParams.get('dateFrom') ?? undefined
    const dateTo = searchParams.get('dateTo') ?? undefined
    const dateLabel = formatDateLabel(dateFrom, dateTo)
    if (dateLabel) {
      result.push({ paramKey: 'date', label: 'Date', value: dateLabel })
    }

    return result
  }, [searchParams])

  const removeFilter = useCallback(
    (paramKey: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (paramKey === 'date') {
        params.delete('dateFrom')
        params.delete('dateTo')
      } else {
        params.delete(paramKey)
      }
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [searchParams, router, pathname]
  )

  const clearAll = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <nav className="flex items-center gap-1 text-sm text-[#5a6d82]">
        <Link
          href="/dashboard"
          className="hover:text-[#7b8fa3] transition-colors"
        >
          Dashboard
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <button
          onClick={clearAll}
          className="hover:text-[#7b8fa3] transition-colors"
        >
          Transactions
        </button>
        <ChevronRight className="size-3.5 shrink-0" />
      </nav>

      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map((chip) => (
          <span
            key={chip.paramKey}
            className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-3 py-1 text-xs"
          >
            {chip.label}: {chip.value}
            <button
              onClick={() => removeFilter(chip.paramKey)}
              className="hover:text-blue-200 transition-colors"
              aria-label={`Remove ${chip.label} filter`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        {chips.length > 1 && (
          <button
            onClick={clearAll}
            className="text-xs text-[#7b8fa3] hover:text-[#c8d6e5] underline transition-colors ml-1"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
