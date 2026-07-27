import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { MonthCalendar } from './itinerary/MonthCalendar'
import {
  Calendar,
  Building2,
  ClipboardCheck,
  Archive,
  Clock,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { ROLES, canCreateAccount, canCreateFCR } from '../utils/roles'
import { format, parseISO, differenceInCalendarDays, addDays, startOfMonth } from 'date-fns'

const LEADERSHIP_ROLES = [ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]
// VIEWER (Product Manager / HVAC Director) sees the same org-wide Team
// Overview leadership does, since their itinerary/FCR queries below are
// already unfiltered (no branch below matches VIEWER, so the queries run
// with no owner/team restriction) -- they're looking at the same full
// dataset, just without approval authority.
const TEAM_OVERVIEW_ROLES = [...LEADERSHIP_ROLES, ROLES.VIEWER]

export const Dashboard = () => {
  const { user, profile, role } = useAuth()
  const [stats, setStats] = useState({
    pendingItineraries: 0,
    pendingFCRs: 0,
    totalAccounts: 0,
    myItineraries: 0,
    myFCRs: 0,
    archivedMCPs: 0,
  })
  const [recentItineraries, setRecentItineraries] = useState([])
  const [recentFCRs, setRecentFCRs] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [teamStats, setTeamStats] = useState({ approvedFCRs: 0, rejectedFCRs: 0, overdueFollowUps: 0 })
  const [teamMembers, setTeamMembers] = useState([])
  const [approvedPlan, setApprovedPlan] = useState(null)
  const [planAccounts, setPlanAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [user, role])

  const fetchDashboardData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // Fetch itineraries based on role
      let itineraryQuery = supabase.from('itineraries').select('*')
      
      if (role === ROLES.SALES_ENGINEER || role === ROLES.BD_ENGINEER) {
        itineraryQuery = itineraryQuery.eq('created_by', user.id)
      } else if (role === ROLES.NSM) {
        itineraryQuery = itineraryQuery.in('submitter_role', [ROLES.SALES_ENGINEER, ROLES.NSM])
      } else if (role === ROLES.COMMERCIAL_AC_HEAD) {
        // Commercial AC Head sees BD and NSM itineraries
        itineraryQuery = itineraryQuery.in('submitter_role', [ROLES.BD_ENGINEER, ROLES.NSM])
      }

      const { data: itineraries } = await itineraryQuery.order('created_at', { ascending: false })

      // Fetch FCRs
      let fcrQuery = supabase.from('fcrs').select('*')
      
      if (role === ROLES.SALES_ENGINEER || role === ROLES.BD_ENGINEER) {
        fcrQuery = fcrQuery.eq('created_by', user.id)
      } else if (role === ROLES.NSM) {
        fcrQuery = fcrQuery.eq('submitter_role', ROLES.SALES_ENGINEER)
      } else if (role === ROLES.COMMERCIAL_AC_HEAD) {
        fcrQuery = fcrQuery.eq('submitter_role', ROLES.BD_ENGINEER)
      }

      const { data: fcrs } = await fcrQuery.order('created_at', { ascending: false })

      // Fetch accounts (team-wide -- accounts are a shared address book)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, company_name')

      // VIEWER never generates their own MCP (Actual) exports, so count
      // every archived snapshot they can see (org-wide, per the
      // mcp_archive_select_viewer RLS policy) rather than "mine" (always 0).
      let archivedMCPQuery = supabase.from('mcp_archive').select('id', { count: 'exact', head: true })
      if (role !== ROLES.VIEWER) archivedMCPQuery = archivedMCPQuery.eq('generated_by', user.id)
      const { count: archivedMCPs } = await archivedMCPQuery

      // This month's approved MCP (Plan) -- shown as a calendar below once
      // it clears approval, per the "approved plan shows on the dashboard"
      // workflow.
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const { data: plan } = await supabase
        .from('itineraries')
        .select('*')
        .eq('created_by', user.id)
        .eq('month', monthStart)
        .eq('status', 'approved')
        .maybeSingle()
      setApprovedPlan(plan || null)
      setPlanAccounts(accounts || [])

      setStats({
        pendingItineraries: itineraries?.filter(i => i.status === 'pending_approval').length || 0,
        pendingFCRs: fcrs?.filter(f => f.status === 'pending_approval').length || 0,
        totalAccounts: accounts?.length || 0,
        myItineraries: itineraries?.length || 0,
        myFCRs: fcrs?.length || 0,
        archivedMCPs: archivedMCPs || 0,
      })

      setRecentItineraries(itineraries?.slice(0, 5) || [])
      setRecentFCRs(fcrs?.slice(0, 5) || [])

      // Follow-ups due soon or overdue, from FCR follow_up_date
      const today = new Date()
      const horizon = addDays(today, 14)
      const items = []

      for (const f of fcrs || []) {
        if (!f.follow_up_date || f.status !== 'approved') continue
        const dueDate = parseISO(f.follow_up_date)
        if (dueDate <= horizon) {
          items.push({
            key: `fcr-${f.id}`,
            type: 'FCR follow-up',
            label: f.customer_info?.company_name || 'Field Contact Report',
            date: f.follow_up_date,
            overdue: differenceInCalendarDays(dueDate, today) < 0,
            link: `/fcr/${f.id}`,
          })
        }
      }

      items.sort((a, b) => a.date.localeCompare(b.date))
      setFollowUps(items)

      // Leadership team-overview: NSM sees the MBT Sales Team (Sales
      // Engineers); Commercial AC Head and VIEWER see both the MBT Sales
      // and BD Teams. Fetched separately from the role-scoped `fcrs`/
      // `itineraries` above (those stay approval-queue-scoped for Head, e.g.
      // BD/NSM only) so this consolidated view and the per-member table
      // below always agree with each other regardless of role.
      if (TEAM_OVERVIEW_ROLES.includes(role)) {
        const memberRoles = role === ROLES.NSM ? ['se'] : ['se', 'bd']
        const { data: members } = await supabase
          .from('user_profiles')
          .select('id, name, role')
          .in('role', memberRoles)
          .order('name')

        const memberIds = (members || []).map(m => m.id)

        const [{ data: memberFcrs }, { data: memberPlans }] = memberIds.length
          ? await Promise.all([
              supabase.from('fcrs').select('created_by, status, follow_up_date').in('created_by', memberIds),
              supabase.from('itineraries').select('created_by, status').in('created_by', memberIds).eq('month', monthStart),
            ])
          : [{ data: [] }, { data: [] }]

        const overdueFollowUps = (memberFcrs || []).filter(f =>
          f.follow_up_date && f.status === 'approved' && parseISO(f.follow_up_date) < today
        ).length

        setTeamStats({
          approvedFCRs: (memberFcrs || []).filter(f => f.status === 'approved').length,
          rejectedFCRs: (memberFcrs || []).filter(f => f.status === 'rejected').length,
          overdueFollowUps,
        })

        setTeamMembers((members || []).map(m => {
          const mFcrs = (memberFcrs || []).filter(f => f.created_by === m.id)
          const plan = (memberPlans || []).find(p => p.created_by === m.id)
          return {
            id: m.id,
            name: m.name,
            role: m.role,
            fcrApproved: mFcrs.filter(f => f.status === 'approved').length,
            fcrPending: mFcrs.filter(f => f.status === 'pending_approval').length,
            fcrRejected: mFcrs.filter(f => f.status === 'rejected').length,
            planStatus: plan ? plan.status : 'none',
          }
        }))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-amber-100 text-amber-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
      none: 'bg-gray-100 text-gray-500',
    }
    const labels = {
      draft: 'Draft',
      pending_approval: 'Pending Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      none: 'No Plan Yet',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  const TEAM_MEMBER_ROLE_LABELS = { se: 'Sales Engineer', bd: 'BD Engineer' }
  const salesTeamMembers = teamMembers.filter(m => m.role === 'se')
  const bdTeamMembers = teamMembers.filter(m => m.role === 'bd')

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {profile?.full_name || 'User'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label={role === ROLES.VIEWER ? 'All MCP (Plan)s' : role === ROLES.COMMERCIAL_AC_HEAD || role === ROLES.NSM ? 'Pending Itineraries' : 'My Itineraries'}
          value={role === ROLES.VIEWER ? stats.myItineraries : role === ROLES.COMMERCIAL_AC_HEAD || role === ROLES.NSM ? stats.pendingItineraries : stats.myItineraries}
          color="blue"
          link="/itinerary"
        />
        <StatCard
          icon={ClipboardCheck}
          label={role === ROLES.VIEWER ? 'All FCRs' : role === ROLES.COMMERCIAL_AC_HEAD || role === ROLES.NSM ? 'Pending FCRs' : 'My FCRs'}
          value={role === ROLES.VIEWER ? stats.myFCRs : role === ROLES.COMMERCIAL_AC_HEAD || role === ROLES.NSM ? stats.pendingFCRs : stats.myFCRs}
          color="amber"
          link="/fcr"
        />
        <StatCard
          icon={Building2}
          label="Total Accounts"
          value={stats.totalAccounts}
          color="emerald"
          link="/accounts"
        />
        <StatCard
          icon={Archive}
          label="MCP Archive"
          value={stats.archivedMCPs}
          color="purple"
          link="/mcp-archive"
        />
      </div>

      {approvedPlan && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">This Month's MCP (Plan)</h3>
            <Link to={`/itinerary/${approvedPlan.id}`} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View Full Plan <ArrowRight size={14} />
            </Link>
          </div>
          <MonthCalendar month={approvedPlan.month} visits={approvedPlan.visits || []} accounts={planAccounts} />
        </div>
      )}

      {role && TEAM_OVERVIEW_ROLES.includes(role) && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Team Overview</h3>
          <p className="text-sm text-gray-500 mb-4">
            {role === ROLES.NSM ? 'Consolidated data for the MBT Sales Team' : 'Consolidated data for the MBT Sales and BD Teams'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-700">{teamStats.approvedFCRs}</p>
              <p className="text-sm text-emerald-700 mt-0.5">FCRs Approved</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{teamStats.rejectedFCRs}</p>
              <p className="text-sm text-red-700 mt-0.5">FCRs Rejected</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-700">{teamStats.overdueFollowUps}</p>
              <p className="text-sm text-amber-700 mt-0.5">Overdue Follow-ups</p>
            </div>
          </div>

          {teamMembers.length === 0 ? (
            <p className="text-sm text-gray-400 mt-4">No team members found.</p>
          ) : (
            <div className="mt-6 space-y-6">
              <TeamMemberTable title="MBT Sales Team" members={salesTeamMembers} getStatusBadge={getStatusBadge} />
              {role !== ROLES.NSM && (
                <TeamMemberTable title="BD Team" members={bdTeamMembers} getStatusBadge={getStatusBadge} />
              )}
            </div>
          )}
        </div>
      )}

      {followUps.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={18} /> Follow-ups Due Soon
          </h3>
          <div className="space-y-2">
            {followUps.map(item => (
              <Link
                key={item.key}
                to={item.link}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.type}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.overdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {item.overdue ? 'Overdue · ' : 'Due '}{format(parseISO(item.date), 'MMM dd, yyyy')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Itineraries */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Itineraries</h3>
            <Link to="/itinerary" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {recentItineraries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-50" />
              <p>No itineraries yet</p>
              {role !== ROLES.VIEWER && (
                <Link to="/itinerary/new" className="text-primary-600 text-sm mt-1 inline-block">
                  Create your first itinerary
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {recentItineraries.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{item.title || `Itinerary - ${format(new Date(item.month), 'MMMM yyyy')}`}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.visits?.length || 0} visits planned
                    </p>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent FCRs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Field Contact Reports</h3>
            <Link to="/fcr" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {recentFCRs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ClipboardCheck size={32} className="mx-auto mb-2 opacity-50" />
              <p>No FCRs yet</p>
              {canCreateFCR(role) && (
                <Link to="/fcr/new" className="text-primary-600 text-sm mt-1 inline-block">
                  Create your first FCR
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {recentFCRs.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{item.customer_info?.company_name || 'Field Contact Report'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.visit_date ? format(new Date(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                    </p>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {canCreateAccount(role) && (
            <QuickActionCard
              icon={Building2}
              label="Add Account"
              description="Profile a prospect first"
              link="/accounts/new"
              color="emerald"
            />
          )}
          {role !== ROLES.VIEWER && (
            <QuickActionCard
              icon={Calendar}
              label="New MCP (Plan)"
              description="Propose your monthly visits"
              link="/itinerary/new"
              color="blue"
            />
          )}
          {canCreateFCR(role) && (
            <QuickActionCard
              icon={ClipboardCheck}
              label="New FCR"
              description="Log a field visit"
              link="/fcr/new"
              color="amber"
            />
          )}
          <QuickActionCard
            icon={Archive}
            label="MCP (Actual)"
            description="See what actually happened"
            link="/mcp-actual"
            color="purple"
          />
        </div>
      </div>
    </div>
  )
}

// Per-member breakdown shown inside the Team Overview card -- one row per
// Sales/BD Engineer with their FCR counts by status and this month's MCP
// (Plan) status. Hidden entirely (returns null) when there are no members
// of that team so NSM (Sales-only) doesn't render an empty "BD Team"
// section that never applies to them.
const TeamMemberTable = ({ title, members, getStatusBadge }) => {
  if (members.length === 0) return null

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 px-2 font-medium">Name</th>
              <th className="py-2 px-2 font-medium">FCRs Approved</th>
              <th className="py-2 px-2 font-medium">FCRs Pending</th>
              <th className="py-2 px-2 font-medium">FCRs Rejected</th>
              <th className="py-2 px-2 font-medium">This Month's MCP (Plan)</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 px-2 font-medium text-gray-900">{m.name}</td>
                <td className="py-2.5 px-2 text-emerald-700">{m.fcrApproved}</td>
                <td className="py-2.5 px-2 text-amber-700">{m.fcrPending}</td>
                <td className="py-2.5 px-2 text-red-700">{m.fcrRejected}</td>
                <td className="py-2.5 px-2">{getStatusBadge(m.planStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const StatCard = ({ icon: Icon, label, value, color, link }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Link to={link} className="card hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </Link>
  )
}

const QuickActionCard = ({ icon: Icon, label, description, link, color }) => {
  const colors = {
    blue: 'hover:border-blue-300 hover:bg-blue-50',
    emerald: 'hover:border-emerald-300 hover:bg-emerald-50',
    amber: 'hover:border-amber-300 hover:bg-amber-50',
    purple: 'hover:border-purple-300 hover:bg-purple-50',
  }

  return (
    <Link 
      to={link}
      className={`flex items-center gap-3 p-4 border border-gray-200 rounded-xl transition-all ${colors[color]}`}
    >
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-gray-600" />
      </div>
      <div>
        <p className="font-medium text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </Link>
  )
}