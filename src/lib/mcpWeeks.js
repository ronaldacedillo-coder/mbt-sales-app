import { startOfMonth, endOfMonth, addDays, isSameMonth, isAfter, format, getDay } from 'date-fns'

// Lays out a month the same way MBT's official Monthly Coverage Plan (MCP)
// template does: Monday-to-Friday work weeks only (no weekend columns), Week
// 1 starting on the first Monday on/after the 1st, continuing until the
// week whose Monday falls after the last day of the month. The final week
// is often partial (e.g. a month ending on a Tuesday leaves Wed/Thu/Fri
// blank) -- those days come back as `null` so callers can render an empty
// cell instead of a date outside the month.
export const getMCPWeeks = (monthInput) => {
  const monthDate = typeof monthInput === 'string' ? new Date(monthInput + (monthInput.length === 7 ? '-01' : '')) : monthInput
  const first = startOfMonth(monthDate)
  const last = endOfMonth(monthDate)

  const dow = getDay(first) // 0 = Sun ... 6 = Sat
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow
  let cursor = addDays(first, daysToMonday)

  const weeks = []
  let weekNum = 1
  while (!isAfter(cursor, last)) {
    const days = []
    for (let i = 0; i < 5; i++) {
      const d = addDays(cursor, i)
      days.push(isSameMonth(d, monthDate) && !isAfter(d, last) ? format(d, 'yyyy-MM-dd') : null)
    }
    weeks.push({ weekNum, days })
    weekNum++
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export const MCP_WEEKDAY_LABELS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

// Groups an itinerary's visits by date + AM/PM period, resolving account_id
// to a display name. Returns { 'yyyy-MM-dd': { AM: [text...], PM: [text...] } }
export const groupVisitsByDayPeriod = (visits = [], accounts = []) => {
  const accountsById = Object.fromEntries(accounts.map(a => [a.id, a]))
  const byDay = {}
  visits.forEach(v => {
    if (!v.visit_date) return
    const period = v.period === 'PM' ? 'PM' : 'AM'
    byDay[v.visit_date] = byDay[v.visit_date] || { AM: [], PM: [] }
    const name = accountsById[v.account_id]?.company_name || 'Unassigned'
    const label = v.purpose ? `${name} - ${v.purpose}` : name
    byDay[v.visit_date][period].push(label)
  })
  return byDay
}
