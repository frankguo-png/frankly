import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBudgetVsActual } from '@/lib/kpi/budget'

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
    const month = searchParams.get('month')

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month parameter. Use YYYY-MM format.' },
        { status: 400 }
      )
    }

    // Fetch raw budget records for the management table
    const { data: budgets, error: budgetsError } = await supabase
      .from('budgets')
      .select('*')
      .eq('org_id', orgId)
      .eq('effective_month', month)
      .order('monthly_amount', { ascending: false })

    if (budgetsError) {
      throw new Error(`Failed to fetch budgets: ${budgetsError.message}`)
    }

    // Also fetch the budget vs actual comparison
    const comparison = await getBudgetVsActual(orgId, month)

    return NextResponse.json({ budgets: budgets ?? [], comparison })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budgets' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgId = userOrg.org_id
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Budget id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) {
      throw new Error(`Failed to delete budget: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return NextResponse.json(
      { error: 'Failed to delete budget' },
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
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgId = userOrg.org_id
    const body = await request.json()
    const { id, category, department, project, monthly_amount, effective_month } = body

    if (!monthly_amount || !effective_month) {
      return NextResponse.json(
        { error: 'monthly_amount and effective_month are required' },
        { status: 400 }
      )
    }

    if (id) {
      // Update existing budget
      const { data, error } = await supabase
        .from('budgets')
        .update({
          category: category ?? null,
          department: department ?? null,
          project: project ?? null,
          monthly_amount,
          effective_month,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update budget: ${error.message}`)
      }

      return NextResponse.json({ budget: data })
    } else {
      // Insert new budget
      const { data, error } = await supabase
        .from('budgets')
        .insert({
          org_id: orgId,
          category: category ?? null,
          department: department ?? null,
          project: project ?? null,
          monthly_amount,
          effective_month,
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create budget: ${error.message}`)
      }

      return NextResponse.json({ budget: data }, { status: 201 })
    }
  } catch (error) {
    console.error('Error saving budget:', error)
    return NextResponse.json(
      { error: 'Failed to save budget' },
      { status: 500 }
    )
  }
}
