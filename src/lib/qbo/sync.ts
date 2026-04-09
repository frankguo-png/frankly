import { makeQboRequest } from './client'
import { mapQboPurchase, mapQboBill, mapQboDeposit } from './mappers'
import { createServiceClient } from '@/lib/supabase/server'

function getDateRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 90)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

async function queryQbo(
  connectionId: string,
  entity: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const query = `SELECT * FROM ${entity} WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 1000`
  const encodedQuery = encodeURIComponent(query)

  try {
    const data = await makeQboRequest(
      'GET',
      `query?query=${encodedQuery}`,
      connectionId
    )
    return data.QueryResponse?.[entity] || []
  } catch (error) {
    console.error(`Error fetching ${entity} from QBO:`, error)
    return []
  }
}

export async function syncQboTransactions(connectionId: string) {
  const supabase = createServiceClient()

  // Get connection details
  const { data: connection, error: connError } = await supabase
    .from('qbo_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (connError || !connection) {
    throw new Error(`QBO connection not found: ${connError?.message}`)
  }

  const orgId = connection.org_id

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_log')
    .insert({
      org_id: orgId,
      source: 'qbo',
      sync_type: 'transactions',
      status: 'running',
    })
    .select('id')
    .single()

  if (syncLogError) {
    throw new Error(`Failed to create sync log: ${syncLogError.message}`)
  }

  const { start, end } = getDateRange()
  let totalFetched = 0
  let totalCreated = 0
  let totalUpdated = 0

  try {
    // Fetch all transaction types in parallel
    const [purchases, bills, deposits] = await Promise.all([
      queryQbo(connectionId, 'Purchase', start, end),
      queryQbo(connectionId, 'Bill', start, end),
      queryQbo(connectionId, 'Deposit', start, end),
    ])

    totalFetched = purchases.length + bills.length + deposits.length

    // Map all transactions
    const entityId = connection.entity_id ?? null
    const mappedTransactions = [
      ...purchases.map((p) => mapQboPurchase(p, orgId, entityId)),
      ...bills.map((b) => mapQboBill(b, orgId, entityId)),
      ...deposits.map((d) => mapQboDeposit(d, orgId, entityId)),
    ]

    // Upsert in batches of 100
    const batchSize = 100
    for (let i = 0; i < mappedTransactions.length; i += batchSize) {
      const batch = mappedTransactions.slice(i, i + batchSize)

      const { error: upsertError, count } = await supabase
        .from('transactions')
        .upsert(batch, {
          onConflict: 'org_id,source,source_transaction_id',
          ignoreDuplicates: false,
          count: 'exact',
        })

      if (upsertError) {
        console.error('Error upserting QBO transactions:', upsertError)
      } else {
        totalCreated += count || batch.length
      }
    }

    totalUpdated = 0 // Upsert handles both create and update

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

    // Update last_synced_at on qbo_connections
    await supabase
      .from('qbo_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        connection_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

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

    // Mark connection as errored
    await supabase
      .from('qbo_connections')
      .update({
        connection_status: 'error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    throw error
  }
}
