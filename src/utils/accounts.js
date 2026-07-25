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
