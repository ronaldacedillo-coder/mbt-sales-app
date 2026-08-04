import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, canApproveFCR } from '../../utils/roles'
import { FCRFormBody } from './FCRFormBody'
import { emptyCustomerInfo, emptyFormData } from './fcrTemplates'
import {
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Building2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

const STATUS_FILTERS = [
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

export const FCRApproval = () => {
  const { user, role } = useAuth()
  const [fcrs, setFcrs] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [processing, setProcessing] = useState(null)
  // Approving/rejecting used to make the FCR vanish from this page for
  // good, so an approver could never pull it back up to confirm what they'd
  // signed off on. Defaulting to 'pending_approval' keeps the everyday
  // workflow unchanged; switching tabs lets them see the FCR that was the
  // subject of an earlier decision.
  const [statusFilter, setStatusFilter] = useState('pending_approval')

  useEffect(() => {
    fetchFCRs()
    fetchAccounts()
  }, [user, role, statusFilter])

  // FCRFormBody needs the account's trade_terms to render the Trade Terms
  // field below (Customer Information itself is a snapshot already stored
  // on the FCR row) -- without this, that one field silently shows blank
  // in the reviewer's read-only preview.
  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('id, company_name, city, trade_terms')
    setAccounts(data || [])
  }

  const fetchFCRs = async () => {
    if (!user) return
    setLoading(true)

    try {
      let query = supabase
        .from('fcrs')
        .select(`
          *,
          account:accounts(company_name, city),
          creator:user_profiles!fcrs_created_by_fkey(full_name:name, role)
        `)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (role === ROLES.NSM) {
        query = query.eq('submitter_role', ROLES.SALES_ENGINEER)
      } else if (role === ROLES.COMMERCIAL_AC_HEAD) {
        // Head sees both teams here -- BD is theirs to approve, MBT Sales is
        // read-only visibility (canApproveFCR below keeps the Approve/Reject
        // buttons NSM-only for those).
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

  const handleApprove = async (id, ackStatus) => {
    // Belt-and-suspenders: the Approve button is already disabled unless the
    // account has acknowledged the meeting minutes, but that only guards the
    // click itself -- re-check here against the value this row was fetched
    // with, in case it's stale. The database's own WITH CHECK is the real
    // backstop (see the fcrs_update_approver policy), this just avoids a
    // round trip to the server for the common case.
    if (ackStatus !== 'acknowledged') {
      alert('This FCR can\'t be approved yet -- the account hasn\'t acknowledged the meeting minutes.')
      return
    }
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
      fetchFCRs()
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
      fetchFCRs()
    } catch (error) {
      console.error('Error rejecting FCR:', error)
      alert('Failed to reject FCR')
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
        <h1 className="text-2xl font-bold text-gray-900">FCR Approvals</h1>
        <p className="text-gray-500 mt-1">
          Review pending field contact reports, or look back at ones you've already decided on
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

      {fcrs.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            {statusFilter === 'pending_approval' ? 'All caught up!' : 'Nothing here'}
          </h3>
          <p className="text-gray-500 mt-1">
            {statusFilter === 'all'
              ? 'No FCRs found'
              : `No ${STATUS_FILTERS.find(f => f.value === statusFilter)?.label.toLowerCase()} FCRs`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {fcrs.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.customer_info?.company_name || item.account?.company_name || 'Field Contact Report'}
                    </h3>
                    {statusBadge(item.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {item.visit_date ? format(parseISO(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} />
                      {item.team_type === 'business_development' ? 'BD Report' : 'MBT Sales Report'}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="View the full FCR being submitted for approval"
                  >
                    {expandedId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {expandedId === item.id ? 'Hide Full FCR' : 'View Full FCR'}
                  </button>
                </div>
              </div>

              {/* Expanded Details -- full read-only FCR, same layout as the official form */}
              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <FCRFormBody
                    record={{
                      ...item,
                      customer_info: { ...emptyCustomerInfo(), ...(item.customer_info || {}) },
                      form_data: { ...emptyFormData(item.team_type || 'mbt_sales'), ...(item.form_data || {}) },
                    }}
                    onChange={() => {}}
                    teamType={item.team_type || 'mbt_sales'}
                    accounts={accounts}
                    readOnly
                    submitterName={item.creator?.full_name}
                  />
                </div>
              )}

              {/* Approve/Reject only make sense for an FCR still awaiting a
                  decision, AND only for the approver it's actually routed to
                  -- Head can now see MBT Sales FCRs too (read-only), but
                  those are still the NSM's call to make. */}
              {item.status === 'pending_approval' && (
                canApproveFCR(role, item.submitter_role) ? (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {item.ack_status !== 'acknowledged' && (
                      <p className="text-xs text-amber-600 mb-3 flex items-center gap-1.5">
                        <Clock size={12} />
                        Waiting on the account to acknowledge the meeting minutes -- this can't be approved yet.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        onClick={() => handleReject(item.id)}
                        disabled={processing === item.id}
                        className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(item.id, item.ack_status)}
                        disabled={processing === item.id || item.ack_status !== 'acknowledged'}
                        title={item.ack_status === 'acknowledged' ? '' : 'The account must acknowledge the meeting minutes before this FCR can be approved'}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 size={16} />
                        {processing === item.id ? 'Processing...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
                    Awaiting {item.submitter_role === ROLES.SALES_ENGINEER ? 'NSM' : 'Commercial AC Head'} approval
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}