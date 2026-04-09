import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  calculateRunway,
  calculateBurnTrend,
  forecastCashPosition,
  getPayrollVsCashAlert,
} from '@/lib/kpi/forecasting'

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
    const entityId = request.nextUrl.searchParams.get('entity') || undefined

    const [runway, burnTrend, cashForecast, payrollAlert] = await Promise.all([
      calculateRunway(orgId, entityId),
      calculateBurnTrend(orgId, entityId),
      forecastCashPosition(orgId, 6, entityId),
      getPayrollVsCashAlert(orgId, entityId),
    ])

    const res = NextResponse.json({
      runway,
      burnTrend,
      cashForecast,
      payrollAlert,
    })
    res.headers.set('Cache-Control', 'private, s-maxage=120, stale-while-revalidate=300')
    return res
  } catch (error) {
    console.error('Error computing forecast:', error)
    return NextResponse.json(
      { error: 'Failed to compute forecast' },
      { status: 500 }
    )
  }
}
