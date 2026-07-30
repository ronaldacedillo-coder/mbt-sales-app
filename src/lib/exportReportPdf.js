import { format, parseISO } from 'date-fns'
import { buildFcrMinutesText } from './fcrMinutes'

// Beautified, single-file PDF covering the same data as excelExport.js's
// workbook -- a consolidated report rather than one PDF per record (that
// already exists via the per-record "Export PDF" buttons on FCR/MCP Archive,
// and via the Weekly Report ZIP). Styling deliberately matches fcrPdf.js/
// mcpPdf.js's existing look (dark section bars, autoTable grid theme) so
// every PDF this app produces reads as the same family of document.

const TEAM_LABELS = { mbt_sales: 'MBT Sales', business_development: 'Business Development' }
const teamLabel = (teamType) => TEAM_LABELS[teamType] || teamType || ''

const NAVY = [30, 58, 138] // primary-900
const NAVY_LIGHT = [37, 99, 235] // primary-600
const SLATE = [17, 24, 39]

export const buildExportReportPdf = async ({ fcrs, mcpEntries, rangeLabel, scopeLabel, generatedBy }) => {
  const [{ jsPDF: JsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default?.default || autoTableModule.default

  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  let y = 40

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = 40
    }
  }

  const sectionTitle = (title) => {
    ensureSpace(26)
    doc.setFillColor(...SLATE)
    doc.rect(margin, y, pageWidth - margin * 2, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title.toUpperCase(), margin + 8, y + 14)
    doc.setTextColor(0, 0, 0)
    y += 20 + 8
  }

  const table = (head, body, columnStyles) => {
    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4, valign: 'top', lineColor: [220, 220, 220], lineWidth: 0.5, textColor: [30, 30, 30] },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles,
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 16
  }

  // ---- Cover ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageWidth, 120, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('MBT Sales & BD', margin, 52)
  doc.text('Field Reports Export', margin, 78)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(scopeLabel || '', margin, 100)
  doc.setTextColor(0, 0, 0)
  y = 150

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Period: ${rangeLabel}`, margin, y)
  y += 16
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')} by ${generatedBy || 'Unknown'}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += 30

  const statBox = (x, w, label, value, color) => {
    doc.setFillColor(...color)
    doc.setDrawColor(...color)
    doc.roundedRect(x, y, w, 56, 6, 6, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(...NAVY_LIGHT)
    doc.text(String(value), x + 14, y + 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(label.toUpperCase(), x + 14, y + 48)
    doc.setTextColor(0, 0, 0)
  }
  const boxW = (pageWidth - margin * 2 - 16) / 2
  statBox(margin, boxW, 'Acknowledged FCRs', fcrs.length, [220, 220, 220])
  statBox(margin + boxW + 16, boxW, 'MCP (Actual) Entries', mcpEntries.length, [220, 220, 220])
  y += 56 + 26

  sectionTitle('Breakdown by Team')
  const salesFcrs = fcrs.filter(f => f.team_type !== 'business_development')
  const bdFcrs = fcrs.filter(f => f.team_type === 'business_development')
  const salesMcp = mcpEntries.filter(e => e.submitter_role !== 'bd_engineer')
  const bdMcp = mcpEntries.filter(e => e.submitter_role === 'bd_engineer')
  table(
    ['Team', 'Acknowledged FCRs', 'MCP (Actual) Entries'],
    [
      ['MBT Sales', String(salesFcrs.length), String(salesMcp.length)],
      ['Business Development', String(bdFcrs.length), String(bdMcp.length)],
    ]
  )

  // ---- FCR summary ----
  doc.addPage()
  y = 40
  sectionTitle('Field Contact Reports')
  if (fcrs.length) {
    table(
      ['Team', 'Rep', 'Company', 'Visit Date', 'Acknowledged By', 'Designation', 'Email', 'Acknowledged At'],
      fcrs.map(f => [
        teamLabel(f.team_type),
        f.creator?.full_name || 'Unknown',
        f.customer_info?.company_name || f.account?.company_name || '',
        f.visit_date ? format(parseISO(f.visit_date), 'MMM d, yyyy') : '',
        // Same fallback as excelExport.js: no separate acknowledged_designation
        // /acknowledged_email is captured at ack time, so those two fall
        // back to what the FCR was originally sent to (attendee_designation
        // /attendee_email) -- same person in the overwhelming majority of cases.
        f.acknowledged_name || f.attendee_name || '',
        f.attendee_designation || '',
        f.attendee_email || '',
        f.acknowledged_at ? format(parseISO(f.acknowledged_at), 'MMM d, yyyy h:mm a') : '',
      ]),
      { 2: { cellWidth: 70 }, 6: { cellWidth: 90 } }
    )
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text('No acknowledged FCRs in this period.', margin, y)
    doc.setTextColor(0, 0, 0)
    y += 20
  }

  // ---- Minutes of the Meeting, one block per FCR ----
  if (fcrs.length) {
    doc.addPage()
    y = 40
    sectionTitle('Minutes of the Meeting')
    fcrs.forEach((f, idx) => {
      // Drop the "MINUTES OF THE MEETING" title + underline that
      // buildFcrMinutesText leads with -- the blue banner just below already
      // says that, so keeping both reads as a stutter.
      const minutesText = buildFcrMinutesText({ record: f, submitterName: f.creator?.full_name })
        .replace(/^MINUTES OF THE MEETING\n=+\n\n/, '')
      const lines = doc.splitTextToSize(minutesText, pageWidth - margin * 2)
      ensureSpace(30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setFillColor(...NAVY_LIGHT)
      doc.rect(margin, y, pageWidth - margin * 2, 16, 'F')
      doc.setTextColor(255, 255, 255)
      const heading = `${f.customer_info?.company_name || f.account?.company_name || 'Field Contact Report'} -- ${f.visit_date ? format(parseISO(f.visit_date), 'MMM d, yyyy') : 'No date'}`
      doc.text(heading, margin + 6, y + 11.5)
      doc.setTextColor(0, 0, 0)
      y += 16 + 6

      ensureSpace(lines.length * 10 + 10)
      doc.setFont('courier', 'normal')
      doc.setFontSize(7.5)
      doc.text(lines, margin, y)
      y += lines.length * 10 + 18
      doc.setFont('helvetica', 'normal')

      if (idx < fcrs.length - 1) ensureSpace(4)
    })
  }

  // ---- MCP (Actual) summary ----
  doc.addPage()
  y = 40
  sectionTitle('MCP (Actual)')
  if (mcpEntries.length) {
    table(
      ['Team', 'Rep', 'Month', 'Visits', 'Generated By', 'Generated At'],
      mcpEntries.map(e => {
        const snapshot = e.snapshot || {}
        return [
          teamLabel(e.submitter_role === 'bd_engineer' ? 'business_development' : 'mbt_sales'),
          snapshot.submitterName || e.generator?.full_name || 'Unknown',
          e.month ? format(parseISO(e.month), 'MMMM yyyy') : '',
          String(e.fcr_count ?? (snapshot.visits || []).length),
          e.generator?.full_name || '',
          e.created_at ? format(parseISO(e.created_at), 'MMM d, yyyy') : '',
        ]
      }),
      { 1: { cellWidth: 90 } }
    )
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text('No MCP (Actual) entries in this period.', margin, y)
    doc.setTextColor(0, 0, 0)
  }

  // Footer page numbers
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' })
    doc.text('MBT Sales Operations', margin, pageHeight - 16)
    doc.setTextColor(0, 0, 0)
  }

  const filename = `MBT Export - ${rangeLabel}.pdf`
  doc.save(filename)
}
