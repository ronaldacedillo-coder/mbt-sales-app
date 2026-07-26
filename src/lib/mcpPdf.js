import { format, parseISO } from 'date-fns'
import { getMCPWeeks, groupVisitsByDayPeriod } from './mcpWeeks'

// Generates and downloads a real .pdf styled after MBT's official Monthly
// Coverage Plan (MCP) template, built from the shared week/visit grouping
// logic in mcpWeeks.js. Uses jsPDF + autoTable rather than window.print(),
// so this is a real file download, not a browser print-dialog workaround.
//
// Only MCP (Actual) exports a PDF (MCP (Plan) is approve-only) -- this is
// generic enough to serve that one caller while still reading naturally as
// "the MCP PDF builder" rather than something Actual-specific.
//
// buildMCPDoc does the actual work without downloading anything; downloadMCPPdf
// and getMCPPdfBlob (used by the weekly report ZIP bundler) both wrap it.
const buildMCPDoc = async ({
  month,
  notes,
  visits,
  accounts,
  submitterName,
  approverName,
  title = 'MONTHLY COVERAGE PLAN',
  filenamePrefix = 'MCP',
}) => {
  const [{ jsPDF: JsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  // jspdf-autotable's ESM/CJS interop wraps the function an extra level
  // depending on bundler -- cover both shapes rather than assume one.
  const autoTable = autoTableModule.default?.default || autoTableModule.default

  const monthDate = month ? parseISO(month) : new Date()
  const weeks = getMCPWeeks(monthDate)
  const byDay = groupVisitsByDayPeriod(visits, accounts)

  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 28

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, pageWidth / 2, 32, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`NAME: ${submitterName || ''}`, margin, 52)
  doc.text(
    `MONTH: ${format(monthDate, 'MMMM').toUpperCase()}  ${format(monthDate, 'yyyy')}`,
    pageWidth / 2,
    52,
    { align: 'center' }
  )

  const head = [['WK', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'WEEK\nForecast / Actual', 'MTD\nForecast / Actual']]
  const body = weeks.map(week => {
    const dayCells = week.days.map(dateStr => {
      if (!dateStr) return ''
      const dayNum = format(parseISO(dateStr), 'd')
      const am = (byDay[dateStr]?.AM || []).join('\n')
      const pm = (byDay[dateStr]?.PM || []).join('\n')
      return `${dayNum}\n\nAM: ${am}\n\nPM: ${pm}`
    })
    return [String(week.weekNum), ...dayCells, 'Forecast:\n\n\nActual:', 'Forecast:\n\n\nActual:']
  })

  autoTable(doc, {
    head,
    body,
    startY: 64,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4, valign: 'top', lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 70, fillColor: [251, 251, 251] },
      7: { cellWidth: 70, fillColor: [251, 251, 251] },
    },
    theme: 'grid',
  })

  let y = doc.lastAutoTable.finalY + 20

  if (notes) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(`Notes: ${notes}`, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 12 + 10
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Important Notes:', margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.text('1. MCP Weekly Input, FCR as attachment.', margin, y)
  y += 14
  doc.text('2. MCP must be reviewed and signed by Line Manager.', margin, y)
  y += 36

  const leftX = margin
  const rightX = pageWidth / 2 + 20
  const lineWidth = pageWidth / 2 - margin - 40

  doc.setFontSize(10)
  doc.text(submitterName || '', leftX, y)
  doc.text(approverName || '', rightX, y)
  doc.line(leftX, y + 4, leftX + lineWidth, y + 4)
  doc.line(rightX, y + 4, rightX + lineWidth, y + 4)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SUBMITTED BY', leftX, y + 16)
  doc.text('REVIEWED & APPROVED BY', rightX, y + 16)

  return { doc, filename: `${filenamePrefix} - ${format(monthDate, 'MMMM yyyy')}.pdf` }
}

export const downloadMCPPdf = async (args) => {
  const { doc, filename } = await buildMCPDoc(args)
  doc.save(filename)
}

// Same PDF, returned as a Blob instead of downloaded -- used to bundle
// several MCP (Actual) snapshots into one ZIP (see weeklyReportZip.js).
export const getMCPPdfBlob = async (args) => {
  const { doc, filename } = await buildMCPDoc(args)
  return { blob: doc.output('blob'), filename }
}
