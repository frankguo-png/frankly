import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/qbo/client'
import { syncQboTransactions } from '@/lib/qbo/sync'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const realmId = searchParams.get('realmId')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      console.error('QBO OAuth error:', errorParam)
      const redirectUrl = new URL('/dashboard/settings', request.url)
      redirectUrl.searchParams.set('qbo_error', errorParam)
      return NextResponse.redirect(redirectUrl)
    }

    if (!code || !state || !realmId) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?qbo_error=missing_params', request.url)
      )
    }

    // Validate state against the cookie
    const cookieStore = await cookies()
    const savedState = cookieStore.get('qbo_oauth_state')?.value

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?qbo_error=invalid_state', request.url)
      )
    }

    // Clear the state cookie
    cookieStore.delete('qbo_oauth_state')

    // Verify user is authenticated
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/login', request.url)
      )
    }

    // Get user's org_id
    const serviceClient = createServiceClient()
    const { data: userOrg, error: orgError } = await serviceClient
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (orgError || !userOrg) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?qbo_error=no_organization', request.url)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, realmId)

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString()

    // Upsert QBO connection (one connection per org per realm)
    const { data: connection, error: upsertError } = await serviceClient
      .from('qbo_connections')
      .upsert(
        {
          org_id: userOrg.org_id,
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          connection_status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'org_id,realm_id',
        }
      )
      .select('id')
      .single()

    if (upsertError) {
      // If upsert with conflict fails (no unique constraint on org_id,realm_id),
      // fall back to checking for existing and inserting/updating
      const { data: existing } = await serviceClient
        .from('qbo_connections')
        .select('id')
        .eq('org_id', userOrg.org_id)
        .eq('realm_id', realmId)
        .single()

      if (existing) {
        await serviceClient
          .from('qbo_connections')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            connection_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        // Trigger initial sync in the background
        syncQboTransactions(existing.id).catch((err) =>
          console.error('Initial QBO sync failed:', err)
        )
      } else {
        const { data: newConn, error: insertError } = await serviceClient
          .from('qbo_connections')
          .insert({
            org_id: userOrg.org_id,
            realm_id: realmId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            connection_status: 'active',
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Failed to save QBO connection:', insertError)
          return NextResponse.redirect(
            new URL('/dashboard/settings?qbo_error=save_failed', request.url)
          )
        }

        if (newConn) {
          syncQboTransactions(newConn.id).catch((err) =>
            console.error('Initial QBO sync failed:', err)
          )
        }
      }
    } else if (connection) {
      // Trigger initial sync in the background
      syncQboTransactions(connection.id).catch((err) =>
        console.error('Initial QBO sync failed:', err)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?qbo_success=connected', request.url)
    )
  } catch (error) {
    console.error('QBO callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/settings?qbo_error=callback_failed', request.url)
    )
  }
}
