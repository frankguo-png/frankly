import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/qbo/client'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate random state for CSRF protection
    const state = crypto.randomUUID()

    // Store state in a cookie for validation in the callback
    const cookieStore = await cookies()
    cookieStore.set('qbo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    const authUrl = getAuthorizationUrl(state)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('QBO auth error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate QBO authentication' },
      { status: 500 }
    )
  }
}
