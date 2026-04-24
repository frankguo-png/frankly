import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid/client'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { syncPlaidTransactions } from '@/lib/plaid/sync'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { public_token, entity_id } = await request.json()
    console.log('[plaid/exchange-token] user.id=', user.id, ' entity_id=', entity_id, ' public_token length=', public_token?.length)

    if (!public_token) {
      console.log('[plaid/exchange-token] 400: public_token missing')
      return NextResponse.json(
        { error: 'public_token is required' },
        { status: 400 }
      )
    }

    if (!entity_id) {
      console.log('[plaid/exchange-token] 400: entity_id missing')
      return NextResponse.json(
        { error: 'entity_id is required' },
        { status: 400 }
      )
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    })
    const { access_token, item_id } = exchangeResponse.data

    // Get account details
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    })
    const accounts = accountsResponse.data.accounts

    // Get user's org_id
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .single<{ org_id: string }>()

    if (orgError || !userOrg) {
      console.log('[plaid/exchange-token] 404: userOrg lookup failed', { orgError })
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      )
    }

    console.log('[plaid/exchange-token] userOrg.org_id=', userOrg.org_id)

    // Verify the entity belongs to this user's org (RLS ensures cross-org lookups return nothing)
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id')
      .eq('id', entity_id)
      .eq('org_id', userOrg.org_id)
      .single<{ id: string }>()

    if (entityError || !entity) {
      console.log('[plaid/exchange-token] 400: entity lookup failed', { entity_id, org_id: userOrg.org_id, entityError })
      return NextResponse.json(
        { error: 'Entity not found for this organization', entity_id, org_id: userOrg.org_id },
        { status: 400 }
      )
    }

    // Insert bank accounts
    const bankAccountInserts = accounts.map((account) => ({
      org_id: userOrg.org_id,
      entity_id,
      plaid_item_id: item_id,
      // TODO: Replace base64 encoding with proper encryption (e.g., AES-256)
      plaid_access_token: Buffer.from(access_token).toString('base64'),
      plaid_account_id: account.account_id,
      bank_name: account.official_name || account.name || 'Unknown Bank',
      account_name: account.name,
      account_type: String(account.type),
      currency: account.balances.iso_currency_code || 'USD',
      current_balance: account.balances.current,
      available_balance: account.balances.available,
      connection_status: 'active' as const,
    }))

    const { data: bankAccounts, error: insertError } = await supabase
      .from('bank_accounts')
      .insert(bankAccountInserts)
      .select('id')

    if (insertError) {
      console.error('Error inserting bank accounts:', insertError)
      return NextResponse.json(
        { error: 'Failed to save bank accounts' },
        { status: 500 }
      )
    }

    // Trigger initial transaction sync
    for (const bankAccount of bankAccounts) {
      await syncPlaidTransactions(bankAccount.id)
    }

    return NextResponse.json({
      success: true,
      bank_account_ids: bankAccounts.map((ba) => ba.id),
    })
  } catch (error) {
    // Plaid SDK errors have { response: { data: { error_code, error_message, ... } } }
    const err = error as {
      response?: { data?: { error_code?: string; error_message?: string; error_type?: string } }
      message?: string
    }
    const plaid = err?.response?.data
    console.error('[plaid/exchange-token] 500 caught error:', {
      error_code: plaid?.error_code,
      error_type: plaid?.error_type,
      error_message: plaid?.error_message,
      message: err?.message,
    })
    return NextResponse.json(
      {
        error: 'Failed to exchange token',
        plaid_error_code: plaid?.error_code ?? null,
        plaid_error_message: plaid?.error_message ?? null,
        plaid_error_type: plaid?.error_type ?? null,
      },
      { status: 500 }
    )
  }
}
