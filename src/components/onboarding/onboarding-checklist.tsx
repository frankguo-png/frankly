'use client'

import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Landmark,
  BookOpen,
  PiggyBank,
  Tags,
  MessageSquare,
} from 'lucide-react'

const DISMISS_KEY = 'frankly_onboarding_dismissed'

interface OnboardingStatus {
  hasBankAccount: boolean
  hasQboConnection: boolean
  hasBudget: boolean
  hasCategorizedTransactions: boolean
  hasChatConversation: boolean
}

interface Step {
  id: keyof OnboardingStatus
  title: string
  description: string
  href: string
  icon: React.ElementType
}

const STEPS: Step[] = [
  {
    id: 'hasBankAccount',
    title: 'Connect a bank account',
    description: 'Import transactions automatically via Plaid',
    href: '/dashboard/settings',
    icon: Landmark,
  },
  {
    id: 'hasQboConnection',
    title: 'Sync your accounting tool',
    description: 'Connect QuickBooks for categorized expense data',
    href: '/dashboard/settings',
    icon: BookOpen,
  },
  {
    id: 'hasBudget',
    title: 'Set your first budget',
    description: 'Track spending against monthly targets',
    href: '/dashboard/budgets',
    icon: PiggyBank,
  },
  {
    id: 'hasCategorizedTransactions',
    title: 'Review your transactions',
    description: 'Categorize transactions for accurate reporting',
    href: '/dashboard/transactions',
    icon: Tags,
  },
  {
    id: 'hasChatConversation',
    title: 'Try the AI assistant',
    description: 'Ask questions about your financial data',
    href: '/dashboard/chat',
    icon: MessageSquare,
  },
]

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true) // Start hidden to avoid flash
  const [expanded, setExpanded] = useState(true)

  const { data: status, isLoading } = useSWR<OnboardingStatus>(
    '/api/onboarding/status',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  )

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    setDismissed(stored === 'true')
  }, [])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }, [])

  // Don't render while loading or if dismissed
  if (isLoading || dismissed) return null
  if (!status) return null

  const completedCount = STEPS.filter((step) => status[step.id]).length
  const totalSteps = STEPS.length
  const allComplete = completedCount === totalSteps
  const shouldAutoCollapse = completedCount >= 3

  // Auto-hide when all steps are complete
  if (allComplete) return null

  const progressPercent = (completedCount / totalSteps) * 100
  const isCollapsed = shouldAutoCollapse && !expanded

  // Collapsed single-line view
  if (isCollapsed) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setExpanded(true)}
          className="group w-full flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm px-5 py-3.5 transition-all duration-300 hover:border-blue-500/20 hover:bg-[#131f31]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15">
              <span className="text-xs font-bold text-blue-400">
                {completedCount}/{totalSteps}
              </span>
            </div>
            <span className="text-sm font-medium text-[#c0cdd9]">
              Finish setting up &mdash;{' '}
              <span className="text-blue-400">
                {totalSteps - completedCount} step{totalSteps - completedCount !== 1 ? 's' : ''} remaining
              </span>
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-[#7b8fa3] transition-transform group-hover:text-[#7b8fa3]" />
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
        {/* Gradient accent at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#e8edf4]">
                Get started with Frankly
              </h3>
              <p className="mt-0.5 text-sm text-[#7b8fa3]">
                {completedCount} of {totalSteps} complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              {shouldAutoCollapse && (
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded-lg p-1.5 text-[#7b8fa3] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[#7b8fa3]"
                  aria-label="Collapse"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="rounded-lg p-1.5 text-[#7b8fa3] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[#7b8fa3]"
                aria-label="Dismiss setup guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-[#1a2b3c] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="px-3 pb-3">
          {STEPS.map((step) => {
            const done = status[step.id]
            const Icon = step.icon

            return (
              <Link
                key={step.id}
                href={step.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200 ${
                  done
                    ? 'opacity-60 hover:opacity-80'
                    : 'hover:bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                {/* Checkbox / check icon */}
                <div
                  className={`flex-shrink-0 transition-all duration-500 ${
                    done ? 'scale-100' : ''
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-check-in" />
                  ) : (
                    <Circle className="h-5 w-5 text-[#2a3d52] group-hover:text-blue-400/60 transition-colors" />
                  )}
                </div>

                {/* Icon */}
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                    done
                      ? 'bg-emerald-500/10'
                      : 'bg-blue-500/10 group-hover:bg-blue-500/15'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      done ? 'text-emerald-400/70' : 'text-blue-400'
                    }`}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium transition-colors ${
                      done
                        ? 'text-[#5a6d82] line-through decoration-[#6b7f94]'
                        : 'text-[#c0cdd9] group-hover:text-[#e8edf4]'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      done ? 'text-[#6b7f94]' : 'text-[#7b8fa3]'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>

                {/* Arrow */}
                {!done && (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#2a3d52] transition-all group-hover:text-blue-400 group-hover:translate-x-0.5" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Dismiss link */}
        <div className="px-5 pb-4 pt-1">
          <button
            onClick={handleDismiss}
            className="text-xs text-[#6b7f94] hover:text-[#5a6d82] transition-colors"
          >
            Dismiss setup guide
          </button>
        </div>
      </div>
    </div>
  )
}
