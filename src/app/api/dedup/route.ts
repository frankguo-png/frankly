import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deduplicateTransactions } from '@/lib/utils/dedup'

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
      .single<{ org_id: string }>()
    if (!userOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const result = await deduplicateTransactions(userOrg.org_id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Dedup failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dedup failed' },
      { status: 500 }
    )
  }
}
