export const ROLES = {
  SALES_ENGINEER: 'sales_engineer',
  BD_ENGINEER: 'bd_engineer',
  NSM: 'nsm',
  COMMERCIAL_AC_HEAD: 'commercial_ac_head',
  VIEWER: 'viewer',
}

// MBT Project Pipeline stores its own, shorter role strings on
// user_profiles.role ('se', 'bd', 'nsm', 'head', plus 'pm'/'director' for
// people who only use Pipeline). The Sales app has always spoken in terms
// of ROLES.* above, so every Pipeline login gets mapped once here rather
// than touching every place that already compares against ROLES.*.
//
// 'pm' and 'director' (Product Manager / HVAC Director) map to VIEWER --
// a read-only role with visibility across both the MBT Sales and BD teams'
// Accounts, FCRs, MCP (Plan), and MCP (Actual)/Archive, but no ability to
// create, edit, approve, or delete anything. They sign in with the same
// MBT Project Pipeline credentials as everyone else -- no separate account
// was created for this.
//
// 'admin' (the team's admin, e.g. Christine Joy Villanueva) also maps to
// VIEWER -- same permission set as pm/director (read-only, both teams,
// including PDF exports which are already ungated by role on FCR/MCP
// Archive). She has her own dedicated account in this app (not shared with
// Pipeline), since she isn't a Pipeline user.
const PIPELINE_ROLE_MAP = {
  se: ROLES.SALES_ENGINEER,
  bd: ROLES.BD_ENGINEER,
  nsm: ROLES.NSM,
  head: ROLES.COMMERCIAL_AC_HEAD,
  pm: ROLES.VIEWER,
  director: ROLES.VIEWER,
  admin: ROLES.VIEWER,
}

// Returns null for Pipeline roles the Sales app has no equivalent for --
// callers should treat null as "no access to this app".
export const mapPipelineRole = (pipelineRole) => PIPELINE_ROLE_MAP[pipelineRole] || null

// Some people need to be read-only in THIS app specifically while keeping
// their normal role (and full access) in MBT Project Pipeline -- e.g. an
// active Sales/BD Engineer moved to view-only here without touching their
// shared Pipeline role/title. `sales_app_role_override` on user_profiles is
// a Sales-app-only column Pipeline never reads, so setting it has zero
// effect there. Currently the only supported value is 'viewer'; anything
// else (including null) falls back to the normal Pipeline role mapping.
export const mapProfileRole = (pipelineRole, override) =>
  override === 'viewer' ? ROLES.VIEWER : mapPipelineRole(pipelineRole)

export const ROLE_LABELS = {
  [ROLES.SALES_ENGINEER]: 'Sales Engineer',
  [ROLES.BD_ENGINEER]: 'BD Engineer',
  [ROLES.NSM]: 'National Sales Manager',
  [ROLES.COMMERCIAL_AC_HEAD]: 'Commercial AC Head',
  [ROLES.VIEWER]: 'Viewer (Read-Only)',
}

// VIEWER covers more than one real-world title (Product Manager, HVAC
// Director) that share identical permissions in this app. Use the
// Pipeline-native role string (profile.pipeline_role) to show the specific
// title instead of the generic "Viewer" label -- falls back to
// ROLE_LABELS[role] for everyone else.
export const PIPELINE_ROLE_LABELS = {
  pm: 'Product Manager',
  director: 'HVAC Director',
  admin: 'Team Admin',
}

export const getDisplayTitle = (role, pipelineRole) =>
  PIPELINE_ROLE_LABELS[pipelineRole] || ROLE_LABELS[role] || role

export const TEAM_TYPES = {
  MBT_SALES: 'mbt_sales',
  BUSINESS_DEVELOPMENT: 'business_development',
}

export const canCreateItinerary = (role) =>
  [ROLES.SALES_ENGINEER, ROLES.BD_ENGINEER, ROLES.NSM].includes(role)

// The NSM profiles accounts and assigns them to a Sales Engineer on their
// team (see the ASE/TSE dropdown in AccountForm), so Account creation is
// open to everyone except the read-only Viewer role. FCRs stay
// SE/BD/Head-only -- the NSM doesn't make field visits themselves, only
// reviews/approves the ones SE files, and VIEWER never creates anything.
export const canCreateAccount = (role) => role !== ROLES.VIEWER

export const canCreateFCR = (role) => ![ROLES.NSM, ROLES.VIEWER].includes(role)

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