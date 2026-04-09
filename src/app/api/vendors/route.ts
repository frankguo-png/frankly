import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface VendorRow {
  vendor: string
  total_spend: number
  transaction_count: number
  first_seen: string
  last_seen: string
  category: string | null
}

interface MonthlyRow {
  vendor: string
  month: string
  spend: number
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

    // Default to last 12 months
    const now = new Date()
    const defaultStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)
      .toISOString()
      .slice(0, 10)
    const defaultEnd = now.toISOString().slice(0, 10)

    const start = searchParams.get('start') || defaultStart
    const end = searchParams.get('end') || defaultEnd
    const entityId = searchParams.get('entity') || undefined

    // Query: aggregate by vendor
    const { data: vendorRows, error: vendorError } = await (supabase.rpc as any)(
      'get_vendor_analytics',
      { p_org_id: orgId, p_start: start, p_end: end }
    ) as { data: VendorRow[] | null; error: any }

    // If RPC doesn't exist, fall back to raw query approach
    if (vendorError) {
      // Use a direct query approach
      let txQuery = supabase
        .from('transactions')
        .select('vendor, amount, date, category')
        .eq('org_id', orgId)
        .eq('is_duplicate', false)
        .not('vendor', 'is', null)
        .lt('amount', 0)
        .gte('date', start)
        .lte('date', end)
      if (entityId) txQuery = txQuery.eq('entity_id', entityId)

      const { data: transactions, error: txError } = await txQuery

      if (txError) {
        console.error('Error querying transactions:', txError)
        return NextResponse.json(
          { error: 'Failed to query transactions' },
          { status: 500 }
        )
      }

      if (!transactions || transactions.length === 0) {
        return NextResponse.json({ vendors: [], summary: { totalVendors: 0, totalSpend: 0, avgPerVendor: 0, topVendor: null } })
      }

      // Group by vendor in JS
      const vendorMap = new Map<
        string,
        {
          totalSpend: number
          transactionCount: number
          firstSeen: string
          lastSeen: string
          categories: Map<string, number>
          monthlySpend: Map<string, number>
        }
      >()

      for (const tx of transactions) {
        const v = tx.vendor as string
        const absAmount = Math.abs(tx.amount)
        const month = (tx.date as string).slice(0, 7) // YYYY-MM

        if (!vendorMap.has(v)) {
          vendorMap.set(v, {
            totalSpend: 0,
            transactionCount: 0,
            firstSeen: tx.date as string,
            lastSeen: tx.date as string,
            categories: new Map(),
            monthlySpend: new Map(),
          })
        }

        const entry = vendorMap.get(v)!
        entry.totalSpend += absAmount
        entry.transactionCount += 1
        if ((tx.date as string) < entry.firstSeen) entry.firstSeen = tx.date as string
        if ((tx.date as string) > entry.lastSeen) entry.lastSeen = tx.date as string

        const cat = (tx.category as string) || 'Uncategorized'
        entry.categories.set(cat, (entry.categories.get(cat) || 0) + absAmount)

        entry.monthlySpend.set(month, (entry.monthlySpend.get(month) || 0) + absAmount)
      }

      // Compute months in range for avgMonthly
      const startDate = new Date(start)
      const endDate = new Date(end)
      const totalMonths = Math.max(
        1,
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth()) + 1
      )

      // Build vendor list
      const vendors = Array.from(vendorMap.entries())
        .map(([name, data]) => {
          // Top category
          let topCategory = 'Uncategorized'
          let maxCatSpend = 0
          for (const [cat, spend] of data.categories) {
            if (spend > maxCatSpend) {
              maxCatSpend = spend
              topCategory = cat
            }
          }

          // Trend: compare last 3 months avg vs prior 3 months avg
          const sortedMonths = Array.from(data.monthlySpend.keys()).sort()
          const trend = computeTrend(data.monthlySpend, now)

          // Monthly spend for last 6 months (for mini chart)
          const last6Months = getLast6Months(now)
          const monthlySpend = last6Months.map((m) => ({
            month: m,
            spend: data.monthlySpend.get(m) || 0,
          }))

          return {
            name,
            totalSpend: Math.round(data.totalSpend * 100) / 100,
            transactionCount: data.transactionCount,
            avgMonthly: Math.round((data.totalSpend / totalMonths) * 100) / 100,
            firstSeen: data.firstSeen,
            lastSeen: data.lastSeen,
            topCategory,
            trend,
            monthlySpend,
          }
        })
        .sort((a, b) => b.totalSpend - a.totalSpend)

      const totalSpend = vendors.reduce((sum, v) => sum + v.totalSpend, 0)

      return NextResponse.json({
        vendors,
        summary: {
          totalVendors: vendors.length,
          totalSpend: Math.round(totalSpend * 100) / 100,
          avgPerVendor:
            vendors.length > 0
              ? Math.round((totalSpend / vendors.length) * 100) / 100
              : 0,
          topVendor: vendors.length > 0 ? vendors[0].name : null,
        },
      })
    }

    // If RPC succeeded (unlikely on first deploy, but handle it)
    return NextResponse.json({ vendors: vendorRows, summary: {} })
  } catch (error) {
    console.error('Error computing vendor analytics:', error)
    return NextResponse.json(
      { error: 'Failed to compute vendor analytics' },
      { status: 500 }
    )
  }
}

function computeTrend(
  monthlySpend: Map<string, number>,
  now: Date
): 'up' | 'down' | 'flat' {
  // Last 3 months vs prior 3 months
  const months: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }

  const recent3 = months.slice(0, 3)
  const prior3 = months.slice(3, 6)

  const recentAvg =
    recent3.reduce((sum, m) => sum + (monthlySpend.get(m) || 0), 0) / 3
  const priorAvg =
    prior3.reduce((sum, m) => sum + (monthlySpend.get(m) || 0), 0) / 3

  if (priorAvg === 0 && recentAvg === 0) return 'flat'
  if (priorAvg === 0) return 'up'

  const change = (recentAvg - priorAvg) / priorAvg
  if (change > 0.1) return 'up'
  if (change < -0.1) return 'down'
  return 'flat'
}

function getLast6Months(now: Date): string[] {
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}
