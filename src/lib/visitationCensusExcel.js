import { format, parseISO, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns'

// Beautified .xlsx "Visitation Census" -- one tab per Sunday-Saturday week
// covering the selected date range, each listing every active MBT Sales/BD
// team member (including zero-activity ones, so the report reads as a full
// roster census, not just a list of who happened to file something) with
// their FCR counts by status and the accounts they visited that week.
//
// Mirrors excelExport.js's approach (xlsx-js-style for per-cell styling,
// one buildXSheet() per tab, plain computed values rather than formulas --
// this is generated fresh from the database on every click, so there's
// nothing for a live formula to stay in sync with).

const NAVY = '1E3A8A'
const HEADER_TEXT = 'FFFFFF'
const ZEBRA = 'F3F4F6'
const MUTED_ZEBRA = 'F9FAFB'
const BORDER_COLOR = 'D1D5DB'
const MUTED_TEXT = '9CA3AF'

const thinBorder = { style: 'thin', color: { rgb: BORDER_COLOR } }
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

const headerCellStyle = {
  font: { bold: true, color: { rgb: HEADER_TEXT }, sz: 10 },
  fill: { fgColor: { rgb: NAVY } },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  border: allBorders,
}

const bodyCellStyle = (zebra, muted, center) => ({
  font: { sz: 9.5, color: { rgb: muted ? MUTED_TEXT : '1F2937' }, italic: !!muted },
  alignment: { vertical: 'center', horizontal: center ? 'center' : 'left', wrapText: true },
  fill: { fgColor: { rgb: zebra ? (muted ? MUTED_ZEBRA : ZEBRA) : 'FFFFFF' } },
  border: allBorders,
})

const totalCellStyle = (center) => ({
  font: { bold: true, sz: 9.5, color: { rgb: '111827' } },
  alignment: { vertical: 'center', horizontal: center ? 'center' : 'left' },
  fill: { fgColor: { rgb: 'E5E7EB' } },
  border: allBorders,
})

const groupHeaderStyle = {
  font: { bold: true, sz: 10, color: { rgb: NAVY } },
  fill: { fgColor: { rgb: 'DBEAFE' } },
  alignment: { vertical: 'center', horizontal: 'left' },
  border: allBorders,
}

const titleCellStyle = {
  font: { bold: true, sz: 18, color: { rgb: HEADER_TEXT } },
  fill: { fgColor: { rgb: NAVY } },
  alignment: { vertical: 'center', horizontal: 'left' },
}

const subtitleCellStyle = {
  font: { sz: 11, color: { rgb: '374151' } },
  alignment: { vertical: 'center', horizontal: 'left' },
}

const noteCellStyle = {
  font: { sz: 9, italic: true, color: { rgb: '6B7280' } },
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
}

const sectionCellStyle = {
  font: { bold: true, sz: 12, color: { rgb: NAVY } },
  alignment: { vertical: 'center', horizontal: 'left' },
}

const writeStyledRows = (ws, XLSX, rows, startRow = 0) => {
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell == null) return
      const addr = XLSX.utils.encode_cell({ r: startRow + r, c })
      ws[addr] = { t: typeof cell.value === 'number' ? 'n' : 's', v: cell.value ?? '', s: cell.style }
    })
  })
}

// Sunday-Saturday weeks fully covering [start, end], matching the Dashboard
// Team Overview's weekStartsOn: 0 convention.
const buildWeeks = (start, end) => {
  const starts = eachWeekOfInterval({ start: parseISO(start), end: parseISO(end) }, { weekStartsOn: 0 })
  return starts.map((s, i) => {
    const e = endOfWeek(s, { weekStartsOn: 0 })
    const sameMonth = s.getMonth() === e.getMonth()
    const label = sameMonth
      ? `${format(s, 'MMM d')}-${format(e, 'd, yyyy')}`
      : `${format(s, 'MMM d')}-${format(e, 'MMM d, yyyy')}`
    const sheetRange = sameMonth ? `${format(s, 'MMM d')}-${format(e, 'd')}` : `${format(s, 'MMM d')}-${format(e, 'MMM d')}`
    return { start: s, end: e, label, sheetName: `Week ${i + 1} (${sheetRange})`.slice(0, 31) }
  })
}

