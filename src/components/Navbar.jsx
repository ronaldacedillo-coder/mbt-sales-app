import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Bell, User, LogOut, Menu } from 'lucide-react'
import { ROLES, getDisplayTitle } from '../utils/roles'

const APPROVER_ROLES = [ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]

export const Navbar = ({ onMenuClick = () => {} }) => {
  const { profile, role, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)
  const [alertTarget, setAlertTarget] = useState('/dashboard')
  const [alertLabel, setAlertLabel] = useState('')

  useEffect(() => {
    if (!user || !role) return

    const fetchAlerts = async () => {
      if (APPROVER_ROLES.includes(role)) {
        // Approvers: how many items are waiting on them right now
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

        const total = (fcrCount || 0) + (itineraryCount || 0)
        setAlertCount(total)
        setAlertTarget((fcrCount || 0) >= (itineraryCount || 0) ? '/fcr/approval' : '/itinerary/approval')
        setAlertLabel(`${total} item${total === 1 ? '' : 's'} waiting for your approval`)
      } else {
        // Reps: anything rejected that needs a resubmit
        const [{ count: fcrRejected }, { count: itineraryRejected }] = await Promise.all([
          supabase.from('fcrs').select('id', { count: 'exact', head: true })
            .eq('created_by', user.id).eq('status', 'rejected'),
          supabase.from('itineraries').select('id', { count: 'exact', head: true })
            .eq('created_by', user.id).eq('status', 'rejected'),
        ])

        const total = (fcrRejected || 0) + (itineraryRejected || 0)
        setAlertCount(total)
        setAlertTarget((fcrRejected || 0) >= (itineraryRejected || 0) ? '/fcr' : '/itinerary')
        setAlertLabel(`${total} item${total === 1 ? '' : 's'} rejected and need${total === 1 ? 's' : ''} your attention`)
      }
    }

    fetchAlerts()
    const interval = setInterval(fetchAlerts, 60000)
    return () => clearInterval(interval)
  }, [user, role])

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-3 sm:px-6 gap-2 sticky top-0 z-10 print:hidden">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden -ml-1 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">MBT Sales Operations</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <button
          onClick={() => navigate(alertTarget)}
          className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
          title={alertCount > 0 ? alertLabel : 'No alerts'}
        >
          <Bell size={20} />
          {alertCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-semibold rounded-full">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-primary-600" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-gray-500">{profile ? getDisplayTitle(profile.role, profile.pipeline_role) : ''}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}