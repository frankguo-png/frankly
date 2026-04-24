import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface OrgChartNode {
  id: string
  name: string
  title: string | null
  department: string | null
  avatar_url: string | null
  location_type: string | null
  is_manager: boolean
  children: OrgChartNode[]
}

export interface DepartmentSummary {
  department: string
  headcount: number
  totalCost: number
}

export interface OrgChartResponse {
  tree: OrgChartNode[]
  departments: DepartmentSummary[]
  totalEmployees: number
  totalDepartments: number
  newThisMonth: number
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

    // Fetch all active employees
    let empQuery = supabase
      .from('employees')
      .select('id, name, title, department, manager_id, avatar_url, salary, start_date, location_type, is_manager')
      .eq('org_id', orgId)
      .eq('status', 'active')
    if (entityId) empQuery = empQuery.eq('entity_id', entityId)
    const { data: employees, error: empError } = await empQuery

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 })
    }

    const emps = employees ?? []

    // Build tree structure from manager_id relationships
    const empMap = new Map<string, OrgChartNode>()
    for (const emp of emps) {
      empMap.set(emp.id, {
        id: emp.id,
        name: emp.name,
        title: emp.title,
        department: emp.department,
        avatar_url: emp.avatar_url,
        location_type: emp.location_type,
        is_manager: emp.is_manager,
        children: [],
      })
    }

    const roots: OrgChartNode[] = []
    for (const emp of emps) {
      const node = empMap.get(emp.id)!
      if (emp.manager_id && empMap.has(emp.manager_id)) {
        empMap.get(emp.manager_id)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    // Build department summaries
    const deptMap = new Map<string, { headcount: number; totalCost: number }>()
    for (const emp of emps) {
      const dept = emp.department || 'Unassigned'
      const existing = deptMap.get(dept) ?? { headcount: 0, totalCost: 0 }
      existing.headcount += 1
      existing.totalCost += emp.salary ? Number(emp.salary) : 0
      deptMap.set(dept, existing)
    }

    const departments: DepartmentSummary[] = Array.from(deptMap.entries())
      .map(([department, data]) => ({ department, ...data }))
      .sort((a, b) => b.headcount - a.headcount)

    // Count new this month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const newThisMonth = emps.filter(
      (e) => e.start_date && e.start_date >= monthStart
    ).length

    const response: OrgChartResponse = {
      tree: roots,
      departments,
      totalEmployees: emps.length,
      totalDepartments: deptMap.size,
      newThisMonth,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Org chart API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
