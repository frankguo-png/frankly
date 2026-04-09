import { NextRequest, NextResponse } from 'next/server'
import { Products, CountryCode } from 'plaid'
import { plaidClient } from '@/lib/plaid/client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Ampliwork Dashboard',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (error) {
    console.error('Error creating link token:', error)
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    )
  }
}
