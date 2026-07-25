import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, getApproverRole } from '../../utils/roles'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Building2,
  Clock,
  Save,
  Send,
  AlertCircle,
  ClipboardCheck
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'

export const ItineraryForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role, profile } = useAuth()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState({
    title: '',
    month: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    visits: [],
    notes: '',
    status: 'draft'
  })
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAccounts()
    if (isEdit) fetchItinerary()
  }, [id])

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, company_name, city, industry')
      .order('company_name')
    setAccounts(data || [])
  }

  const fetchItinerary = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      if (data) {
        setFormData({
          ...data,
          month: data.month,
          visits: data.visits || []
        })
      }
    } catch (err) {
      setError('Failed to load itinerary')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addVisit = () => {
    setFormData(prev => ({
      ...prev,
      visits: [...prev.visits, {
        id: crypto.randomUUID(),
        account_id: '',
        visit_date: '',
        purpose: '',
        estimated_duration: '',
        location: '',
        notes: ''
      }]
    }))
  }

  const updateVisit = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      visits: prev.visits.map((v, i) => i === index ? { ...v, [field]: value } : v)
    }))
  }

  const removeVisit = (index) => {
    setFormData(prev => ({
      ...prev,
      visits: prev.visits.filter((_, i) => i !== index)
    }))
  }

  const handleSave = async (status = 'draft') => {
    setSaving(true)
    setError('')

    try {
      const payload = {
        title: formData.title || `Itinerary - ${format(parseISO(formData.month), 'MMMM yyyy')}`,
        month: formData.month,
        visits: formData.visits,
        notes: formData.notes,
        status: status,
        created_by: user.id,
        submitter_role: role,
        approver_role: getApproverRole(role),
      }

      if (isEdit) {
        const { error } = await supabase
          .from('itineraries')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('itineraries')
          .insert([payload])
        if (error) throw error
      }

      navigate('/itinerary')
    } catch (err) {
      setError(err.message || 'Failed to save itinerary')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitForApproval = () => {
    if (formData.visits.length === 0) {
      setError('Please add at least one visit')
      return
    }
    handleSave('pending_approval')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/itinerary')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Itinerary' : 'New Itinerary'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isEdit ? 'Update your monthly schedule' : 'Plan your monthly visits'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="card space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="input"
              placeholder="e.g., July 2026 Sales Visits"
            />
          </div>
          <div>
            <label className="label">Month</label>
            <input
              type="month"
              value={formData.month ? format(parseISO(formData.month), 'yyyy-MM') : ''}
              onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value + '-01' }))}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="input min-h-[80px]"
            placeholder="General notes about this itinerary..."
          />
        </div>
      </div>

      {/* Visits Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Planned Visits</h3>
          <button
            onClick={addVisit}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            Add Visit
          </button>
        </div>

        {formData.visits.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <MapPin size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No visits planned yet</p>
            <button onClick={addVisit} className="text-primary-600 text-sm mt-1 hover:underline">
              Add your first visit
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.visits.map((visit, index) => (
              <div key={visit.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm">Visit #{index + 1}</h4>
                  <div className="flex items-center gap-1">
                    {visit.account_id && (
                      <button
                        onClick={() => navigate('/fcr/new', {
                          state: { prefill: { account_id: visit.account_id, visit_date: visit.visit_date } }
                        })}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Create a Field Contact Report for this visit"
                      >
                        <ClipboardCheck size={13} /> Log FCR
                      </button>
                    )}
                    <button
                      onClick={() => removeVisit(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs">Account</label>
                    <select
                      value={visit.account_id}
                      onChange={(e) => updateVisit(index, 'account_id', e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">Select account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.company_name} ({acc.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label text-xs">Visit Date</label>
                    <input
                      type="date"
                      value={visit.visit_date}
                      onChange={(e) => updateVisit(index, 'visit_date', e.target.value)}
                      className="input text-sm"
                    />
                  </div>

                  <div>
                    <label className="label text-xs">Estimated Duration</label>
                    <input
                      type="text"
                      value={visit.estimated_duration}
                      onChange={(e) => updateVisit(index, 'estimated_duration', e.target.value)}
                      className="input text-sm"
                      placeholder="e.g., 2 hours"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label text-xs">Purpose</label>
                    <input
                      type="text"
                      value={visit.purpose}
                      onChange={(e) => updateVisit(index, 'purpose', e.target.value)}
                      className="input text-sm"
                      placeholder="Purpose of visit..."
                    />
                  </div>

                  <div>
                    <label className="label text-xs">Location</label>
                    <input
                      type="text"
                      value={visit.location}
                      onChange={(e) => updateVisit(index, 'location', e.target.value)}
                      className="input text-sm"
                      placeholder="Meeting location..."
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="label text-xs">Visit Notes</label>
                    <textarea
                      value={visit.notes}
                      onChange={(e) => updateVisit(index, 'notes', e.target.value)}
                      className="input text-sm min-h-[60px]"
                      placeholder="Additional notes for this visit..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/itinerary')}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSave('draft')}
          disabled={saving}
          className="btn-secondary flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={handleSubmitForApproval}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Send size={16} />
          {saving ? 'Submitting...' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  )
}