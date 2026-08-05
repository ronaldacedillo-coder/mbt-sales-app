import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, getTeamType, getApproverRole } from '../../utils/roles'
import { emptyCustomerInfo, emptyFormData } from './fcrTemplates'
import { FCRFormBody } from './FCRFormBody'
import { downloadFCRPdf } from '../../lib/fcrPdf'
import { ArrowLeft, Save, Send, Lock, FileText, Mail, RefreshCw, CheckCircle2, Clock3, Users } from 'lucide-react'
import { format } from 'date-fns'

const blankRecord = (teamType) => ({
  account_id: '',
  visit_date: format(new Date(), 'yyyy-MM-dd'),
  period: 'AM',
  status: 'draft',
  customer_info: emptyCustomerInfo(),
  form_data: emptyFormData(teamType),
  coverage_notes: '',
  customer_signature_name: '',
  attendee_name: '',
  attendee_designation: '',
  attendee_email: '',
  ack_status: 'not_sent',
})

export const FCRForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, profile } = useAuth()
  const isEdit = Boolean(id)
  const myTeamType = getTeamType(role)
  const prefill = !isEdit ? location.state?.prefill : null

  const [record, setRecord] = useState(() => ({
    ...blankRecord(myTeamType),
    ...(prefill?.account_id ? { account_id: prefill.account_id } : {}),
    ...(prefill?.visit_date ? { visit_date: prefill.visit_date } : {}),
  }))
  const [teamType, setTeamType] = useState(myTeamType)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [sendingAck, setSendingAck] = useState(false)
  const [checkingAck, setCheckingAck] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [jointInfo, setJointInfo] = useState(null)
  const [jointCandidates, setJointCandidates] = useState([])
  const [linkingJointId, setLinkingJointId] = useState(null)

  useEffect(() => {
    fetchAccounts()
    if (isEdit) fetchFCR()
  }, [id])

  // Two reps (e.g. an SE and a BD rep) visiting the same account together
  // each file their own FCR -- this surfaces that connection: once linked
  // (see fcr_link_joint_visit / fcr_set_joint_link), show who the other
  // rep is and their acknowledgment status; before that, offer to link to
  // any other FCR already filed for this same account on this same date.
  // Only meaningful once the FCR has an id (fcr_set_joint_link needs one
  // to authorize against), so this sits out entirely for a new, unsaved FCR.
  useEffect(() => {
    if (!isEdit || !record.account_id || !record.visit_date) {
      setJointInfo(null)
      setJointCandidates([])
      return
    }
    fetchJointData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, record.account_id, record.visit_date, record.joint_fcr_id])

  const fetchJointData = async () => {
    try {
      if (record.joint_fcr_id) {
        const { data, error } = await supabase.rpc('fcr_joint_info', { p_id: record.joint_fcr_id })
        if (error) throw error
        setJointInfo(data?.[0] || null)
        setJointCandidates([])
      } else {
        const { data, error } = await supabase.rpc('fcr_joint_candidates', {
          p_account_id: record.account_id,
          p_visit_date: record.visit_date,
          p_exclude_id: id || null,
        })
        if (error) throw error
        setJointInfo(null)
        setJointCandidates(data || [])
      }
    } catch (err) {
      console.error('Failed to load joint visit info:', err)
    }
  }

  const handleLinkJoint = async (peerId) => {
    setLinkingJointId(peerId)
    try {
      const { error } = await supabase.rpc('fcr_set_joint_link', { p_fcr_id: id, p_peer_id: peerId })
      if (error) throw error
      setRecord(prev => ({ ...prev, joint_fcr_id: peerId }))
      toast.success('Linked as a joint visit')
    } catch (err) {
      toast.error(err.message || 'Failed to link the joint visit')
    } finally {
      setLinkingJointId(null)
    }
  }

  // Only accounts with a completed profile (Trade Terms set -- see
  // AccountForm) are selectable. Customer Information on the FCR is fully
  // derived from the account record now, not typed here -- see
  // accountToCustomerInfo() in FCRFormBody.jsx.
  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, company_name, city, country, address, contact_email, contact_phone, owners, region, dealer_classification, channel, ase_tse, visit_freq_days, trade_terms, distributor_name')
      .not('trade_terms', 'is', null)
      .order('company_name')
    setAccounts(data || [])
  }

  const fetchFCR = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('fcrs')
        .select('*, approver:user_profiles!fcrs_approved_by_fkey(full_name:name)')
        .eq('id', id)
        .single()
      if (error) throw error
      if (data) {
        const resolvedTeamType = data.team_type || myTeamType
        setTeamType(resolvedTeamType)
        setRecord({
          ...data,
          customer_info: { ...emptyCustomerInfo(), ...(data.customer_info || {}) },
          form_data: { ...emptyFormData(resolvedTeamType), ...(data.form_data || {}) },
        })
      }
    } catch (err) {
      toast.error('Failed to load FCR')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (status) => {
    if (!record.account_id) {
      setFieldErrors({ account_id: 'Select an account above -- an FCR can only be filed against a profiled account' })
      return
    }
    setSaving(true)
    setFieldErrors({})
    try {
      const payload = { ...record, status, team_type: teamType }
      delete payload.id
      delete payload.creator
      delete payload.account
      delete payload.approver

      if (isEdit) {
        // created_by/submitter_role/approver_role are set once at creation
        // and must never change on a later save -- an approver opening a
        // draft/rejected FCR they don't own (to review it) would otherwise
        // silently reassign it to themselves the moment they hit Save.
        delete payload.created_by
        delete payload.submitter_role
        delete payload.approver_role
        const { error } = await supabase.from('fcrs').update(payload).eq('id', id)
        if (error) throw error
      } else {
        payload.created_by = user.id
        payload.submitter_role = role
        payload.approver_role = getApproverRole(role)
        const { error } = await supabase.from('fcrs').insert([payload])
        if (error) throw error
      }
      navigate('/fcr')
    } catch (err) {
      toast.error(err.message || 'Failed to save FCR')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitForApproval = () => {
    if (!record.account_id) {
      setFieldErrors({ account_id: 'Select an account above -- an FCR can only be filed against a profiled account' })
      return
    }
    if (!record.attendee_name || !record.attendee_email) {
      setFieldErrors({
        ...(!record.attendee_name ? { attendee_name: 'Required before submitting for approval' } : {}),
        ...(!record.attendee_email ? { attendee_email: 'Required before submitting for approval' } : {}),
      })
      return
    }
    if (record.ack_status !== 'acknowledged') {
      toast.error('This FCR can\'t be submitted for approval yet -- only FCRs acknowledged by the account are sent to the NSM or Commercial AC Head. Send the acknowledgment request below first.')
      return
    }
    handleSave('pending_approval')
  }

  // Emails the attendee directly via the send-fcr-acknowledgment Edge
  // Function (Resend) -- a one-click "Confirm Meeting Happened" button in
  // their inbox, no mail app popup on the SE/BD's side. The function is
  // authenticated as the current user, so it only ever works on FCRs they
  // own (enforced by the fcrs table's own RLS policies).
  const handleSendAcknowledgment = async () => {
    if (!record.attendee_name || !record.attendee_email) {
      setFieldErrors({
        ...(!record.attendee_name ? { attendee_name: "Enter the attendee's name first" } : {}),
        ...(!record.attendee_email ? { attendee_email: "Enter the attendee's email address first" } : {}),
      })
      return
    }
    setSendingAck(true)
    setFieldErrors({})
    try {
      // The Edge Function re-reads this FCR straight from the database --
      // it doesn't see whatever's currently typed in this form. Reps who
      // fill in the attendee's email and immediately hit "Send" without
      // saving first used to get a confusing "Edge Function returned a
      // non-2xx status code" (the function correctly bounced them with
      // "no attendee email set yet," since the DB still had the old blank
      // value, but that real reason never made it back to the screen).
      // Persisting the current form here first closes that gap.
      const payload = { ...record, team_type: teamType }
      delete payload.id
      delete payload.creator
      delete payload.account
      delete payload.approver
      // See handleSave -- ownership fields are set once at creation and
      // must not be overwritten by a later save.
      delete payload.created_by
      delete payload.submitter_role
      delete payload.approver_role
      // The Visit Date is no longer something the rep can freely type in --
      // it's locked to the date the acknowledgment request was first sent,
      // so it can't be backdated/misrepresented. Only stamp it the first
      // time (ack_requested_at not set yet); a later "Resend Request" must
      // not keep shifting the date.
      const isFirstSend = !record.ack_requested_at
      if (isFirstSend) {
        payload.visit_date = format(new Date(), 'yyyy-MM-dd')
      }
      const { error: saveError } = await supabase.from('fcrs').update(payload).eq('id', id)
      if (saveError) throw saveError

      const { data, error } = await supabase.functions.invoke('send-fcr-acknowledgment', {
        body: { fcr_id: id },
      })
      if (error) {
        // supabase-js collapses any non-2xx response into a generic
        // "Edge Function returned a non-2xx status code" and leaves the
        // function's own JSON body (with the actual reason) unread on
        // `error.context` -- surface that instead of the generic wrapper
        // whenever it's available.
        let message = error.message
        if (error?.context?.json) {
          try {
            const body = await error.context.clone().json()
            if (body?.error) message = body.error
          } catch {
            // Body wasn't JSON (or already consumed) -- fall back below.
          }
        }
        throw new Error(message)
      }
      if (!data?.ok) throw new Error(data?.error || 'Failed to send the acknowledgment email')

      if (data.inherited || data.alreadyPending) {
        // The edge function found a joint-visit peer FCR (same account,
        // date, and attendee email) and either copied over its existing
        // acknowledgment or linked to its still-pending one -- either way,
        // no email went out. Re-read the authoritative state rather than
        // guessing at it locally.
        const { data: refreshed } = await supabase
          .from('fcrs')
          .select('ack_status, acknowledged_at, acknowledged_name, acknowledged_comment, status, joint_fcr_id')
          .eq('id', id)
          .single()
        setRecord(prev => ({
          ...prev,
          ...(refreshed || {}),
          ...(isFirstSend ? { visit_date: payload.visit_date } : {}),
        }))
        toast.success(
          data.inherited
            ? `Already acknowledged as part of ${data.peerName || 'the linked rep'}'s joint visit -- no email needed.`
            : `An acknowledgment request for this visit was already sent as part of ${data.peerName || 'a linked'}'s FCR -- waiting on that same response.`
        )
      } else {
        setRecord(prev => ({
          ...prev,
          ack_status: 'pending',
          ack_requested_at: new Date().toISOString(),
          ...(isFirstSend ? { visit_date: payload.visit_date } : {}),
        }))
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send the acknowledgment request')
    } finally {
      setSendingAck(false)
    }
  }

  // The account acknowledges on their own device/session, so the SE's tab
  // doesn't hear about it automatically -- this just re-reads the row.
  // `status` is included because acknowledging also auto-submits a still-draft
  // FCR for approval (see the acknowledge_fcr RPC) -- refreshing needs to
  // pick that up too, not just ack_status, so the form correctly flips to
  // read-only once it enters the approval queue.
  const handleCheckAckStatus = async () => {
    setCheckingAck(true)
    try {
      const { data, error } = await supabase
        .from('fcrs')
        .select('ack_status, acknowledged_at, acknowledged_name, acknowledged_comment, status')
        .eq('id', id)
        .single()
      if (error) throw error
      setRecord(prev => ({ ...prev, ...data }))
    } catch (err) {
      toast.error(err.message || 'Failed to refresh acknowledgment status')
    } finally {
      setCheckingAck(false)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const account = accounts.find(a => a.id === record.account_id)
      await downloadFCRPdf({ record, account, submitterName: profile?.full_name, approverName: record.approver?.full_name })
    } catch (err) {
      console.error('Failed to export FCR PDF:', err)
      toast.error('Failed to generate the PDF file')
    } finally {
      setExportingPdf(false)
    }
  }

  // VIEWER (Product Manager / HVAC Director) never edits an FCR, regardless
  // of its status -- everything below renders read-only for them. Same for
  // anyone opening an existing FCR they didn't create (an NSM/Head reviewing
  // a report routed to them, reached from the FCR list) -- only the
  // original submitter can ever edit their own draft/rejected FCR.
  const isViewer = role === ROLES.VIEWER
  const isOwner = !isEdit || record.created_by === user.id
  const readOnly = isViewer || !isOwner || (isEdit && !['draft', 'rejected'].includes(record.status))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/fcr')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors print:hidden flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Field Contact Report' : 'New Field Contact Report'}
            </h1>
            <p className="text-gray-500 text-sm">
              {teamType === 'business_development' ? 'FIELD CONTACT REPORT - BD' : 'FIELD CONTACT REPORT - MBT SALES'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap sm:ml-auto">
          {readOnly && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <Lock size={12} /> Read-only ({record.status.replace('_', ' ')})
            </span>
          )}
          {isEdit && (
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || record.status !== 'approved'}
              className="btn-secondary flex items-center gap-2 print:hidden disabled:opacity-40 disabled:cursor-not-allowed"
              title={record.status === 'approved' ? 'Downloads a PDF of this FCR' : 'This FCR can be exported once the NSM or Commercial AC Head has approved it'}
            >
              <FileText size={16} /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {record.status === 'rejected' && record.rejection_reason && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-medium">This FCR was rejected:</span> {record.rejection_reason}
          <p className="mt-1 text-red-600">Make your revisions below and resubmit.</p>
        </div>
      )}

      <FCRFormBody
        record={record}
        onChange={setRecord}
        teamType={teamType}
        readOnly={readOnly}
        accounts={accounts}
        submitterName={profile?.full_name}
        fieldErrors={fieldErrors}
      />

      {isEdit && (
        <div className="card print:hidden">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Acknowledgment</h3>
          <div className="flex flex-wrap items-center gap-3">
            {record.ack_status === 'acknowledged' ? (
              <div className="w-full space-y-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full w-fit">
                  <CheckCircle2 size={14} />
                  Acknowledged by {record.acknowledged_name || 'the account'}
                  {record.acknowledged_at && ` on ${format(new Date(record.acknowledged_at), 'MMM dd, yyyy')}`}
                </span>
                {record.acknowledged_comment && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 mb-1">Attendee's comment</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.acknowledged_comment}</p>
                  </div>
                )}
              </div>
            ) : record.ack_status === 'pending' ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                <Clock3 size={14} />
                Waiting on the account to acknowledge
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                Not sent yet
              </span>
            )}

            {!isViewer && record.ack_status !== 'acknowledged' && (
              <button
                onClick={handleSendAcknowledgment}
                disabled={sendingAck || !record.attendee_email || !record.attendee_name}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
                title={!record.attendee_name ? "Fill in the attendee's name above first" : !record.attendee_email ? "Fill in the attendee's email above first" : ''}
              >
                <Mail size={14} /> {sendingAck ? 'Sending...' : record.ack_status === 'pending' ? 'Resend Request' : 'Send Acknowledgment Request'}
              </button>
            )}

            {!isViewer && record.ack_status === 'pending' && (
              <button
                onClick={handleCheckAckStatus}
                disabled={checkingAck}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <RefreshCw size={14} className={checkingAck ? 'animate-spin' : ''} /> Refresh Status
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Sends an email directly to the attendee with a one-click "Confirm Meeting Happened" button{record.status === 'draft' ? '. Once they click it, this FCR is automatically submitted to the NSM or Commercial AC Head for approval' : ''} -- only acknowledged FCRs are sent for approval, and the PDF export above only unlocks once it's approved.
          </p>
        </div>
      )}

      {/* Joint Visit -- surfaces when another rep (typically the MBT Sales
          / BD counterpart on a joint call) has filed their own FCR for
          this same account on this same date, so the two aren't confused
          for duplicates and don't each separately email the account
          contact for what was one meeting (see fcr_link_joint_visit). */}
      {isEdit && (jointInfo || jointCandidates.length > 0) && (
        <div className="card print:hidden">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users size={16} /> Joint Visit
          </h3>
          {jointInfo ? (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-gray-700">
                Linked with <span className="font-medium">{jointInfo.creator_name}</span>
                {' '}({jointInfo.team_type === 'business_development' ? 'BD' : 'MBT Sales'})
              </span>
              {jointInfo.ack_status === 'acknowledged' ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} /> Their FCR is acknowledged
                </span>
              ) : jointInfo.ack_status === 'pending' ? (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Clock3 size={12} /> Their acknowledgment is pending
                </span>
              ) : (
                <span className="text-xs text-gray-400">They haven't sent an acknowledgment request yet</span>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                {jointCandidates.length === 1 ? 'Another FCR was' : `${jointCandidates.length} other FCRs were`} filed for this account on this same date. If this was a joint visit, link it so the account contact isn't asked to confirm the same meeting twice.
              </p>
              {jointCandidates.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-gray-700">
                    {c.creator_name} ({c.team_type === 'business_development' ? 'BD' : 'MBT Sales'})
                  </span>
                  {!readOnly && (
                    <button
                      onClick={() => handleLinkJoint(c.id)}
                      disabled={linkingJointId === c.id}
                      className="btn-secondary text-xs py-1 px-2 disabled:opacity-50"
                    >
                      {linkingJointId === c.id ? 'Linking...' : 'This was a joint visit'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
          <button onClick={() => navigate('/fcr')} className="btn-secondary">Cancel</button>
          <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary flex items-center gap-2">
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleSubmitForApproval}
            disabled={saving || record.ack_status !== 'acknowledged'}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title={record.ack_status === 'acknowledged' ? '' : 'The account must acknowledge the meeting minutes first (see below) -- only acknowledged FCRs are sent for approval'}
          >
            <Send size={16} />
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      )}
    </div>
  )
}