const accountName = (f) => f.customer_info?.company_name || f.account?.company_name || 'Unknown Account'
const companionNames = (f) => [f.companion?.name, f.companion2?.name].filter(Boolean)

// MBT Sales together, then BD Team together (each alphabetical by name),
// rather than interleaved -- both the Overview leaderboard and each week's
// tab render one contiguous block per team, with a group header row.
const GROUP_LABELS = { se: 'MBT Sales Team', bd: 'BD Team' }
const groupMembers = (teamMembers) => {
  const byName = (a, b) => a.name.localeCompare(b.name)
  return [
    { role: 'se', label: GROUP_LABELS.se, members: teamMembers.filter(m => m.role === 'se').sort(byName) },
    { role: 'bd', label: GROUP_LABELS.bd, members: teamMembers.filter(m => m.role === 'bd').sort(byName) },
  ].filter(g => g.members.length > 0)
}

const buildOverviewSheet = (XLSX, { fcrs, teamMembers, weeks, rangeLabel, scopeLabel, generatedBy }) => {
  const ws = {}
  const rows = [
    [{ value: 'MBT Sales & BD Team -- Visitation Census', style: titleCellStyle }],
    [],
    [{ value: scopeLabel, style: subtitleCellStyle }],
    [{ value: `Period: ${rangeLabel}`, style: subtitleCellStyle }],
    [{ value: `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')} by ${generatedBy || 'Unknown'}`, style: subtitleCellStyle }],
    [],
    [{ value: 'How to read this report', style: sectionCellStyle }],
    [{ value: 'Each tab after this one covers one Sunday-Saturday week; the tab name shows the date range.', style: noteCellStyle }],
    [{ value: '"FCRs Filed" counts every FCR with a Visit Date in that week, regardless of status. "Acknowledged" means the account contact confirmed the visit; "Approved" means the NSM/Commercial AC Head signed off.', style: noteCellStyle }],
    [{ value: '"Joint Visits" counts FCRs where the filer named an accompanying Sales Engineer or BD Team member. Rows shown in gray had no FCR that week -- kept in the list for full roster coverage.', style: noteCellStyle }],
    [],
    [{ value: 'Team Leaderboard -- Full Report Period', style: sectionCellStyle }],
  ]
  const headerRowIdx = rows.length
  const lbHead = ['Team', 'Name', 'FCRs Filed', 'Acknowledged', 'Approved', 'Unique Accounts Visited', 'Weeks with Visit']
  rows.push(lbHead.map(h => ({ value: h, style: headerCellStyle })))

  const groupMerges = []
  let rowCounter = 0
  groupMembers(teamMembers).forEach((group) => {
    groupMerges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: lbHead.length - 1 } })
    rows.push([{ value: group.label, style: groupHeaderStyle }])

    group.members.forEach((m) => {
      const personFcrs = fcrs.filter(f => f.created_by === m.id)
      const acked = personFcrs.filter(f => f.ack_status === 'acknowledged').length
      const approved = personFcrs.filter(f => f.status === 'approved').length
      const uniqueAccounts = new Set(personFcrs.map(accountName)).size
      const weeksActive = new Set(personFcrs.map(f => weeks.find(w => f.visit_date >= format(w.start, 'yyyy-MM-dd') && f.visit_date <= format(w.end, 'yyyy-MM-dd'))?.label)).size
      const muted = personFcrs.length === 0
      const zebra = rowCounter % 2 === 1
      rowCounter++
      const s = bodyCellStyle(zebra, muted)
      const sc = bodyCellStyle(zebra, muted, true)
      rows.push([
        { value: group.label === GROUP_LABELS.bd ? 'BD Team' : 'MBT Sales', style: s },
        { value: m.name, style: s },
        { value: personFcrs.length, style: sc },
        { value: acked, style: sc },
        { value: approved, style: sc },
        { value: uniqueAccounts, style: sc },
        { value: `${weeksActive} of ${weeks.length}`, style: sc },
      ])
    })
  })

  rows.push([
    { value: 'TOTAL', style: totalCellStyle() },
    { value: `${teamMembers.length} team members`, style: totalCellStyle() },
    { value: fcrs.length, style: totalCellStyle(true) },
    { value: fcrs.filter(f => f.ack_status === 'acknowledged').length, style: totalCellStyle(true) },
    { value: fcrs.filter(f => f.status === 'approved').length, style: totalCellStyle(true) },
    { value: new Set(fcrs.map(accountName)).size, style: totalCellStyle(true) },
    { value: '', style: totalCellStyle(true) },
  ])

  rows.push([])
  rows.push([{ value: 'Weekly Summary', style: sectionCellStyle }])
  const wkHead = ['Week', 'Date Range', 'FCRs Filed', 'Acknowledged', 'Approved', 'Active Reps', 'Unique Accounts Visited']
  rows.push(wkHead.map(h => ({ value: h, style: headerCellStyle })))
  weeks.forEach((w, i) => {
    const wkFcrs = fcrs.filter(f => f.visit_date >= format(w.start, 'yyyy-MM-dd') && f.visit_date <= format(w.end, 'yyyy-MM-dd'))
    const s = bodyCellStyle(i % 2 === 1, false)
    const sc = bodyCellStyle(i % 2 === 1, false, true)
    rows.push([
      { value: w.sheetName, style: s },
      { value: w.label, style: s },
      { value: wkFcrs.length, style: sc },
      { value: wkFcrs.filter(f => f.ack_status === 'acknowledged').length, style: sc },
      { value: wkFcrs.filter(f => f.status === 'approved').length, style: sc },
      { value: new Set(wkFcrs.map(f => f.created_by)).size, style: sc },
      { value: new Set(wkFcrs.map(accountName)).size, style: sc },
    ])
  })

  writeStyledRows(ws, XLSX, rows)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, ...groupMerges]
  ws['!cols'] = [{ wch: 13 }, { wch: 24 }, { wch: 13 }, { wch: 14 }, { wch: 11 }, { wch: 22 }, { wch: 16 }]
  ws['!rows'] = [{ hpt: 30 }]
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: 6 } })
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 }
  return ws
}

