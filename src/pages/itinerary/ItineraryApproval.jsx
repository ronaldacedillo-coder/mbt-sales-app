import { useEffect, useState } from 'react'
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
  ChevronUp
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

export const ItineraryApproval = () => {
  const { user, role } = useAuth()
  const [itineraries, setItineraries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    fetchPendingItineraries()
  }, [user, role])

  const fetchPendingItineraries = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase
        .from('itineraries')
        .select(`
          *,
          creator:user_profiles!itineraries_created_by_fkey(full_name:name, role)
        `)
        .eq('status', 'pending_approval')

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
      fetchPendingItineraries()
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
      fetchPendingItineraries()
    } catch (error) {
      console.error('Error rejecting:', error)
      alert('Failed to reject itinerary')
    } finally {
      setProcessing(null)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MCP (Plan) Approvals</h1>
        <p className="text-gray-500 mt-1">
          Review and approve pending Monthly Coverage Plans
        </p>
      </div>

      {itineraries.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="text-gray-500 mt-1">No pending MCP (Plan)s to review</p>
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
                    <span className="badge badge-pending">Pending Approval</span>
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
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                              Visit #{idx + 1}: {visit.purpose || 'No purpose specified'}
                            </span>
                            {visit.visit_date && (
                              <span className="text-gray-500">
                                {format(parseISO(visit.visit_date), 'MMM dd, yyyy')}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-gray-500 text-xs space-y-1">
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

              {/* Action Buttons */}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}