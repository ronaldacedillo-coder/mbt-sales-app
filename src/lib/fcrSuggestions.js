import { differenceInCalendarDays, parseISO, format } from 'date-fns'

// Builds "Suggested Discussion Points" for an upcoming visit from an
// account's own past FCRs. This is a deliberate, transparent rule-based
// pass over the data the rep already entered -- NOT a call to a generative
// AI model. Labeling it as "AI" would repeat a mistake this app has made
// once before (see the Dashboard's "AI Recommended Approach" relabel) --
// so keep the UI copy honest about what this is. A real LLM-backed version
// can replace/augment this once an API key is wired up (see fcrSuggestions
// docs in the user manual).
//
// pastFcrs: array of FCR rows, most-recent-first, each with
//   { visit_date, coverage_notes, form_data, team_type }
// Returns an ordered array of { id, category, text }, capped at ~6 items.

const CLOSED_STATUSES = ['delivered', 'po acquired', 'lost', 'won', 'verbally awarded']
const isOpenStatus = (status) => {
  const s = (status || '').trim().toLowerCase()
  return s.length > 0 && !CLOSED_STATUSES.some(closed => s.includes(closed))
}

const projectRows = (formData) => {
  const po = formData?.project_opportunities || {}
  return [
    ...(po.primary || []).map(r => ({ ...r, section: po.primary_label || 'Primary' })),
    ...(po.qualified || []).map(r => ({ ...r, section: 'Qualified / Identified' })),
  ].filter(r => (r.project_name_owner || '').trim())
}

export const buildDiscussionSuggestions = (pastFcrs = [], teamType) => {
  const suggestions = []
  const push = (category, text) => suggestions.push({ id: `${category}-${suggestions.length}`, category, text })

  if (pastFcrs.length === 0) return suggestions

  const latest = pastFcrs[0]

  // 1. Explicit follow-up commitments from the last visit.
  const getBack = latest.form_data?.get_back_items?.trim()
  if (getBack) {
    push('Follow up', `You noted this to get back on after the last visit (${format(parseISO(latest.visit_date), 'MMM d, yyyy')}): "${getBack}"`)
  }

  // 2. Project opportunities -- track the most recent status per project
  // name and how many past visits it's shown up in.
  const byProject = new Map()
  pastFcrs.forEach(fcr => {
    projectRows(fcr.form_data).forEach(row => {
      const key = row.project_name_owner.trim().toLowerCase()
      if (!byProject.has(key)) {
        byProject.set(key, { ...row, visitCount: 1, firstSeen: fcr.visit_date, lastSeen: fcr.visit_date })
      } else {
        const existing = byProject.get(key)
        existing.visitCount += 1
        existing.firstSeen = fcr.visit_date // pastFcrs is most-recent-first, so this keeps overwriting to the oldest
      }
    })
  })

  const openProjects = [...byProject.values()].filter(p => isOpenStatus(p.status))
  const stalled = openProjects.filter(p => p.visitCount >= 2).sort((a, b) => b.visitCount - a.visitCount)
  const fresh = openProjects.filter(p => p.visitCount < 2)

  stalled.slice(0, 2).forEach(p => {
    push('Project opportunity', `"${p.project_name_owner}" has shown up in ${p.visitCount} past visits, still at "${p.status}" (since ${format(parseISO(p.firstSeen), 'MMM yyyy')}) -- worth pushing for a decision.`)
  })

  fresh.slice(0, 2).forEach(p => {
    const nextSteps = p.next_steps?.trim()
    push('Project opportunity', `Check in on "${p.project_name_owner}" (${p.section}, last noted status: "${p.status}")${nextSteps ? ` -- ${nextSteps}` : ''}`)
  })

  if (teamType === 'business_development') {
    const notYetSpecIn = openProjects.filter(p => p.section === 'Qualified / Identified')
    notYetSpecIn.slice(0, 1).forEach(p => {
      push('Midea spec-in', `"${p.project_name_owner}" is still Qualified/Identified, not SPEC-IN yet -- confirm whether Midea can get into the approved brand list on this one.`)
    })
  }

  // 3. Competitor activity noted in recent visits (most recent 2).
  const seenBrands = new Set()
  pastFcrs.slice(0, 2).forEach(fcr => {
    ;(fcr.form_data?.competitive_check || []).forEach(row => {
      const brand = row.brand?.trim()
      const detail = [row.initiative, row.notes].filter(Boolean).join(' -- ')
      if (brand && detail && !seenBrands.has(brand.toLowerCase())) {
        seenBrands.add(brand.toLowerCase())
        push('Competitor watch', `${brand} activity noted on ${format(parseISO(fcr.visit_date), 'MMM d')}: ${detail}. Be ready to reinforce Midea's advantages if it comes up.`)
      }
    })
  })

  // 4. Recency nudge.
  const daysSince = differenceInCalendarDays(new Date(), parseISO(latest.visit_date))
  if (daysSince > 30) {
    push('Timing', `It's been ${daysSince} days since the last recorded visit (${format(parseISO(latest.visit_date), 'MMM d, yyyy')}) -- good time to re-engage.`)
  }

  return suggestions.slice(0, 6)
}
