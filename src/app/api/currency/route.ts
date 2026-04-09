import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  fetchLatestRates,
  convertToUSD,
  type SupportedCurrency,
} from '@/lib/currency/fx-rates'

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

    // Fetch bank accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, account_name, account_type, currency, current_balance, available_balance, connection_status')
      .eq('org_id', orgId)

    if (accountsError) {
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    // Fetch latest FX rates
    const fxRates = await fetchLatestRates()

    // Map accounts with USD conversions
    const accountsWithConversion = (accounts ?? []).map((acct) => {
      const currency = (acct.currency ?? 'USD') as SupportedCurrency
      const balance = acct.current_balance ?? 0
      const usdBalance = convertToUSD(balance, currency, fxRates)

      return {
        id: acct.id,
        bankName: acct.bank_name,
        accountName: acct.account_name,
        accountType: acct.account_type,
        currency,
        nativeBalance: balance,
        usdBalance: Math.round(usdBalance * 100) / 100,
        connectionStatus: acct.connection_status,
      }
    })

    const totalUSD = accountsWithConversion.reduce(
      (sum, a) => sum + a.usdBalance,
      0
    )

    return NextResponse.json({
      rates: fxRates.rates,
      ratesTimestamp: fxRates.timestamp,
      accounts: accountsWithConversion,
      totalUSD: Math.round(totalUSD * 100) / 100,
    })
  } catch (error) {
    console.error('Error in currency API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch currency data' },
      { status: 500 }
    )
  }
}
