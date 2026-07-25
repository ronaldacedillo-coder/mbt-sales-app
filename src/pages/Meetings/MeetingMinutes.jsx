import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Plus,
  FileText,
  Send,
  Users,
  Calendar,
  Clock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Save
} from 'lucide-react'
import { format } from 'date-fns'

export const MeetingMinutes = () => {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    account_id: '',
    meeting_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    end_time: '',
    location: '',
    attendees: [''],
    agenda: '',
    discussion_points: [],
    decisions: [],
    action_items: [],
    next_meeting_date: '',
    notes: '',
  })

  useEffect(() => {
    fetchMeetings()
    fetchAccounts()
  }, [user])

  const fetchMeetings = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          account:accounts(company_name)
        `)
        .eq('created_by', user.id)
        .order('meeting_date', { ascending: false })
      if (error) throw error
      setMeetings(data || [])
    } catch (error) {
      console.error('Error fetching meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, company_name')
      .eq('created_by', user.id)
      .order('company_name')
    setAccounts(data || [])
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addAttendee = () => {
    setFormData(prev => ({ ...prev, attendees: [...prev.attendees, ''] }))
  }

  const updateAttendee = (index, value) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.map((a, i) => i === index ? value : a)
    }))
  }

  const removeAttendee = (index) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index)
    }))
  }

  const addDiscussionPoint = () => {
    setFormData(prev => ({
      ...prev,
      discussion_points: [...prev.discussion_points, { topic: '', details: '', owner: '' }]
    }))
  }

  const updateDiscussionPoint = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      discussion_points: prev.discussion_points.map((dp, i) => 
        i === index ? { ...dp, [field]: value } : dp
      )
    }))
  }

  const removeDiscussionPoint = (index) => {
    setFormData(prev => ({
      ...prev,
      discussion_points: prev.discussion_points.filter((_, i) => i !== index)
    }))
  }

  const addDecision = () => {
    setFormData(prev => ({
      ...prev,
      decisions: [...prev.decisions, '']
    }))
  }

  const updateDecision = (index, value) => {
    setFormData(prev => ({
      ...prev,
      decisions: prev.decisions.map((d, i) => i === index ? value : d)
    }))
  }

  const removeDecision = (index) => {
    setFormData(prev => ({
      ...prev,
      decisions: prev.decisions.filter((_, i) => i !== index)
    }))
  }

  const addActionItem = () => {
    setFormData(prev => ({
      ...prev,
      action_items: [...prev.action_items, { task: '', assigned_to: '', due_date: '' }]
    }))
  }

  const updateActionItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      action_items: prev.action_items.map((ai, i) => 
        i === index ? { ...ai, [field]: value } : ai
      )
    }))
  }

  const removeActionItem = (index) => {
    setFormData(prev => ({
      ...prev,
      action_items: prev.action_items.filter((_, i) => i !== index)
    }))
  }

  const generateMinutes = () => {
    const account = accounts.find(a => a.id === formData.account_id)
    const minutes = `
MEETING MINUTES
===============

Meeting Title: ${formData.title}
Date: ${formData.meeting_date}
Time: ${formData.start_time} - ${formData.end_time}
Location: ${formData.location || 'Not specified'}
Account: ${account?.company_name || 'Not specified'}

ATTENDEES
---------
${formData.attendees.filter(a => a).map(a => `- ${a}`).join('\n')}

AGENDA
------
${formData.agenda}

DISCUSSION POINTS
-----------------
${formData.discussion_points.map((dp, i) => `
${i + 1}. ${dp.topic}
   Details: ${dp.details}
   Owner: ${dp.owner || 'Not assigned'}
`).join('')}

DECISIONS MADE
--------------
${formData.decisions.filter(d => d).map((d, i) => `${i + 1}. ${d}`).join('\n')}

ACTION ITEMS
------------
${formData.action_items.map((ai, i) => `
${i + 1}. ${ai.task}
   Assigned to: ${ai.assigned_to || 'Not assigned'}
   Due date: ${ai.due_date || 'Not set'}
`).join('')}

NEXT MEETING
------------
${formData.next_meeting_date ? `Scheduled for: ${formData.next_meeting_date}` : 'No next meeting scheduled'}

ADDITIONAL NOTES
----------------
${formData.notes || 'None'}

