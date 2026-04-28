import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { syncQboTransactions } from '@/lib/qbo/sync'

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
        .select('id')
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

      const summary = {
        total: results.length,
        succeeded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
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
      return NextResponse.json({ success: true, connectionId, ...result })
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
    return NextResponse.json({
      success: true,
      sync: {
        total: results.length,
        succeeded: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
      },
    })
  } catch (error) {
    console.error('Error syncing QBO transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync QBO transactions' },
      { status: 500 }
    )
  }
}
