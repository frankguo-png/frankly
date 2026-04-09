export function mapPlaidTransaction(txn: any, orgId: string, bankAccountId: string, entityId: string | null = null) {
  return {
    org_id: orgId,
    entity_id: entityId,
    bank_account_id: bankAccountId,
    date: txn.authorized_date || txn.date,
    amount: -txn.amount, // Plaid: positive = outflow, we want: negative = outflow
    currency: txn.iso_currency_code || 'USD',
    description: txn.name,
    vendor: txn.merchant_name || txn.name,
    source: 'plaid' as const,
    source_transaction_id: txn.transaction_id,
    is_transfer: txn.transaction_type === 'transfer' || false,
    metadata: {
      plaid_category: txn.personal_finance_category,
      payment_channel: txn.payment_channel,
      pending: txn.pending,
    },
  }
}
