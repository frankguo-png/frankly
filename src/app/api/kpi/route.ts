import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDateRange, getGranularity, formatDateForApi } from '@/lib/utils/dates'
import {
  getKpiSummary,
  getSpendByDepartment,
  getSpendByProject,
  getSpendByAgent,
  getTimeSeries,
} from '@/lib/kpi/calculator'
import type { TimePreset, Granularity, KpiResponse } from '@/lib/kpi/types'

const VALID_PRESETS = new Set<TimePreset>([
  'today',
  'this_week',
  'this_month',
  'last_month',
  'ytd',
  'last_quarter',
])

export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity') || undefined

    let start: string
    let end: string
    let granularity: Granularity

    const preset = searchParams.get('preset') as TimePreset | null
    const paramStart = searchParams.get('start')
    const paramEnd = searchParams.get('end')
    const paramGranularity = searchParams.get('granularity') as Granularity | null

    if (paramStart && paramEnd) {
      start = paramStart
      end = paramEnd
      granularity =
        paramGranularity ?? getGranularity(new Date(paramStart), new Date(paramEnd))
    } else {
      const resolvedPreset =
        preset && VALID_PRESETS.has(preset) ? preset : 'this_month'
      const range = getDateRange(resolvedPreset)
      start = formatDateForApi(range.start)
      end = formatDateForApi(range.end)
      granularity = paramGranularity ?? getGranularity(range.start, range.end)
    }

    // Calculate prior period of equal duration
    const startDate = new Date(start)
    const endDate = new Date(end)
    const durationMs = endDate.getTime() - startDate.getTime()
    const priorEnd = new Date(startDate.getTime() - 1) // day before current start
    const priorStart = new Date(priorEnd.getTime() - durationMs)
    const priorStartStr = formatDateForApi(priorStart)
    const priorEndStr = formatDateForApi(priorEnd)

    const [summary, priorSummary, spendByDepartment, spendByProject, spendByAgent, timeSeries] =
      await Promise.all([
        getKpiSummary(orgId, start, end, entityId),
        getKpiSummary(orgId, priorStartStr, priorEndStr, entityId),
        getSpendByDepartment(orgId, start, end, entityId),
        getSpendByProject(orgId, start, end, entityId),
        getSpendByAgent(orgId, start, end, entityId),
        getTimeSeries(orgId, start, end, granularity, entityId),
      ])

    const response: KpiResponse = {
      summary,
      priorSummary,
      spendByDepartment,
      spendByProject,
      spendByAgent,
      timeSeries,
      period: { start, end, granularity },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error computing KPIs:', error)
    return NextResponse.json(
      { error: 'Failed to compute KPIs' },
      { status: 500 }
    )
  }
}
