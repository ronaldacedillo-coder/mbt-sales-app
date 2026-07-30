import { format, parseISO } from 'date-fns'
import { buildFcrMinutesText } from './fcrMinutes'

// Beautified .xlsx export of acknowledged FCRs (with their Minutes of the
// Meeting) and MCP (Actual) archive entries, covering everyone the current
// role can see (RLS already scopes that -- NSM/BD Head to their own team,
// VIEWER/Admin to both -- see ExportCenter.jsx). Uses xlsx-js-style, a
// drop-in fork of SheetJS's community `xlsx` that adds per-cell styling
// (the plain `xlsx` package can't write fills/fonts/borders at all).
//
// Kept as one function per format (this file / exportReportPdf.js) rather
// than a shared "report model" -- Excel and PDF have different enough
// layout primitives (cells vs. flowed text) that a shared abstraction would
// just be indirection.

const TEAM_LABELS = { mbt_sales: 'MBT Sales', business_development: 'Business Development' }
const teamLabel = (teamType) => TEAM_LABELS[teamType] || teamType || ''

const NAVY = '1E3A8A' // primary-900
const NAVY_LIGHT = '2563EB' // primary-600
const HEADER_TEXT = 'FFFFFF'
const ZEBRA = 'F3F4F6' // gray-100
const BORDER_COLOR = 'D1D5DB' // gray-300

const thinBorder = { style: 'thin', color: { rgb: BORDER_COLOR } }
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

const headerCellStyle = {
  font: { bold: true, color: { rgb: HEADER_TEXT }, sz: 10 },
  fill: { fgColor: { rgb: NAVY } },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  border: allBorders,
}

const bodyCellStyle = (zebra) => ({
  font: { sz: 9.5, color: { rgb: '1F2937' } },
  alignment: { vertical: 'top', wrapText: true },
  fill: zebra ? { fgColor: { rgb: ZEBRA } } : undefined,
  border: allBorders,
})

const titleCellStyle = {
  font: { bold: true, sz: 18, color: { rgb: HEADER_TEXT } },
  fill: { fgColor: { rgb: NAVY } },
  alignment: { vertical: 'center', horizontal: 'left' },
}

const subtitleCellStyle = {
  font: { sz: 11, color: { rgb: '374151' } },
  alignment: { vertical: 'center', horizontal: 'left' },
}

const statLabelStyle = {
  font: { bold: true, sz: 9, color: { rgb: '6B7280' } },
  alignment: { horizontal: 'left' },
}

const statValueStyle = {
  font: { bold: true, sz: 16, color: { rgb: NAVY_LIGHT } },
  alignment: { horizontal: 'left' },
}

// Writes a 2D array of {value, style} cells into a worksheet starting at
// (rowOffset, 0), returning the sheet's !ref-friendly row count.
const writeStyledRows = (ws, XLSX, rows, startRow = 0) => {
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell == null) return
      const addr = XLSX.utils.encode_cell({ r: startRow + r, c })
      ws[addr] = { t: typeof cell.value === 'number' ? 'n' : 's', v: cell.value ?? '', s: cell.style }
    })
  })
}

const buildSummarySheet = (XLSX, { scopeLabel, rangeLabel, generatedBy, fcrCount, mcpCount, teamCounts }) => {
  const ws = {}
  const rows = [
    [{ value: 'MBT Sales & BD -- Field Reports Export', style: titleCellStyle }],
    [],
    [{ value: scopeLabel, style: subtitleCellStyle }],
    [{ value: `Period: ${rangeLabel}`, style: subtitleCellStyle }],
    [{ value: `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')} by ${generatedBy || 'Unknown'}`, style: subtitleCellStyle }],
    [],
    [
      { value: 'Acknowledged FCRs', style: statLabelStyle },
      null,
      { value: 'MCP (Actual) Entries', style: statLabelStyle },
    ],
    [
      { value: fcrCount, style: statValueStyle },
      null,
      { value: mcpCount, style: statValueStyle },
    ],
    [],
    [{ value: 'Breakdown by Team', style: { font: { bold: true, sz: 11, color: { rgb: '111827' } } } }],
    [
      { value: 'Team', style: headerCellStyle },
      { value: 'Acknowledged FCRs', style: headerCellStyle },
      { value: 'MCP (Actual) Entries', style: headerCellStyle },
    ],
    ...teamCounts.map((t, i) => [
      { value: t.team, style: bodyCellStyle(i % 2 === 1) },
      { value: t.fcrCount, style: bodyCellStyle(i % 2 === 1) },
      { value: t.mcpCount, style: bodyCellStyle(i % 2 === 1) },
    ]),
  ]
  writeStyledRows(ws, XLSX, rows)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]
  ws['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 22 }, { wch: 16 }]
  ws['!rows'] = [{ hpt: 30 }]
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 1, c: 3 } })
  ws['!pageSetup'] = { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0, footer: 0 }
  return ws
}

