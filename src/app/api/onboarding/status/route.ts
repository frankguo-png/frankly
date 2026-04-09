import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    // Run all count queries in parallel for speed
    const [bankAccounts, qboConnections, budgets, categorizedTxns, chatConversations] =
      await Promise.all([
        supabase
          .from('bank_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('qbo_connections')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('connection_status', 'active'),
        supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .neq('categorization_status', 'uncategorized'),
        supabase
          .from('chat_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId),
      ])

    return NextResponse.json({
      hasBankAccount: (bankAccounts.count ?? 0) > 0,
      hasQboConnection: (qboConnections.count ?? 0) > 0,
      hasBudget: (budgets.count ?? 0) > 0,
      hasCategorizedTransactions: (categorizedTxns.count ?? 0) > 0,
      hasChatConversation: (chatConversations.count ?? 0) > 0,
    })
  } catch (error) {
    console.error('Onboarding status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
