-- Add hourly rate fields for interns and hourly workers
ALTER TABLE payroll_allocations ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);
ALTER TABLE payroll_allocations ADD COLUMN IF NOT EXISTS hours_per_week INTEGER DEFAULT 40;
