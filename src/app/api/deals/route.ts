import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type DealStage = 'pitched' | 'negotiating' | 'verbal' | 'closed_won' | 'closed_lost'

interface DealRow {
  id: string
  org_id: string
  name: string
  company: string | null
  amount: number
  probability: number
  stage: DealStage
  expected_close_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface StageSummary {
  stage: DealStage
  total: number
  count: number
}

interface DealsSummary {
  totalPipeline: number
  weightedPipeline: number
  closingThisMonth: number
  byStage: StageSummary[]
}

export async function GET(_request: NextRequest) {
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

    const orgId = userOrg.org_id

    // Fetch ALL deals in a single query (including closed_lost for win rate)
    const includeAll = _request.nextUrl.searchParams.get('all') === '1'

    const { data: allDeals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('org_id', orgId)
      .order('amount', { ascending: false })

    if (dealsError) {
      console.error('Error fetching deals:', dealsError)
      return NextResponse.json(
        { error: 'Failed to fetch deals' },
        { status: 500 }
      )
    }

    const allRows = (allDeals ?? []) as DealRow[]

    // Filter for display: exclude closed_lost unless ?all=1
    const rows = includeAll ? allRows : allRows.filter((d) => d.stage !== 'closed_lost')

    // Calculate summary stats from the display rows
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    let totalPipeline = 0
    let weightedPipeline = 0
    let closingThisMonth = 0
    const stageMap = new Map<DealStage, { total: number; count: number }>()

    for (const deal of rows) {
      const amount = Number(deal.amount)
      const probability = Number(deal.probability)

      totalPipeline += amount
      weightedPipeline += amount * (probability / 100)

      // Check if expected to close this month
      if (deal.expected_close_date) {
        const closeDate = new Date(deal.expected_close_date)
        if (
          closeDate.getMonth() === currentMonth &&
          closeDate.getFullYear() === currentYear
        ) {
          closingThisMonth += amount
        }
      }

      // Aggregate by stage
      const existing = stageMap.get(deal.stage) ?? { total: 0, count: 0 }
      existing.total += amount
      existing.count += 1
      stageMap.set(deal.stage, existing)
    }

    const stageOrder: DealStage[] = ['pitched', 'negotiating', 'verbal', 'closed_won']
    const byStage: StageSummary[] = stageOrder
      .filter((s) => stageMap.has(s))
      .map((stage) => ({
        stage,
        total: stageMap.get(stage)!.total,
        count: stageMap.get(stage)!.count,
      }))

    const summary: DealsSummary = {
      totalPipeline,
      weightedPipeline,
      closingThisMonth,
      byStage,
    }

    // Compute win rate from the full dataset (allRows includes closed_lost)
    const closedWon = allRows.filter((d) => d.stage === 'closed_won').length
    const closedLost = allRows.filter((d) => d.stage === 'closed_lost').length
    const winRate = closedWon + closedLost > 0 ? closedWon / (closedWon + closedLost) : 0

    return NextResponse.json({ deals: rows, summary: { ...summary, winRate } })
  } catch (error) {
    console.error('Error in deals API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, company, amount, probability, stage, expected_close_date, notes } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required and must be a non-empty string' }, { status: 400 })
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be a number greater than 0' }, { status: 400 })
    }

    if (probability !== undefined && (isNaN(Number(probability)) || probability < 0 || probability > 100)) {
      return NextResponse.json({ error: 'Probability must be a number between 0 and 100' }, { status: 400 })
    }

    const validStages: DealStage[] = ['pitched', 'negotiating', 'verbal', 'closed_won', 'closed_lost']
    if (stage && !validStages.includes(stage)) {
      return NextResponse.json({ error: `Stage must be one of: ${validStages.join(', ')}` }, { status: 400 })
    }

    const { data: deal, error: insertError } = await supabase
      .from('deals')
      .insert({
        org_id: userOrg.org_id,
        name,
        company: company || null,
        amount,
        probability: probability ?? 50,
        stage: stage || 'pitched',
        expected_close_date: expected_close_date || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating deal:', insertError)
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
    }

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error('Error in deals POST:', error)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 })
    }

    // Only allow certain fields to be updated
    const allowedFields = ['stage', 'probability', 'amount', 'expected_close_date', 'notes', 'name', 'company']
    const sanitized: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key]
      }
    }

    sanitized.updated_at = new Date().toISOString()

    const { data: deal, error: updateError } = await supabase
      .from('deals')
      .update(sanitized)
      .eq('id', id)
      .eq('org_id', userOrg.org_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating deal:', updateError)
      return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error in deals PATCH:', error)
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('org_id', userOrg.org_id)

    if (deleteError) {
      console.error('Error deleting deal:', deleteError)
      return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in deals DELETE:', error)
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
  }
}
