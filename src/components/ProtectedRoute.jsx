import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Logged in via MBT Project Pipeline but with a role the Sales app has no
  // equivalent for (e.g. 'pm' or 'director') -- there's nothing useful to
  // show them here rather than a broken/empty dashboard.
  if (profile && !profile.role) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900">No access to MBT Sales Operations</h1>
          <p className="text-sm text-gray-500 mt-2">
            Your MBT Project Pipeline account ({profile.pipeline_role}) isn't set up for this app.
            Use MBT Project Pipeline instead, or ask your admin to update your role.
          </p>
        </div>
      </div>
    )
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}