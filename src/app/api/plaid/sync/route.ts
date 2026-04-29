import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { syncPlaidTransactions } from '@/lib/plaid/sync'
import { deduplicateTransactions } from '@/lib/utils/dedup'

// Run dedup for an org, swallowing errors so a dedup failure doesn't break sync.
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
      // Sync all active bank accounts across all orgs (cron job)
      const service = createServiceClient()
      const { data: bankAccounts, error } = await service
        .from('bank_accounts')
        .select('id, org_id')
        .eq('connection_status', 'active')

      if (error) {
        console.error('Error fetching bank accounts:', error)
        return NextResponse.json(
          { error: 'Failed to fetch bank accounts' },
          { status: 500 }
        )
      }

      const results = await Promise.allSettled(
        (bankAccounts ?? []).map((account) => syncPlaidTransactions(account.id))
      )

      // Dedupe each org touched by this sync (Plaid ↔ QBO transactions).
      const uniqueOrgIds = Array.from(new Set((bankAccounts ?? []).map(b => b.org_id)))
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
      // Need orgId for dedup; look it up off the bank_account row.
      const service = createServiceClient()
      const { data: ba } = await service
        .from('bank_accounts')
        .select('org_id')
        .eq('id', bankAccountId)
        .single<{ org_id: string }>()
      const dedup = ba ? await safeDedupe(ba.org_id) : null
      return NextResponse.json({ success: true, bankAccountId, dedup })
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
    console.error('Error syncing transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    )
  }
}
