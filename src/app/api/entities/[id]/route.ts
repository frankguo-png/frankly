import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
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
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if ('short_code' in body) updates.short_code = body.short_code ? String(body.short_code).trim() : null
    if (typeof body.currency === 'string' && body.currency.trim()) updates.currency = body.currency.trim()
    if ('color' in body) updates.color = body.color || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data: entity, error: updateError } = await supabase
      .from('entities')
      .update(updates)
      .eq('id', id)
      .eq('org_id', userOrg.org_id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update entity:', updateError)
      return NextResponse.json(
        { error: 'Failed to update entity', details: updateError.message },
        { status: 500 }
      )
    }

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    return NextResponse.json({ entity })
  } catch (error) {
    console.error('Error updating entity:', error)
    return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 })
  }
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

    // FKs that reference this entity (bank_accounts, qbo_connections, transactions,
    // employees, payroll_allocations) all use ON DELETE SET NULL — so deleting
    // the entity leaves those rows intact with entity_id = null.
    const { error: deleteError } = await supabase
      .from('entities')
      .delete()
      .eq('id', id)
      .eq('org_id', userOrg.org_id)

    if (deleteError) {
      console.error('Failed to delete entity:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete entity', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting entity:', error)
    return NextResponse.json({ error: 'Failed to delete entity' }, { status: 500 })
  }
}
