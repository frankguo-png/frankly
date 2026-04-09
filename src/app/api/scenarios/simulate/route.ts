import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBankBalance, getMonthlyTotals } from '@/lib/kpi/forecasting'
import { simulateScenario } from '@/lib/kpi/scenario-engine'
import type { ScenarioInputs } from '@/lib/kpi/scenario-engine'

export async function POST(request: Request) {
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
    const inputs: ScenarioInputs = await request.json()

    const [balanceNow, monthlyTotals] = await Promise.all([
      getBankBalance(orgId),
      getMonthlyTotals(orgId, 3),
    ])

    const months = monthlyTotals.length || 1
    const avgMonthlyRevenue =
      monthlyTotals.reduce((sum, m) => sum + m.cashIn, 0) / months
    const avgMonthlyExpenses =
      monthlyTotals.reduce((sum, m) => sum + m.cashOut, 0) / months

    const result = simulateScenario(
      { balanceNow, avgMonthlyRevenue, avgMonthlyExpenses },
      inputs
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error simulating scenario:', error)
    return NextResponse.json(
      { error: 'Failed to simulate scenario' },
      { status: 500 }
    )
  }
}
