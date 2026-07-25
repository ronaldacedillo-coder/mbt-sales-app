import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { TRADE_TERMS, TRADE_TERMS_LABELS, DISTRIBUTOR_OPTIONS } from '../../utils/accounts'
import {
  ArrowLeft,
  Building2,
  Save,
  AlertCircle,
  Lightbulb,
  Sparkles,
  HandCoins
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
    owners: '',
    region: '',
    dealer_classification: '',
    channel: '',
    ase_tse: '',
    visit_freq_days: '',
    trade_terms: '',
    distributor_name: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generatingRecommendation, setGeneratingRecommendation] = useState(false)
  const [possibleDuplicates, setPossibleDuplicates] = useState([])

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

  const checkDuplicates = async () => {
    const name = formData.company_name?.trim()
    if (!name) {
      setPossibleDuplicates([])
      return
    }
    let query = supabase
      .from('accounts')
      .select('id, company_name, city')
      .ilike('company_name', name)
    if (isEdit) query = query.neq('id', id)
    const { data } = await query
    setPossibleDuplicates(data || [])
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
    setError('')

    if (!formData.trade_terms) {
      setError('Please select Trade Terms below -- an account can\'t be saved without it, since Itinerary and FCR only let reps pick from fully profiled accounts.')
      return
    }
    if (formData.trade_terms === TRADE_TERMS.DISTRIBUTOR && !formData.distributor_name?.trim()) {
      setError('Please specify which MBT Distributor this account transacts through.')
      return
    }

    setSaving(true)
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
        navigate(`/accounts/${id}`)
      } else {
        const { error } = await supabase
          .from('accounts')
          .insert([payload])
        if (error) throw error
        navigate('/accounts')
      }
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
          onClick={() => navigate(isEdit ? `/accounts/${id}` : '/accounts')}
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
                onBlur={checkDuplicates}
                className="input"
                placeholder="Enter company name"
                required
              />
              {possibleDuplicates.length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <p className="font-medium">This looks similar to an existing account -- double check before creating a duplicate:</p>
                  <ul className="mt-1 space-y-0.5">
                    {possibleDuplicates.map(d => (
                      <li key={d.id}>
                        <Link to={`/accounts/${d.id}`} className="underline hover:text-amber-900">
                          {d.company_name}{d.city ? ` (${d.city})` : ''}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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

        {/* Trade Terms -- required. Itinerary and FCR only let reps select
            accounts that have this set, so this is the gate that makes an
            account "profiled". */}
        <div className="card border-2 border-amber-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <HandCoins size={20} />
            Trade Terms *
          </h3>
          <p className="text-xs text-gray-400 mb-4">Required -- this account won't be selectable in Itinerary or FCR until this is set.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(TRADE_TERMS).map(tt => (
              <button
                key={tt}
                type="button"
                onClick={() => handleChange('trade_terms', tt)}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  formData.trade_terms === tt ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium text-gray-900">{TRADE_TERMS_LABELS[tt]}</span>
              </button>
            ))}
          </div>

          {formData.trade_terms === TRADE_TERMS.DISTRIBUTOR && (
            <div className="mt-4">
              <label className="label">MBT Distributor *</label>
              {DISTRIBUTOR_OPTIONS.length > 0 ? (
                <select
                  value={formData.distributor_name}
                  onChange={(e) => handleChange('distributor_name', e.target.value)}
                  className="input"
                >
                  <option value="">Select distributor</option>
                  {DISTRIBUTOR_OPTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.distributor_name}
                  onChange={(e) => handleChange('distributor_name', e.target.value)}
                  className="input"
                  placeholder="Distributor name"
                />
              )}
            </div>
          )}
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

        {/* Coverage & Classification -- this is the info FCR's Customer
            Information section used to collect as free text on every visit;
            it now lives here once, and FCR just displays it read-only. */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Coverage &amp; Classification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Owner/s</label>
              <input
                type="text"
                value={formData.owners}
                onChange={(e) => handleChange('owners', e.target.value)}
                className="input"
                placeholder="Business owner(s)"
              />
            </div>
            <div>
              <label className="label">Region</label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => handleChange('region', e.target.value)}
                className="input"
                placeholder="e.g., Metro Manila East"
              />
            </div>
            <div>
              <label className="label">Dealer Classification</label>
              <input
                type="text"
                value={formData.dealer_classification}
                onChange={(e) => handleChange('dealer_classification', e.target.value)}
                className="input"
                placeholder="e.g., Gold Dealer"
              />
            </div>
            <div>
              <label className="label">Channel</label>
              <input
                type="text"
                value={formData.channel}
                onChange={(e) => handleChange('channel', e.target.value)}
                className="input"
                placeholder="e.g., Retail / Aircon Specialist"
              />
            </div>
            <div>
              <label className="label">ASE / TSE</label>
              <input
                type="text"
                value={formData.ase_tse}
                onChange={(e) => handleChange('ase_tse', e.target.value)}
                className="input"
                placeholder="Assigned ASE / TSE"
              />
            </div>
            <div>
              <label className="label">Visit Freq / Days</label>
              <input
                type="text"
                value={formData.visit_freq_days}
                onChange={(e) => handleChange('visit_freq_days', e.target.value)}
                className="input"
                placeholder="e.g., Bi-weekly / Tue & Thu"
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

        {/* Suggested Talking Points */}
        <div className="card border-2 border-primary-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles size={20} className="text-primary-600" />
                Suggested Talking Points
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">A starting-point suggestion based on industry and the details you've entered below -- not a substitute for your own read of the account. Edit freely.</p>
            </div>
            <button
              type="button"
              onClick={generateRecommendation}
              disabled={generatingRecommendation}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Lightbulb size={16} />
              {generatingRecommendation ? 'Generating...' : 'Suggest'}
            </button>
          </div>

          {formData.recommended_approach ? (
            <div className="p-4 bg-primary-50 rounded-lg">
              <textarea
                value={formData.recommended_approach}
                onChange={(e) => handleChange('recommended_approach', e.target.value)}
                className="w-full bg-transparent text-sm text-primary-900 leading-relaxed border-none focus:outline-none resize-y min-h-[60px]"
              />
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Lightbulb size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Fill in company details and click Suggest for a starting-point approach</p>
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
            onClick={() => navigate(isEdit ? `/accounts/${id}` : '/accounts')}
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