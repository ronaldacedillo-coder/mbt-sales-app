import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getTeamType, getApproverRole } from '../../utils/roles'
import { emptyCustomerInfo, emptyFormData } from './fcrTemplates'
import { FCRFormBody } from './FCRFormBody'
import { downloadFCRPdf } from '../../lib/fcrPdf'
import { ArrowLeft, Save, Send, AlertCircle, Lock, FileText, Mail, RefreshCw, CheckCircle2, Clock3 } from 'lucide-react'
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
  const [error, setError] = useState('')
  const [sendingAck, setSendingAck] = useState(false)
  const [checkingAck, setCheckingAck] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    fetchAccounts()
    if (isEdit) fetchFCR()
  }, [id])

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
      const { data, error } = await supabase.from('fcrs').select('*').eq('id', id).single()
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
      setError('Failed to load FCR')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (status) => {
    if (!record.account_id) {
      setError('Please select an account above -- an FCR can only be filed against a profiled account')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...record,
        status,
        team_type: teamType,
        created_by: user.id,
        submitter_role: role,
        approver_role: getApproverRole(role),
      }
      delete payload.id
      delete payload.creator
      delete payload.account

      if (isEdit) {
        const { error } = await supabase.from('fcrs').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fcrs').insert([payload])
        if (error) throw error
      }
      navigate('/fcr')
    } catch (err) {
      setError(err.message || 'Failed to save FCR')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitForApproval = () => {
    if (!record.account_id) {
      setError('Please select an account above -- an FCR can only be filed against a profiled account')
      return
    }
    if (!record.attendee_name || !record.attendee_email) {
      setError('Please fill in the meeting attendee\'s name and email before submitting -- needed to request their acknowledgment of the minutes')
      return
    }
    handleSave('pending_approval')
  }

  // Flips ack_status to 'pending' and opens the SE/BD's own mail client with
  // the acknowledgment link pre-filled -- mirrors the mailto pattern already
  // used elsewhere in this app rather than standing up a server-side mailer.
  const handleSendAcknowledgment = async () => {
    if (!record.attendee_email) {
      setError('Enter the attendee\'s email address first')
      return
    }
    setSendingAck(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('fcrs')
        .update({ ack_status: 'pending', ack_requested_at: new Date().toISOString() })
        .eq('id', id)
        .select('ack_token, ack_status, ack_requested_at')
        .single()
      if (error) throw error
      setRecord(prev => ({ ...prev, ...data }))

      const link = `${window.location.origin}${import.meta.env.BASE_URL}#/acknowledge/${data.ack_token}`
      const company = record.customer_info?.company_name || 'our recent visit'
      const subject = encodeURIComponent(`Please acknowledge: Meeting minutes -- ${company}`)
      const body = encodeURIComponent(
        `Hi ${record.attendee_name || ''},\n\nPlease review and acknowledge the minutes from our recent visit:\n\n${link}\n\nThank you!`
      )
      window.location.href = `mailto:${record.attendee_email}?subject=${subject}&body=${body}`
    } catch (err) {
      setError(err.message || 'Failed to send the acknowledgment request')
    } finally {
      setSendingAck(false)
    }
  }

  // The account acknowledges on their own device/session, so the SE's tab
  // doesn't hear about it automatically -- this just re-reads the row.
  const handleCheckAckStatus = async () => {
    setCheckingAck(true)
    try {
      const { data, error } = await supabase
        .from('fcrs')
        .select('ack_status, acknowledged_at, acknowledged_name')
        .eq('id', id)
        .single()
      if (error) throw error
      setRecord(prev => ({ ...prev, ...data }))
    } catch (err) {
      setError(err.message || 'Failed to refresh acknowledgment status')
    } finally {
      setCheckingAck(false)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    setError('')
    try {
      const account = accounts.find(a => a.id === record.account_id)
      await downloadFCRPdf({ record, account, submitterName: profile?.full_name })
    } catch (err) {
      console.error('Failed to export FCR PDF:', err)
      setError('Failed to generate the PDF file')
    } finally {
      setExportingPdf(false)
    }
  }

  const readOnly = isEdit && !['draft', 'rejected'].includes(record.status)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/fcr')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors print:hidden">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Field Contact Report' : 'New Field Contact Report'}
          </h1>
          <p className="text-gray-500 text-sm">
            {teamType === 'business_development' ? 'FIELD CONTACT REPORT - BD' : 'FIELD CONTACT REPORT - MBT SALES'}
          </p>
        </div>
        {readOnly && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <Lock size={12} /> Read-only ({record.status.replace('_', ' ')})
          </span>
        )}
        {isEdit && (
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || record.ack_status !== 'acknowledged'}
            className="ml-auto btn-secondary flex items-center gap-2 print:hidden disabled:opacity-40 disabled:cursor-not-allowed"
            title={record.ack_status === 'acknowledged' ? 'Downloads a PDF of this FCR' : 'The account must acknowledge the meeting minutes before this FCR can be exported'}
          >
            <FileText size={16} /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

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
      />

      {isEdit && (
        <div className="card print:hidden">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Acknowledgment</h3>
          <div className="flex flex-wrap items-center gap-3">
            {record.ack_status === 'acknowledged' ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={14} />
                Acknowledged by {record.acknowledged_name || 'the account'}
                {record.acknowledged_at && ` on ${format(new Date(record.acknowledged_at), 'MMM dd, yyyy')}`}
              </span>
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

            {record.ack_status !== 'acknowledged' && !readOnly && (
              <button
                onClick={handleSendAcknowledgment}
                disabled={sendingAck || !record.attendee_email}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
                title={record.attendee_email ? '' : "Fill in the attendee's email above first"}
              >
                <Mail size={14} /> {sendingAck ? 'Sending...' : record.ack_status === 'pending' ? 'Resend Request' : 'Send Acknowledgment Request'}
              </button>
            )}

            {record.ack_status === 'pending' && (
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
            Sending opens your email app with the acknowledgment link pre-filled -- the account clicks it, reviews the minutes, and confirms. The PDF export above unlocks once they do.
          </p>
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center justify-end gap-3 print:hidden">
          <button onClick={() => navigate('/fcr')} className="btn-secondary">Cancel</button>
          <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary flex items-center gap-2">
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={handleSubmitForApproval} disabled={saving} className="btn-primary flex items-center gap-2">
            <Send size={16} />
            {saving ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      )}
    </div>
  )
}
