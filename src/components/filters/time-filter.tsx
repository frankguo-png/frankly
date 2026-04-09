'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTimeFilter } from '@/hooks/use-time-filter'
import type { TimePreset } from '@/lib/kpi/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'

const PRESETS: { label: string; value: TimePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'YTD', value: 'ytd' },
  { label: 'Last Quarter', value: 'last_quarter' },
]

export function TimeFilter() {
  const { preset, setPreset, setCustomRange, dateRange } = useTimeFilter()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [range, setRange] = useState<DateRange | undefined>({
    from: dateRange.start,
    to: dateRange.end,
  })

  const isCustom = !PRESETS.some((p) => p.value === preset)

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => setPreset(p.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-wide transition-all duration-200',
            preset === p.value
              ? 'bg-blue-600/90 text-white shadow-[0_0_16px_-3px_rgba(59,130,246,0.5)]'
              : 'text-[#7b8fa3] hover:text-[#9baab8] hover:bg-white/[0.03]',
          )}
        >
          {p.label}
        </button>
      ))}

      {/* Custom date range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-wide transition-all duration-200',
            isCustom
              ? 'bg-blue-600/90 text-white shadow-[0_0_16px_-3px_rgba(59,130,246,0.5)]'
              : 'text-[#7b8fa3] hover:text-[#9baab8] hover:bg-white/[0.03]',
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {isCustom && range?.from && range?.to
            ? `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d')}`
            : 'Custom'}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto border-[rgba(255,255,255,0.06)] bg-[#0d1a2d]/95 backdrop-blur-xl p-0">
          <div className="p-3">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(newRange) => {
                setRange(newRange)
                if (newRange?.from && newRange?.to) {
                  setCustomRange(newRange.from, newRange.to)
                  setCalendarOpen(false)
                }
              }}
              numberOfMonths={2}
              className="rounded-lg"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
