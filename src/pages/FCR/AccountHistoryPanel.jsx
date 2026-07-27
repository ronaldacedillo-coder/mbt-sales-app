import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { buildDiscussionSuggestions } from '../../lib/fcrSuggestions'
import { EditableTable } from '../../components/EditableTable'
import { format, parseISO } from 'date-fns'
import { History, ChevronLeft, ChevronRight, Lightbulb, Loader2 } from 'lucide-react'

const projectColumns = [
  { key: 'project_name_owner', label: 'Project / Owner' },
  { key: 'address', label: 'Address' },
  { key: 'amount', label: 'Amount' },
  { key: 'rollout', label: 'Rollout' },
  { key: 'rep', label: 'Rep' },
  { key: 'status', label: 'Status' },
  { key: 'next_steps', label: 'Next Steps' },
]

const competitiveColumns = [
  { key: 'brand', label: 'Brand' },
  { key: 'initiative', label: 'Initiative' },
  { key: 'duration', label: 'Duration' },
  { key: 'mechanics', label: 'Mechanics' },
  { key: 'notes', label: 'Notes' },
]

const StatusPill = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    red: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tones[tone]}`}>{children}</span>
}

// Shows this account's own past FCRs (paginated, one visit at a time) plus a
// rule-based "Suggested Discussion Points" summary built from all of them.
// Excludes the FCR currently being edited via excludeFcrId. RLS already
// scopes the query to FCRs the current user can see (their own, or their
// direct reports' if they're the approver), so this naturally reads as
// "your visit history with this account."
export const AccountHistoryPanel = ({ accountId, excludeFcrId, teamType }) => {
  const [fcrs, setFcrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (accountId) fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const fetchHistory = async () => {
    setLoading(true)
    setError('')
    setPage(0)
    try {
      let query = supabase
        .from('fcrs')
        .select('id, visit_date, period, status, ack_status, attendee_name, attendee_designation, coverage_notes, form_data, team_type')
        .eq('account_id', accountId)
        .order('visit_date', { ascending: false })
        .limit(12)
      if (excludeFcrId) query = query.neq('id', excludeFcrId)
      const { data, error } = await query
      if (error) throw error
      setFcrs(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load visit history')
    } finally {
      setLoading(false)
    }
  }

  if (!accountId) return null

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  const suggestions = buildDiscussionSuggestions(fcrs, teamType)
  const current = fcrs[page]

  return (
    <div className="space-y-4">
      {/* Suggested Discussion Points -- rule-based, not AI. Built from every
          past FCR fetched above, not just the page currently being viewed. */}
      {suggestions.length > 0 && (
        <div className="card border-primary-100 bg-primary-50/30">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={16} className="text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">Suggested Discussion Points</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Generated from patterns in this account's past visits (open opportunities, follow-up commitments, competitor notes) -- a rule-based summary, not AI-generated. Use it as a starting point, not a script.
          </p>
          <ul className="space-y-2">
            {suggestions.map(s => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded">
                  {s.category}
                </span>
                <span className="text-gray-700">{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Previous Visits -- paginated, one FCR per page */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <History size={16} /> Previous Visits to This Account {fcrs.length > 0 && `(${fcrs.length})`}
          </h3>
          {fcrs.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              Visit {page + 1} of {fcrs.length}
              <button
                onClick={() => setPage(p => Math.min(fcrs.length - 1, p + 1))}
                disabled={page === fcrs.length - 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {fcrs.length === 0 ? (
          <p className="text-sm text-gray-400">No previous visits recorded for this account yet -- this will be the first.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {format(parseISO(current.visit_date), 'MMMM d, yyyy')} ({current.period === 'PM' ? 'PM' : 'AM'})
              </span>
              {current.status === 'approved' && <StatusPill tone="emerald">Approved</StatusPill>}
              {current.status === 'rejected' && <StatusPill tone="red">Rejected</StatusPill>}
              {current.status === 'pending_approval' && <StatusPill tone="amber">Pending Approval</StatusPill>}
              {current.status === 'draft' && <StatusPill>Draft</StatusPill>}
              {current.ack_status === 'acknowledged' && <StatusPill tone="emerald">Acknowledged</StatusPill>}
              {current.attendee_name && (
                <span className="text-xs text-gray-500">
                  with {current.attendee_name}{current.attendee_designation ? `, ${current.attendee_designation}` : ''}
                </span>
              )}
            </div>

            {current.coverage_notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Coverage Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">{current.coverage_notes}</p>
              </div>
            )}

            {current.form_data?.get_back_items && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Get-Back Items</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">{current.form_data.get_back_items}</p>
              </div>
            )}

            {(() => {
              const po = current.form_data?.project_opportunities || {}
              const rows = [...(po.primary || []), ...(po.qualified || [])].filter(r => (r.project_name_owner || '').trim())
              return rows.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Project Opportunities</p>
                  <EditableTable columns={projectColumns} rows={rows} onChange={() => {}} readOnly />
                </div>
              ) : null
            })()}

            {(() => {
              const rows = (current.form_data?.competitive_check || []).filter(r => (r.brand || '').trim())
              return rows.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Competitive Check</p>
                  <EditableTable columns={competitiveColumns} rows={rows} onChange={() => {}} readOnly />
                </div>
              ) : null
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
