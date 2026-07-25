// The Sales app and MBT Project Pipeline now share one Supabase project
// (see src/lib/supabase.js), so the search-account-projects Edge Function
// is just invoked on the same client -- no separate project/key needed.
import { supabase } from './supabase'

// The MBT Project Pipeline web app. It's a single-page dashboard (Dashboard /
// Pipeline / OKR / Approvals / Price List / Users as in-page tabs, projects
// opened via a row-click modal) rather than a router with per-project URLs --
// there's no /projects/:id-style address to link straight to a specific
// project. So this points at the Pipeline table view; the SE still needs to
// search/scroll to the right row once there. Update this if the Pipeline app
// ever adds a deep-linkable project view (e.g. a ?project=<id> param it
// auto-opens on load).
const PIPELINE_APP_URL = 'https://mbt-pipeline.netlify.app/'

export const pipelineProjectUrl = () => {
  return PIPELINE_APP_URL
}

// Search MBT Project Pipeline for project inquiries whose dealer / end-user /
// developer / consultant / general contractor / distributor field matches
// the given company name (case-insensitive, partial match). Throws on error.
export const searchPipelineProjects = async (query) => {
  if (!query || query.trim().length < 3) return []
  const { data, error } = await supabase.functions.invoke('search-account-projects', {
    body: { query: query.trim() },
  })
  if (error) throw error
  return data?.results || []
}
