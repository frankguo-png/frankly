import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { syncQboTransactions } from '@/lib/qbo/sync'
import { deduplicateTransactions } from '@/lib/utils/dedup'

async function safeDedupe(orgId: string) {
  try {
    return await deduplicateTransactions(orgId)
  } catch (e) {
    console.error(`Dedup failed for org ${orgId}:`, e)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isCronJob =
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (isCronJob) {
      // Sync all active QBO connections (cron job)
      const supabase = createServiceClient()
      const { data: connections, error } = await supabase
        .from('qbo_connections')
        .select('id, org_id')
        .eq('connection_status', 'active')

      if (error) {
        console.error('Error fetching QBO connections:', error)
        return NextResponse.json(
          { error: 'Failed to fetch QBO connections' },
          { status: 500 }
        )
      }

      const results = await Promise.allSettled(
        (connections || []).map((conn) => syncQboTransactions(conn.id))
      )

      const uniqueOrgIds = Array.from(new Set((connections ?? []).map(c => c.org_id)))
      const dedupResults = await Promise.allSettled(uniqueOrgIds.map(safeDedupe))

      const summary = {
        total: results.length,
        succeeded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        dedup: {
          orgs: uniqueOrgIds.length,
          duplicates_found: dedupResults.reduce((sum, r) => {
            if (r.status === 'fulfilled' && r.value) return sum + r.value.duplicates_found
            return sum
          }, 0),
        },
        details: results.map((r, i) => ({
          connectionId: connections?.[i]?.id,
          status: r.status,
          result: r.status === 'fulfilled' ? r.value : undefined,
          error: r.status === 'rejected' ? String(r.reason) : undefined,
        })),
      }

      return NextResponse.json({ success: true, sync: summary })
    }

    // User-initiated: connectionId given → single connection,
    // no body → sync all of the user's org's active QBO connections.
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { connectionId?: string } = {}
    try { body = await request.json() } catch { /* no body is fine */ }
    const { connectionId } = body

    if (connectionId) {
      const result = await syncQboTransactions(connectionId)
      const service = createServiceClient()
      const { data: conn } = await service
        .from('qbo_connections')
        .select('org_id')
        .eq('id', connectionId)
        .single<{ org_id: string }>()
      const dedup = conn ? await safeDedupe(conn.org_id) : null
      return NextResponse.json({ success: true, connectionId, ...result, dedup })
    }

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single<{ org_id: string }>()
    if (!userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const service = createServiceClient()
    const { data: connections, error: connErr } = await service
      .from('qbo_connections')
      .select('id')
      .eq('org_id', userOrg.org_id)
      .eq('connection_status', 'active')
    if (connErr) {
      return NextResponse.json({ error: connErr.message }, { status: 500 })
    }

    const results = await Promise.allSettled(
      (connections ?? []).map(c => syncQboTransactions(c.id))
    )
    const dedup = await safeDedupe(userOrg.org_id)
    return NextResponse.json({
      success: true,
      sync: {
        total: results.length,
        succeeded: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
      },
      dedup,
    })
  } catch (error) {
    console.error('Error syncing QBO transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync QBO transactions' },
      { status: 500 }
    )
  }
}