const buildFcrSheet = (XLSX, fcrs) => {
  const ws = {}
  const head = [
    'Team', 'Rep', 'Company', 'Visit Date', 'AM/PM',
    'Acknowledged By', 'Designation', 'Email', 'Acknowledged At', 'Get Back Items', 'Coverage Notes', 'Minutes of the Meeting',
  ]
  const rows = [
    head.map(h => ({ value: h, style: headerCellStyle })),
    ...fcrs.map((f, i) => {
      const zebra = i % 2 === 1
      const s = bodyCellStyle(zebra)
      return [
        { value: teamLabel(f.team_type), style: s },
        { value: f.creator?.full_name || 'Unknown', style: s },
        { value: f.customer_info?.company_name || f.account?.company_name || '', style: s },
        { value: f.visit_date ? format(parseISO(f.visit_date), 'MMM d, yyyy') : '', style: s },
        { value: f.period === 'PM' ? 'PM' : 'AM', style: { ...s, alignment: { ...s.alignment, horizontal: 'center' } } },
        // acknowledged_name is what the attendee typed/confirmed at ack time
        // (defaults to attendee_name but they can correct it via "Not you?"
        // on the acknowledgment page) -- there's no separate
        // acknowledged_designation/acknowledged_email captured at that step,
        // so Designation/Email fall back to what the FCR was originally
        // filed with (attendee_designation/attendee_email), which is the
        // same person in the overwhelming majority of cases.
        { value: f.acknowledged_name || f.attendee_name || '', style: s },
        { value: f.attendee_designation || '', style: s },
        { value: f.attendee_email || '', style: s },
        { value: f.acknowledged_at ? format(parseISO(f.acknowledged_at), 'MMM d, yyyy h:mm a') : '', style: s },
        { value: f.form_data?.get_back_items || '', style: s },
        { value: f.coverage_notes || '', style: s },
        { value: buildFcrMinutesText({ record: f, submitterName: f.creator?.full_name }), style: s },
      ]
    }),
  ]
  writeStyledRows(ws, XLSX, rows)
  ws['!cols'] = [
    { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 13 }, { wch: 7 },
    { wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 30 }, { wch: 30 }, { wch: 55 },
  ]
  ws['!rows'] = [{ hpt: 22 }, ...fcrs.map(() => ({ hpt: 60 }))]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } })
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: head.length - 1 } }) }
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 }
  return ws
}

const buildMcpSheet = (XLSX, mcpEntries) => {
  const ws = {}
  const head = ['Team', 'Rep', 'Month', 'Visits', 'Generated By', 'Generated At']
  const rows = [
    head.map(h => ({ value: h, style: headerCellStyle })),
    ...mcpEntries.map((e, i) => {
      const zebra = i % 2 === 1
      const s = bodyCellStyle(zebra)
      const snapshot = e.snapshot || {}
      return [
        { value: teamLabel(e.submitter_role === 'bd_engineer' ? 'business_development' : 'mbt_sales'), style: s },
        { value: snapshot.submitterName || e.generator?.full_name || 'Unknown', style: s },
        { value: e.month ? format(parseISO(e.month), 'MMMM yyyy') : '', style: s },
        { value: e.fcr_count ?? (snapshot.visits || []).length, style: { ...s, alignment: { ...s.alignment, horizontal: 'center' } } },
        { value: e.generator?.full_name || '', style: s },
        { value: e.created_at ? format(parseISO(e.created_at), 'MMM d, yyyy') : '', style: s },
      ]
    }),
  ]
  writeStyledRows(ws, XLSX, rows)
  ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 16 }]
  ws['!rows'] = [{ hpt: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } })
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: head.length - 1 } }) }
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0, footer: 0 }
  return ws
}

export const downloadExportExcel = async ({ fcrs, mcpEntries, rangeLabel, scopeLabel, generatedBy }) => {
  const XLSX = (await import('xlsx-js-style')).default

  const salesFcrs = fcrs.filter(f => f.team_type !== 'business_development')
  const bdFcrs = fcrs.filter(f => f.team_type === 'business_development')
  const salesMcp = mcpEntries.filter(e => e.submitter_role !== 'bd_engineer')
  const bdMcp = mcpEntries.filter(e => e.submitter_role === 'bd_engineer')

  const wb = XLSX.utils.book_new()
  const summarySheet = buildSummarySheet(XLSX, {
    scopeLabel,
    rangeLabel,
    generatedBy,
    fcrCount: fcrs.length,
    mcpCount: mcpEntries.length,
    teamCounts: [
      { team: 'MBT Sales', fcrCount: salesFcrs.length, mcpCount: salesMcp.length },
      { team: 'Business Development', fcrCount: bdFcrs.length, mcpCount: bdMcp.length },
    ],
  })
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')
  XLSX.utils.book_append_sheet(wb, buildFcrSheet(XLSX, fcrs), 'Field Contact Reports')
  XLSX.utils.book_append_sheet(wb, buildMcpSheet(XLSX, mcpEntries), 'MCP (Actual)')

  const filename = `MBT Export - ${rangeLabel}.xlsx`
  XLSX.writeFile(wb, filename)
}
