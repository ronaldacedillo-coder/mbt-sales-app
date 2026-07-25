import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, getTeamType, getApproverRole } from '../../utils/roles'
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  User,
  MessageSquare,
  Target,
  Lightbulb
} from 'lucide-react'
import { format } from 'date-fns'

// Discussion guide templates based on team type
const DISCUSSION_GUIDES = {
  mbt_sales: [
    { topic: 'Current Operations', questions: ['What are your current operational challenges?', 'How do you manage your daily workflows?', 'What tools are you currently using?'] },
    { topic: 'Pain Points', questions: ['What frustrates you most about your current process?', 'Where do you see inefficiencies?', 'What takes up most of your time?'] },
    { topic: 'Goals & Objectives', questions: ['What are your top priorities this quarter?', 'What does success look like for your team?', 'What metrics do you track?'] },
    { topic: 'Budget & Timeline', questions: ['What is your budget range for this initiative?', 'What is your expected timeline?', 'Who else is involved in the decision?'] },
    { topic: 'Competition', questions: ['What other solutions are you considering?', 'What do you like/dislike about them?', 'What would make you choose us?'] },
  ],
  business_development: [
    { topic: 'Market Position', questions: ['How do you position yourself in the market?', 'What is your unique value proposition?', 'Who are your main competitors?'] },
    { topic: 'Growth Strategy', questions: ['What are your growth targets?', 'What markets are you looking to expand into?', 'What partnerships are you seeking?'] },
    { topic: 'Challenges', questions: ['What barriers are you facing to growth?', 'What resources do you need?', 'What is your biggest risk?'] },
    { topic: 'Collaboration Opportunities', questions: ['How can we collaborate effectively?', 'What synergies do you see?', 'What would a successful partnership look like?'] },
    { topic: 'Next Steps', questions: ['What are the immediate next steps?', 'Who should be involved in follow-up?', 'What is your preferred timeline?'] },
  ]
}

