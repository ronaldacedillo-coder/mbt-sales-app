import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  Plus, 
  Building2, 
  Search, 
  MapPin,
  Factory,
  ChevronRight,
  Star,
  Filter
} from 'lucide-react'

export const AccountList = () => {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')

  useEffect(() => {
    fetchAccounts()
  }, [user])

  const fetchAccounts = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
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
        acc.industry?.toLowerCase().includes(search)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-500 mt-1">Manage your prospect accounts</p>
        </div>
        <Link to="/accounts/new" className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Account
        </Link>
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
        <div className="flex gap-2">
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
          <p className="text-gray-500 mt-1">Add your first prospect account to get started</p>
          <Link to="/accounts/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={18} />
            Add Account
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <Link 
              key={account.id} 
              to={`/accounts/${account.id}`}
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Building2 size={20} className="text-primary-600" />
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(account.priority)}`}>
                  {account.priority?.charAt(0).toUpperCase() + account.priority?.slice(1) || 'Normal'}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                {account.company_name}
              </h3>
              
              <div className="space-y-1.5 text-sm text-gray-500">
                {account.industry && (
                  <p className="flex items-center gap-1.5">
                    <Factory size={14} />
                    {account.industry}
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
                    <span className="font-medium">AI Recommendation:</span> {account.recommended_approach}
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {account.contact_name || 'No primary contact'}
                </span>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}