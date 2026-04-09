import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDateRange, formatDateForApi } from '@/lib/utils/dates'

interface OpexCategory {
  category: string
  amount: number
  percentOfTotal: number
  previousAmount: number
  monthOverMonthChange: number // percentage change
}

export interface OpexCategoriesResponse {
  totalOpex: number
  previousTotalOpex: number
  totalChange: number
  categories: OpexCategory[]
  period: { start: string; end: string }
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

    const paramStart = searchParams.get('start')
    const paramEnd = searchParams.get('end')

    let start: string
    let end: string

    if (paramStart && paramEnd) {
      start = paramStart
      end = paramEnd
    } else {
      const range = getDateRange('this_month')
      start = formatDateForApi(range.start)
      end = formatDateForApi(range.end)
    }

    // Calculate the previous period (same duration, shifted back)
    const startDate = new Date(start)
    const endDate = new Date(end)
    const durationMs = endDate.getTime() - startDate.getTime()
    const prevEnd = new Date(startDate.getTime() - 1) // day before current start
    const prevStart = new Date(prevEnd.getTime() - durationMs)
    const prevStartStr = formatDateForApi(prevStart)
    const prevEndStr = formatDateForApi(prevEnd)

    const serviceClient = createServiceClient()

    // Fetch current and previous period transactions in parallel
    const [currentResult, previousResult] = await Promise.all([
      serviceClient
        .from('transactions')
        .select('amount, category')
        .eq('org_id', orgId)
        .gte('date', start)
        .lte('date', end)
        .eq('is_duplicate', false),
      serviceClient
        .from('transactions')
        .select('amount, category')
        .eq('org_id', orgId)
        .gte('date', prevStartStr)
        .lte('date', prevEndStr)
        .eq('is_duplicate', false),
    ])

    if (currentResult.error) {
      throw new Error(`Failed to fetch transactions: ${currentResult.error.message}`)
    }
    if (previousResult.error) {
      throw new Error(`Failed to fetch previous transactions: ${previousResult.error.message}`)
    }

    // Aggregate current period expenses by category (negative amounts = expenses)
    const currentByCategory = new Map<string, number>()
    let totalOpex = 0

    for (const tx of currentResult.data ?? []) {
      if (tx.amount < 0) {
        const cat = tx.category || 'Uncategorized'
        const absAmount = Math.abs(tx.amount)
        currentByCategory.set(cat, (currentByCategory.get(cat) ?? 0) + absAmount)
        totalOpex += absAmount
      }
    }

    // Aggregate previous period expenses by category
    const previousByCategory = new Map<string, number>()
    let previousTotalOpex = 0

    for (const tx of previousResult.data ?? []) {
      if (tx.amount < 0) {
        const cat = tx.category || 'Uncategorized'
        const absAmount = Math.abs(tx.amount)
        previousByCategory.set(cat, (previousByCategory.get(cat) ?? 0) + absAmount)
        previousTotalOpex += absAmount
      }
    }

    // Build category list sorted by amount descending
    const categories: OpexCategory[] = Array.from(currentByCategory.entries())
      .map(([category, amount]) => {
        const previousAmount = previousByCategory.get(category) ?? 0
        const monthOverMonthChange =
          previousAmount > 0
            ? ((amount - previousAmount) / previousAmount) * 100
            : amount > 0
              ? 100
              : 0

        return {
          category,
          amount,
          percentOfTotal: totalOpex > 0 ? (amount / totalOpex) * 100 : 0,
          previousAmount,
          monthOverMonthChange,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const totalChange =
      previousTotalOpex > 0
        ? ((totalOpex - previousTotalOpex) / previousTotalOpex) * 100
        : totalOpex > 0
          ? 100
          : 0

    const response: OpexCategoriesResponse = {
      totalOpex,
      previousTotalOpex,
      totalChange,
      categories,
      period: { start, end },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error computing opex categories:', error)
    return NextResponse.json(
      { error: 'Failed to compute operating expenses' },
      { status: 500 }
    )
  }
}
