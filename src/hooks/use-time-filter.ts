'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDateRange, getGranularity, formatDateForApi } from '@/lib/utils/dates'
import { getPreference, setPreference, PREF_TIME_FILTER, PREF_TIME_FILTER_CUSTOM } from '@/lib/utils/preferences'
import type { TimePreset, Granularity } from '@/lib/kpi/types'

export function useTimeFilter() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Restore saved preference on mount (only when URL has no params)
  const [restoredFromStorage, setRestoredFromStorage] = useState(false)
  useEffect(() => {
    // Only restore if there are no URL params already set
    if (searchParams.has('preset') || searchParams.has('start')) {
      setRestoredFromStorage(true)
      return
    }
    const savedPreset = getPreference<string | null>(PREF_TIME_FILTER, null)
    const savedCustom = getPreference<{ start: string; end: string } | null>(PREF_TIME_FILTER_CUSTOM, null)

    if (savedCustom?.start && savedCustom?.end) {
      const params = new URLSearchParams()
      params.set('start', savedCustom.start)
      params.set('end', savedCustom.end)
      router.replace(`${pathname}?${params.toString()}`)
    } else if (savedPreset && savedPreset !== 'this_month') {
      const params = new URLSearchParams()
      params.set('preset', savedPreset)
      router.replace(`${pathname}?${params.toString()}`)
    }
    setRestoredFromStorage(true)
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preset = (searchParams.get('preset') || 'this_month') as TimePreset
  const customStart = searchParams.get('start')
  const customEnd = searchParams.get('end')

  const dateRange = useMemo(() => {
    if (customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd) }
    }
    return getDateRange(preset)
  }, [preset, customStart, customEnd])

  const granularity: Granularity = useMemo(() => {
    return getGranularity(dateRange.start, dateRange.end)
  }, [dateRange])

  const startStr = formatDateForApi(dateRange.start)
  const endStr = formatDateForApi(dateRange.end)

  const setPreset = useCallback((newPreset: TimePreset) => {
    setPreference(PREF_TIME_FILTER, newPreset)
    // Clear any saved custom range when switching to a preset
    setPreference(PREF_TIME_FILTER_CUSTOM, null)
    const params = new URLSearchParams()
    params.set('preset', newPreset)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname])

  const setCustomRange = useCallback((start: Date, end: Date) => {
    const startApi = formatDateForApi(start)
    const endApi = formatDateForApi(end)
    setPreference(PREF_TIME_FILTER_CUSTOM, { start: startApi, end: endApi })
    setPreference(PREF_TIME_FILTER, null)
    const params = new URLSearchParams()
    params.set('start', startApi)
    params.set('end', endApi)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname])

  return { preset, start: startStr, end: endStr, granularity, dateRange, setPreset, setCustomRange }
}
