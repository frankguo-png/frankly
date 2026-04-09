import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface BonusRow {
  id: string
  employee_id: string
  employee_name: string
  employee_title: string | null
  employee_department: string | null
  employee_avatar_url: string | null
  proposed_by_name: string | null
  bonus_type: string
  amount: number
  percentage_of_salary: number | null
  base_salary_at_time: number | null
  performance_rating_at_time: number | null
  reason: string | null
  status: string
  fiscal_year: number | null
  fiscal_quarter: number | null
  effective_date: string | null
  payout_date: string | null
  approved_at: string | null
  paid_at: string | null
  created_at: string
}

export interface BonusApprovalRow {
  id: string
  bonus_id: string
  approver_name: string | null
  approver_role: string | null
  status: string
  comments: string | null
  decided_at: string | null
}

export interface BonusReviewsResponse {
  bonuses: BonusRow[]
  summary: {
    total: number
    totalAmount: number
    byStatus: Record<string, number>
    byType: Record<string, { count: number; amount: number }>
    byDepartment: Array<{
      department: string
      count: number
      totalAmount: number
      avgAmount: number
    }>
    pendingApprovalCount: number
    paidThisYear: number
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

    // Fetch bonuses
    const { data: bonuses, error: bonusesError } = await supabase
      .from('bonuses')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (bonusesError) {
      console.error('Error fetching bonuses:', bonusesError)
      return NextResponse.json({ error: 'Failed to fetch bonuses' }, { status: 500 })
    }

    // Fetch employees for name resolution
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, title, department, avatar_url')
      .eq('org_id', orgId)

    const empMap = new Map((employees ?? []).map(e => [e.id, e]))

    const enrichedBonuses: BonusRow[] = (bonuses ?? []).map(b => {
      const emp = empMap.get(b.employee_id)
      const proposer = b.proposed_by ? empMap.get(b.proposed_by) : null
      return {
        id: b.id,
        employee_id: b.employee_id,
        employee_name: emp?.name ?? 'Unknown',
        employee_title: emp?.title ?? null,
        employee_department: emp?.department ?? null,
        employee_avatar_url: emp?.avatar_url ?? null,
        proposed_by_name: proposer?.name ?? null,
        bonus_type: b.bonus_type,
        amount: Number(b.amount),
        percentage_of_salary: b.percentage_of_salary ? Number(b.percentage_of_salary) : null,
        base_salary_at_time: b.base_salary_at_time ? Number(b.base_salary_at_time) : null,
        performance_rating_at_time: b.performance_rating_at_time ? Number(b.performance_rating_at_time) : null,
        reason: b.reason,
        status: b.status,
        fiscal_year: b.fiscal_year,
        fiscal_quarter: b.fiscal_quarter,
        effective_date: b.effective_date,
        payout_date: b.payout_date,
        approved_at: b.approved_at,
        paid_at: b.paid_at,
        created_at: b.created_at,
      }
    })

    // Build summary
    const byStatus: Record<string, number> = {}
    const byType: Record<string, { count: number; amount: number }> = {}
    const deptStats = new Map<string, { count: number; totalAmount: number }>()
    let totalAmount = 0
    let pendingApprovalCount = 0
    let paidThisYear = 0
    const currentYear = new Date().getFullYear()

    for (const b of enrichedBonuses) {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1
      totalAmount += b.amount

      const typeEntry = byType[b.bonus_type] ?? { count: 0, amount: 0 }
      typeEntry.count++
      typeEntry.amount += b.amount
      byType[b.bonus_type] = typeEntry

      if (b.status === 'pending_approval') pendingApprovalCount++
      if (b.status === 'paid' && b.fiscal_year === currentYear) paidThisYear += b.amount

      const dept = b.employee_department ?? 'Unassigned'
      const ds = deptStats.get(dept) ?? { count: 0, totalAmount: 0 }
      ds.count++
      ds.totalAmount += b.amount
      deptStats.set(dept, ds)
    }

    const byDepartment = Array.from(deptStats.entries()).map(([department, s]) => ({
      department,
      count: s.count,
      totalAmount: s.totalAmount,
      avgAmount: s.count > 0 ? Math.round(s.totalAmount / s.count) : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount)

    const response: BonusReviewsResponse = {
      bonuses: enrichedBonuses,
      summary: {
        total: enrichedBonuses.length,
        totalAmount,
        byStatus,
        byType,
        byDepartment,
        pendingApprovalCount,
        paidThisYear,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Bonus reviews API error:', err)
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

    // Create a bonus
    if (action === 'create_bonus') {
      const { employee_id, bonus_type, amount, reason, percentage_of_salary, effective_date, payout_date, fiscal_year, fiscal_quarter } = body

      if (!employee_id) {
        return NextResponse.json({ error: 'Employee is required' }, { status: 400 })
      }
      const VALID_TYPES = ['annual_performance', 'spot', 'retention', 'signing', 'project_completion', 'referral']
      if (!bonus_type || !VALID_TYPES.includes(bonus_type)) {
        return NextResponse.json({ error: `Bonus type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
      }
      const numAmount = Number(amount)
      if (!amount || isNaN(numAmount) || numAmount <= 0 || !Number.isFinite(numAmount) || numAmount > 1_000_000) {
        return NextResponse.json({ error: 'Amount must be between $0 and $1,000,000' }, { status: 400 })
      }

      // Snapshot salary at time of bonus
      const { data: employee } = await supabase
        .from('employees')
        .select('salary')
        .eq('id', employee_id)
        .eq('org_id', orgId)
        .single()

      const { data: bonus, error: insertError } = await supabase
        .from('bonuses')
        .insert({
          org_id: orgId,
          employee_id,
          bonus_type,
          amount: Number(amount),
          percentage_of_salary: percentage_of_salary ? Number(percentage_of_salary) : null,
          base_salary_at_time: employee?.salary ? Number(employee.salary) : null,
          reason: reason?.trim() || null,
          status: 'pending_approval',
          effective_date: effective_date || null,
          payout_date: payout_date || null,
          fiscal_year: fiscal_year || new Date().getFullYear(),
          fiscal_quarter: fiscal_quarter || Math.ceil((new Date().getMonth() + 1) / 3),
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating bonus:', insertError)
        return NextResponse.json({ error: 'Failed to create bonus' }, { status: 500 })
      }

      return NextResponse.json({ bonus }, { status: 201 })
    }

    // Update bonus status
    if (action === 'update_bonus') {
      const { bonus_id, status: newStatus, comment } = body
      if (!bonus_id) {
        return NextResponse.json({ error: 'Bonus ID is required' }, { status: 400 })
      }

      const VALID_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'paid']
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        draft: ['pending_approval'],
        pending_approval: ['approved', 'rejected'],
        approved: ['scheduled', 'paid'],
        scheduled: ['paid'],
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (newStatus) {
        if (!VALID_STATUSES.includes(newStatus)) {
          return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 })
        }

        // Fetch current status to validate transition
        const { data: currentBonus } = await supabase
          .from('bonuses')
          .select('status')
          .eq('id', bonus_id)
          .eq('org_id', orgId)
          .single()

        if (!currentBonus) {
          return NextResponse.json({ error: 'Bonus not found' }, { status: 404 })
        }

        const allowed = ALLOWED_TRANSITIONS[currentBonus.status] ?? []
        if (!allowed.includes(newStatus)) {
          return NextResponse.json({ error: `Cannot transition from ${currentBonus.status} to ${newStatus}` }, { status: 400 })
        }

        updateData.status = newStatus
        if (newStatus === 'approved') updateData.approved_at = new Date().toISOString()
        if (newStatus === 'paid') updateData.paid_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('bonuses')
        .update(updateData)
        .eq('id', bonus_id)
        .eq('org_id', orgId)

      if (updateError) {
        console.error('Error updating bonus:', updateError)
        return NextResponse.json({ error: 'Failed to update bonus' }, { status: 500 })
      }

      // Record approval/rejection with comment in audit trail
      if (newStatus && (newStatus === 'approved' || newStatus === 'rejected') && comment) {
        // Find an employee record for the current user to use as approver
        const { data: approverEmp } = await supabase
          .from('employees')
          .select('id')
          .eq('org_id', orgId)
          .eq('email', user!.email ?? '')
          .limit(1)
          .single()

        if (approverEmp) {
          await supabase.from('bonus_approvals').insert({
            bonus_id,
            approver_id: approverEmp.id,
            approver_role: 'hr',
            status: newStatus === 'approved' ? 'approved' : 'rejected',
            comments: comment.trim(),
            decided_at: new Date().toISOString(),
          } as any)
        }
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Bonus reviews POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
