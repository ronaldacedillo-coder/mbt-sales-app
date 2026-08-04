import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES, canCreateAccount } from '../../utils/roles'
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS } from '../../utils/accounts'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  Plus,
  Building2,
  Search,
  MapPin,
  Factory,
  ChevronRight,
  Star,
  Filter,
  Trash2
} from 'lucide-react'

export const AccountList = () => {
  const { user, role } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    fetchAccounts()
  }, [user])

  const fetchAccounts = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          creator:user_profiles!accounts_created_by_fkey(full_name:name)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Commercial AC Head only -- covered by the accounts_delete_owner_or_manager
  // RLS policy (which also allows NSM and the account's own creator, but the
  // UI only surfaces this button for the Head to keep it as a deliberate,
  // top-level cleanup action rather than something reps do day-to-day).
  const openDeleteDialog = (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteTarget(id)
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
      setAccounts(prev => prev.filter(a => a.id !== id))
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
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

  const filteredAccounts = accounts.filter(acc => {
    if (filterPriority !== 'all' && acc.priority !== filterPriority) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        acc.company_name?.toLowerCase().includes(search) ||
        acc.city?.toLowerCase().includes(search) ||
        (CUSTOMER_TYPE_LABELS[acc.customer_type] || acc.customer_type)?.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Grouped by Customer Type (in the same order as the AccountForm dropdown)
  // rather than one flat list, so accounts of a kind sit together -- e.g.
  // all Distributors, then all Dealers. Accounts still missing a customer
  // type (pre-dating the field, or just not filled in yet) land in a
  // trailing "Customer Type Not Set" group instead of being hidden.
  const groupedAccounts = [
    ...CUSTOMER_TYPES.map(ct => ({
      key: ct.value,
      label: ct.label,
      accounts: filteredAccounts.filter(a => a.customer_type === ct.value),
    })),
    {
      key: '__unspecified__',
      label: 'Customer Type Not Set',
      accounts: filteredAccounts.filter(a => !a.customer_type),
    },
  ].filter(group => group.accounts.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1">Manage your prospect accounts</p>
        </div>
        {canCreateAccount(role) && (
          <Link to="/accounts/new" className="btn-primary flex items-center justify-center gap-2 self-start">
            <Plus size={18} />
            Add Account
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'high', 'medium', 'low'].map((priority) => (
            <button
              key={priority}
              onClick={() => setFilterPriority(priority)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterPriority === priority 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Account Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No accounts yet</h3>
          <p className="text-gray-500 mt-1">
            {canCreateAccount(role) ? 'Add your first prospect account to get started' : 'No accounts have been added yet'}
          </p>
          {canCreateAccount(role) && (
            <Link to="/accounts/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={18} />
              Add Account
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedAccounts.map((group) => (
            <div key={group.key}>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                {group.label}
                <span className="text-xs font-normal text-gray-400">({group.accounts.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.accounts.map((account) => (
                  <Link
                    key={account.id}
                    to={`/accounts/${account.id}`}
                    className="card hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Building2 size={20} className="text-primary-600" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(account.priority)}`}>
                          {account.priority?.charAt(0).toUpperCase() + account.priority?.slice(1) || 'Normal'}
                        </span>
                        {role === ROLES.COMMERCIAL_AC_HEAD && (
                          <button
                            onClick={(e) => openDeleteDialog(e, account.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete account"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors flex items-center gap-2">
                      {account.company_name}
                      {!account.trade_terms && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap" title="Trade Terms not set -- won't appear in Itinerary/FCR dropdowns">
                          Profile incomplete
                        </span>
                      )}
                    </h3>

                    <div className="space-y-1.5 text-sm text-gray-500">
                      {account.customer_type && (
                        <p className="flex items-center gap-1.5">
                          <Factory size={14} />
                          {CUSTOMER_TYPE_LABELS[account.customer_type] || account.customer_type}
                        </p>
                      )}
                      {account.city && (
                        <p className="flex items-center gap-1.5">
                          <MapPin size={14} />
                          {account.city}{account.country ? `, ${account.country}` : ''}
                        </p>
                      )}
                    </div>

                    {account.recommended_approach && (
                      <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-700">
                          <span className="font-medium">Talking points:</span> {account.recommended_approach}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {account.contact_name || 'No primary contact'}
                      </span>
                      {account.creator?.full_name && (
                        <span className="text-xs text-gray-400" title="Added by">
                          {account.creator.full_name}
                        </span>
                      )}
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-600 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}
        title="Delete this account?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => handleDelete(deleteTarget)}
      />
    </div>
  )
}