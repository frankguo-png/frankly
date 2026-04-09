import { NextResponse } from 'next/server'
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

    const orgId = userOrg.org_id

    // Fetch all payroll allocations (active)
    const { data: activeEmployees, error: empError } = await supabase
      .from('payroll_allocations')
      .select('*')
      .eq('org_id', orgId)
      .is('end_date', null)
      .order('department', { ascending: true })
      .order('employee_name', { ascending: true })

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

    const emps = activeEmployees ?? []
    const totalSpend = (transactions ?? []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    // Summary
    const totalMonthlyPayroll = emps.reduce((sum, e) => sum + getMonthlyCost(e), 0)
    const employeeCount = emps.length
    const avgSalary = employeeCount > 0
      ? emps.reduce((sum, e) => sum + (e.annual_salary ?? (e.hourly_rate ? e.hourly_rate * (e.hours_per_week ?? 40) * 52 : 0)), 0) / employeeCount
      : 0
    const payrollPctOfSpend = totalSpend > 0 ? (totalMonthlyPayroll / (totalSpend / 12)) * 100 : 0

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
      const type = emp.employment_type ?? 'unknown'
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

      return {
        id: emp.id,
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        department: emp.department,
        employment_type: emp.employment_type,
        annual_salary: emp.annual_salary,
        hourly_rate: emp.hourly_rate,
        hours_per_week: emp.hours_per_week,
        monthly_cost: getMonthlyCost(emp),
        projects,
        effective_date: emp.effective_date,
      }
    })

    return NextResponse.json({
      summary: {
        totalMonthlyPayroll,
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
