import { startOfMonth, endOfMonth, format } from 'date-fns'
import { supabase } from './supabase'

// MCP (Actual) is built from FCRs the account has acknowledged -- that's
// the only signal we trust that a visit really happened as described. Each
// acknowledged FCR becomes one "visit" in the same shape MonthCalendar and
// the MCP week-grid helpers (mcpWeeks.js) already expect for MCP (Plan),
// so both screens can reuse all of that existing rendering code untouched.
export const fetchAcknowledgedVisits = async ({ userId, month }) => {
  const monthDate = typeof month === 'string' ? new Date(month) : month
  const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const end = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('fcrs')
    .select('id, account_id, visit_date, period')
    .eq('created_by', userId)
    .eq('ack_status', 'acknowledged')
    .gte('visit_date', start)
    .lte('visit_date', end)
    .order('visit_date')

  if (error) throw error

  return (data || [])
    .filter(f => f.visit_date && f.account_id)
    .map(f => ({
      id: f.id,
      account_id: f.account_id,
      visit_date: f.visit_date,
      period: f.period === 'PM' ? 'PM' : 'AM',
    }))
}

// Per-day free-text notes for days that don't have their own FCR -- leaves,
// site visits with no formal report, out-of-office, etc. One row per
// (user, date); an empty note deletes the row rather than leaving clutter.
export const fetchDailyNotes = async ({ userId, month }) => {
  const monthDate = typeof month === 'string' ? new Date(month) : month
  const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const end = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('mcp_daily_notes')
    .select('note_date, note')
    .eq('user_id', userId)
    .gte('note_date', start)
    .lte('note_date', end)

  if (error) throw error

  const byDate = {}
  ;(data || []).forEach(row => { byDate[row.note_date] = row.note || '' })
  return byDate
}

export const saveDailyNote = async ({ userId, date, note }) => {
  const trimmed = (note || '').trim()
  if (!trimmed) {
    const { error } = await supabase
      .from('mcp_daily_notes')
      .delete()
      .eq('user_id', userId)
      .eq('note_date', date)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('mcp_daily_notes')
    .upsert(
      { user_id: userId, note_date: date, note: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,note_date' }
    )
  if (error) throw error
}

// A stable, self-contained snapshot for the MCP Archive -- doesn't rely on
// the accounts table or the underlying FCRs still existing/matching later.
export const buildMcpActualSnapshot = ({ month, visits, accounts, submitterName, dailyNotes = {} }) => {
  const accountsById = {}
  visits.forEach(v => {
    const acc = accounts.find(a => a.id === v.account_id)
    accountsById[v.account_id] = { company_name: acc?.company_name || 'Unknown account' }
  })
  return {
    month: typeof month === 'string' ? month : format(month, 'yyyy-MM-dd'),
    visits,
    accountsById,
    dailyNotes,
    submitterName: submitterName || '',
    generatedAt: new Date().toISOString(),
  }
}

// Reconstructs the {accounts} shape mcpWeeks.js/downloadMCPPdf expect from
// an archived snapshot's accountsById map.
export const accountsFromSnapshot = (snapshot) =>
  Object.entries(snapshot.accountsById || {}).map(([id, v]) => ({ id, company_name: v.company_name }))
