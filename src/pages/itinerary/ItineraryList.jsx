import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, canApproveItinerary } from '../../utils/roles'
import {
  Plus,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

export const ItineraryList = () => {
  const { user, role } = useAuth()
  const [itineraries, setItineraries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchItineraries()
  }, [user, role])

  const fetchItineraries = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase.from('itineraries').select(`
        *,
        creator:user_profiles!itineraries_created_by_fkey(full_name:name, role)
      `)

      if (role === ROLES.SALES_ENGINEER || role === ROLES.BD_ENGINEER) {
        query = query.eq('created_by', user.id)
      } else if (role === ROLES.NSM) {
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
    try {
      const { error } = await supabase
        .from('itineraries')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      fetchItineraries()
    } catch (error) {
      console.error('Error approving itinerary:', error)
      alert('Failed to approve itinerary')
    }
  }

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    try {
      const { error } = await supabase
        .from('itineraries')
        .update({ status: 'rejected', rejection_reason: reason, approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      fetchItineraries()
    } catch (error) {
      console.error('Error rejecting itinerary:', error)
      alert('Failed to reject itinerary')
    }
  }

  // Commercial AC Head only -- covered by the itineraries_delete_head RLS
  // policy (BD and NSM submissions, the only ones the Head can see/approve
  // here). Handy for clearing out test/demo/duplicate entries without a
  // database console.
  const handleDelete = async (id) => {
    if (!confirm('Delete this MCP (Plan)? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('itineraries').delete().eq('id', id)
      if (error) throw error
      fetchItineraries()
    } catch (error) {
      console.error('Error deleting itinerary:', error)
      alert('Failed to delete MCP (Plan)')
    }
  }

  const filteredItineraries = itineraries.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        (item.title && item.title.toLowerCase().includes(search)) ||
        (item.creator?.full_name && item.creator.full_name.toLowerCase().includes(search))
      )
    }
    return true
  })

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle2 size={16} className="text-emerald-600" />
      case 'rejected': return <XCircle size={16} className="text-red-600" />
      case 'pending_approval': return <Clock size={16} className="text-amber-600" />
      default: return <Clock size={16} className="text-gray-400" />
    }
  }

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
    return canApproveItinerary(role, item.submitter_role)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCP (Plan)</h1>
          <p className="text-gray-500 mt-1">Monthly Coverage Plan -- propose and get approval for your visit schedule</p>
        </div>
        <Link to="/itinerary/new" className="btn-primary flex items-center justify-center gap-2 self-start">
          <Plus size={18} />
          New MCP (Plan)
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search MCP (Plan)s..."
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

      {/* Itinerary List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredItineraries.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No MCP (Plan)s found</h3>
          <p className="text-gray-500 mt-1">Create your first Monthly Coverage Plan to get started</p>
          <Link to="/itinerary/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={18} />
            Create MCP (Plan)
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItineraries.map((item) => (
            <div key={item.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.title || `MCP (Plan) - ${format(parseISO(item.month), 'MMMM yyyy')}`}
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(item.status)}`}>
                      {getStatusIcon(item.status)}
                      {item.status === 'pending_approval' ? 'Pending Approval' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {format(parseISO(item.month), 'MMMM yyyy')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UsersIcon size={14} />
                      {(item.visits?.length || 0)} visits
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
                  {role === ROLES.COMMERCIAL_AC_HEAD && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete MCP (Plan)"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <Link
                    to={`/itinerary/${item.id}`}
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

const UsersIcon = ({ size, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)