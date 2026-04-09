import { createServiceClient } from '@/lib/supabase/server'

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI!

const TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2'

function basicAuthHeader(): string {
  const credentials = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')
  return `Basic ${credentials}`
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: QBO_CLIENT_ID,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: QBO_REDIRECT_URI,
    state,
  })
  return `${AUTH_BASE}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  realmId: string
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  realm_id: string
}> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: QBO_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    realm_id: realmId,
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Token refresh failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  }
}

async function getConnectionAndRefreshIfNeeded(connectionId: string) {
  const supabase = createServiceClient()

  const { data: connection, error } = await supabase
    .from('qbo_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !connection) {
    throw new Error(`QBO connection not found: ${error?.message}`)
  }

  const tokenExpiresAt = new Date(connection.token_expires_at)
  const now = new Date()

  // Refresh if token expires within 5 minutes
  if (tokenExpiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const tokens = await refreshAccessToken(connection.refresh_token)

    const newExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString()

    await supabase
      .from('qbo_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    return {
      ...connection,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: newExpiresAt,
    }
  }

  return connection
}

export async function makeQboRequest(
  method: string,
  endpoint: string,
  connectionId: string,
  body?: any
): Promise<any> {
  let connection = await getConnectionAndRefreshIfNeeded(connectionId)

  const url = `${QBO_API_BASE}/${connection.realm_id}/${endpoint}`

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body)
  }

  let response = await fetch(url, fetchOptions)

  // Handle 401 by refreshing and retrying once
  if (response.status === 401) {
    const supabase = createServiceClient()
    const tokens = await refreshAccessToken(connection.refresh_token)

    const newExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString()

    await supabase
      .from('qbo_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    fetchOptions.headers = {
      ...fetchOptions.headers as Record<string, string>,
      'Authorization': `Bearer ${tokens.access_token}`,
    }

    response = await fetch(url, fetchOptions)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`QBO API error (${response.status}): ${errorBody}`)
  }

  return response.json()
}

export async function getCompanyInfo(connectionId: string): Promise<string> {
  try {
    const data = await makeQboRequest('GET', 'companyinfo/' + (await getRealmId(connectionId)), connectionId)
    return data.CompanyInfo?.CompanyName || 'Unknown Company'
  } catch {
    return 'Unknown Company'
  }
}

async function getRealmId(connectionId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('qbo_connections')
    .select('realm_id')
    .eq('id', connectionId)
    .single()
  return data?.realm_id || ''
}
