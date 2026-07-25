-- SUPERSEDED -- do not run. The Sales app's database was later merged into
-- MBT Project Pipeline's Supabase project (see the "add_sales_app_tables"
-- migration applied directly there). That migration creates `accounts` with
-- this same team-shared RLS baked in from the start, against Pipeline's
-- user_profiles table. This file targeted the old standalone Sales app
-- project and was never applied -- kept only for history.
--
-- Make Accounts a shared, team-wide address book instead of private-per-user.
-- Today an SE and a BD Engineer working the same customer end up with two
-- separate, mutually invisible Account rows because visibility is limited to
-- created_by = auth.uid(). This opens read access to the whole team so
-- everyone shares one customer file, while keeping edit/delete restricted to
-- the account's creator or a manager (NSM / Commercial AC Head). Insert stays
-- open to any authenticated user (they own what they create).
--
-- Safe to run any time -- purely a policy change, no data or column changes.

DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
CREATE POLICY "Team can view all accounts" ON accounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
CREATE POLICY "Owner or manager can update accounts" ON accounts
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('nsm', 'commercial_ac_head')
    )
  );

DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
CREATE POLICY "Owner or manager can delete accounts" ON accounts
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('nsm', 'commercial_ac_head')
    )
  );
