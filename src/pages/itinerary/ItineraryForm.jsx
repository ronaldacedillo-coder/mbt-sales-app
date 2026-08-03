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
  CalendarDays,
  X,
  Pencil
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'

export const ItineraryForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
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
  const [view, setView] = useState('calendar')
  // Entry now happens directly on the calendar via this modal -- clicking a
  // day (new) or a visit chip (edit) opens it right here instead of
  // switching to the List view, so the whole itinerary is entered from one
  // page. { mode: 'new'|'edit', draft, index } while open, null when closed.
  const [modalVisit, setModalVisit] = useState(null)

  // VIEWER (Product Manager / HVAC Director) can open any MCP (Plan) to
  // look at it, but never edits one -- every input, calendar drag, and
  // action button below is disabled/hidden for them. Same treatment for
  // anyone opening a plan they didn't create themselves -- in practice
  // that's the NSM/Commercial AC Head reviewing a rep's submission from
  // ItineraryList or MCP (Plan) Approvals, who should be able to see the
  // full plan (including the calendar view) without risking an accidental
  // edit to someone else's submission. Approve/Reject stays on the
  // Approvals page, not here.
  const readOnly = role === ROLES.VIEWER || (isEdit && formData.created_by && formData.created_by !== user.id)

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

  const blankVisit = (prefillDate = '') => ({
    id: crypto.randomUUID(),
    account_id: '',
    visit_date: prefillDate,
    period: 'AM',
    purpose: '',
    estimated_duration: '',
    location: '',
    notes: ''
  })

  const addVisit = (prefillDate = '') => {
    const draft = blankVisit(prefillDate)
    setFormData(prev => ({ ...prev, visits: [...prev.visits, draft] }))
    return draft.id
  }

  // Clicking an empty day (or its "+") on the calendar opens the entry
  // modal pre-filled with that date, in "new" mode -- nothing is added to
  // formData.visits until Submit is pressed inside the modal.
  const addVisitFromCalendar = (dateStr) => {
    setModalVisit({ mode: 'new', draft: blankVisit(dateStr) })
  }

  // Clicking an existing visit chip opens the same modal, pre-filled with
  // that visit, in "edit" mode.
  const selectVisitFromCalendar = (visitId) => {
    const index = formData.visits.findIndex(v => v.id === visitId)
    if (index === -1) return
    setModalVisit({ mode: 'edit', index, draft: { ...formData.visits[index] } })
  }

  const handleModalFieldChange = (field, value) => {
    setModalVisit(prev => prev && ({ ...prev, draft: { ...prev.draft, [field]: value } }))
  }

  const handleModalSubmit = () => {
    if (!modalVisit) return
    if (!modalVisit.draft.account_id || !modalVisit.draft.visit_date) {
      setError('Pick an account and a visit date before submitting.')
      return
    }
    setError('')
    setFormData(prev => ({
      ...prev,
      visits: modalVisit.mode === 'edit'
        ? prev.visits.map((v, i) => (i === modalVisit.index ? modalVisit.draft : v))
        : [...prev.visits, modalVisit.draft]
    }))
    setModalVisit(null)
  }

  const handleModalDelete = () => {
    if (!modalVisit || modalVisit.mode !== 'edit') return
    setFormData(prev => ({ ...prev, visits: prev.visits.filter((_, i) => i !== modalVisit.index) }))
    setModalVisit(null)
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
              // MCP (Plan) is a forward-looking schedule -- a rep proposes
              // visits for a month that hasn't happened yet, so the picker
              // only allows the current month or later. Doesn't retroactively
              // block an already-saved past month from displaying/editing
              // (min just constrains what a new pick can be), which matters
              // for old drafts.
              min={format(startOfMonth(new Date()), 'yyyy-MM')}
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

      {modalVisit && (
        <VisitEntryModal
          modalVisit={modalVisit}
          accounts={accounts}
          readOnly={readOnly}
          onFieldChange={handleModalFieldChange}
          onSubmit={handleModalSubmit}
          onDelete={handleModalDelete}
          onClose={() => setModalVisit(null)}
          onLogFcr={(visit) => navigate('/fcr/new', {
            state: { prefill: { account_id: visit.account_id, visit_date: visit.visit_date } }
          })}
        />
      )}
    </div>
  )
}

// One-page calendar entry: opened by clicking a day (new visit) or an
// existing chip (edit visit) in MonthCalendar -- see addVisitFromCalendar/
// selectVisitFromCalendar above. Submit both adds a new visit and saves
// edits to an existing one; Delete only shows up in edit mode.
const VisitEntryModal = ({ modalVisit, accounts, readOnly, onFieldChange, onSubmit, onDelete, onClose, onLogFcr }) => {
  const { mode, draft } = modalVisit
  const isEdit = mode === 'edit'

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit visit' : 'Add visit'}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            {isEdit ? <Pencil size={16} className="text-primary-600" /> : <Plus size={16} className="text-primary-600" />}
            {isEdit ? 'Edit Visit' : 'Add Visit'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label text-xs">Account</label>
            <select
              value={draft.account_id}
              onChange={(e) => onFieldChange('account_id', e.target.value)}
              className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
              autoFocus={!readOnly}
              disabled={readOnly}
            >
              <option value="">Select account</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.company_name} ({acc.city})</option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No profiled accounts yet -- <Link to="/accounts/new" className="underline">create one</Link> (with Trade Terms filled in) first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Visit Date</label>
              <input
                type="date"
                value={draft.visit_date}
                onChange={(e) => onFieldChange('visit_date', e.target.value)}
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
                    onClick={() => onFieldChange('period', p)}
                    disabled={readOnly}
                    className={`flex-1 py-2 font-medium transition-colors disabled:cursor-default ${
                      (draft.period || 'AM') === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 disabled:hover:bg-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label text-xs">Estimated Duration</label>
            <input
              type="text"
              value={draft.estimated_duration}
              onChange={(e) => onFieldChange('estimated_duration', e.target.value)}
              className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="e.g., 2 hours"
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="label text-xs">Purpose</label>
            <input
              type="text"
              value={draft.purpose}
              onChange={(e) => onFieldChange('purpose', e.target.value)}
              className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Purpose of visit..."
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="label text-xs">Location</label>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => onFieldChange('location', e.target.value)}
              className="input text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Meeting location..."
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="label text-xs">Visit Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => onFieldChange('notes', e.target.value)}
              className="input text-sm min-h-[60px] disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Additional notes for this visit..."
              disabled={readOnly}
            />
          </div>

          {isEdit && !readOnly && draft.account_id && (
            <button
              type="button"
              onClick={() => onLogFcr(draft)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline"
            >
              <ClipboardCheck size={13} /> Log FCR for this visit
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          {isEdit && !readOnly ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {readOnly ? (
              <button onClick={onClose} className="btn-secondary text-sm">Close</button>
            ) : (
              <>
                <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
                <button onClick={onSubmit} className="btn-primary flex items-center gap-2 text-sm">
                  <Send size={14} /> Submit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}