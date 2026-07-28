import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, getApproverRole } from '../../utils/roles'
import { MonthCalendar } from './MonthCalendar'
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
  ClipboardCheck,
  List,
  CalendarDays
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'

export const ItineraryForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const isEdit = Boolean(id)
  // VIEWER (Product Manager / HVAC Director) can open any MCP (Plan) to
  // look at it, but never edits one -- every input, calendar drag, and
  // action button below is disabled/hidden for them.
  const readOnly = role === ROLES.VIEWER

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
  const [view, setView] = useState('calendar')

  useEffect(() => {
    fetchAccounts()
    if (isEdit) fetchItinerary()
  }, [id])

  // Only accounts with a completed profile (Trade Terms set -- see
  // AccountForm) are selectable here. Reps who haven't profiled the
  // account yet need to do that first, from the Accounts section.
  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, company_name, city, customer_type')
      .not('trade_terms', 'is', null)
      .order('company_name')
    setAccounts(data || [])
  }

  const fetchItinerary = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .select(`
          *,
          creator:user_profiles!itineraries_created_by_fkey(full_name:name),
          approver:user_profiles!itineraries_approved_by_fkey(full_name:name)
        `)
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

  const addVisit = (prefillDate = '') => {
    const newId = crypto.randomUUID()
    setFormData(prev => ({
      ...prev,
      visits: [...prev.visits, {
        id: newId,
        account_id: '',
        visit_date: prefillDate,
        period: 'AM',
        purpose: '',
        estimated_duration: '',
        location: '',
        notes: ''
      }]
    }))
    return newId
  }

  // Clicking a day in the calendar view adds a visit pre-filled with that
  // date and switches to the List view so the SE can fill in the rest.
  const addVisitFromCalendar = (dateStr) => {
    const newId = addVisit(dateStr)
    setView('list')
    setTimeout(() => {
      document.getElementById(`visit-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  // Clicking an existing visit chip in the calendar jumps to its card in
  // the List view instead of duplicating the edit UI inside the grid.
  const selectVisitFromCalendar = (visitId) => {
    setView('list')
    setTimeout(() => {
      document.getElementById(`visit-${visitId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
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

  const accountName = (accountId) => accounts.find(a => a.id === accountId)?.company_name || 'Unassigned account'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/itinerary')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {isEdit ? (readOnly ? 'MCP (Plan)' : 'Edit MCP (Plan)') : 'New MCP (Plan)'}
            {readOnly && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                Read-only
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm">
            {readOnly ? 'Viewing this monthly schedule' : isEdit ? 'Update your proposed monthly schedule' : 'Propose your monthly visit schedule for approval'}
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
              className="input disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="e.g., July 2026 Sales Visits"
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Month</label>
            <input
              type="month"
              value={formData.month ? format(parseISO(formData.month), 'yyyy-MM') : ''}
              onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value + '-01' }))}
              className="input disabled:bg-gray-50 disabled:text-gray-500"
              disabled={readOnly}
            />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="input min-h-[80px] disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="General notes about this itinerary..."
            disabled={readOnly}
          />
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('calendar')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
            view === 'calendar' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <CalendarDays size={15} /> Calendar
        </button>
        <button
          onClick={() => setView('list')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
            view === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <List size={15} /> List
        </button>
      </div>

      {/* Calendar view (on-screen browsing only -- print uses the MCP grid above) */}
      <div className={`card ${view === 'calendar' ? '' : 'hidden'}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {formData.month ? format(parseISO(formData.month), 'MMMM yyyy') : 'Calendar'}
        </h3>
        <MonthCalendar
          month={formData.month || format(new Date(), 'yyyy-MM-dd')}
          visits={formData.visits}
          accounts={accounts}
          editable={!readOnly}
          onDayClick={readOnly ? undefined : addVisitFromCalendar}
          onSelectVisit={selectVisitFromCalendar}
        />
      </div>

      {/* List (edit) view */}
      <div className={`card ${view === 'list' ? '' : 'hidden'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Planned Visits</h3>
          {!readOnly && (
            <button
              onClick={() => addVisit()}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Visit
            </button>
          )}
        </div>

        {formData.visits.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <MapPin size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No visits planned yet</p>
            {!readOnly && (
              <button onClick={() => addVisit()} className="text-primary-600 text-sm mt-1 hover:underline">
                Add your first visit
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {formData.visits.map((visit, index) => (
              <div key={visit.id} id={`visit-${visit.id}`} className="border border-gray-200 rounded-lg p-4 bg-gray-50 scroll-mt-20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm">Visit #{index + 1}</h4>
                  {!readOnly && (
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
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs">Account</label>
                    <select
                      value={visit.account_id}
                      onChange={(e) => updateVisit(index, 'account_id', e.target.value)}
                      className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      disabled={readOnly}
                    >
                      <option value="">Select account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.company_name} ({acc.city})
                        </option>
                      ))}
                    </select>
                    {accounts.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No profiled accounts yet -- <Link to="/accounts/new" className="underline">create one</Link> (with Trade Terms filled in) first.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="label text-xs">Visit Date</label>
                    <input
                      type="date"
                      value={visit.visit_date}
                      onChange={(e) => updateVisit(index, 'visit_date', e.target.value)}
                      className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <label className="label text-xs">AM / PM</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                      {['AM', 'PM'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateVisit(index, 'period', p)}
                          disabled={readOnly}
                          className={`flex-1 py-2 font-medium transition-colors disabled:cursor-default ${
                            (visit.period || 'AM') === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 disabled:hover:bg-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs">Estimated Duration</label>
                    <input
                      type="text"
                      value={visit.estimated_duration}
                      onChange={(e) => updateVisit(index, 'estimated_duration', e.target.value)}
                      className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="e.g., 2 hours"
                      disabled={readOnly}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label text-xs">Purpose</label>
                    <input
                      type="text"
                      value={visit.purpose}
                      onChange={(e) => updateVisit(index, 'purpose', e.target.value)}
                      className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Purpose of visit..."
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <label className="label text-xs">Location</label>
                    <input
                      type="text"
                      value={visit.location}
                      onChange={(e) => updateVisit(index, 'location', e.target.value)}
                      className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
                      disabled={readOnly}
                      placeholder="Meeting location..."
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="label text-xs">Visit Notes</label>
                    <textarea
                      value={visit.notes}
                      onChange={(e) => updateVisit(index, 'notes', e.target.value)}
                      className="input text-sm min-h-[60px] disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Additional notes for this visit..."
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={() => navigate('/itinerary')}
          className="btn-secondary"
        >
          {readOnly ? 'Back' : 'Cancel'}
        </button>
        {!readOnly && (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}