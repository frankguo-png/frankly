import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgId = userOrg.org_id
    const service = createServiceClient()

    // Delete in FK-safe order (children before parents)

    // HR data
    await service.from('review_goals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('performance_reviews').delete().eq('org_id', orgId)
    await service.from('review_cycles').delete().eq('org_id', orgId)
    await service.from('bonus_approvals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('bonuses').delete().eq('org_id', orgId)

    // Reconciliation
    await service.from('reconciliation_matches').delete().eq('org_id', orgId)

    // Employees (after reviews/bonuses that reference them)
    await service.from('employees').delete().eq('org_id', orgId)

    // Financial data
    await service.from('transactions').delete().eq('org_id', orgId)
    await service.from('payroll_allocations').delete().eq('org_id', orgId)
    await service.from('pending_payments').delete().eq('org_id', orgId)
    await service.from('deals').delete().eq('org_id', orgId)
    await service.from('budgets').delete().eq('org_id', orgId)

    // Chat history
    const { data: conversations } = await service
      .from('chat_conversations')
      .select('id')
      .eq('org_id', orgId)

    if (conversations && conversations.length > 0) {
      for (const conv of conversations) {
        await service.from('chat_messages').delete().eq('conversation_id', conv.id)
      }
      await service.from('chat_conversations').delete().eq('org_id', orgId)
    }

    // Delete seed bank accounts (they have no real Plaid credentials)
    // Real bank accounts will be re-created when user connects via Plaid
    await service
      .from('bank_accounts')
      .delete()
      .eq('org_id', orgId)

    // Sync logs
    await service.from('sync_log').delete().eq('org_id', orgId)

    return NextResponse.json({
      success: true,
      message: 'All data cleared. Connect Plaid and QuickBooks to start with real data.',
    })
  } catch (err) {
    console.error('Clear data error:', err)
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 })
  }
}
