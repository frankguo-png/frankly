import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { findMatches, type TransactionRecord } from '@/lib/reconciliation/matcher'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userOrg) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    const orgId = userOrg.org_id

    const searchParams = request.nextUrl.searchParams
    const months = parseInt(searchParams.get('months') ?? '3', 10)
    const entityId = searchParams.get('entity') || undefined
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    const startStr = startDate.toISOString().split('T')[0]

    // Fetch bank + payroll transactions (Plaid and Rippling sources — what actually hit the bank)
    let bankQuery = supabase
      .from('transactions')
      .select('id, date, amount, vendor, description, category, source')
      .eq('org_id', orgId)
      .in('source', ['plaid', 'rippling'])
      .eq('is_duplicate', false)
      .gte('date', startStr)
      .order('date', { ascending: false })
      .limit(500)
    if (entityId) bankQuery = bankQuery.eq('entity_id', entityId)

    const { data: bankTxs } = await bankQuery

    // Fetch accounting transactions (QBO source — what was recorded in the books)
    let acctQuery = supabase
      .from('transactions')
      .select('id, date, amount, vendor, description, category, source')
      .eq('org_id', orgId)
      .eq('source', 'qbo')
      .eq('is_duplicate', false)
      .gte('date', startStr)
      .order('date', { ascending: false })
      .limit(500)
    if (entityId) acctQuery = acctQuery.eq('entity_id', entityId)

    const { data: acctTxs } = await acctQuery

    // Check for already matched transactions
    const { data: existingMatches } = await supabase
      .from('reconciliation_matches')
      .select('bank_tx_id, accounting_tx_id, status')
      .eq('org_id', orgId)
      .eq('status', 'matched')

    const matchedBankIds = new Set((existingMatches ?? []).map(m => m.bank_tx_id))
    const matchedAcctIds = new Set((existingMatches ?? []).map(m => m.accounting_tx_id))
    const dismissedIds = new Set(
      (await supabase
        .from('reconciliation_matches')
        .select('bank_tx_id, accounting_tx_id')
        .eq('org_id', orgId)
        .eq('status', 'dismissed')
      ).data?.flatMap(m => [m.bank_tx_id, m.accounting_tx_id].filter(Boolean)) ?? []
    )

    // Filter out already matched/dismissed transactions
    const unmatchedBankTxs: TransactionRecord[] = (bankTxs ?? [])
      .filter(tx => !matchedBankIds.has(tx.id) && !dismissedIds.has(tx.id))
      .map(tx => ({ id: tx.id, date: tx.date, amount: tx.amount, vendor: tx.vendor, description: tx.description, category: tx.category, source: tx.source }))

    const unmatchedAcctTxs: TransactionRecord[] = (acctTxs ?? [])
      .filter(tx => !matchedAcctIds.has(tx.id) && !dismissedIds.has(tx.id))
      .map(tx => ({ id: tx.id, date: tx.date, amount: tx.amount, vendor: tx.vendor, description: tx.description, category: tx.category, source: tx.source }))

    // Run matching algorithm
    const result = findMatches(unmatchedBankTxs, unmatchedAcctTxs)

    // Include already matched count in summary
    const alreadyMatchedCount = existingMatches?.length ?? 0
    const totalBankTxs = (bankTxs ?? []).length
    const totalAcctTxs = (acctTxs ?? []).length

    return NextResponse.json({
      suggestedMatches: result.matches,
      unmatchedBank: result.unmatchedBank,
      unmatchedAccounting: result.unmatchedAccounting,
      summary: {
        ...result.summary,
        alreadyMatchedCount,
        totalBankTransactions: totalBankTxs,
        totalAccountingTransactions: totalAcctTxs,
        overallMatchRate: (totalBankTxs + totalAcctTxs) > 0
          ? Math.round(((alreadyMatchedCount * 2 + result.matches.length * 2) / (totalBankTxs + totalAcctTxs)) * 100)
          : 0,
      },
    })
  } catch (err) {
    console.error('Reconciliation API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!userOrg) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    const orgId = userOrg.org_id

    const body = await request.json()
    const { action } = body

    if (action === 'confirm_match') {
      const { bank_tx_id, accounting_tx_id, confidence } = body
      if (!bank_tx_id || !accounting_tx_id) {
        return NextResponse.json({ error: 'Both transaction IDs required' }, { status: 400 })
      }

      await supabase.from('reconciliation_matches').insert({
        org_id: orgId,
        bank_tx_id,
        accounting_tx_id,
        match_type: 'manual',
        match_confidence: confidence ?? 1.0,
        status: 'matched',
        matched_by: user.id,
      } as any)

      return NextResponse.json({ success: true })
    }

    if (action === 'dismiss') {
      const { bank_tx_id, accounting_tx_id } = body
      await supabase.from('reconciliation_matches').insert({
        org_id: orgId,
        bank_tx_id: bank_tx_id ?? null,
        accounting_tx_id: accounting_tx_id ?? null,
        match_type: 'manual',
        match_confidence: 0,
        status: 'dismissed',
        matched_by: user.id,
      } as any)

      return NextResponse.json({ success: true })
    }

    if (action === 'auto_match_all') {
      // Auto-confirm all suggested matches above 0.7 confidence
      const { matches } = body
      if (!Array.isArray(matches)) {
        return NextResponse.json({ error: 'Matches array required' }, { status: 400 })
      }

      let confirmed = 0
      for (const m of matches) {
        if (m.confidence >= 0.7) {
          await supabase.from('reconciliation_matches').insert({
            org_id: orgId,
            bank_tx_id: m.bankTxId,
            accounting_tx_id: m.accountingTxId,
            match_type: 'auto',
            match_confidence: m.confidence,
            status: 'matched',
            matched_by: user.id,
          } as any)
          confirmed++
        }
      }

      return NextResponse.json({ success: true, confirmed })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Reconciliation POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
