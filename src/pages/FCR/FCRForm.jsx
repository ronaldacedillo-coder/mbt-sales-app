import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getTeamType, getApproverRole } from '../../utils/roles'
import { emptyCustomerInfo, emptyFormData } from './fcrTemplates'
import { FCRFormBody } from './FCRFormBody'
import { ArrowLeft, Save, Send, AlertCircle, Lock } from 'lucide-react'
import { format } from 'date-fns'

const blankRecord = (teamType) => ({
  account_id: '',
  visit_date: format(new Date(), 'yyyy-MM-dd'),
  status: 'draft',
  customer_info: emptyCustomerInfo(),
  form_data: emptyFormData(teamType),
  coverage_notes: '',
  customer_signature_name: '',
})

export const FCRForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const isEdit = Boolean(id)
  const myTeamType = getTeamType(role)

  const [record, setRecord] = useState(blankRecord(myTeamType))
  const [teamType, setTeamType] = useState(myTeamType)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAccounts()
    if (isEdit) fetchFCR()
  }, [id])

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, company_name, city, country, address, contact_email, contact_phone')
      .eq('created_by', user.id)
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
    if (!record.customer_info?.company_name) {
      setError('Please fill in at least the Company Name under Customer Information')
      return
    }
    handleSave('pending_approval')
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
        <button onClick={() => navigate('/fcr')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
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
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <Lock size={12} /> Read-only ({record.status.replace('_', ' ')})
          </span>
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
      />

      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
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
