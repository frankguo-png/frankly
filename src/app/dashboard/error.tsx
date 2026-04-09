'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex items-center justify-center size-14 rounded-xl bg-[rgba(239,68,68,0.08)] mb-5">
        <AlertCircle className="size-7 text-red-400/80" />
      </div>
      <h2 className="text-lg font-semibold text-[#e8edf4] mb-2">Something went wrong</h2>
      <p className="text-sm text-[#7b8fa3] max-w-md mb-1">
        The dashboard encountered an unexpected error. This has been logged automatically.
      </p>
      {error.message && (
        <p className="text-xs text-[#5b6e82] font-mono max-w-md mb-6 bg-[rgba(255,255,255,0.02)] rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.04)]">
          {error.message}
        </p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500"
      >
        <RefreshCw className="size-4" />
        Try again
      </button>
    </div>
  )
}
