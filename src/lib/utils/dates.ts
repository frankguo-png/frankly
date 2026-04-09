import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  startOfQuarter,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  subMonths,
  subYears,
  format,
  differenceInDays,
} from 'date-fns'

type DatePreset = 'today' | 'this_week' | 'this_month' | 'ytd' | 'last_month' | 'last_quarter'

export function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date()

  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) }
    case 'this_month':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case 'ytd':
      return { start: startOfYear(now), end: endOfDay(now) }
    case 'last_month': {
      const lastMonth = subMonths(now, 1)
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
    }
    case 'last_quarter': {
      const lastQuarterDate = subMonths(startOfQuarter(now), 1)
      const lq = startOfQuarter(lastQuarterDate)
      return { start: lq, end: endOfQuarter(lq) }
    }
  }
}

export function getGranularity(start: Date, end: Date): 'day' | 'week' | 'month' {
  const days = differenceInDays(end, start)

  if (days <= 31) return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getPreviousYearRange(start: Date, end: Date): { start: Date; end: Date } {
  return {
    start: subYears(start, 1),
    end: subYears(end, 1),
  }
}
