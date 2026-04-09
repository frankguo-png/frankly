-- Add invoice/AP document tracking fields to pending_payments
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT CHECK (payment_terms IN ('due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90')),
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;
