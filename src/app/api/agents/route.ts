import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAgentMetrics } from '@/lib/kpi/agent-roi'

export async function GET() {
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

    const metrics = await getAgentMetrics(userOrg.org_id)
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching agent metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agent metrics' },
      { status: 500 }
    )
  }
}
