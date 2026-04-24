import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

function getMonthlyCost(emp: {
  annual_salary: number | null
  hourly_rate: number | null
  hours_per_week: number | null
}): number {
  if (emp.annual_salary) return emp.annual_salary / 12
  if (emp.hourly_rate) return emp.hourly_rate * (emp.hours_per_week ?? 40) * 52 / 12
  return 0
}

type CompBucket = 'salaried' | 'contractor' | 'hourly'

// How to count someone's comp for reporting purposes.
// - salaried: full_time / part_time — predictable recurring monthly payroll
// - contractor: variable, engagement-based; not monthly payroll
// - hourly: hourly + intern — paid by the hour, not salary
function compBucket(type: string | null | undefined): CompBucket {
  if (type === 'contractor') return 'contractor'
  if (type === 'hourly' || type === 'intern') return 'hourly'
  return 'salaried'
}

// Rippling's `employment_type` is occasionally mis-classified (e.g. interns
// tagged as FULL_TIME at onboarding). Fall back to a title-based override so
// downstream bucketing and badges match reality.
function effectiveEmploymentType(
  type: string | null | undefined,
  title: string | null | undefined
): string | null {
  if (type === 'intern') return 'intern'
  if (title && /\bintern\b/i.test(title)) return 'intern'
  return type ?? null
}

