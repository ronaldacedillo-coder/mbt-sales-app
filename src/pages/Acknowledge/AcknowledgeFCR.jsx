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
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [justAcknowledged, setJustAcknowledged] = useState(false)

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
      setLoading(false)
    }
    load()
  }, [token])

  const handleAcknowledge = async () => {
    if (!name.trim() || !confirmed) return
    setSubmitting(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('acknowledge_fcr', { p_token: token, p_name: name.trim() })
      if (error) throw error
      if (!data) {
        setError('This link has already been used or is no longer active.')
        return
      }
      setJustAcknowledged(true)
    } catch (err) {
      setError(err.message || 'Failed to submit your acknowledgment. Please try again.')
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
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
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

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
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
                  Acknowledged{details.acknowledged_name || justAcknowledged ? ` by ${justAcknowledged ? name : details.acknowledged_name}` : ''}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">Thank you -- no further action is needed. You may close this page.</p>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div>
                <label className="label">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Type your full name"
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                I confirm that the minutes above accurately reflect our discussion.
              </label>
              <button
                onClick={handleAcknowledge}
                disabled={!name.trim() || !confirmed || submitting}
                className="btn-primary w-full disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Acknowledge Minutes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
