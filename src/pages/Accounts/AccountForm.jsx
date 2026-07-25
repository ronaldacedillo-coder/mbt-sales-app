import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  ArrowLeft, 
  Building2, 
  Save, 
  AlertCircle,
  Lightbulb,
  Sparkles
} from 'lucide-react'

const INDUSTRIES = [
  'Manufacturing', 'Healthcare', 'Retail', 'Technology', 
  'Finance', 'Education', 'Construction', 'Logistics',
  'Energy', 'Agriculture', 'Hospitality', 'Other'
]

const COMPANY_SIZES = [
  '1-10 employees', '11-50 employees', '51-200 employees',
  '201-500 employees', '501-1000 employees', '1000+ employees'
]

const PRIORITIES = [
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
]

const APPROACH_STRATEGIES = {
  manufacturing: [
    'Focus on operational efficiency and cost reduction',
    'Highlight automation and Industry 4.0 solutions',
    'Emphasize supply chain optimization',
    'Discuss quality control and compliance standards'
  ],
  healthcare: [
    'Focus on patient care improvement and safety',
    'Highlight regulatory compliance and certifications',
    'Discuss data security and HIPAA compliance',
    'Emphasize cost-effective healthcare delivery'
  ],
  retail: [
    'Focus on customer experience enhancement',
    'Highlight inventory management solutions',
    'Discuss omnichannel strategies',
    'Emphasize data-driven decision making'
  ],
  technology: [
    'Focus on innovation and scalability',
    'Highlight integration capabilities',
    'Discuss cybersecurity and data protection',
    'Emphasize agile development practices'
  ],
  finance: [
    'Focus on risk management and compliance',
    'Highlight digital transformation',
    'Discuss customer trust and security',
    'Emphasize regulatory adherence'
  ],
  education: [
    'Focus on student outcomes and engagement',
    'Highlight technology integration',
    'Discuss accessibility and inclusivity',
    'Emphasize cost-effective solutions'
  ],
  construction: [
    'Focus on project efficiency and safety',
    'Highlight sustainable building practices',
    'Discuss supply chain management',
    'Emphasize quality and compliance'
  ],
  logistics: [
    'Focus on supply chain optimization',
    'Highlight real-time tracking solutions',
    'Discuss cost reduction strategies',
    'Emphasize delivery reliability'
  ],
  energy: [
    'Focus on sustainability and efficiency',
    'Highlight renewable energy solutions',
    'Discuss regulatory compliance',
    'Emphasize cost management'
  ],
  agriculture: [
    'Focus on yield optimization',
    'Highlight precision agriculture',
    'Discuss sustainability practices',
    'Emphasize supply chain integration'
  ],
  hospitality: [
    'Focus on guest experience',
    'Highlight operational efficiency',
    'Discuss technology integration',
    'Emphasize brand reputation'
  ],
  other: [
    'Focus on understanding unique business needs',
    'Highlight customizable solutions',
    'Discuss ROI and value proposition',
    'Emphasize partnership approach'
  ]
}

