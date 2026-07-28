// Trade Terms: every account must declare how it buys before it's
// considered "profiled" -- see AccountForm.jsx.
export const TRADE_TERMS = {
  DIRECT: 'direct_cmi',
  DISTRIBUTOR: 'distributor',
}

export const TRADE_TERMS_LABELS = {
  [TRADE_TERMS.DIRECT]: 'Direct CMI Trade Terms Agreement',
  [TRADE_TERMS.DISTRIBUTOR]: 'Transacts through an MBT Distributor',
}

// The 2 MBT distributors -- AccountForm renders these as a <select> once
// this list is non-empty (see DISTRIBUTOR_OPTIONS.length check there).
export const DISTRIBUTOR_OPTIONS = ['Polaris', 'G-Energy']

// An account is "profiled" -- and therefore selectable in the Itinerary and
// FCR account dropdowns -- once it has a company name and a declared Trade
// Terms status (and, if buying through a distributor, a distributor name).
export const isAccountProfiled = (account) => {
  if (!account?.company_name) return false
  if (!account?.trade_terms) return false
  if (account.trade_terms === TRADE_TERMS.DISTRIBUTOR && !account.distributor_name) return false
  return true
}

// Customer Type replaces the old generic "Industry" field on accounts --
// every account here is a construction-trade customer, so what matters is
// what kind of customer they are. Value is a slug stored on
// accounts.customer_type; CUSTOMER_TYPE_LABELS maps it back to the
// human-readable label anywhere it's displayed (AccountList, AccountDetail)
// or used to key AccountForm's APPROACH_STRATEGIES.
export const CUSTOMER_TYPES = [
  { value: 'project_contractor', label: 'Project Contractor' },
  { value: 'fitout_contractor', label: 'Fit-out Contractor' },
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'architect', label: 'Architect' },
  { value: 'land_developer', label: 'Land Developer' },
  { value: 'institutional_account', label: 'Multi-Branch Institutional Account' },
  { value: 'other', label: 'Other End-user Account' },
]

export const CUSTOMER_TYPE_LABELS = Object.fromEntries(CUSTOMER_TYPES.map(ct => [ct.value, ct.label]))
