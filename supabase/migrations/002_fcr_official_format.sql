-- Adds the fields needed to match the official Concepcion Midea Inc.
-- Field Contact Report paper forms (MBT Sales / BD). Purely additive --
-- no existing columns are changed or removed, so this is safe to run
-- even if there are already FCR rows in the table.

ALTER TABLE fcrs
  ADD COLUMN IF NOT EXISTS team_type TEXT CHECK (team_type IN ('mbt_sales', 'business_development')),
  ADD COLUMN IF NOT EXISTS customer_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coverage_notes TEXT,
  ADD COLUMN IF NOT EXISTS customer_signature_name TEXT;
