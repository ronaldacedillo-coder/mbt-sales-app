import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, canApproveFCR } from '../../utils/roles'
import { 
  CheckCircle2, 
  XCircle, 
  ClipboardCheck,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Target,
  Building2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

export const FCRApproval = () => {
  const { user, role } = useAuth()
  const [fcrs, setFcrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    fetchPendingFCRs()
  }, [user, role])

  const fetchPendingFCRs = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase
        .from('fcrs')
        .select(`
          *,
          account:accounts(company_name, city),
          creator:profiles!fcrs_created_by_fkey(full_name, role, email)
        `)
        .eq('status', 'pending_approval')

      if (role === ROLES.NSM) {
        query = query.eq('submitter_role', ROLES.SALES_ENGINEER)
      } else if (role === ROLES.COMMERCIAL_AC_HEAD) {
        query = query.eq('submitter_role', ROLES.BD_ENGINEER)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      setFcrs(data || [])
    } catch (error) {
      console.error('Error fetching FCRs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id) => {
    setProcessing(id)
    try {
      const { error } = await supabase
        .from('fcrs')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) throw error
      fetchPendingFCRs()
    } catch (error) {
      console.error('Error approving FCR:', error)
      alert('Failed to approve FCR')
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
        .from('fcrs')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
      if (error) throw error
      fetchPendingFCRs()
    } catch (error) {
      console.error('Error rejecting FCR:', error)
      alert('Failed to reject FCR')
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
        <h1 className="text-2xl font-bold text-gray-900">FCR Approvals</h1>
        <p className="text-gray-500 mt-1">
          Review and approve pending field contact reports
        </p>
      </div>

      {fcrs.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="text-gray-500 mt-1">No pending FCRs to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fcrs.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.account?.company_name || 'Field Contact Report'}
                    </h3>
                    <span className="badge badge-pending">Pending Approval</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {item.visit_date ? format(parseISO(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} />
                      {item.visit_type?.replace('_', ' ') || 'Field Visit'}
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
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  {/* Attendees */}
                  {item.attendees && item.attendees.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                        <User size={14} />
                        Attendees
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {item.attendees.map((attendee, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">
                            {attendee}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discussion Points */}
                  {item.discussion_points && item.discussion_points.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                        <MessageSquare size={14} />
                        Discussion Points
                      </h4>
                      <div className="space-y-2">
                        {item.discussion_points.map((point, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <p className="font-medium text-gray-900">{point.topic || `Point ${idx + 1}`}</p>
                            <p className="text-gray-600 mt-1">{point.notes}</p>
                            {point.outcome && (
                              <p className="text-emerald-600 mt-1 text-xs">
                                <span className="font-medium">Outcome:</span> {point.outcome}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {item.action_items && item.action_items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                        <Target size={14} />
                        Action Items
                      </h4>
                      <div className="space-y-2">
                        {item.action_items.map((action, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">
                            <div>
                              <p className="font-medium text-gray-900">{action.task}</p>
                              <p className="text-gray-500 text-xs mt-0.5">
                                Assigned to: {action.assigned_to || 'Unassigned'}
                                {action.due_date && ` | Due: ${format(parseISO(action.due_date), 'MMM dd, yyyy')}`}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              action.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              action.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {action.status?.replace('_', ' ') || 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.next_steps && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Next Steps:</span> {item.next_steps}
                      </p>
                    </div>
                  )}

                  {item.notes && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Additional Notes:</span> {item.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
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