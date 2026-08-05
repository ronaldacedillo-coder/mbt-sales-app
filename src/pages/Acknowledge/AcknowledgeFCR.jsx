import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildFcrMinutesText } from '../../lib/fcrMinutes'
import { CheckCircle2, AlertCircle, FileText } from 'lucide-react'

// Public, unauthenticated page -- reached only via the link a Sales/BD rep
// emails to the account contact after a visit. It never touches the fcrs
// table directly; both reads and the acknowledgment write go through
// SECURITY DEFINER RPCs scoped to an exact ack_token match (see the
// add_fcr_acknowledgment_and_mcp_archive migration), so there's no way to
// browse or list anyone else's FCRs from here.
export const AcknowledgeFCR = () => {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [details, setDetails] = useState(null)
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [justAcknowledged, setJustAcknowledged] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_fcr_ack_details', { p_token: token })
      if (error || !data || data.length === 0) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const row = data[0]
      setDetails(row)
      setName(row.attendee_name || '')
      // If the FCR was sent without an attendee name on file, the "Confirm
      // Meeting Happened" button below is disabled until a name is typed
      // in (it can't submit a blank confirmation). Open the name field
      // immediately in that case rather than leaving a disabled button
      // with no visible reason why -- the account contact would otherwise
      // have no way to tell it just needs their name first.
      if (!row.attendee_name) setEditingName(true)
      setLoading(false)
    }
    load()
  }, [token])

  // One click confirms -- the attendee's name is already on file from the
  // FCR (the SE/BD entered it when logging the visit), so there's nothing
  // to type unless it needs correcting. The comment is entirely optional --
  // acknowledging works with or without one.
  const handleAcknowledge = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('acknowledge_fcr', {
        p_token: token,
        p_name: name.trim(),
        p_comment: comment.trim() || null,
      })
      if (error) throw error
      if (!data) {
        setError('This link has already been used or is no longer active.')
        return
      }
      setJustAcknowledged(true)
    } catch (err) {
      setError(err.message || 'Failed to submit your confirmation. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div
          className={`max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-[0_20px_60px_-15px_rgba(37,99,235,0.15)] p-8 text-center transition-all duration-200 ease-out-strong ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        >
          <AlertCircle size={40} className="mx-auto text-gray-300 mb-4" />
          <h1 className="text-lg font-semibold text-gray-900">Link not found</h1>
          <p className="text-sm text-gray-500 mt-2">This acknowledgment link is invalid or has expired. Please contact the MBT representative who sent it to you.</p>
        </div>
      </div>
    )
  }

  const alreadyAcknowledged = details.ack_status === 'acknowledged' || justAcknowledged
  const minutesText = buildFcrMinutesText({
    record: {
      visit_date: details.visit_date,
      period: details.period,
      customer_info: details.customer_info,
      coverage_notes: details.coverage_notes,
      form_data: details.form_data,
      attendee_name: details.attendee_name,
      team_type: details.team_type,
    },
    submitterName: details.submitter_name,
  })

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">MBT Sales -- Meeting Minutes Acknowledgment</span>
        </div>

        <div
          className={`bg-white rounded-xl border border-gray-200 shadow-[0_20px_60px_-15px_rgba(37,99,235,0.15)] p-6 space-y-5 transition-all duration-200 ease-out-strong ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        >
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {details.customer_info?.company_name || 'Meeting Minutes'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Please review the minutes below from your recent visit with {details.submitter_name || 'your MBT representative'}.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{minutesText}</pre>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {alreadyAcknowledged ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  Confirmed{details.acknowledged_name || justAcknowledged ? ` by ${justAcknowledged ? name : details.acknowledged_name}` : ''}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">Thank you -- no further action is needed. You may close this page.</p>
                {(justAcknowledged ? comment.trim() : details.acknowledged_comment) && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <p className="text-xs font-medium text-emerald-800">Your comment:</p>
                    <p className="text-xs text-emerald-700 mt-0.5 whitespace-pre-wrap">
                      {justAcknowledged ? comment.trim() : details.acknowledged_comment}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              {editingName ? (
                <div>
                  <label className="label">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="Type your full name"
                    autoFocus
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Confirming as <span className="font-medium text-gray-900">{name || 'Not specified'}</span>.{' '}
                  <button type="button" onClick={() => setEditingName(true)} className="text-primary-600 hover:underline">
                    Not you?
                  </button>
                </p>
              )}
              <div>
                <label className="label">Comment (optional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input min-h-[80px] resize-y"
                  placeholder="Anything to add or correct about the visit? (optional)"
                />
              </div>
              <button
                onClick={handleAcknowledge}
                disabled={!name.trim() || submitting}
                className="btn-primary w-full text-base py-3 disabled:opacity-50"
              >
                {submitting ? 'Confirming...' : 'Confirm Meeting Happened'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
