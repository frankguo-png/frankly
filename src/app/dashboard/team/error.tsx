'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
      <div className="flex items-center justify-center size-12 rounded-xl bg-[rgba(239,68,68,0.08)] mb-4">
        <AlertCircle className="size-6 text-red-400/80" />
      </div>
      <h2 className="text-base font-semibold text-[#e8edf4] mb-2">Team section error</h2>
      <p className="text-sm text-[#7b8fa3] max-w-sm mb-4">
        Failed to load team data. Please try again.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-blue-500"
      >
        <RefreshCw className="size-3.5" />
        Retry
      </button>
    </div>
  )
}
