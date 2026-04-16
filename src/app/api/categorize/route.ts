import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { categorizeTransactions } from '@/lib/categorization/engine'

const TEMPLATE_ORG_ID = '00000000-0000-0000-0000-000000000000'

async function ensureDefaultRules(orgId: string) {
  const service = createServiceClient()

  // Check if org already has rules
  const { count } = await service
    .from('category_rules')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if ((count ?? 0) > 0) return // Already has rules

  // Copy template rules from placeholder org
  const { data: templateRules } = await service
    .from('category_rules')
    .select('rule_name, rule_type, match_field, match_value, target_category, target_department, target_project, priority')
    .eq('org_id', TEMPLATE_ORG_ID)
    .eq('is_active', true)

  if (!templateRules || templateRules.length === 0) return

  const newRules = templateRules.map(rule => ({
    ...rule,
    org_id: orgId,
    is_active: true,
  }))

  await service.from('category_rules').insert(newRules)
}

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

  // 3. Ensure org has default categorization rules
  try {
    await ensureDefaultRules(orgData.org_id)
  } catch (err) {
    console.error('Failed to provision default rules:', err)
  }

  // 4. Run categorization
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
