-- SUPERSEDED -- do not run. The Sales app's database was later merged into
-- MBT Project Pipeline's Supabase project (see the "add_sales_app_tables"
-- migration applied directly there). That migration creates
-- `accounts_pipeline_links` with a *real* foreign key to `projects(id)`
-- (both tables now live in the same database), which is strictly better
-- than the text-id-only version below. This file targeted the old
-- standalone Sales app project and was never applied -- kept only for
-- history.
--
-- Links a Sales-app Account to one or more MBT Project Pipeline project
-- inquiries, so reps can see related Pipeline activity for that customer
-- during a field visit or meeting. Pipeline is a separate Supabase project
-- (no live database connection between the two), so pipeline_project_id is
-- just the text id copied over from a search result -- there's no real
-- foreign key across projects, only a soft reference.
--
-- pipeline_data caches the curated fields returned by the search at the
-- moment a project was linked (name, status, date, total, brands, delivery,
-- assigned SE/BD person, etc.) so the Account page can show something useful
-- without calling back out to Pipeline on every page load. It can go stale;
-- unlink and re-link (or re-run the search) to refresh it.
--
-- Safe to run any time -- purely additive, no existing tables touched.

CREATE TABLE IF NOT EXISTS accounts_pipeline_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  pipeline_project_id TEXT NOT NULL,
  pipeline_project_name TEXT,
  pipeline_data JSONB DEFAULT '{}'::jsonb,
  linked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (account_id, pipeline_project_id)
);

ALTER TABLE accounts_pipeline_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view pipeline links" ON accounts_pipeline_links
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can link pipeline projects" ON accounts_pipeline_links
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Linker or manager can remove pipeline links" ON accounts_pipeline_links
  FOR DELETE USING (
    linked_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('nsm', 'commercial_ac_head')
    )
  );

CREATE INDEX IF NOT EXISTS idx_accounts_pipeline_links_account_id ON accounts_pipeline_links(account_id);
