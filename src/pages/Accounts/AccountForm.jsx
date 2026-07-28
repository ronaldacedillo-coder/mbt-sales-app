import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { TRADE_TERMS, TRADE_TERMS_LABELS, DISTRIBUTOR_OPTIONS, CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS } from '../../utils/accounts'
import {
  ArrowLeft,
  Building2,
  Save,
  AlertCircle,
  Lightbulb,
  Sparkles,
  HandCoins
} from 'lucide-react'

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
  project_contractor: [
    'Focus on project timelines and on-time equipment delivery',
    'Highlight technical support during installation and commissioning',
    'Discuss volume/project-based pricing for multiple units',
    'Emphasize after-sales service and warranty coverage'
  ],
  fitout_contractor: [
    'Focus on fast turnaround for interior fit-out schedules',
    'Highlight compact, space-efficient unit options',
    'Discuss flexible delivery windows to match fit-out phases',
    'Emphasize aesthetics and low-noise operation for occupied spaces'
  ],
  general_contractor: [
    'Focus on reliability across multiple concurrent projects',
    'Highlight consistent supply and inventory availability',
    'Discuss bulk/project pricing and payment terms',
    'Emphasize coordination with MEP subcontractors'
  ],
  architect: [
    'Focus on design flexibility and product specification support',
    'Highlight energy efficiency ratings and green building compliance',
    'Discuss technical documentation and spec sheet availability',
    'Emphasize aesthetics and integration with building design'
  ],
  land_developer: [
    'Focus on long-term partnership across multiple development phases',
    'Highlight scalable solutions for master-planned communities',
    'Discuss developer pricing and bulk procurement terms',
    'Emphasize brand reputation and buyer confidence'
  ],
  institutional_account: [
    'Focus on standardization across multiple branches/sites',
    'Highlight centralized procurement and consistent service support',
    'Discuss maintenance contracts and long-term service agreements',
    'Emphasize reliability and minimal downtime for operations'
  ],
  distributor: [
    'Focus on territory coverage and channel growth potential',
    'Highlight margin structure and volume incentive programs',
    'Discuss marketing/co-op support and lead sharing',
    'Emphasize product training and technical support for their downline'
  ],
  dealer: [
    'Focus on sell-through support and showroom-ready materials',
    'Highlight dealer pricing tiers and promo/rebate programs',
    'Discuss stock availability and order lead times',
    'Emphasize brand support -- training, signage, and marketing collateral'
  ],
  other: [
    'Focus on understanding the account\'s specific needs',
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
    customer_type: '',
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
  const [teamMembers, setTeamMembers] = useState([])

  useEffect(() => {
    if (isEdit) fetchAccount()
    fetchTeamMembers()
  }, [id])

  // ASE/TSE assigns the account to whoever will actually cover it in the
  // field. Not every account is an MBT Sales (contractor) account -- Land
  // Developers, Institutional Accounts, HVAC Consultants, Architects, and
  // General Contractors are typically BD Team territory, so BD Engineers
  // need to show up here too, not just Sales Engineers. Roles 'se'/'bd' are
  // the short codes MBT Project Pipeline stores (see PIPELINE_ROLE_MAP in
  // utils/roles.js), which is what this shared user_profiles table uses
  // regardless of which app you're in.
  //
  // EXCLUDED_MEMBER_IDS -- reps kept out of the assignment dropdown by
  // request (e.g. no longer covering accounts here), without touching
  // their actual user_profiles.role, which is shared with MBT Project
  // Pipeline and shouldn't be changed just to hide someone from this list.
  // Elmer Anthony Cubita, 2026-07-26.
  const EXCLUDED_MEMBER_IDS = ['57a08234-7fd6-4c3b-be5a-f3c0342e3ec5']

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, name, role')
      .in('role', ['se', 'bd'])
      .order('name')
    setTeamMembers((data || []).filter(m => !EXCLUDED_MEMBER_IDS.includes(m.id)))
  }

  const salesEngineers = teamMembers.filter(m => m.role === 'se')
  const bdEngineers = teamMembers.filter(m => m.role === 'bd')

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
    if (!formData.customer_type) {
      setError('Please select a Customer Type first')
      return
    }

    setGeneratingRecommendation(true)

    // Simulate AI recommendation based on customer type
    setTimeout(() => {
      const strategies = APPROACH_STRATEGIES[formData.customer_type] || APPROACH_STRATEGIES.other
      const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)]
      const customerTypeLabel = CUSTOMER_TYPE_LABELS[formData.customer_type] || formData.customer_type

      const recommendation = `${randomStrategy}. Based on ${formData.company_size || 'the company size'} as a ${customerTypeLabel}, prioritize ${formData.pain_points ? 'addressing their pain points: ' + formData.pain_points : 'understanding their operational challenges'}. ${formData.goals ? 'Align with their goals: ' + formData.goals : 'Focus on demonstrating clear ROI and value proposition.'}`

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
              <label className="label">Customer Type</label>
              <select
                value={formData.customer_type}
                onChange={(e) => handleChange('customer_type', e.target.value)}
                className="input"
              >
                <option value="">Select customer type</option>
                {/* Keeps a previously-set value visible even if it doesn't match
                    a current Customer Type (this account still had the old
                    "Industry" value, e.g. "Construction" or "Retail") instead
                    of silently blanking it out. */}
                {formData.customer_type && !CUSTOMER_TYPES.some(ct => ct.value === formData.customer_type) && (
                  <option value={formData.customer_type}>{formData.customer_type}</option>
                )}
                {CUSTOMER_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
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
              <select
                value={formData.ase_tse}
                onChange={(e) => handleChange('ase_tse', e.target.value)}
                className="input"
              >
                <option value="">Assign a Sales Engineer or BD Engineer</option>
                {/* Keeps a previously-set value visible even if it doesn't match
                    a current team member (renamed, deactivated, or set before
                    this became a dropdown) instead of silently blanking it out. */}
                {formData.ase_tse && !teamMembers.some(m => m.name === formData.ase_tse) && (
                  <option value={formData.ase_tse}>{formData.ase_tse}</option>
                )}
                <optgroup label="Sales Engineers">
                  {salesEngineers.map(se => (
                    <option key={se.id} value={se.name}>{se.name}</option>
                  ))}
                </optgroup>
                <optgroup label="BD Engineers">
                  {bdEngineers.map(bd => (
                    <option key={bd.id} value={bd.name}>{bd.name}</option>
                  ))}
                </optgroup>
              </select>
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
              <p className="text-xs text-gray-400 mt-0.5">A starting-point suggestion based on customer type and the details you've entered below -- not a substitute for your own read of the account. Edit freely.</p>
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
        <div className="flex flex-wrap items-center justify-end gap-3">
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