export const AccountForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    company_size: '',
    website: '',
    description: '',
    address: '',
    city: '',
    country: '',
    contact_name: '',
    contact_title: '',
    contact_email: '',
    contact_phone: '',
    decision_maker: '',
    decision_maker_title: '',
    budget_range: '',
    current_solution: '',
    pain_points: '',
    goals: '',
    priority: 'medium',
    notes: '',
    recommended_approach: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generatingRecommendation, setGeneratingRecommendation] = useState(false)

  useEffect(() => {
    if (isEdit) fetchAccount()
  }, [id])

  const fetchAccount = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      if (data) setFormData(data)
    } catch (err) {
      setError('Failed to load account')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const generateRecommendation = () => {
    if (!formData.industry) {
      setError('Please select an industry first')
      return
    }
    
    setGeneratingRecommendation(true)
    
    // Simulate AI recommendation based on industry
    setTimeout(() => {
      const strategies = APPROACH_STRATEGIES[formData.industry.toLowerCase()] || APPROACH_STRATEGIES.other
      const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)]
      
      const recommendation = `${randomStrategy}. Based on ${formData.company_size || 'the company size'} in the ${formData.industry} sector, prioritize ${formData.pain_points ? 'addressing their pain points: ' + formData.pain_points : 'understanding their operational challenges'}. ${formData.goals ? 'Align with their goals: ' + formData.goals : 'Focus on demonstrating clear ROI and value proposition.'}`
      
      handleChange('recommended_approach', recommendation)
      setGeneratingRecommendation(false)
    }, 1500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        ...formData,
        created_by: user.id,
      }

      if (isEdit) {
        const { error } = await supabase
          .from('accounts')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('accounts')
          .insert([payload])
        if (error) throw error
      }

      navigate('/accounts')
    } catch (err) {
      setError(err.message || 'Failed to save account')
    } finally {
      setSaving(false)
    }
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
          onClick={() => navigate('/accounts')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Account' : 'New Account'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isEdit ? 'Update prospect account details' : 'Register a new prospect account'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={20} />
            Company Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Company Name *</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className="input"
                placeholder="Enter company name"
                required
              />
            </div>

            <div>
              <label className="label">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                className="input"
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind.toLowerCase()}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Company Size</label>
              <select
                value={formData.company_size}
                onChange={(e) => handleChange('company_size', e.target.value)}
                className="input"
              >
                <option value="">Select size</option>
                {COMPANY_SIZES.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                className="input"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="input"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">Company Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="input min-h-[80px]"
                placeholder="Brief description of the company..."
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="label">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="input"
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="input"
                placeholder="City"
              />
            </div>
            <div>
              <label className="label">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="input"
                placeholder="Country"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Primary Contact Name</label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                className="input"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label">Contact Title</label>
              <input
                type="text"
                value={formData.contact_title}
                onChange={(e) => handleChange('contact_title', e.target.value)}
                className="input"
                placeholder="e.g., Operations Manager"
              />
            </div>
            <div>
              <label className="label">Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                className="input"
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                className="input"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="label">Decision Maker Name</label>
              <input
                type="text"
                value={formData.decision_maker}
                onChange={(e) => handleChange('decision_maker', e.target.value)}
                className="input"
                placeholder="Name of decision maker"
              />
            </div>
            <div>
              <label className="label">Decision Maker Title</label>
              <input
                type="text"
                value={formData.decision_maker_title}
                onChange={(e) => handleChange('decision_maker_title', e.target.value)}
                className="input"
                placeholder="e.g., CEO, VP of Operations"
              />
            </div>
          </div>
        </div>

        {/* Business Intelligence */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Intelligence</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Budget Range</label>
              <input
                type="text"
                value={formData.budget_range}
                onChange={(e) => handleChange('budget_range', e.target.value)}
                className="input"
                placeholder="e.g., $50K - $100K"
              />
            </div>
            <div>
              <label className="label">Current Solution</label>
              <input
                type="text"
                value={formData.current_solution}
                onChange={(e) => handleChange('current_solution', e.target.value)}
                className="input"
                placeholder="What are they currently using?"
              />
            </div>
            <div>
              <label className="label">Pain Points</label>
              <textarea
                value={formData.pain_points}
                onChange={(e) => handleChange('pain_points', e.target.value)}
                className="input min-h-[80px]"
                placeholder="What challenges are they facing?"
              />
            </div>
            <div>
              <label className="label">Goals & Objectives</label>
              <textarea
                value={formData.goals}
                onChange={(e) => handleChange('goals', e.target.value)}
                className="input min-h-[80px]"
                placeholder="What are they trying to achieve?"
              />
            </div>
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="card border-2 border-primary-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={20} className="text-primary-600" />
              AI Recommended Approach
            </h3>
            <button
              type="button"
              onClick={generateRecommendation}
              disabled={generatingRecommendation}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Lightbulb size={16} />
              {generatingRecommendation ? 'Generating...' : 'Generate'}
            </button>
          </div>
          
          {formData.recommended_approach ? (
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-900 leading-relaxed">
                {formData.recommended_approach}
              </p>
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Lightbulb size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Fill in company details and click Generate to get AI recommendations</p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h3>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="input min-h-[100px]"
            placeholder="Any other relevant information..."
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/accounts')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Update Account' : 'Save Account'}
          </button>
        </div>
      </form>
    </div>
  )
}