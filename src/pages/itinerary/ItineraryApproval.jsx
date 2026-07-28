import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, canApproveItinerary } from '../../utils/roles'
import {
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  User,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

const STATUS_FILTERS = [
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

export const ItineraryApproval = () => {
  const { user, role } = useAuth()
  const [itineraries, setItineraries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [processing, setProcessing] = useState(null)
  // Approving/rejecting an item here used to make it vanish from this page
  // for good -- there was no way back to it short of hunting for it in
  // ItineraryList. Defaulting to 'pending_approval' keeps the primary
  // approve/reject workflow unchanged, but switching tabs lets the
  // approver look back at what they already decided on.
  const [statusFilter, setStatusFilter] = useState('pending_approval')

  useEffect(() => {
    fetchItineraries()
    fetchAccounts()
  }, [user, role, statusFilter])

  // Needed so the expanded visit list below can show which account each
  // visit is for -- visits only store account_id, and the approver needs
  // to see the actual company name to make an informed approve/reject call.
  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('id, company_name, city')
    setAccounts(data || [])
  }

  const accountName = (accountId) => {
    const acc = accounts.find(a => a.id === accountId)
    return acc ? `${acc.company_name}${acc.city ? ` (${acc.city})` : ''}` : 'Unassigned account'
  }

  const fetchItineraries = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase
        .from('itineraries')
        .select(`
          *,
          creator:user_profiles!itineraries_created_by_fkey(full_name:name, role)
        `)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (role === ROLES.NSM) {
        query = query.in('submitter_role', [ROLES.SALES_ENGINEER, ROLES.NSM])
      } else if (role === ROLES.COMMERCIAL_AC_HEAD) {
        query = query.in('submitter_role', [ROLES.BD_ENGINEER, ROLES.NSM])
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      setItineraries(data || [])
    } catch (error) {
      console.error('Error fetching itineraries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    setProcessing(id)
    try {
      const { error } = await supabase
        .from('itineraries')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) throw error
      fetchItineraries()
    } catch (error) {
      console.error('Error approving:', error)
      alert('Failed to approve itinerary')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    setProcessing(id)
    try {
      const { error } = await supabase
        .from('itineraries')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) throw error
      fetchItineraries()
    } catch (error) {
      console.error('Error rejecting:', error)
      alert('Failed to reject itinerary')
    } finally {
      setProcessing(null)
    }
  }

  const statusBadge = (status) => {
    const styles = {
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
    }
    const labels = {
      approved: 'Approved',
      rejected: 'Rejected',
      pending_approval: 'Pending Approval',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        {labels[status] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MCP (Plan) Approvals</h1>
        <p className="text-gray-500 mt-1">
          Review pending Monthly Coverage Plans, or look back at ones you've already decided on
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === f.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {itineraries.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            {statusFilter === 'pending_approval' ? 'All caught up!' : 'Nothing here'}
          </h3>
          <p className="text-gray-500 mt-1">
            {statusFilter === 'all'
              ? 'No MCP (Plan)s found'
              : `No ${STATUS_FILTERS.find(f => f.value === statusFilter)?.label.toLowerCase()} MCP (Plan)s`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {itineraries.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.title || `MCP (Plan) - ${format(parseISO(item.month), 'MMMM yyyy')}`}
                    </h3>
                    {statusBadge(item.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {format(parseISO(item.month), 'MMMM yyyy')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} />
                      {(item.visits?.length || 0)} visits planned
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User size={14} />
                      {item.creator?.full_name || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      Submitted {format(parseISO(item.created_at), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Link
                    to={`/itinerary/${item.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="View the full MCP (Plan), including the calendar"
                  >
                    <Eye size={16} /> View Full Plan
                  </Link>
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Quick preview"
                  >
                    {expandedId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Visit Details</h4>
                  {item.visits?.length > 0 ? (
                    <div className="space-y-2">
                      {item.visits.map((visit, idx) => (
                        <div key={visit.id || idx} className="bg-gray-50 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">
                              Visit #{idx + 1}: {accountName(visit.account_id)}
                            </span>
                            {visit.visit_date && (
                              <span className="text-gray-500">
                                {format(parseISO(visit.visit_date), 'MMM dd, yyyy')}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-gray-500 text-xs space-y-1">
                            {visit.purpose && <p>Purpose: {visit.purpose}</p>}
                            {visit.location && <p>Location: {visit.location}</p>}
                            {visit.estimated_duration && <p>Duration: {visit.estimated_duration}</p>}
                            {visit.notes && <p>Notes: {visit.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No visit details available</p>
                  )}

                  {item.notes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">General Notes:</span> {item.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Approve/Reject only make sense for a plan still awaiting a
                  decision -- once it's approved or rejected, "View Full Plan"
                  above is the only action left. */}
              {item.status === 'pending_approval' && (
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-end gap-3">
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={processing === item.id}
                    className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={processing === item.id}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {processing === item.id ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}