function getAllocationsFromJson(json: Json): Record<string, number> {
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    const result: Record<string, number> = {}
    for (const [key, val] of Object.entries(json)) {
      if (typeof val === 'number') {
        result[key] = val
      }
    }
    return result
  }
  return {}
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const entityId = request.nextUrl.searchParams.get('entityId')
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

    // Fetch all payroll allocations (active)
    let activeQuery = supabase
      .from('payroll_allocations')
      .select('*')
      .eq('org_id', orgId)
      .is('end_date', null)
      .order('department', { ascending: true })
      .order('employee_name', { ascending: true })
    if (entityId) activeQuery = activeQuery.eq('entity_id', entityId)
    const { data: activeEmployees, error: empError } = await activeQuery

    if (empError) {
      return NextResponse.json(
        { error: 'Failed to fetch payroll data', details: empError.message },
        { status: 500 }
      )
    }

    // Fetch all payroll allocations (including historical for trend)
    const { data: allEmployees } = await supabase
      .from('payroll_allocations')
      .select('employee_id, employee_name, annual_salary, hourly_rate, hours_per_week, department, employment_type, effective_date, end_date')
      .eq('org_id', orgId)
      .order('effective_date', { ascending: true })

    // Fetch total spend for payroll % calculation
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('org_id', orgId)
      .eq('is_duplicate', false)
      .lt('amount', 0)

    // Fetch titles + location + country + salary change date + entity + bonus flags
    // (employees joined by rippling_id = payroll_allocations.employee_id).
    const { data: employeesData } = await supabase
      .from('employees')
      .select('id, rippling_id, title, location_type, country, salary_effective_date, entity_id')
      .eq('org_id', orgId)
      .not('rippling_id', 'is', null)

    const titleByRipplingId = new Map<string, string | null>()
    const locationByRipplingId = new Map<string, string | null>()
    const countryByRipplingId = new Map<string, string | null>()
    const salaryDateByRipplingId = new Map<string, string | null>()
    const entityByRipplingId = new Map<string, string | null>()
    const employeeUuidToRipplingId = new Map<string, string>()
    for (const e of (employeesData ?? [])) {
      if (e.rippling_id) {
        titleByRipplingId.set(e.rippling_id, e.title ?? null)
        locationByRipplingId.set(e.rippling_id, e.location_type ?? null)
        countryByRipplingId.set(e.rippling_id, e.country ?? null)
        salaryDateByRipplingId.set(e.rippling_id, e.salary_effective_date ?? null)
        entityByRipplingId.set(e.rippling_id, e.entity_id ?? null)
        employeeUuidToRipplingId.set(e.id, e.rippling_id)
      }
    }

    // Bonuses in an active state — use as "has bonus" indicator in the roster.
    const { data: bonusesData } = await supabase
      .from('bonuses')
      .select('employee_id, amount, status')
      .eq('org_id', orgId)
      .in('status', ['pending_approval', 'approved', 'scheduled'])

    const bonusByRipplingId = new Map<string, { count: number; total: number }>()
    for (const b of (bonusesData ?? [])) {
      const rid = employeeUuidToRipplingId.get(b.employee_id)
      if (!rid) continue
      const entry = bonusByRipplingId.get(rid) ?? { count: 0, total: 0 }
      entry.count += 1
      entry.total += Number(b.amount ?? 0)
      bonusByRipplingId.set(rid, entry)
    }

    const emps = activeEmployees ?? []
    const totalSpend = (transactions ?? []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    // Summary — split by comp bucket so salaried payroll isn't inflated by
    // contractors (engagement-based) or hourly/interns (hours-based).
    let salariedMonthlyPayroll = 0
    let contractorMonthlyCost = 0
    let hourlyMonthlyCost = 0
    let salariedCount = 0
    let contractorCount = 0
    let hourlyCount = 0
    let salariedAnnualTotal = 0
    for (const e of emps) {
      const cost = getMonthlyCost(e)
      const effType = effectiveEmploymentType(
        e.employment_type,
        titleByRipplingId.get(e.employee_id) ?? null
      )
      const bucket = compBucket(effType)
      if (bucket === 'salaried') {
        salariedMonthlyPayroll += cost
        salariedCount += 1
        salariedAnnualTotal += e.annual_salary ?? 0
      } else if (bucket === 'contractor') {
        contractorMonthlyCost += cost
        contractorCount += 1
      } else {
        hourlyMonthlyCost += cost
        hourlyCount += 1
      }
    }
    const totalMonthlyCost = salariedMonthlyPayroll + contractorMonthlyCost + hourlyMonthlyCost
    const employeeCount = emps.length
    const avgSalary = salariedCount > 0 ? salariedAnnualTotal / salariedCount : 0
    const payrollPctOfSpend = totalSpend > 0 ? (totalMonthlyCost / (totalSpend / 12)) * 100 : 0

    // Department breakdown
    const departmentMap: Record<string, { cost: number; count: number }> = {}
    for (const emp of emps) {
      const dept = emp.department ?? 'Uncategorized'
      if (!departmentMap[dept]) departmentMap[dept] = { cost: 0, count: 0 }
      departmentMap[dept].cost += getMonthlyCost(emp)
      departmentMap[dept].count += 1
    }
    const departmentBreakdown = Object.entries(departmentMap)
      .map(([department, data]) => ({ department, ...data }))
      .sort((a, b) => b.cost - a.cost)

    // Employment type breakdown
    const typeMap: Record<string, { cost: number; count: number }> = {}
    for (const emp of emps) {
      const type = effectiveEmploymentType(
        emp.employment_type,
        titleByRipplingId.get(emp.employee_id) ?? null
      ) ?? 'unknown'
      if (!typeMap[type]) typeMap[type] = { cost: 0, count: 0 }
      typeMap[type].cost += getMonthlyCost(emp)
      typeMap[type].count += 1
    }
    const employmentTypeBreakdown = Object.entries(typeMap)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.cost - a.cost)

    // Payroll trend - compute from effective_date
    // Build monthly snapshots for last 6 months
    const now = new Date()
    const monthlyTrend: { month: string; cost: number; headcount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      // Find employees who were active during this month
      let monthCost = 0
      let headcount = 0
      for (const emp of (allEmployees ?? [])) {
        const effDate = new Date(emp.effective_date)
        const endDate = emp.end_date ? new Date(emp.end_date) : null

        // Employee was active if effective_date <= monthEnd and (end_date is null or end_date >= monthStart)
        if (effDate <= monthEnd && (!endDate || endDate >= date)) {
          monthCost += getMonthlyCost(emp)
          headcount += 1
        }
      }

      monthlyTrend.push({ month: monthLabel, cost: Math.round(monthCost * 100) / 100, headcount })
    }

    // Employees with project info for the roster table
    const roster = emps.map((emp) => {
      const allocs = getAllocationsFromJson(emp.project_allocations)
      const projects = Object.entries(allocs)
        .filter(([, pct]) => pct > 0)
        .map(([name, pct]) => `${name} (${pct}%)`)

      const title = titleByRipplingId.get(emp.employee_id) ?? null
      const effType = effectiveEmploymentType(emp.employment_type, title)
      const bonus = bonusByRipplingId.get(emp.employee_id) ?? null
      return {
        id: emp.id,
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        title,
        location_type: locationByRipplingId.get(emp.employee_id) ?? null,
        country: countryByRipplingId.get(emp.employee_id) ?? null,
        salary_effective_date: salaryDateByRipplingId.get(emp.employee_id) ?? null,
        entity_id: entityByRipplingId.get(emp.employee_id) ?? emp.entity_id ?? null,
        department: emp.department,
        employment_type: effType,
        annual_salary: emp.annual_salary,
        hourly_rate: emp.hourly_rate,
        hours_per_week: emp.hours_per_week,
        monthly_cost: getMonthlyCost(emp),
        projects,
        effective_date: emp.effective_date,
        pending_bonus_count: bonus?.count ?? 0,
        pending_bonus_total: bonus?.total ?? 0,
      }
    })

    return NextResponse.json({
      summary: {
        salariedMonthlyPayroll,
        contractorMonthlyCost,
        hourlyMonthlyCost,
        totalMonthlyCost,
        salariedCount,
        contractorCount,
        hourlyCount,
        employeeCount,
        avgSalary,
        payrollPctOfSpend,
      },
      departmentBreakdown,
      employmentTypeBreakdown,
      monthlyTrend,
      roster,
      orgId,
    })
  } catch (err) {
    console.error('Payroll API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
