import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']

interface DeduplicationResult {
  total_checked: number
  duplicates_found: number
  enriched: number
}

/**
 * Simple word-overlap similarity between two strings.
 * Splits both by whitespace, counts matching tokens / total unique tokens.
 */
export function vendorSimilarity(a: string, b: string): number {
  if (!a || !b) return 0

  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))

  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let matchCount = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      matchCount++
    }
  }

  const totalUnique = new Set([...tokensA, ...tokensB]).size
  return matchCount / totalUnique
}

/**
 * Deduplicate transactions for an organization.
 * When same transaction exists in both Plaid and QBO, keep QBO version
 * (richer metadata) and mark Plaid as duplicate.
 */
export async function deduplicateTransactions(
  orgId: string
): Promise<DeduplicationResult> {
  const supabase = createServiceClient()

  // 1. Fetch all non-duplicate transactions for plaid and qbo
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_duplicate', false)
    .in('source', ['plaid', 'qbo'])

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`)
  }

  if (!transactions || transactions.length === 0) {
    return { total_checked: 0, duplicates_found: 0, enriched: 0 }
  }

  // 2. Group by source
  const plaidTransactions: Transaction[] = []
  const qboTransactions: Transaction[] = []

  for (const tx of transactions) {
    if (tx.source === 'plaid') {
      plaidTransactions.push(tx)
    } else if (tx.source === 'qbo') {
      qboTransactions.push(tx)
    }
  }

  let duplicatesFound = 0
  let enriched = 0

  // 3. For each Plaid transaction, look for a QBO match
  for (const plaidTx of plaidTransactions) {
    const plaidDate = new Date(plaidTx.date)
    const plaidAmount = Math.abs(plaidTx.amount)

    let bestMatch: Transaction | null = null
    let bestSimilarity = 0

    for (const qboTx of qboTransactions) {
      // Check date within +/- 2 days
      const qboDate = new Date(qboTx.date)
      const daysDiff = Math.abs(
        (plaidDate.getTime() - qboDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff > 2) continue

      // Check same absolute amount
      const qboAmount = Math.abs(qboTx.amount)
      if (plaidAmount !== qboAmount) continue

      // Check vendor similarity
      const similarity = vendorSimilarity(
        plaidTx.vendor ?? '',
        qboTx.vendor ?? ''
      )
      if (similarity > 0.6 && similarity > bestSimilarity) {
        bestMatch = qboTx
        bestSimilarity = similarity
      }
    }

    if (!bestMatch) continue

    duplicatesFound++

    // 4a. Mark Plaid transaction as duplicate
    const { error: dupError } = await supabase
      .from('transactions')
      .update({
        is_duplicate: true,
        merged_with: bestMatch.id,
      })
      .eq('id', plaidTx.id)

    if (dupError) {
      console.error(
        `Failed to mark transaction ${plaidTx.id} as duplicate:`,
        dupError.message
      )
      continue
    }

    // 4b. Enrich QBO transaction with any missing data from Plaid
    const enrichUpdates: Record<string, string> = {}

    if (!bestMatch.category && plaidTx.category) {
      enrichUpdates.category = plaidTx.category
    }
    if (!bestMatch.department && plaidTx.department) {
      enrichUpdates.department = plaidTx.department
    }
    if (!bestMatch.project && plaidTx.project) {
      enrichUpdates.project = plaidTx.project
    }

    if (Object.keys(enrichUpdates).length > 0) {
      enriched++
      const { error: enrichError } = await supabase
        .from('transactions')
        .update(enrichUpdates)
        .eq('id', bestMatch.id)

      if (enrichError) {
        console.error(
          `Failed to enrich transaction ${bestMatch.id}:`,
          enrichError.message
        )
      }
    }
  }

  return {
    total_checked: plaidTransactions.length,
    duplicates_found: duplicatesFound,
    enriched,
  }
}
