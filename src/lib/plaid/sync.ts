import { plaidClient } from './client'
import { mapPlaidTransaction } from './mappers'
import { createServiceClient } from '@/lib/supabase/server'

export async function syncPlaidTransactions(bankAccountId: string) {
  const supabase = createServiceClient()

  // Get bank account to read plaid_access_token, plaid_cursor, and org_id
  const { data: bankAccount, error: bankError } = await supabase
    .from('bank_accounts')
    .select('org_id, plaid_access_token, plaid_cursor, plaid_account_id, entity_id')
    .eq('id', bankAccountId)
    .single()

  if (bankError || !bankAccount?.plaid_access_token) {
    throw new Error(`Bank account not found or missing access token: ${bankError?.message}`)
  }

  const orgId = bankAccount.org_id
  const entityId = bankAccount.entity_id ?? null

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_log')
    .insert({
      org_id: orgId,
      source: 'plaid',
      sync_type: 'transactions',
      status: 'running',
    })
    .select('id')
    .single()

  if (syncLogError) {
    throw new Error(`Failed to create sync log: ${syncLogError.message}`)
  }

  let cursor = bankAccount.plaid_cursor || undefined
  let hasMore = true
  let totalFetched = 0
  let totalCreated = 0
  let totalUpdated = 0

  try {
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: bankAccount.plaid_access_token,
        cursor: cursor,
      })

      const { added, modified, removed, has_more, next_cursor, accounts } = response.data

      // Process added transactions
      if (added.length > 0) {
        const mappedTransactions = added.map((txn) =>
          mapPlaidTransaction(txn, orgId, bankAccountId, entityId)
        )

        const { error: upsertError } = await supabase
          .from('transactions')
          .upsert(mappedTransactions, {
            onConflict: 'org_id,source,source_transaction_id',
            ignoreDuplicates: false,
          })

        if (upsertError) {
          console.error('Error upserting added transactions:', upsertError)
        } else {
          totalCreated += added.length
        }
      }

      // Process modified transactions
      if (modified.length > 0) {
        for (const txn of modified) {
          const mapped = mapPlaidTransaction(txn, orgId, bankAccountId, entityId)
          const { error: updateError } = await supabase
            .from('transactions')
            .update(mapped)
            .eq('org_id', orgId)
            .eq('source', 'plaid')
            .eq('source_transaction_id', txn.transaction_id)

          if (updateError) {
            console.error('Error updating modified transaction:', updateError)
          } else {
            totalUpdated += 1
          }
        }
      }

      // Process removed transactions
      if (removed.length > 0) {
        const removedIds = removed.map((r) => r.transaction_id)

        const { error: removeError } = await supabase
          .from('transactions')
          .update({ is_duplicate: true })
          .eq('org_id', orgId)
          .eq('source', 'plaid')
          .in('source_transaction_id', removedIds)

        if (removeError) {
          console.error('Error marking removed transactions:', removeError)
        }
      }

      totalFetched += added.length + modified.length + removed.length

      // Update balance from accounts response
      if (accounts && accounts.length > 0) {
        const matchingAccount = accounts.find(
          (a) => a.account_id === bankAccount.plaid_account_id
        )
        if (matchingAccount) {
          await supabase
            .from('bank_accounts')
            .update({
              current_balance: matchingAccount.balances.current,
              available_balance: matchingAccount.balances.available,
            })
            .eq('id', bankAccountId)
        }
      }

      cursor = next_cursor
      hasMore = has_more
    }

    // Update plaid_cursor and last_synced_at on bank_accounts
    await supabase
      .from('bank_accounts')
      .update({
        plaid_cursor: cursor,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', bankAccountId)

    // Update sync log as completed
    await supabase
      .from('sync_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_fetched: totalFetched,
        records_created: totalCreated,
        records_updated: totalUpdated,
      })
      .eq('id', syncLog.id)

    return {
      fetched: totalFetched,
      created: totalCreated,
      updated: totalUpdated,
    }
  } catch (error) {
    // Update sync log as failed
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        records_fetched: totalFetched,
        records_created: totalCreated,
        records_updated: totalUpdated,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', syncLog.id)

    throw error
  }
}
