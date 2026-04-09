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

    // Sync a specific bank account (user-initiated)
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bankAccountId } = await request.json()

    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'bankAccountId is required' },
        { status: 400 }
      )
    }

    await syncPlaidTransactions(bankAccountId)

    return NextResponse.json({ success: true, bankAccountId })
  } catch (error) {
    console.error('Error syncing transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    )
  }
}
