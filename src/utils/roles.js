export const ROLES = {
  SALES_ENGINEER: 'sales_engineer',
  BD_ENGINEER: 'bd_engineer',
  NSM: 'nsm',
  COMMERCIAL_AC_HEAD: 'commercial_ac_head',
}

// MBT Project Pipeline stores its own, shorter role strings on
// user_profiles.role ('se', 'bd', 'nsm', 'head', plus 'pm'/'director' for
// people who only use Pipeline). The Sales app has always spoken in terms
// of ROLES.* above, so every Pipeline login gets mapped once here rather
// than touching every place that already compares against ROLES.*.
const PIPELINE_ROLE_MAP = {
  se: ROLES.SALES_ENGINEER,
  bd: ROLES.BD_ENGINEER,
  nsm: ROLES.NSM,
  head: ROLES.COMMERCIAL_AC_HEAD,
}

// Returns null for Pipeline roles the Sales app has no equivalent for
// (pm, director) -- callers should treat null as "no access to this app".
export const mapPipelineRole = (pipelineRole) => PIPELINE_ROLE_MAP[pipelineRole] || null

export const ROLE_LABELS = {
  [ROLES.SALES_ENGINEER]: 'Sales Engineer',
  [ROLES.BD_ENGINEER]: 'BD Engineer',
  [ROLES.NSM]: 'National Sales Manager',
  [ROLES.COMMERCIAL_AC_HEAD]: 'Commercial AC Head',
}

export const TEAM_TYPES = {
  MBT_SALES: 'mbt_sales',
  BUSINESS_DEVELOPMENT: 'business_development',
}

export const canCreateItinerary = (role) => 
  [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM].includes(role)

export const canSubmitItinerary = (role) => 
  [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM].includes(role)

export const canApproveItinerary = (role, submitterRole) => {
  if (submitterRole === ROLES.SALES_ENGINEER) return role === ROLES.NSM
  if (submitterRole === ROLES.BD_ENGINEER) return role === ROLES.COMMERCIAL_AC_HEAD
  if (submitterRole === ROLES.NSM) return role === ROLES.COMMERCIAL_AC_HEAD
  return false
}

export const canApproveFCR = (role, submitterRole) => {
  if (submitterRole === ROLES.SALES_ENGINEER) return role === ROLES.NSM
  if (submitterRole === ROLES.BD_ENGINEER) return role === ROLES.COMMERCIAL_AC_HEAD
  return false
}

export const getTeamType = (role) => {
  if (role === ROLES.SALES_ENGINEER || role === ROLES.NSM) return TEAM_TYPES.MBT_SALES
  if (role === ROLES.BD_ENGINEER) return TEAM_TYPES.BUSINESS_DEVELOPMENT
  if (role === ROLES.COMMERCIAL_AC_HEAD) return null
  return null
}

export const getApproverRole = (role) => {
  if (role === ROLES.SALES_ENGINEER) return ROLES.NSM
  if (role === ROLES.BD_ENGINEER) return ROLES.COMMERCIAL_AC_HEAD
  if (role === ROLES.NSM) return ROLES.COMMERCIAL_AC_HEAD
  return null
}