'use client'

import { useState, useCallback } from 'react'
import { OrgChart } from '@/components/dashboard/org-chart'
import { PerformanceReviews } from '@/components/dashboard/performance-reviews'
import { BonusReviews } from '@/components/dashboard/bonus-reviews'
import { Users, ClipboardCheck, DollarSign } from 'lucide-react'

type TeamTab = 'organization' | 'performance' | 'bonuses'

const TABS: Array<{ key: TeamTab; label: string; icon: typeof Users }> = [
  { key: 'organization', label: 'Organization', icon: Users },
  { key: 'performance', label: 'Performance Reviews', icon: ClipboardCheck },
  { key: 'bonuses', label: 'Bonuses', icon: DollarSign },
]

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<TeamTab>('organization')

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (index + 1) % TABS.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (index - 1 + TABS.length) % TABS.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = TABS.length - 1
    } else {
      return
    }
    setActiveTab(TABS[nextIndex].key)
    const btn = document.querySelector(`[data-tab="${TABS[nextIndex].key}"]`) as HTMLElement
    btn?.focus()
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#e8edf4]">Team</h1>
          <p className="text-sm text-[#7b8fa3] mt-0.5">
            Manage your organization, performance reviews, and bonuses
          </p>
        </div>
      </div>

      {/* Tab bar — ARIA tablist pattern with keyboard navigation */}
      <div
        role="tablist"
        aria-label="Team sections"
        className="flex gap-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] p-0.5 border border-[rgba(255,255,255,0.04)] w-fit"
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              data-tab={tab.key}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200 ${
                isActive
                  ? 'bg-[rgba(255,255,255,0.1)] text-[#e8edf4] shadow-sm'
                  : 'text-[#7b8fa3] hover:text-[#c0cad8]'
              }`}
            >
              <Icon className="size-3" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={activeTab}>
        {activeTab === 'organization' && <OrgChart />}
        {activeTab === 'performance' && <PerformanceReviews />}
        {activeTab === 'bonuses' && <BonusReviews />}
      </div>
    </div>
  )
}
