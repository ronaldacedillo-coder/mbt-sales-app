import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, 
  Calendar, 
  Building2, 
  FileText, 
  Users,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react'
import { ROLES } from '../utils/roles'

export const Sidebar = () => {
  const { role, profile } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/itinerary', label: 'Itinerary', icon: Calendar, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/accounts', label: 'Accounts', icon: Building2, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/fcr', label: 'Field Contact Reports', icon: ClipboardCheck, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
    { path: '/meetings', label: 'Meetings', icon: Users, roles: [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD] },
  ]

  const filteredNav = navItems.filter(item => item.roles.includes(role))

  return (
    <aside className="w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">MBT Sales</span>
        </div>
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
              {isActive && <ChevronRight size={14} className="ml-auto" />}
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