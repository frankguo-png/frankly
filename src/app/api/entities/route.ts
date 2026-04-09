import { NextRequest, NextResponse } from 'next/server'
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

    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const { data: entities, error: fetchError } = await supabase
      .from('entities')
      .select('id, org_id, name, short_code, currency, color, created_at')
      .eq('org_id', userOrg.org_id)
      .order('name', { ascending: true })

    if (fetchError) {
      console.error('Failed to fetch entities:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch entities' },
        { status: 500 }
      )
    }

    return NextResponse.json({ entities: entities ?? [] })
  } catch (error) {
    console.error('Error fetching entities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, short_code, currency, color } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data: entity, error: insertError } = await supabase
      .from('entities')
      .insert({
        org_id: userOrg.org_id,
        name,
        short_code: short_code || null,
        currency: currency || 'USD',
        color: color || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create entity:', insertError)
      return NextResponse.json(
        { error: 'Failed to create entity' },
        { status: 500 }
      )
    }

    return NextResponse.json({ entity }, { status: 201 })
  } catch (error) {
    console.error('Error creating entity:', error)
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    )
  }
}
