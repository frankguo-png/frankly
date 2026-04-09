import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { format, subDays } from 'date-fns'

export interface DailyCashflowPoint {
  date: string
  cashIn: number
  cashOut: number
  net: number
  transactionCount: number
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
    const paramDays = searchParams.get('days')
    const days = paramDays ? Math.min(Math.max(parseInt(paramDays, 10) || 30, 7), 90) : 30

    const today = new Date()
    const startDate = subDays(today, days - 1)
    const start = format(startDate, 'yyyy-MM-dd')
    const end = format(today, 'yyyy-MM-dd')

    const serviceClient = createServiceClient()

    const { data: transactions, error: txError } = await serviceClient
      .from('transactions')
      .select('date, amount')
      .eq('org_id', orgId)
      .gte('date', start)
      .lte('date', end)
      .eq('is_duplicate', false)

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`)
    }

    // Group by day
    const dayMap = new Map<string, { cashIn: number; cashOut: number; count: number }>()

    for (const tx of transactions ?? []) {
      const dayKey = tx.date.substring(0, 10) // YYYY-MM-DD
      const bucket = dayMap.get(dayKey) ?? { cashIn: 0, cashOut: 0, count: 0 }

      if (tx.amount > 0) {
        bucket.cashIn += tx.amount
      } else {
        bucket.cashOut += Math.abs(tx.amount)
      }
      bucket.count += 1

      dayMap.set(dayKey, bucket)
    }

    // Build result array for every day in range (including zero-data days)
    const result: DailyCashflowPoint[] = []
    const cursor = new Date(startDate)
    while (cursor <= today) {
      const key = format(cursor, 'yyyy-MM-dd')
      const bucket = dayMap.get(key)
      result.push({
        date: key,
        cashIn: bucket?.cashIn ?? 0,
        cashOut: bucket?.cashOut ?? 0,
        net: (bucket?.cashIn ?? 0) - (bucket?.cashOut ?? 0),
        transactionCount: bucket?.count ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching daily cashflow:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily cashflow' },
      { status: 500 }
    )
  }
}
