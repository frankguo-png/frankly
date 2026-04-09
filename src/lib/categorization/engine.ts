import { createServiceClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']
type CategoryRule = Database['public']['Tables']['category_rules']['Row']

interface CategorizationResult {
  total_uncategorized: number
  total_categorized: number
  total_remaining: number
}

interface TransactionUpdate {
  category?: string
  department?: string
  project?: string
  categorization_status: 'rule_matched'
}

/**
 * Categorize a single transaction against a list of rules.
 * Returns the update object if a rule matches, or null if no match.
 */
export function categorizeTransaction(
  transaction: Pick<Transaction, 'vendor' | 'description' | 'amount'>,
  rules: CategoryRule[]
): TransactionUpdate | null {
  for (const rule of rules) {
    const fieldValue = getFieldValue(transaction, rule.match_field)
    if (fieldValue === null) continue

    const matched = matchRule(rule.rule_type, fieldValue, rule.match_value)
    if (!matched) continue

    const update: TransactionUpdate = {
      categorization_status: 'rule_matched',
    }

    if (rule.target_category !== null) {
      update.category = rule.target_category
    }
    if (rule.target_department !== null) {
      update.department = rule.target_department
    }
    if (rule.target_project !== null) {
      update.project = rule.target_project
    }

    return update
  }

  return null
}

/**
 * Categorize all uncategorized, non-duplicate transactions for an organization.
 */
export async function categorizeTransactions(
  orgId: string
): Promise<CategorizationResult> {
  const supabase = createServiceClient()

  // 1. Fetch uncategorized, non-duplicate transactions
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('org_id', orgId)
    .eq('categorization_status', 'uncategorized')
    .eq('is_duplicate', false)

  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`)
  }

  const uncategorized = transactions ?? []
  const totalUncategorized = uncategorized.length

  if (totalUncategorized === 0) {
    return {
      total_uncategorized: 0,
      total_categorized: 0,
      total_remaining: 0,
    }
  }

  // 2. Fetch active category rules, ordered by priority ASC (lower = higher priority)
  const { data: rules, error: rulesError } = await supabase
    .from('category_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (rulesError) {
    throw new Error(`Failed to fetch rules: ${rulesError.message}`)
  }

  if (!rules || rules.length === 0) {
    return {
      total_uncategorized: totalUncategorized,
      total_categorized: 0,
      total_remaining: totalUncategorized,
    }
  }

  // 3. Categorize each transaction and group updates by same category/dept/project
  const batchMap = new Map<string, { update: TransactionUpdate; ids: string[] }>()
  let totalCategorized = 0

  for (const tx of uncategorized) {
    const update = categorizeTransaction(tx, rules)
    if (!update) continue

    totalCategorized++

    // Create a key from the update values for batching
    const batchKey = `${update.category ?? ''}|${update.department ?? ''}|${update.project ?? ''}`

    const existing = batchMap.get(batchKey)
    if (existing) {
      existing.ids.push(tx.id)
    } else {
      batchMap.set(batchKey, { update, ids: [tx.id] })
    }
  }

  // 4. Batch update transactions
  for (const { update, ids } of batchMap.values()) {
    const { error: updateError } = await supabase
      .from('transactions')
      .update(update)
      .in('id', ids)

    if (updateError) {
      console.error(
        `Failed to update batch (${ids.length} transactions):`,
        updateError.message
      )
    }
  }

  return {
    total_uncategorized: totalUncategorized,
    total_categorized: totalCategorized,
    total_remaining: totalUncategorized - totalCategorized,
  }
}

function getFieldValue(
  transaction: Pick<Transaction, 'vendor' | 'description' | 'amount'>,
  matchField: string
): string | null {
  switch (matchField) {
    case 'vendor':
      return transaction.vendor ?? null
    case 'description':
      return transaction.description ?? null
    case 'amount':
      return transaction.amount != null ? String(transaction.amount) : null
    default:
      return null
  }
}

function matchRule(
  ruleType: string,
  fieldValue: string,
  matchValue: string
): boolean {
  switch (ruleType) {
    case 'exact':
      return fieldValue.toLowerCase() === matchValue.toLowerCase()
    case 'contains':
      return fieldValue.toLowerCase().includes(matchValue.toLowerCase())
    case 'regex':
      try {
        return new RegExp(matchValue, 'i').test(fieldValue)
      } catch {
        console.error(`Invalid regex pattern: ${matchValue}`)
        return false
      }
    default:
      return false
  }
}
