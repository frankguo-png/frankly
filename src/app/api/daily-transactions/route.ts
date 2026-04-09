import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']

export interface CategoryBreakdown {
  category: string
  total: number
  count: number
  percentage: number
}

export interface DayGroup {
  date: string
  totalIn: number
  totalOut: number
  net: number
  count: number
  transactions: Transaction[]
}

export interface WeekGroup {
  weekStart: string
  weekEnd: string
  totalIn: number
  totalOut: number
  net: number
  count: number
  days: DayGroup[]
}

export interface DailyTransactionsResponse {
  view: 'day' | 'week' | 'month'
  date: string
  dateRangeStart?: string
  dateRangeEnd?: string
  totalIn: number
  totalOut: number
  net: number
  count: number
  dailyAverage?: number
  priorTotalIn?: number
  priorTotalOut?: number
  priorNet?: number
  priorComparisonPercent?: number | null
  transactions: Transaction[]
  categoryBreakdown: CategoryBreakdown[]
  dayGroups?: DayGroup[]
  weekGroups?: WeekGroup[]
}

function buildCategoryBreakdown(txList: Transaction[]): CategoryBreakdown[] {
  let totalIn = 0
  let totalOut = 0
  const categoryMap = new Map<string, { total: number; count: number }>()

  for (const tx of txList) {
    if (tx.amount >= 0) {
      totalIn += tx.amount
    } else {
      totalOut += Math.abs(tx.amount)
    }
    const cat = tx.category ?? 'Uncategorized'
    const bucket = categoryMap.get(cat) ?? { total: 0, count: 0 }
    bucket.total += Math.abs(tx.amount)
    bucket.count += 1
    categoryMap.set(cat, bucket)
  }

  const totalAbsolute = totalIn + totalOut
  return Array.from(categoryMap.entries())
    .map(([category, { total, count }]) => ({
      category,
      total,
      count,
      percentage: totalAbsolute > 0 ? Math.round((total / totalAbsolute) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

function buildDayGroups(txList: Transaction[]): DayGroup[] {
  const dayMap = new Map<string, Transaction[]>()
  for (const tx of txList) {
    const d = tx.date ?? 'unknown'
    const arr = dayMap.get(d) ?? []
    arr.push(tx)
    dayMap.set(d, arr)
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, txs]) => {
      let totalIn = 0
      let totalOut = 0
      for (const tx of txs) {
        if (tx.amount >= 0) totalIn += tx.amount
        else totalOut += Math.abs(tx.amount)
      }
      return { date, totalIn, totalOut, net: totalIn - totalOut, count: txs.length, transactions: txs }
    })
}

function buildWeekGroups(dayGroups: DayGroup[]): WeekGroup[] {
  const weekMap = new Map<string, DayGroup[]>()
  for (const dg of dayGroups) {
    const d = new Date(dg.date + 'T00:00:00')
    const ws = startOfWeek(d, { weekStartsOn: 1 })
    const we = endOfWeek(d, { weekStartsOn: 1 })
    const key = format(ws, 'yyyy-MM-dd')
    const arr = weekMap.get(key) ?? []
    arr.push(dg)
    weekMap.set(key, arr)
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartStr, days]) => {
      const ws = new Date(weekStartStr + 'T00:00:00')
      const we = endOfWeek(ws, { weekStartsOn: 1 })
      let totalIn = 0
      let totalOut = 0
      let count = 0
      for (const dg of days) {
        totalIn += dg.totalIn
        totalOut += dg.totalOut
        count += dg.count
      }
      return {
        weekStart: format(ws, 'yyyy-MM-dd'),
        weekEnd: format(we, 'yyyy-MM-dd'),
        totalIn,
        totalOut,
        net: totalIn - totalOut,
        count,
        days,
      }
    })
}

async function fetchTransactionsForRange(
  serviceClient: ReturnType<typeof createServiceClient>,
  orgId: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const { data, error } = await serviceClient
    .from('transactions')
    .select('*')
    .eq('org_id', orgId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('is_duplicate', false)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)
  return data ?? []
}

function computeSummary(txList: Transaction[]) {
  let totalIn = 0
  let totalOut = 0
  for (const tx of txList) {
    if (tx.amount >= 0) totalIn += tx.amount
    else totalOut += Math.abs(tx.amount)
  }
  return { totalIn, totalOut, net: totalIn - totalOut, count: txList.length }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgId = userOrg.org_id
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')
    const view = (searchParams.get('view') ?? 'day') as 'day' | 'week' | 'month'
    const serviceClient = createServiceClient()
    const parsedDate = new Date(dateParam + 'T00:00:00')

    if (view === 'day') {
      // Existing day view logic
      const txList = await fetchTransactionsForRange(serviceClient, orgId, dateParam, dateParam)
      const summary = computeSummary(txList)
      const categoryBreakdown = buildCategoryBreakdown(txList)

      const result: DailyTransactionsResponse = {
        view: 'day',
        date: dateParam,
        ...summary,
        transactions: txList,
        categoryBreakdown,
      }
      return NextResponse.json(result)
    }

    if (view === 'week') {
      const weekStart = startOfWeek(parsedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(parsedDate, { weekStartsOn: 1 })
      const startStr = format(weekStart, 'yyyy-MM-dd')
      const endStr = format(weekEnd, 'yyyy-MM-dd')

      const txList = await fetchTransactionsForRange(serviceClient, orgId, startStr, endStr)
      const summary = computeSummary(txList)
      const categoryBreakdown = buildCategoryBreakdown(txList)
      const dayGroups = buildDayGroups(txList)
      const numDays = 7
      const dailyAverage = numDays > 0 ? summary.net / numDays : 0

      // Prior week comparison
      const priorWeekStart = subWeeks(weekStart, 1)
      const priorWeekEnd = endOfWeek(priorWeekStart, { weekStartsOn: 1 })
      const priorTxList = await fetchTransactionsForRange(
        serviceClient,
        orgId,
        format(priorWeekStart, 'yyyy-MM-dd'),
        format(priorWeekEnd, 'yyyy-MM-dd')
      )
      const priorSummary = computeSummary(priorTxList)
      const priorComparisonPercent =
        priorSummary.net !== 0
          ? Math.round(((summary.net - priorSummary.net) / Math.abs(priorSummary.net)) * 100)
          : null

      const result: DailyTransactionsResponse = {
        view: 'week',
        date: dateParam,
        dateRangeStart: startStr,
        dateRangeEnd: endStr,
        ...summary,
        dailyAverage,
        priorTotalIn: priorSummary.totalIn,
        priorTotalOut: priorSummary.totalOut,
        priorNet: priorSummary.net,
        priorComparisonPercent,
        transactions: txList,
        categoryBreakdown,
        dayGroups,
      }
      return NextResponse.json(result)
    }

    if (view === 'month') {
      const monthStart = startOfMonth(parsedDate)
      const monthEnd = endOfMonth(parsedDate)
      const startStr = format(monthStart, 'yyyy-MM-dd')
      const endStr = format(monthEnd, 'yyyy-MM-dd')

      const txList = await fetchTransactionsForRange(serviceClient, orgId, startStr, endStr)
      const summary = computeSummary(txList)
      const categoryBreakdown = buildCategoryBreakdown(txList)
      const dayGroups = buildDayGroups(txList)
      const weekGroups = buildWeekGroups(dayGroups)
      const numDays = monthEnd.getDate()
      const dailyAverage = numDays > 0 ? summary.net / numDays : 0

      // Prior month comparison
      const priorMonthStart = startOfMonth(subMonths(parsedDate, 1))
      const priorMonthEnd = endOfMonth(subMonths(parsedDate, 1))
      const priorTxList = await fetchTransactionsForRange(
        serviceClient,
        orgId,
        format(priorMonthStart, 'yyyy-MM-dd'),
        format(priorMonthEnd, 'yyyy-MM-dd')
      )
      const priorSummary = computeSummary(priorTxList)
      const priorComparisonPercent =
        priorSummary.net !== 0
          ? Math.round(((summary.net - priorSummary.net) / Math.abs(priorSummary.net)) * 100)
          : null

      const result: DailyTransactionsResponse = {
        view: 'month',
        date: dateParam,
        dateRangeStart: startStr,
        dateRangeEnd: endStr,
        ...summary,
        dailyAverage,
        priorTotalIn: priorSummary.totalIn,
        priorTotalOut: priorSummary.totalOut,
        priorNet: priorSummary.net,
        priorComparisonPercent,
        transactions: txList,
        categoryBreakdown,
        dayGroups,
        weekGroups,
      }
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching daily transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily transactions' },
      { status: 500 }
    )
  }
}
