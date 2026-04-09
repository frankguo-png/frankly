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

    // User-initiated sync
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId } = await request.json()

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    const result = await syncQboTransactions(connectionId)

    return NextResponse.json({ success: true, connectionId, ...result })
  } catch (error) {
    console.error('Error syncing QBO transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync QBO transactions' },
      { status: 500 }
    )
  }
}
