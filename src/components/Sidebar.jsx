import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard,
  Calendar,
  Building2,
  FileText,
  Archive,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  ArrowLeftRight,
  Download
} from 'lucide-react'
import { ROLES } from '../utils/roles'

const PIPELINE_APP_URL = 'https://mbt-pipeline.netlify.app/'

const APPROVER_ROLES = [ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]

export const Sidebar = () => {
  const { role, profile } = useAuth()
  const location = useLocation()
  const [pendingFCRs, setPendingFCRs] = useState(0)
  const [pendingItineraries, setPendingItineraries] = useState(0)

  useEffect(() => {
    if (!APPROVER_ROLES.includes(role)) return

    const fetchPendingCounts = async () => {
      const submitterRolesForFCR = role === ROLES.NSM ? [ROLES.SALES_ENGINEER] : [ROLES.BD_ENGINEER]
      const submitterRolesForItinerary = role === ROLES.NSM
        ? [ROLES.SALES_ENGINEER, ROLES.NSM]
        : [ROLES.BD_ENGINEER, ROLES.NSM]

      const [{ count: fcrCount }, { count: itineraryCount }] = await Promise.all([
        supabase.from('fcrs').select('id', { count: 'exact', head: true })
          .eq('status', 'pending_approval').in('submitter_role', submitterRolesForFCR),
        supabase.from('itineraries').select('id', { count: 'exact', head: true })
          .eq('status', 'pending_approval').in('submitter_role', submitterRolesForItinerary),
      ])

      setPendingFCRs(fcrCount || 0)
      setPendingItineraries(itineraryCount || 0)
    }

    fetchPendingCounts()
    const interval = setInterval(fetchPendingCounts, 60000)
    return () => clearInterval(interval)
  }, [role])

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/itinerary', label: 'MCP (Plan)', icon: Calendar, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/accounts', label: 'Accounts', icon: Building2, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/fcr', label: 'Field Contact Reports', icon: ClipboardCheck, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/mcp-actual', label: 'MCP (Actual)', icon: Calendar, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/mcp-archive', label: 'MCP Archive', icon: Archive, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/fcr/approval', label: 'FCR Approvals', icon: CheckCircle2, roles: APPROVER_ROLES, badge: pendingFCRs },
    { path: '/itinerary/approval', label: 'MCP (Plan) Approvals', icon: CheckCircle2, roles: APPROVER_ROLES, badge: pendingItineraries },
    { path: '/reports/weekly', label: 'Weekly Report Download', icon: Download, roles: APPROVER_ROLES },
  ]

  const filteredNav = navItems.filter(item => item.roles.includes(role))

  return (
    <aside className="w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col print:hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">MBT Sales</span>
        </div>
      </div>

      <div className="px-4 pt-4">
        <a
          href={PIPELINE_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Same login, opens MBT Project Pipeline in a new tab"
        >
          <ArrowLeftRight size={14} />
          Switch to MBT Project Pipeline
        </a>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              {item.label}
              {!!item.badge && (
                <span className="ml-auto bg-red-500 text-white text-xs font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge}
                </span>
              )}
              {isActive && !item.badge && <ChevronRight size={14} className="ml-auto" />}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Team</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {profile?.team_name || 'Not Assigned'}
          </p>
        </div>
      </div>
    </aside>
  )
}