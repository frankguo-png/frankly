import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface PerformanceReviewRow {
  id: string
  cycle_id: string
  cycle_name: string
  employee_id: string
  employee_name: string
  employee_title: string | null
  employee_department: string | null
  employee_avatar_url: string | null
  reviewer_id: string | null
  reviewer_name: string | null
  status: string
  overall_rating: number | null
  self_rating: number | null
  strengths: string | null
  areas_for_improvement: string | null
  development_plan: string | null
  manager_comments: string | null
  employee_comments: string | null
  finalized_at: string | null
  acknowledged_at: string | null
  updated_at: string
}

export interface ReviewCycleRow {
  id: string
  name: string
  period_start: string
  period_end: string
  self_review_deadline: string | null
  manager_review_deadline: string | null
  calibration_deadline: string | null
  status: string
}

export interface PerformanceReviewsResponse {
  reviews: PerformanceReviewRow[]
  cycles: ReviewCycleRow[]
  summary: {
    total: number
    byStatus: Record<string, number>
    avgRating: number | null
    ratingDistribution: Record<number, number>
    byDepartment: Array<{
      department: string
      total: number
      completed: number
      avgRating: number | null
    }>
  }
}

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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgId = userOrg.org_id

    // Fetch review cycles
    const { data: cycles, error: cyclesError } = await supabase
      .from('review_cycles')
      .select('id, name, period_start, period_end, self_review_deadline, manager_review_deadline, calibration_deadline, status')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false })

    if (cyclesError) {
      console.error('Error fetching review cycles:', cyclesError)
      return NextResponse.json({ error: 'Failed to fetch review cycles' }, { status: 500 })
    }

    // Fetch reviews with employee + reviewer info via separate queries
    const { data: reviews, error: reviewsError } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    // Fetch employees for name resolution
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, title, department, avatar_url')
      .eq('org_id', orgId)

    const empMap = new Map((employees ?? []).map(e => [e.id, e]))
    const cycleMap = new Map((cycles ?? []).map(c => [c.id, c]))

    const enrichedReviews: PerformanceReviewRow[] = (reviews ?? []).map(r => {
      const emp = empMap.get(r.employee_id)
      const reviewer = r.reviewer_id ? empMap.get(r.reviewer_id) : null
      const cycle = cycleMap.get(r.cycle_id)
      return {
        id: r.id,
        cycle_id: r.cycle_id,
        cycle_name: cycle?.name ?? 'Unknown',
        employee_id: r.employee_id,
        employee_name: emp?.name ?? 'Unknown',
        employee_title: emp?.title ?? null,
        employee_department: emp?.department ?? null,
        employee_avatar_url: emp?.avatar_url ?? null,
        reviewer_id: r.reviewer_id,
        reviewer_name: reviewer?.name ?? null,
        status: r.status,
        overall_rating: r.overall_rating ? Number(r.overall_rating) : null,
        self_rating: r.self_rating ? Number(r.self_rating) : null,
        strengths: r.strengths,
        areas_for_improvement: r.areas_for_improvement,
        development_plan: r.development_plan,
        manager_comments: r.manager_comments,
        employee_comments: r.employee_comments,
        finalized_at: r.finalized_at,
        acknowledged_at: r.acknowledged_at,
        updated_at: r.updated_at,
      }
    })

    // Build summary stats
    const byStatus: Record<string, number> = {}
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const deptStats = new Map<string, { total: number; completed: number; ratings: number[] }>()
    let ratingSum = 0
    let ratingCount = 0

    for (const r of enrichedReviews) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      if (r.overall_rating != null) {
        ratingSum += r.overall_rating
        ratingCount++
        const bucket = Math.round(r.overall_rating)
        ratingDistribution[bucket] = (ratingDistribution[bucket] ?? 0) + 1
      }
      const dept = r.employee_department ?? 'Unassigned'
      const ds = deptStats.get(dept) ?? { total: 0, completed: 0, ratings: [] }
      ds.total++
      if (r.status === 'finalized' || r.status === 'acknowledged') ds.completed++
      if (r.overall_rating != null) ds.ratings.push(r.overall_rating)
      deptStats.set(dept, ds)
    }

    const byDepartment = Array.from(deptStats.entries()).map(([department, s]) => ({
      department,
      total: s.total,
      completed: s.completed,
      avgRating: s.ratings.length > 0
        ? Math.round((s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length) * 10) / 10
        : null,
    })).sort((a, b) => b.total - a.total)

    const response: PerformanceReviewsResponse = {
      reviews: enrichedReviews,
      cycles: cycles ?? [],
      summary: {
        total: enrichedReviews.length,
        byStatus,
        avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        ratingDistribution,
        byDepartment,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Performance reviews API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const orgId = userOrg.org_id
    const body = await request.json()
    const { action } = body

    // Create a review cycle
    if (action === 'create_cycle') {
      const { name, period_start, period_end, self_review_deadline, manager_review_deadline, calibration_deadline } = body

      if (!name?.trim()) {
        return NextResponse.json({ error: 'Cycle name is required' }, { status: 400 })
      }
      if (!period_start || !period_end) {
        return NextResponse.json({ error: 'Period start and end are required' }, { status: 400 })
      }

      const { data: cycle, error: insertError } = await supabase
        .from('review_cycles')
        .insert({
          org_id: orgId,
          name: name.trim(),
          period_start,
          period_end,
          self_review_deadline: self_review_deadline || null,
          manager_review_deadline: manager_review_deadline || null,
          calibration_deadline: calibration_deadline || null,
          status: 'active',
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating review cycle:', insertError)
        return NextResponse.json({ error: 'Failed to create review cycle' }, { status: 500 })
      }

      // Auto-create reviews for all active employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id, manager_id')
        .eq('org_id', orgId)
        .eq('status', 'active')

      if (employees && employees.length > 0) {
        const reviewInserts = employees.map(emp => ({
          org_id: orgId,
          cycle_id: cycle.id,
          employee_id: emp.id,
          reviewer_id: emp.manager_id || null,
          status: 'self_review' as const,
        }))

        await supabase.from('performance_reviews').insert(reviewInserts)
      }

      return NextResponse.json({ cycle }, { status: 201 })
    }

    // Create a single review
    if (action === 'create_review') {
      const { cycle_id, employee_id, reviewer_id } = body

      if (!cycle_id || !employee_id) {
        return NextResponse.json({ error: 'Cycle and employee are required' }, { status: 400 })
      }

      const { data: review, error: insertError } = await supabase
        .from('performance_reviews')
        .insert({
          org_id: orgId,
          cycle_id,
          employee_id,
          reviewer_id: reviewer_id || null,
          status: 'self_review',
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating review:', insertError)
        return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
      }

      return NextResponse.json({ review }, { status: 201 })
    }

    // Update a review (rating, status, comments)
    if (action === 'update_review') {
      const { review_id, ...updates } = body
      if (!review_id) {
        return NextResponse.json({ error: 'Review ID is required' }, { status: 400 })
      }

      // Validate status transition if status is being changed
      const VALID_STATUSES = ['not_started', 'self_review', 'manager_review', 'calibration', 'finalized', 'acknowledged']
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        not_started: ['self_review'],
        self_review: ['manager_review'],
        manager_review: ['calibration'],
        calibration: ['finalized'],
        finalized: ['acknowledged'],
      }

      if (updates.status) {
        if (!VALID_STATUSES.includes(updates.status)) {
          return NextResponse.json({ error: `Invalid status: ${updates.status}` }, { status: 400 })
        }

        // Fetch current status to validate transition
        const { data: currentReview } = await supabase
          .from('performance_reviews')
          .select('status')
          .eq('id', review_id)
          .eq('org_id', orgId)
          .single()

        if (!currentReview) {
          return NextResponse.json({ error: 'Review not found' }, { status: 404 })
        }

        const allowed = ALLOWED_TRANSITIONS[currentReview.status] ?? []
        if (!allowed.includes(updates.status)) {
          return NextResponse.json({ error: `Cannot transition from ${currentReview.status} to ${updates.status}` }, { status: 400 })
        }
      }

      // Validate rating range
      if (updates.overall_rating !== undefined && updates.overall_rating !== null) {
        const r = Number(updates.overall_rating)
        if (isNaN(r) || r < 1 || r > 5) {
          return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
        }
      }
      if (updates.self_rating !== undefined && updates.self_rating !== null) {
        const r = Number(updates.self_rating)
        if (isNaN(r) || r < 1 || r > 5) {
          return NextResponse.json({ error: 'Self rating must be between 1 and 5' }, { status: 400 })
        }
      }

      const allowedFields = ['status', 'overall_rating', 'self_rating', 'strengths', 'areas_for_improvement', 'development_plan', 'manager_comments', 'employee_comments']
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field]
        }
      }

      if (updates.status === 'finalized') {
        updateData.finalized_at = new Date().toISOString()
      }
      if (updates.status === 'acknowledged') {
        updateData.acknowledged_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('performance_reviews')
        .update(updateData)
        .eq('id', review_id)
        .eq('org_id', orgId)

      if (updateError) {
        console.error('Error updating review:', updateError)
        return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Performance reviews POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
