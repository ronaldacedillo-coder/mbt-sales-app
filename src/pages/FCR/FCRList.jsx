import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, canApproveFCR, canCreateFCR } from '../../utils/roles'
import {
  Plus,
  ClipboardCheck,
  Search,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Calendar,
  Trash2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

export const FCRList = () => {
  const { user, role } = useAuth()
  const [fcrs, setFcrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchFCRs()
  }, [user, role])

  const fetchFCRs = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase.from('fcrs').select(`
        *,
        account:accounts(company_name),
        creator:user_profiles!fcrs_created_by_fkey(full_name:name, role)
      `)

      if (role === ROLES.SALES_ENGINEER || role === ROLES.BD_ENGINEER) {
        query = query.eq('created_by', user.id)
      } else if (role === ROLES.NSM) {
        query = query.eq('submitter_role', ROLES.SALES_ENGINEER)
      } else if (role === ROLES.COMMERCIAL_AC_HEAD) {
        // Head sees both teams here -- canApprove()/the delete button below
        // both stay scoped to what Head can actually act on (BD only).
        query = query.in('submitter_role', [ROLES.BD_ENGINEER, ROLES.SALES_ENGINEER])
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
    try {
      const { error } = await supabase
        .from('fcrs')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      fetchFCRs()
    } catch (error) {
      console.error('Error approving FCR:', error)
      alert('Failed to approve FCR')
    }
  }

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    try {
      const { error } = await supabase
        .from('fcrs')
        .update({ status: 'rejected', rejection_reason: reason, approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      fetchFCRs()
    } catch (error) {
      console.error('Error rejecting FCR:', error)
      alert('Failed to reject FCR')
    }
  }

  // Commercial AC Head only, and BD submissions only -- covered by the
  // fcrs_delete_head RLS policy. Head can now see MBT Sales FCRs here too,
  // but delete authority over those stays with the NSM, so the button below
  // is gated to item.submitter_role === BD_ENGINEER as well as the role
  // check. Handy for clearing out test/demo/duplicate entries without a
  // database console.
  const handleDelete = async (id) => {
    if (!confirm('Delete this FCR? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('fcrs').delete().eq('id', id)
      if (error) throw error
      fetchFCRs()
    } catch (error) {
      console.error('Error deleting FCR:', error)
      alert('Failed to delete FCR')
    }
  }

  const filteredFCRs = fcrs.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        item.customer_info?.company_name?.toLowerCase().includes(search) ||
        item.account?.company_name?.toLowerCase().includes(search) ||
        item.creator?.full_name?.toLowerCase().includes(search)
      )
    }
    return true
  })

  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200'
      case 'pending_approval': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const canApprove = (item) => {
    if (item.status !== 'pending_approval') return false
    return canApproveFCR(role, item.submitter_role)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Contact Reports</h1>
          <p className="text-gray-500 mt-1">Manage field visit reports</p>
        </div>
        {canCreateFCR(role) && (
          <Link to="/fcr/new" className="btn-primary flex items-center justify-center gap-2 self-start">
            <Plus size={18} />
            New FCR
          </Link>
        )}
      </div>

      <p className="text-xs text-gray-400 -mt-3">
        Only acknowledged FCRs are sent to the NSM or Commercial AC Head for approval. Only approved FCRs can be downloaded as a PDF.
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search FCRs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'pending_approval', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status === 'pending_approval' ? 'Pending' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* FCR List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredFCRs.length === 0 ? (
        <div className="card text-center py-16">
          <ClipboardCheck size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No FCRs yet</h3>
          <p className="text-gray-500 mt-1">
            {canCreateFCR(role) ? 'Create your first field contact report' : 'No field contact reports yet'}
          </p>
          {canCreateFCR(role) && (
            <Link to="/fcr/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={18} />
              Create FCR
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFCRs.map((item) => (
            <div key={item.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.customer_info?.company_name || item.account?.company_name || 'Field Contact Report'}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(item.status)}`}>
                      {item.status === 'pending_approval' ? 'Pending Approval' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                    {item.ack_status === 'acknowledged' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Minutes Acknowledged
                      </span>
                    ) : item.ack_status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Awaiting Acknowledgment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        Not Yet Acknowledged
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {item.visit_date ? format(parseISO(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} />
                      {item.team_type === 'business_development' ? 'BD Report' : 'MBT Sales Report'}
                    </span>
                    {item.creator && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">
                          {item.creator.full_name?.charAt(0) || 'U'}
                        </span>
                        {item.creator.full_name}
                      </span>
                    )}
                  </div>

                  {item.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <span className="font-medium">Rejection reason:</span> {item.rejection_reason}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:ml-4">
                  {canApprove(item) && (
                    <>
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(item.id)}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </>
                  )}
                  {role === ROLES.COMMERCIAL_AC_HEAD && item.submitter_role === ROLES.BD_ENGINEER && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete FCR"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <Link
                    to={`/fcr/${item.id}`}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}