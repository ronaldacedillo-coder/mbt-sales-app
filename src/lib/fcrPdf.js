import { format, parseISO } from 'date-fns'
import { TRADE_TERMS_LABELS } from '../utils/accounts'
import { buildFcrMinutesText } from './fcrMinutes'

// Builds the PDF document itself without triggering a download -- shared by
// downloadFCRPdf (single-file, used from the FCR page) and getFCRPdfBlob
// (used by the weekly report ZIP bundler, which needs the raw bytes instead
// of a browser download per file). Only ever called once the account has
// acknowledged the meeting minutes (see the gating in FCRForm.jsx) -- the
// acknowledgment block below is part of the exported record precisely so
// the PDF itself is proof of that.
const buildFCRDoc = async ({ record, account, submitterName }) => {
  const [{ jsPDF: JsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default?.default || autoTableModule.default

  const customerInfo = record.customer_info || {}
  const formData = record.form_data || {}
  const isBD = record.team_type === 'business_development'

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
    ensureSpace(24)
    doc.setFillColor(17, 24, 39)
    doc.rect(margin, y, pageWidth - margin * 2, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title.toUpperCase(), margin + 6, y + 12.5)
    doc.setTextColor(0, 0, 0)
    y += 18 + 6
  }

  const table = (head, body, columnStyles) => {
    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4, valign: 'top', lineColor: [200, 200, 200], lineWidth: 0.5, textColor: [0, 0, 0] },
      headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles,
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 14
  }

  const kv = (pairs) => {
    const colWidth = (pageWidth - margin * 2) / 2
    ensureSpace(Math.ceil(pairs.length / 2) * 26)
    pairs.forEach(([label, value], i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = margin + col * colWidth
      const rowY = y + row * 26
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 100, 100)
      doc.text(label.toUpperCase(), x, rowY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(0, 0, 0)
      doc.text(String(value || '-'), x, rowY + 12, { maxWidth: colWidth - 10 })
    })
    y += Math.ceil(pairs.length / 2) * 26 + 8
  }

  const paragraph = (label, text) => {
    const lines = doc.splitTextToSize(text || 'None recorded.', pageWidth - margin * 2)
    ensureSpace(14 + lines.length * 11)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label.toUpperCase(), margin, y)
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(lines, margin, y)
    y += lines.length * 11 + 10
  }

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('FIELD CONTACT REPORT', pageWidth / 2, y, { align: 'center' })
  y += 16
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(isBD ? 'MBT BUSINESS DEVELOPMENT' : 'MBT SALES', pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 20

  sectionTitle('Customer Information')
  kv([
    ['Company Name', customerInfo.company_name],
    ['Business Address', customerInfo.business_address],
    ['Owner/s', customerInfo.owners],
    ['Region', customerInfo.region],
    ['Contact No.', customerInfo.contact_no],
    ['E-Mail Address', customerInfo.email],
    ['Dealer Classification', customerInfo.dealer_classification],
    ['Channel', customerInfo.channel],
    ['Trade Terms', account ? TRADE_TERMS_LABELS[account.trade_terms] : ''],
    ['Visit Date', record.visit_date ? `${format(parseISO(record.visit_date), 'MMMM d, yyyy')} (${record.period === 'PM' ? 'PM' : 'AM'})` : ''],
  ])

  if ((formData.program_execution || []).length) {
    sectionTitle('CMIP Program Execution Check')
    table(
      ['Program', 'Status', 'Date', 'Next Steps', 'Notes'],
      formData.program_execution.map(r => [r.program, r.status, r.date, r.next_steps, r.notes]),
      { 0: { cellWidth: 110 } }
    )
  }

  if (isBD && (formData.specializations || []).length) {
    sectionTitle('Specializations')
    table(
      ['Establishment Type', 'AC System', 'Notes'],
      formData.specializations.map(r => [r.establishment_type, r.ac_system, r.notes])
    )
  }

  if ((formData.competitive_check || []).length) {
    sectionTitle('Competitive Check')
    table(
      ['Brand', 'Initiative', 'Duration', 'Mechanics', 'Notes'],
      formData.competitive_check.map(r => [r.brand, r.initiative, r.duration, r.mechanics, r.notes])
    )
  }

  if (isBD && (formData.competitive_advantage || []).length) {
    sectionTitle('Competitive Advantage of Consultant')
    table(
      ['Description', 'Notes'],
      formData.competitive_advantage.map(r => [r.description, r.notes])
    )
  }

  if (!isBD && formData.ar_collection) {
    sectionTitle('AR and Collection Update')
    kv([
      ['Payment Terms', formData.ar_collection.payment_terms],
      ['Credit Limit', formData.ar_collection.credit_limit],
    ])
    if ((formData.ar_collection.monitors || []).length) {
      table(
        ['AR Monitor', 'Reason', 'Commitment Date', 'Next Steps', 'Contact'],
        formData.ar_collection.monitors.map(r => [r.type, r.reason, r.commitment_date, r.next_steps, r.contact])
      )
    }
  }

  const primaryProjects = (formData.project_opportunities?.primary || []).filter(p => p.project_name_owner)
  const qualifiedProjects = (formData.project_opportunities?.qualified || []).filter(p => p.project_name_owner)
  if (primaryProjects.length) {
    sectionTitle(`Project Opportunities -- ${formData.project_opportunities?.primary_label || 'Under Negotiation'}`)
    table(
      ['Project / Owner', 'Address', 'Amount', 'Roll-out', 'Rep', 'Status'],
      primaryProjects.map(p => [p.project_name_owner, p.address, p.amount, p.rollout, p.rep, p.status])
    )
  }
  if (qualifiedProjects.length) {
    sectionTitle('Project Opportunities -- Qualified / Identified')
    table(
      ['Project / Owner', 'Address', 'Amount', 'Roll-out', 'Rep', 'Status'],
      qualifiedProjects.map(p => [p.project_name_owner, p.address, p.amount, p.rollout, p.rep, p.status])
    )
  }

  const cycleInitiatives = (formData.cycle_initiatives || []).filter(ci => ci.title || ci.notes)
  if (cycleInitiatives.length) {
    sectionTitle('Cycle Initiatives')
    table(
      ['', 'Title', 'Notes'],
      cycleInitiatives.map(ci => [ci.label, ci.title, ci.notes]),
      { 0: { cellWidth: 24 } }
    )
  }

  sectionTitle(isBD ? 'Consultant Get Back Items' : 'Customer Get Back Items')
  paragraph('Get Back Items', formData.get_back_items)

  sectionTitle('Coverage Notes')
  paragraph('Coverage Notes', record.coverage_notes)

  // Minutes of the Meeting -- the same text the account acknowledged.
  sectionTitle('Minutes of the Meeting')
  const minutesLines = doc.splitTextToSize(buildFcrMinutesText({ record, submitterName }), pageWidth - margin * 2)
  ensureSpace(minutesLines.length * 10 + 10)
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.text(minutesLines, margin, y)
  y += minutesLines.length * 10 + 14
  doc.setFont('helvetica', 'normal')

  // Acknowledgment block -- proof the account confirmed the minutes.
  sectionTitle('Account Acknowledgment')
  kv([
    ['Attendee (Account side)', record.attendee_name],
    ['Attendee Email', record.attendee_email],
    ['Acknowledgment Status', record.ack_status === 'acknowledged' ? 'Acknowledged' : record.ack_status],
    ['Acknowledged By', record.acknowledged_name],
    ['Acknowledged At', record.acknowledged_at ? format(parseISO(record.acknowledged_at), 'MMMM d, yyyy h:mm a') : ''],
  ])

  ensureSpace(40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CUSTOMER -- SIGNATURE OVER PRINTED NAME', margin, y)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(record.customer_signature_name || record.acknowledged_name || '-', margin, y + 10)
  doc.line(margin, y + 14, margin + 260, y + 14)

  // Filename indicates who filed the report and when, per the required
  // format: the name of the SE/BD who filed it, plus the visit date.
  const nameSlug = (submitterName || 'Report').replace(/[^a-z0-9]+/gi, '_')
  const dateSlug = record.visit_date || format(new Date(), 'yyyy-MM-dd')
  return { doc, filename: `FCR_${nameSlug}_${dateSlug}.pdf` }
}

export const downloadFCRPdf = async (args) => {
  const { doc, filename } = await buildFCRDoc(args)
  doc.save(filename)
}

// Same PDF, returned as a Blob instead of downloaded -- used to bundle
// several FCRs into one ZIP (see weeklyReportZip.js) without popping open a
// separate browser download per file.
export const getFCRPdfBlob = async (args) => {
  const { doc, filename } = await buildFCRDoc(args)
  return { blob: doc.output('blob'), filename }
}
