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

    // OAuth banks (BoA, Chase, Wells, Cap One, Peapack-Gladstone, etc.) redirect
    // the user out to the bank's site and back. Plaid requires:
    //   1) redirect_uri included on linkTokenCreate
    //   2) the same URL registered in the Plaid dashboard → Allowed redirect URIs
    // Without both, OAuth banks fail silently and the connection never lands.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    const redirectUri = appUrl ? `${appUrl}/dashboard/settings` : undefined

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Ampliwork Dashboard',
      products: [Products.Transactions],
      // GB not currently enabled on our Plaid account — request product access in the Plaid
      // dashboard if we add UK banking. Wise's US account connects through US anyway.
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
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
