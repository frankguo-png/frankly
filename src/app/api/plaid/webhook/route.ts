import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { syncPlaidTransactions } from '@/lib/plaid/sync'

// TODO: Add Plaid webhook verification for production
// See: https://plaid.com/docs/api/webhooks/webhook-verification/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { webhook_type, webhook_code, item_id } = body

    const supabase = await createServerSupabaseClient()

    if (webhook_type === 'TRANSACTIONS') {
      // Find the bank account(s) associated with this Plaid item
      const { data: bankAccounts, error } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('plaid_item_id', item_id)

      if (error) {
        console.error('Error finding bank accounts for webhook:', error)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Trigger sync for all accounts under this item
      for (const account of bankAccounts) {
        await syncPlaidTransactions(account.id)
      }
    }

    if (webhook_type === 'ITEM') {
      // Update connection status on error
      if (webhook_code === 'ERROR') {
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update({ connection_status: 'error' })
          .eq('plaid_item_id', item_id)

        if (updateError) {
          console.error('Error updating connection status:', updateError)
        }
      }

      if (webhook_code === 'PENDING_EXPIRATION') {
        // Mark as error since our schema only supports active/error/disconnected
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update({ connection_status: 'error' })
          .eq('plaid_item_id', item_id)

        if (updateError) {
          console.error('Error updating connection status:', updateError)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
