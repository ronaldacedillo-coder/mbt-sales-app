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
  Download,
  X
} from 'lucide-react'
import { ROLES } from '../utils/roles'
import { RonAppsLogo } from './RonAppsLogo'
import { AboutModal } from './AboutModal'

const PIPELINE_APP_URL = 'https://mbt-pipeline.netlify.app/'

const APPROVER_ROLES = [ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]

// Static sidebar on desktop/laptop (lg+); below that it's a slide-in drawer
// controlled by Layout's `sidebarOpen` state, toggled via the hamburger
// button in Navbar. `isOpen`/`onClose` are only meaningful below lg.
export const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const { role, profile } = useAuth()
  const location = useLocation()
  const [pendingFCRs, setPendingFCRs] = useState(0)
  const [pendingItineraries, setPendingItineraries] = useState(0)
  const [aboutOpen, setAboutOpen] = useState(false)

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

  // Every rep/manager role plus VIEWER (Product Manager / HVAC Director) --
  // VIEWER only ever lands on entries in VIEW_ROLES below, never on the
  // approval or weekly-report pages, which stay approver-only.
  const VIEW_ROLES = [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD, ROLES.VIEWER]

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: VIEW_ROLES },
    { path: '/itinerary', label: 'MCP (Plan)', icon: Calendar, roles: VIEW_ROLES },
    { path: '/accounts', label: 'Accounts', icon: Building2, roles: VIEW_ROLES },
    { path: '/fcr', label: 'Field Contact Reports', icon: ClipboardCheck, roles: VIEW_ROLES },
    // MCP (Actual) is always scoped to the signed-in user's own acknowledged
    // visits (see MCPActual.jsx), so it would just be permanently empty for
    // VIEWER -- MCP Archive is the cross-team equivalent that actually shows
    // them something (every snapshot ever generated, org-wide).
    { path: '/mcp-actual', label: 'MCP (Actual)', icon: Calendar, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/mcp-archive', label: 'MCP Archive', icon: Archive, roles: VIEW_ROLES },
    { path: '/fcr/approval', label: 'FCR Approvals', icon: CheckCircle2, roles: APPROVER_ROLES, badge: pendingFCRs },
    { path: '/itinerary/approval', label: 'MCP (Plan) Approvals', icon: CheckCircle2, roles: APPROVER_ROLES, badge: pendingItineraries },
    { path: '/reports/weekly', label: 'Weekly Report Download', icon: Download, roles: APPROVER_ROLES },
  ]

  const filteredNav = navItems.filter(item => item.roles.includes(role))

  return (
    <>
      {/* Backdrop -- mobile/tablet only, closes the drawer on tap */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 z-30 lg:hidden print:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col z-40 print:hidden transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">MBT Sales</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
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

        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Team</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {profile?.team_name || 'Not Assigned'}
            </p>
          </div>

          <button
            onClick={() => setAboutOpen(true)}
            className="w-full flex items-center gap-2 px-1 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RonAppsLogo size={18} />
            <span>Built by RonApps</span>
            <span className="ml-auto underline">About</span>
          </button>
        </div>
      </aside>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </>
  )
}