import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params

    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    if (orgError || !userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // transactions.bank_account_id is ON DELETE SET NULL — historical rows stay
    // but get unlinked from this account. We leave the Plaid Item alone on
    // Plaid's side; cleaning up the Plaid access token is a separate concern.
    const { error: deleteError } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id)
      .eq('org_id', userOrg.org_id)

    if (deleteError) {
      console.error('Failed to delete bank account:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete bank account', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting bank account:', error)
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params

    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    if (orgError || !userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, string | null> = {}
    if (typeof body.bank_name === 'string' && body.bank_name.trim()) {
      updates.bank_name = body.bank_name.trim()
    }
    if ('account_name' in body) {
      updates.account_name = body.account_name ? String(body.account_name).trim() : null
    }
    if ('entity_id' in body) {
      // Allow clearing to null, or setting to a valid entity id
      if (body.entity_id === null || body.entity_id === '') {
        updates.entity_id = null
      } else {
        const { data: entity } = await supabase
          .from('entities')
          .select('id')
          .eq('id', body.entity_id)
          .eq('org_id', userOrg.org_id)
          .single<{ id: string }>()
        if (!entity) {
          return NextResponse.json(
            { error: 'Entity not found for this organization' },
            { status: 400 }
          )
        }
        updates.entity_id = entity.id
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data: bankAccount, error: updateError } = await supabase
      .from('bank_accounts')
      .update(updates)
      .eq('id', id)
      .eq('org_id', userOrg.org_id)
      .select('id, bank_name, account_name, account_type, currency, current_balance, connection_status, entity_id')
      .single()

    if (updateError) {
      console.error('Failed to update bank account:', updateError)
      return NextResponse.json(
        { error: 'Failed to update bank account', details: updateError.message },
        { status: 500 }
      )
    }

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
    }

    return NextResponse.json({ bank_account: bankAccount })
  } catch (error) {
    console.error('Error updating bank account:', error)
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 })
  }
}
