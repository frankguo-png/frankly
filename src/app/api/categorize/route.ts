import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { categorizeTransactions } from '@/lib/categorization/engine'

export async function POST() {
  // 1. Authenticate user
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get org_id
  const { data: orgData, error: orgError } = await supabase
    .from('user_organizations')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (orgError || !orgData) {
    return NextResponse.json(
      { error: 'No organization found' },
      { status: 400 }
    )
  }

  // 3. Run categorization
  try {
    const result = await categorizeTransactions(orgData.org_id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Categorization error:', err)
    return NextResponse.json(
      { error: 'Categorization failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