---
Generated by MBT Sales Operations System
Date: ${format(new Date(), 'MMMM dd, yyyy')}
    `.trim()
    return minutes
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        ...formData,
        account_id: formData.account_id || null,
        minutes_text: generateMinutes(),
        created_by: user.id,
      }

      const { error } = await supabase.from('meetings').insert([payload])
      if (error) throw error

      setSuccess('Meeting minutes saved successfully!')
      setShowForm(false)
      fetchMeetings()
      
      setFormData({
        title: '',
        account_id: '',
        meeting_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '',
        end_time: '',
        location: '',
        attendees: [''],
        agenda: '',
        discussion_points: [],
        decisions: [],
        action_items: [],
        next_meeting_date: '',
        notes: '',
      })
    } catch (err) {
      setError(err.message || 'Failed to save meeting minutes')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard!')
    setTimeout(() => setSuccess(''), 3000)
  }

  const downloadMinutes = (meeting) => {
    const blob = new Blob([meeting.minutes_text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Meeting_Minutes_${meeting.title.replace(/\s+/g, '_')}_${meeting.meeting_date}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Minutes</h1>
          <p className="text-gray-500 mt-1">Generate and manage meeting minutes</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          {showForm ? 'Cancel' : <><Plus size={18} /> New Meeting Minutes</>}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      {/* Meeting Minutes Form */}
      {showForm && (
        <div className="card space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Create Meeting Minutes</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Meeting Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="input"
                placeholder="e.g., Q3 Strategy Review"
                required
              />
            </div>
            <div>
              <label className="label">Account</label>
              <select
                value={formData.account_id}
                onChange={(e) => handleChange('account_id', e.target.value)}
                className="input"
              >
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Meeting Date *</label>
              <input
                type="date"
                value={formData.meeting_date}
                onChange={(e) => handleChange('meeting_date', e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => handleChange('start_time', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => handleChange('end_time', e.target.value)}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="input"
                placeholder="Meeting location or video link"
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Attendees</label>
              <button onClick={addAttendee} className="text-sm text-primary-600 hover:text-primary-700">
                + Add Attendee
              </button>
            </div>
            <div className="space-y-2">
              {formData.attendees.map((attendee, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={attendee}
                    onChange={(e) => updateAttendee(index, e.target.value)}
                    className="input flex-1"
                    placeholder={`Attendee ${index + 1}`}
                  />
                  {formData.attendees.length > 1 && (
                    <button onClick={() => removeAttendee(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div>
            <label className="label">Agenda</label>
            <textarea
              value={formData.agenda}
              onChange={(e) => handleChange('agenda', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Meeting agenda..."
            />
          </div>

          {/* Discussion Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Discussion Points</label>
              <button onClick={addDiscussionPoint} className="text-sm text-primary-600 hover:text-primary-700">
                + Add Point
              </button>
            </div>
            <div className="space-y-2">
              {formData.discussion_points.map((point, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-primary-600">Point {index + 1}</span>
                    <button onClick={() => removeDiscussionPoint(index)} className="text-red-500 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      value={point.topic}
                      onChange={(e) => updateDiscussionPoint(index, 'topic', e.target.value)}
                      className="input text-sm"
                      placeholder="Topic"
                    />
                    <textarea
                      value={point.details}
                      onChange={(e) => updateDiscussionPoint(index, 'details', e.target.value)}
                      className="input text-sm min-h-[60px]"
                      placeholder="Discussion details..."
                    />
                    <input
                      type="text"
                      value={point.owner}
                      onChange={(e) => updateDiscussionPoint(index, 'owner', e.target.value)}
                      className="input text-sm"
                      placeholder="Owner"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decisions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Decisions Made</label>
              <button onClick={addDecision} className="text-sm text-primary-600 hover:text-primary-700">
                + Add Decision
              </button>
            </div>
            <div className="space-y-2">
              {formData.decisions.map((decision, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={decision}
                    onChange={(e) => updateDecision(index, e.target.value)}
                    className="input flex-1"
                    placeholder={`Decision ${index + 1}`}
                  />
                  <button onClick={() => removeDecision(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Action Items</label>
              <button onClick={addActionItem} className="text-sm text-primary-600 hover:text-primary-700">
                + Add Action Item
              </button>
            </div>
            <div className="space-y-2">
              {formData.action_items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-primary-600">Action {index + 1}</span>
                    <button onClick={() => removeActionItem(index)} className="text-red-500 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={item.task}
                      onChange={(e) => updateActionItem(index, 'task', e.target.value)}
                      className="input text-sm md:col-span-2"
                      placeholder="Task description"
                    />
                    <input
                      type="text"
                      value={item.assigned_to}
                      onChange={(e) => updateActionItem(index, 'assigned_to', e.target.value)}
                      className="input text-sm"
                      placeholder="Assigned to"
                    />
                    <input
                      type="date"
                      value={item.due_date}
                      onChange={(e) => updateActionItem(index, 'due_date', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Next Meeting Date</label>
            <input
              type="date"
              value={formData.next_meeting_date}
              onChange={(e) => handleChange('next_meeting_date', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Meeting Minutes'}
            </button>
          </div>
        </div>
      )}

      {/* Meeting List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : meetings.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No meeting minutes yet</h3>
          <p className="text-gray-500 mt-1">Create your first meeting minutes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {meeting.meeting_date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {meeting.start_time} - {meeting.end_time}
                    </span>
                    {meeting.account && (
                      <span className="flex items-center gap-1.5">
                        <Users size={14} />
                        {meeting.account.company_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {meeting.attendees?.filter(a => a).length || 0} attendees
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => copyToClipboard(meeting.minutes_text)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => downloadMinutes(meeting)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
              
              {meeting.minutes_text && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {meeting.minutes_text}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}