import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    const body = await request.json()
    const { alertId } = body

    if (!alertId || typeof alertId !== 'string') {
      return NextResponse.json(
        { error: 'alertId is required' },
        { status: 400 }
      )
    }

    // Alerts are computed on-the-fly, not stored.
    // Dismissals could be persisted in a JSON column or localStorage on the client.
    // For now, return success and let the client handle dismissal state.
    return NextResponse.json({ success: true, alertId })
  } catch (error) {
    console.error('Error dismissing alert:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss alert' },
      { status: 500 }
    )
  }
}