export const FCRForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role, profile } = useAuth()
  const isEdit = Boolean(id)
  const teamType = getTeamType(role)
  const discussionGuide = DISCUSSION_GUIDES[teamType] || DISCUSSION_GUIDES.mbt_sales

  const [formData, setFormData] = useState({
    account_id: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    visit_type: 'field_visit',
    attendees: [''],
    discussion_points: [],
    action_items: [],
    next_steps: '',
    follow_up_date: '',
    status: 'draft',
    notes: '',
  })
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeGuide, setActiveGuide] = useState(null)

  useEffect(() => {
    fetchAccounts()
    if (isEdit) fetchFCR()
  }, [id])

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, company_name, city, contact_name')
      .eq('created_by', user.id)
      .order('company_name')
    setAccounts(data || [])
  }

  const fetchFCR = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('fcrs')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      if (data) {
        setFormData({
          ...data,
          visit_date: data.visit_date,
          attendees: data.attendees || [''],
          discussion_points: data.discussion_points || [],
          action_items: data.action_items || [],
        })
      }
    } catch (err) {
      setError('Failed to load FCR')
    } finally {
      setLoading(false)
    }
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
      discussion_points: [...prev.discussion_points, { topic: '', notes: '', outcome: '' }]
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

  const addActionItem = () => {
    setFormData(prev => ({
      ...prev,
      action_items: [...prev.action_items, { task: '', assigned_to: '', due_date: '', status: 'pending' }]
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

  const handleSave = async (status = 'draft') => {
    setSaving(true)
    setError('')

    try {
      const payload = {
        ...formData,
        status: status,
        created_by: user.id,
        submitter_role: role,
        approver_role: getApproverRole(role),
      }

      if (isEdit) {
        const { error } = await supabase
          .from('fcrs')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('fcrs')
          .insert([payload])
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
    if (!formData.account_id) {
      setError('Please select an account')
      return
    }
    if (formData.discussion_points.length === 0) {
      setError('Please add at least one discussion point')
      return
    }
    handleSave('pending_approval')
  }

  const applyGuideQuestions = (topic, questions) => {
    setActiveGuide(topic)
    const newPoints = questions.map(q => ({
      topic: topic,
      notes: q,
      outcome: ''
    }))
    setFormData(prev => ({
      ...prev,
      discussion_points: [...prev.discussion_points, ...newPoints]
    }))
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
          onClick={() => navigate('/fcr')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Field Contact Report' : 'New Field Contact Report'}
          </h1>
          <p className="text-gray-500 text-sm">
            {teamType === 'mbt_sales' ? 'MBT Sales Team Template' : 'Business Development Team Template'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} />
          Visit Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Account *</label>
            <select
              value={formData.account_id}
              onChange={(e) => handleChange('account_id', e.target.value)}
              className="input"
              required
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
            <label className="label">Visit Date *</label>
            <input
              type="date"
              value={formData.visit_date}
              onChange={(e) => handleChange('visit_date', e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Visit Type</label>
            <select
              value={formData.visit_type}
              onChange={(e) => handleChange('visit_type', e.target.value)}
              className="input"
            >
              <option value="field_visit">Field Visit</option>
              <option value="phone_call">Phone Call</option>
              <option value="video_call">Video Call</option>
              <option value="meeting">In-Person Meeting</option>
              <option value="presentation">Presentation</option>
            </select>
          </div>
          <div>
            <label className="label">Follow-up Date</label>
            <input
              type="date"
              value={formData.follow_up_date}
              onChange={(e) => handleChange('follow_up_date', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Attendees */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User size={20} />
            Attendees
          </h3>
          <button
            onClick={addAttendee}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus size={14} />
            Add Attendee
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
                placeholder={`Attendee ${index + 1} name`}
              />
              {formData.attendees.length > 1 && (
                <button
                  onClick={() => removeAttendee(index)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Discussion Guide */}
      <div className="card border-2 border-amber-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lightbulb size={20} className="text-amber-600" />
          Discussion Guide
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Click on a topic to add guided discussion points to your FCR
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {discussionGuide.map((guide) => (
            <button
              key={guide.topic}
              onClick={() => applyGuideQuestions(guide.topic, guide.questions)}
              className={`p-3 rounded-lg border text-left text-sm transition-all ${
                activeGuide === guide.topic
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50'
              }`}
            >
              <span className="font-medium">{guide.topic}</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {guide.questions.length} questions
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Discussion Points */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} />
            Discussion Points
          </h3>
          <button
            onClick={addDiscussionPoint}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus size={14} />
            Add Point
          </button>
        </div>

        {formData.discussion_points.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No discussion points yet</p>
            <p className="text-xs text-gray-400 mt-1">Use the Discussion Guide above or add manually</p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.discussion_points.map((point, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                    Point {index + 1}
                  </span>
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
                    value={point.notes}
                    onChange={(e) => updateDiscussionPoint(index, 'notes', e.target.value)}
                    className="input text-sm min-h-[60px]"
                    placeholder="Discussion notes..."
                  />
                  <input
                    type="text"
                    value={point.outcome}
                    onChange={(e) => updateDiscussionPoint(index, 'outcome', e.target.value)}
                    className="input text-sm"
                    placeholder="Outcome / Key takeaway"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Items */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target size={20} />
            Action Items
          </h3>
          <button
            onClick={addActionItem}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus size={14} />
            Add Action Item
          </button>
        </div>

        {formData.action_items.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Target size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No action items yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.action_items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                    Action {index + 1}
                  </span>
                  <button onClick={() => removeActionItem(index)} className="text-red-500 text-xs">Remove</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={item.task}
                      onChange={(e) => updateActionItem(index, 'task', e.target.value)}
                      className="input text-sm"
                      placeholder="Task description"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={item.assigned_to}
                      onChange={(e) => updateActionItem(index, 'assigned_to', e.target.value)}
                      className="input text-sm"
                      placeholder="Assigned to"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={item.due_date}
                      onChange={(e) => updateActionItem(index, 'due_date', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <select
                      value={item.status}
                      onChange={(e) => updateActionItem(index, 'status', e.target.value)}
                      className="input text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Steps & Notes */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Summary</h3>
        <div>
          <label className="label">Next Steps</label>
          <textarea
            value={formData.next_steps}
            onChange={(e) => handleChange('next_steps', e.target.value)}
            className="input min-h-[80px]"
            placeholder="What are the next steps after this visit?"
          />
        </div>
        <div>
          <label className="label">Additional Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="input min-h-[80px]"
            placeholder="Any other observations or notes..."
          />
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/fcr')}
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