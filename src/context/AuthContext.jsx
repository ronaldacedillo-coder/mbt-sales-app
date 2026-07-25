import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ROLES, mapPipelineRole } from '../utils/roles'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Sales app users are really MBT Project Pipeline users now -- one login,
  // one user_profiles table. Pipeline's role strings ('se', 'bd', 'nsm',
  // 'head', plus 'pm'/'director' for Pipeline-only staff) get mapped to the
  // Sales app's own ROLES.* here, and `full_name` is kept as an alias for
  // Pipeline's `name` column so existing `profile?.full_name` reads
  // elsewhere in the app don't need to change.
  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!data) {
      setProfile(null)
      return
    }
    setProfile({
      ...data,
      full_name: data.name,
      pipeline_role: data.role,
      role: mapPipelineRole(data.role),
    })
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    role: profile?.role || null,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.role === ROLES.COMMERCIAL_AC_HEAD,
    isNSM: profile?.role === ROLES.NSM,
    isSalesEngineer: profile?.role === ROLES.SALES_ENGINEER,
    isBDEngineer: profile?.role === ROLES.BD_ENGINEER,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}