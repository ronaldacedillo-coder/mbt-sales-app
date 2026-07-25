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
import { FCRList } from './pages/FCR/FCRList'
import { FCRForm } from './pages/FCR/FCRForm'
import { FCRApproval } from './pages/FCR/FCRApproval'
import { MeetingMinutes } from './pages/Meetings/MeetingMinutes'
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
        <Route path="/accounts/:id" element={<AccountForm />} />
        
        <Route path="/fcr" element={<FCRList />} />
        <Route path="/fcr/new" element={<FCRForm />} />
        <Route path="/fcr/:id" element={<FCRForm />} />
        <Route path="/fcr/approval" element={
          <ProtectedRoute allowedRoles={[ROLES.NSM, ROLES.COMMERCIAL_AC_HEAD]}>
            <FCRApproval />
          </ProtectedRoute>
        } />
        
        <Route path="/meetings" element={<MeetingMinutes />} />
        
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App