// Trade Terms: every account must declare how it buys before it's
// considered "profiled" -- see AccountForm.jsx. Distributor names aren't
// locked to an exact list yet (free text for now); once MBT's 2 official
// distributor names are confirmed, DISTRIBUTOR_OPTIONS can be filled in and
// AccountForm's distributor field switched from a text input to a <select>.
export const TRADE_TERMS = {
  DIRECT: 'direct_cmi',
  DISTRIBUTOR: 'distributor',
}

export const TRADE_TERMS_LABELS = {
  [TRADE_TERMS.DIRECT]: 'Direct CMI Trade Terms Agreement',
  [TRADE_TERMS.DISTRIBUTOR]: 'Transacts through an MBT Distributor',
}

// TODO: replace with the 2 official MBT distributor names once provided,
// and switch AccountForm's distributor_name field to a <select> using this.
export const DISTRIBUTOR_OPTIONS = []

// An account is "profiled" -- and therefore selectable in the Itinerary and
// FCR account dropdowns -- once it has a company name and a declared Trade
// Terms status (and, if buying through a distributor, a distributor name).
export const isAccountProfiled = (account) => {
  if (!account?.company_name) return false
  if (!account?.trade_terms) return false
  if (account.trade_terms === TRADE_TERMS.DISTRIBUTOR && !account.distributor_name) return false
  return true
}
