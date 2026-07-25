import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES } from '../../utils/roles'
import {
  ArrowLeft,
  Building2,
  MapPin,
  Globe,
  Mail,
  Phone,
  Star,
  Pencil,
  ClipboardCheck,
  Users,
  Calendar,
  Lightbulb,
  ChevronRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { PipelineProjectsPanel } from './PipelineProjectsPanel'

const MANAGER_ROLES = [ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]

const getStatusStyle = (status) => {
  switch (status) {
    case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'rejected': return 'bg-red-50 text-red-700 border-red-200'
    case 'pending_approval': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'low': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export const AccountDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const [account, setAccount] = useState(null)
  const [fcrs, setFcrs] = useState([])
  const [meetings, setMeetings] = useState([])
  const [itineraryVisits, setItineraryVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data: accountData, error: accountError }, { data: fcrData }, { data: meetingData }, { data: itineraryData }] = await Promise.all([
        supabase
          .from('accounts')
          .select('*, creator:user_profiles!accounts_created_by_fkey(full_name:name)')
          .eq('id', id)
          .single(),
        supabase
          .from('fcrs')
          .select('id, visit_date, status, team_type, customer_info, created_at')
          .eq('account_id', id)
          .order('visit_date', { ascending: false }),
        supabase
          .from('meetings')
          .select('id, title, meeting_date, start_time, end_time')
          .eq('account_id', id)
          .order('meeting_date', { ascending: false }),
        supabase
          .from('itineraries')
          .select('id, month, visits')
          .eq('created_by', user.id),
      ])

      if (accountError) throw accountError
      setAccount(accountData)
      setFcrs(fcrData || [])
      setMeetings(meetingData || [])

      const visits = []
      for (const itinerary of itineraryData || []) {
        for (const visit of itinerary.visits || []) {
          if (visit.account_id === id) {
            visits.push({ ...visit, itineraryId: itinerary.id })
          }
        }
      }
      visits.sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || ''))
      setItineraryVisits(visits)
    } catch (err) {
      setError('Failed to load account')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = account && (account.created_by === user.id || MANAGER_ROLES.includes(role))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error || !account) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-500">{error || 'Account not found'}</p>
        <Link to="/accounts" className="text-primary-600 text-sm mt-2 inline-block">Back to Accounts</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/accounts')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{account.company_name}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(account.priority)}`}>
              {account.priority ? account.priority.charAt(0).toUpperCase() + account.priority.slice(1) : 'Normal'} Priority
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {[account.industry, account.city, account.country].filter(Boolean).join(' · ') || 'No details yet'}
          </p>
        </div>
        {canEdit && (
          <Link to={`/accounts/${id}/edit`} className="btn-secondary flex items-center gap-2">
            <Pencil size={16} /> Edit
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: account info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 size={16} /> Company Info
            </h3>
            {account.website && (
              <p className="text-sm text-gray-600 flex items-center gap-2"><Globe size={14} className="text-gray-400" /> {account.website}</p>
            )}
            {account.address && (
              <p className="text-sm text-gray-600 flex items-start gap-2"><MapPin size={14} className="text-gray-400 mt-0.5" /> {[account.address, account.city, account.country].filter(Boolean).join(', ')}</p>
            )}
            {account.company_size && <p className="text-sm text-gray-600">{account.company_size}</p>}
            {account.description && <p className="text-sm text-gray-500 leading-relaxed">{account.description}</p>}
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              Added by {account.creator?.full_name || 'Unknown'}{account.created_at ? ` · ${format(parseISO(account.created_at), 'MMM dd, yyyy')}` : ''}
            </p>
          </div>

          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Primary Contact</h3>
            {account.contact_name ? (
              <>
                <p className="text-sm text-gray-900 font-medium">{account.contact_name}</p>
                {account.contact_title && <p className="text-xs text-gray-500">{account.contact_title}</p>}
                {account.contact_email && <p className="text-sm text-gray-600 flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {account.contact_email}</p>}
                {account.contact_phone && <p className="text-sm text-gray-600 flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {account.contact_phone}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400">No primary contact on file</p>
            )}
            {account.decision_maker && (
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                Decision maker: <span className="text-gray-700">{account.decision_maker}{account.decision_maker_title ? ` (${account.decision_maker_title})` : ''}</span>
              </p>
            )}
          </div>

          {(account.pain_points || account.goals || account.current_solution || account.budget_range) && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Business Intelligence</h3>
              {account.budget_range && <p className="text-sm text-gray-600"><span className="text-gray-400">Budget:</span> {account.budget_range}</p>}
              {account.current_solution && <p className="text-sm text-gray-600"><span className="text-gray-400">Current solution:</span> {account.current_solution}</p>}
              {account.pain_points && <p className="text-sm text-gray-600"><span className="text-gray-400">Pain points:</span> {account.pain_points}</p>}
              {account.goals && <p className="text-sm text-gray-600"><span className="text-gray-400">Goals:</span> {account.goals}</p>}
            </div>
          )}

          {account.recommended_approach && (
            <div className="card border-2 border-primary-100 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Lightbulb size={16} className="text-primary-600" /> Suggested Talking Points
              </h3>
              <p className="text-sm text-primary-900 leading-relaxed">{account.recommended_approach}</p>
            </div>
          )}

          {account.notes && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{account.notes}</p>
            </div>
          )}
        </div>

        {/* Right: activity history */}
        <div className="lg:col-span-2 space-y-6">
          <PipelineProjectsPanel accountId={id} companyName={account.company_name} canEdit={canEdit} />

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ClipboardCheck size={16} /> Field Contact Reports ({fcrs.length})
            </h3>
            {fcrs.length === 0 ? (
              <p className="text-sm text-gray-400">No FCRs logged against this account yet.</p>
            ) : (
              <div className="space-y-2">
                {fcrs.map(item => (
                  <Link key={item.id} to={`/fcr/${item.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.visit_date ? format(parseISO(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                        <span className="text-gray-400 font-normal"> · {item.team_type === 'business_development' ? 'BD Report' : 'MBT Sales Report'}</span>
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(item.status)}`}>
                      {item.status === 'pending_approval' ? 'Pending' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users size={16} /> Meetings ({meetings.length})
            </h3>
            {meetings.length === 0 ? (
              <p className="text-sm text-gray-400">No meeting minutes logged against this account yet.</p>
            ) : (
              <div className="space-y-2">
                {meetings.map(m => (
                  <div key={m.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.meeting_date} {m.start_time ? `· ${m.start_time}–${m.end_time || ''}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar size={16} /> Itinerary Visits ({itineraryVisits.length})
            </h3>
            {itineraryVisits.length === 0 ? (
              <p className="text-sm text-gray-400">No planned visits logged against this account yet.</p>
            ) : (
              <div className="space-y-2">
                {itineraryVisits.map((v, i) => (
                  <Link key={i} to={`/itinerary/${v.itineraryId}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{v.purpose || 'Visit'}</p>
                      <p className="text-xs text-gray-500">{v.visit_date || 'No date'}{v.location ? ` · ${v.location}` : ''}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
