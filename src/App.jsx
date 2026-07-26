import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ItineraryList } from './pages/itinerary/ItineraryList'
import { ItineraryForm } from './pages/itinerary/ItineraryForm'
import { ItineraryApproval } from './pages/itinerary/ItineraryApproval'
import { AccountList } from './pages/Accounts/AccountList'
import { AccountForm } from './pages/Accounts/AccountForm'
import { AccountDetail } from './pages/Accounts/AccountDetail'
import { FCRList } from './pages/FCR/FCRList'
import { FCRForm } from './pages/FCR/FCRForm'
import { FCRApproval } from './pages/FCR/FCRApproval'
import { AcknowledgeFCR } from './pages/Acknowledge/AcknowledgeFCR'
import { MCPActual } from './pages/mcp/MCPActual'
import { MCPArchive } from './pages/mcp/MCPArchive'
import { ROLES } from './utils/roles'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />

      {/* Public -- no login. Reached only via the link a Sales/BD rep emails
          to an account contact for them to acknowledge the meeting minutes. */}
      <Route path="/acknowledge/:token" element={<AcknowledgeFCR />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        
        <Route path="/itinerary" element={<ItineraryList />} />
        <Route path="/itinerary/new" element={<ItineraryForm />} />
        <Route path="/itinerary/:id" element={<ItineraryForm />} />
        <Route path="/itinerary/approval" element={
          <ProtectedRoute allowedRoles={[ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]}>
            <ItineraryApproval />
          </ProtectedRoute>
        } />
        
        <Route path="/accounts" element={<AccountList />} />
        <Route path="/accounts/new" element={<AccountForm />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/accounts/:id/edit" element={<AccountForm />} />
        
        <Route path="/fcr" element={<FCRList />} />
        <Route path="/fcr/new" element={<FCRForm />} />
        <Route path="/fcr/:id" element={<FCRForm />} />
        <Route path="/fcr/approval" element={
          <ProtectedRoute allowedRoles={[ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]}>
            <FCRApproval />
          </ProtectedRoute>
        } />
        
        <Route path="/mcp-actual" element={<MCPActual />} />
        <Route path="/mcp-archive" element={<MCPArchive />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App