const buildWeekSheet = (XLSX, { week, fcrs, teamMembers }) => {
  const ws = {}
  const weekFcrs = fcrs.filter(f => f.visit_date >= format(week.start, 'yyyy-MM-dd') && f.visit_date <= format(week.end, 'yyyy-MM-dd'))

  const rows = [
    [{ value: 'MBT Sales & BD Team -- Weekly Visitation Census', style: titleCellStyle }],
    [],
    [{ value: `Week of ${week.label} (Sunday-Saturday)`, style: subtitleCellStyle }],
  ]
  const headerRowIdx = rows.length
  const head = ['Team', 'Name', 'Accounts Visited', 'FCRs Filed', 'Acknowledged', 'Approved', 'Pending Approval', 'Draft / Not Sent', 'Joint Visits', 'Accounts Visited (list)']
  rows.push(head.map(h => ({ value: h, style: headerCellStyle })))

  let totFiled = 0, totAck = 0, totApproved = 0, totPending = 0, totDraft = 0, totJoint = 0, totAccounts = 0
  const groupMerges = []
  let rowCounter = 0
  groupMembers(teamMembers).forEach((group) => {
    groupMerges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: head.length - 1 } })
    rows.push([{ value: group.label, style: groupHeaderStyle }])

    group.members.forEach((m) => {
      const personFcrs = weekFcrs.filter(f => f.created_by === m.id)
      const accounts = [...new Set(personFcrs.map(accountName))]
      const filed = personFcrs.length
      const acked = personFcrs.filter(f => f.ack_status === 'acknowledged').length
      const approved = personFcrs.filter(f => f.status === 'approved').length
      const pending = personFcrs.filter(f => f.status === 'pending_approval').length
      const draft = personFcrs.filter(f => f.status === 'draft').length
      const joint = personFcrs.filter(f => companionNames(f).length > 0).length
      totFiled += filed; totAck += acked; totApproved += approved; totPending += pending; totDraft += draft; totJoint += joint; totAccounts += accounts.length

      const muted = filed === 0
      const zebra = rowCounter % 2 === 1
      rowCounter++
      const s = bodyCellStyle(zebra, muted)
      const sc = bodyCellStyle(zebra, muted, true)
      rows.push([
        { value: group.label === GROUP_LABELS.bd ? 'BD Team' : 'MBT Sales', style: s },
        { value: m.name, style: s },
        { value: accounts.length, style: sc },
        { value: filed, style: sc },
        { value: acked, style: sc },
        { value: approved, style: sc },
        { value: pending, style: sc },
        { value: draft, style: sc },
        { value: joint, style: sc },
        { value: accounts.length ? accounts.join('; ') : '-', style: s },
      ])
    })
  })

  rows.push([
    { value: 'TOTAL', style: totalCellStyle() },
    { value: `${teamMembers.length} team members`, style: totalCellStyle() },
    { value: totAccounts, style: totalCellStyle(true) },
    { value: totFiled, style: totalCellStyle(true) },
    { value: totAck, style: totalCellStyle(true) },
    { value: totApproved, style: totalCellStyle(true) },
    { value: totPending, style: totalCellStyle(true) },
    { value: totDraft, style: totalCellStyle(true) },
    { value: totJoint, style: totalCellStyle(true) },
    { value: '', style: totalCellStyle() },
  ])

  writeStyledRows(ws, XLSX, rows)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, ...groupMerges]
  ws['!cols'] = [{ wch: 11 }, { wch: 22 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 60 }]
  ws['!rows'] = [{ hpt: 26 }, , , { hpt: 30 }]
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: 9 } })
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 }
  return ws
}

