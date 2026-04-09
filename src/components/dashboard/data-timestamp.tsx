'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DataTimestampProps {
  isValidating: boolean
  mutate: () => void
  /** If data is loaded (i.e., at least one successful fetch has occurred) */
  hasData: boolean
}

export function DataTimestamp({ isValidating, mutate, hasData }: DataTimestampProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [, setTick] = useState(0)

  // Track when data finishes loading (isValidating transitions from true to false)
  useEffect(() => {
    if (!isValidating && hasData) {
      setLastUpdated(new Date())
      setRefreshing(false)
    }
  }, [isValidating, hasData])

  // Update the "X ago" text every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    mutate()
  }, [mutate])

  if (!lastUpdated) return null

  const timeAgo = formatDistanceToNow(lastUpdated, { addSuffix: true })
  const displayText = refreshing && isValidating ? 'Refreshing...' : `Updated ${timeAgo}`

  return (
    <button
      type="button"
      onClick={handleRefresh}
      className="inline-flex items-center gap-1.5 text-xs text-[#7b8fa3] hover:text-[#c8d6e5] transition-colors cursor-pointer"
      title="Click to refresh data"
    >
      <Clock className="h-3 w-3" />
      <span>{displayText}</span>
      {isValidating && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400" />
        </span>
      )}
    </button>
  )
}
