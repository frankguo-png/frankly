import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { syncPlaidTransactions } from '@/lib/plaid/sync'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isCronJob =
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (isCronJob) {
      // Sync all active bank accounts across all orgs (cron job)
      const supabase = await createServerSupabaseClient()
      const { data: bankAccounts, error } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('connection_status', 'active')

      if (error) {
        console.error('Error fetching bank accounts:', error)
        return NextResponse.json(
          { error: 'Failed to fetch bank accounts' },
          { status: 500 }
        )
      }

      const results = await Promise.allSettled(
        bankAccounts.map((account) => syncPlaidTransactions(account.id))
      )

      const summary = {
        total: results.length,
        succeeded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
      }

      return NextResponse.json({ success: true, sync: summary })
    }

    // User-initiated: sync a single account when bankAccountId given,
    // otherwise sync every active account in the user's org.
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { bankAccountId?: string } = {}
    try { body = await request.json() } catch { /* no body is fine */ }
    const { bankAccountId } = body

    if (bankAccountId) {
      await syncPlaidTransactions(bankAccountId)
      return NextResponse.json({ success: true, bankAccountId })
    }

    // No bankAccountId — sync all of the user's org's active accounts.
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
    const { data: accounts, error: acctErr } = await service
      .from('bank_accounts')
      .select('id')
      .eq('org_id', userOrg.org_id)
      .eq('connection_status', 'active')
    if (acctErr) {
      return NextResponse.json({ error: acctErr.message }, { status: 500 })
    }

    const results = await Promise.allSettled(
      (accounts ?? []).map(a => syncPlaidTransactions(a.id))
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
    console.error('Error syncing transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    )
  }
}