const buildDataSheet = (XLSX, fcrs) => {
  const ws = {}
  const head = ['Visit Date', 'Team', 'Rep', 'Account Visited', 'FCR Status', 'Ack Status', 'Companion 1', 'Companion 2']
  // MBT Sales rows together, then BD Team rows together, each sub-sorted by
  // visit date -- matches the grouping used on the Overview and weekly tabs.
  const sorted = [...fcrs].sort((a, b) => {
    if (a.team_type !== b.team_type) return a.team_type === 'business_development' ? 1 : -1
    return (a.visit_date || '').localeCompare(b.visit_date || '')
  })
  const STATUS_LABEL = { approved: 'Approved', pending_approval: 'Pending Approval', draft: 'Draft', rejected: 'Rejected' }
  const ACK_LABEL = { acknowledged: 'Acknowledged', pending: 'Pending', not_sent: 'Not Sent' }
  const rows = [
    head.map(h => ({ value: h, style: headerCellStyle })),
    ...sorted.map((f, i) => {
      const s = bodyCellStyle(i % 2 === 1, false)
      const companions = companionNames(f)
      return [
        { value: f.visit_date ? format(parseISO(f.visit_date), 'MMM d, yyyy') : '', style: s },
        { value: f.team_type === 'business_development' ? 'BD Team' : 'MBT Sales', style: s },
        { value: f.creator?.full_name || 'Unknown', style: s },
        { value: accountName(f), style: s },
        { value: STATUS_LABEL[f.status] || f.status || '', style: s },
        { value: ACK_LABEL[f.ack_status] || f.ack_status || '', style: s },
        { value: companions[0] || '', style: s },
        { value: companions[1] || '', style: s },
      ]
    }),
  ]
  writeStyledRows(ws, XLSX, rows)
  ws['!cols'] = [{ wch: 13 }, { wch: 11 }, { wch: 20 }, { wch: 34 }, { wch: 15 }, { wch: 13 }, { wch: 18 }, { wch: 18 }]
  ws['!rows'] = [{ hpt: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } })
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: head.length - 1 } }) }
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 }
  return ws
}

// fcrs: every FCR (any status) with a Visit Date in [start, end], each
// carrying creator (full_name), account/customer_info, companion/companion2
// (full_name). teamMembers: the full active SE/BD roster ({id, name, role}),
// same list ExportCenter's "Download by Team Member" section already uses --
// every member is listed on every week's tab, even with zero FCRs, so the
// report reads as a full census rather than just "who happened to file."
export const downloadVisitationCensusExcel = async ({ fcrs, teamMembers, start, end, rangeLabel, scopeLabel, generatedBy }) => {
  const XLSX = (await import('xlsx-js-style')).default
  const weeks = buildWeeks(start, end)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildOverviewSheet(XLSX, { fcrs, teamMembers, weeks, rangeLabel, scopeLabel, generatedBy }), 'Overview')
  weeks.forEach((week) => {
    XLSX.utils.book_append_sheet(wb, buildWeekSheet(XLSX, { week, fcrs, teamMembers }), week.sheetName)
  })
  XLSX.utils.book_append_sheet(wb, buildDataSheet(XLSX, fcrs), 'Data (raw)')

  const filename = `MBT Visitation Census - ${rangeLabel}.xlsx`
  XLSX.writeFile(wb, filename)
}
