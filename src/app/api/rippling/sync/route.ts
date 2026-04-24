import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { syncRipplingEmployees } from '@/lib/rippling/sync'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isCronJob =
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`

    let orgId: string

    if (isCronJob) {
      // For cron jobs, sync all orgs that have rippling data
      const supabase = createServiceClient()
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('id')

      if (error || !orgs?.length) {
        return NextResponse.json(
          { error: 'No organizations found' },
          { status: 404 }
        )
      }

      const results = await Promise.allSettled(
        orgs.map(async (org) => {
          const employees = await syncRipplingEmployees(org.id)
          return { org_id: org.id, employees }
        })
      )

      const summary = {
        total: results.length,
        succeeded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
      }

      return NextResponse.json({ success: true, sync: summary })
    }

    // User-initiated sync
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's org
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

    orgId = userOrg.org_id

    const employees = await syncRipplingEmployees(orgId)

    return NextResponse.json({ success: true, employees })
  } catch (error) {
    console.error('Rippling sync error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to sync Rippling data',
      },
      { status: 500 }
    )
  }
}
