import { format, parseISO } from 'date-fns'
import { getMCPWeeks, MCP_WEEKDAY_LABELS, groupVisitsByDayPeriod } from './mcpWeeks'

// Generates a .xlsx styled after MBT's official Monthly Coverage Plan (MCP)
// template -- the sheet submitted for reimbursement approval. It's a
// from-scratch recreation (not a copy of the uploaded template file, which
// this app has no way to ship as a static asset) that reproduces the same
// look: gray header row, WK/Mon-Fri grid, AM/PM schedule blocks per day,
// blank Forecast/Actual boxes for manual fill-in, and a sign-off footer.
const GRAY = 'FFD9D9D9'
const PINK = 'FFFBF3F3'
const WHITE = 'FFFFFFFF'
const BLACK = 'FF000000'
const medium = { style: 'medium', color: { argb: BLACK } }
const thin = { style: 'thin', color: { argb: BLACK } }
const allBorders = { top: thin, bottom: thin, left: thin, right: thin }
const boxBorders = { top: medium, bottom: medium, left: medium, right: medium }

export const buildMCPWorkbook = async ({ itinerary, visits, accounts, submitterName, approverName }) => {
  // Loaded on demand -- exceljs is a large dependency and most people never
  // click "Export MCP (Excel)", so it shouldn't bloat the main app bundle.
  const { default: ExcelJS } = await import('exceljs')
  const monthDate = itinerary.month ? parseISO(itinerary.month) : new Date()
  const weeks = getMCPWeeks(monthDate)
  const byDay = groupVisitsByDayPeriod(visits, accounts)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'MBT Sales Operations'
  const ws = wb.addWorksheet('MCP', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  ws.columns = [
    { width: 4 },   // A margin
    { width: 6 },   // B WK
    { width: 26 },  // C Mon
    { width: 26 },  // D Tue
    { width: 26 },  // E Wed
    { width: 26 },  // F Thu
    { width: 26 },  // G Fri
    { width: 15 },  // H week label
    { width: 12 },  // I week value
    { width: 15 },  // J mtd label
    { width: 12 },  // K mtd value
  ]

  let r = 1
  ws.mergeCells(r, 2, r, 11)
  const title = ws.getCell(r, 2)
  title.value = 'MONTHLY COVERAGE PLAN'
  title.font = { name: 'Calibri', size: 18, bold: true }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 26
  r += 1

  ws.mergeCells(r, 2, r, 3)
  ws.getCell(r, 2).value = 'NAME:'
  ws.mergeCells(r, 4, r, 7)
  ws.getCell(r, 4).value = submitterName || ''
  ws.mergeCells(r, 8, r, 9)
  ws.getCell(r, 8).value = `MONTH: ${format(monthDate, 'MMMM').toUpperCase()}`
  ws.mergeCells(r, 10, r, 11)
  ws.getCell(r, 10).value = format(monthDate, 'yyyy')
  for (let c = 2; c <= 11; c++) {
    const cell = ws.getCell(r, c)
    cell.font = { name: 'Calibri', size: 13, bold: true }
    cell.alignment = { horizontal: c === 2 || c === 8 ? 'left' : 'center', vertical: 'middle' }
    cell.border = { bottom: medium }
  }
  ws.getRow(r).height = 22
  r += 1

  const headerRow = r
  const headers = ['WK', ...MCP_WEEKDAY_LABELS, 'WEEK Forecast / Actual', '', 'MTD Forecast / Actual', '']
  ws.mergeCells(headerRow, 8, headerRow, 9)
  ws.mergeCells(headerRow, 10, headerRow, 11)
  headers.forEach((h, i) => {
    if (i === 7 || i === 9) return // covered by the merges above
    const cell = ws.getCell(headerRow, 2 + i)
    cell.value = h
  })
  for (let c = 2; c <= 11; c++) {
    const cell = ws.getCell(headerRow, c)
    cell.font = { name: 'Calibri', size: 11, bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = boxBorders
  }
  ws.getRow(headerRow).height = 22
  r += 1

  weeks.forEach(week => {
    const dayNumRow = r
    const amRow = r + 1
    const pmRow = r + 2

    ws.mergeCells(dayNumRow, 2, pmRow, 2)
    const wkCell = ws.getCell(dayNumRow, 2)
    wkCell.value = week.weekNum
    wkCell.font = { name: 'Calibri', size: 16, bold: true }
    wkCell.alignment = { horizontal: 'center', vertical: 'middle' }
    wkCell.border = boxBorders

    week.days.forEach((dateStr, i) => {
      const col = 3 + i
      const dayNumCell = ws.getCell(dayNumRow, col)
      dayNumCell.value = dateStr ? Number(format(parseISO(dateStr), 'd')) : ''
      dayNumCell.font = { name: 'Calibri', size: 12, bold: true }
      dayNumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
      dayNumCell.alignment = { horizontal: 'center', vertical: 'middle' }
      dayNumCell.border = allBorders

      const amCell = ws.getCell(amRow, col)
      amCell.value = dateStr ? `AM: ${(byDay[dateStr]?.AM || []).join('\n')}` : ''
      const pmCell = ws.getCell(pmRow, col)
      pmCell.value = dateStr ? `PM: ${(byDay[dateStr]?.PM || []).join('\n')}` : ''
      ;[amCell, pmCell].forEach(cell => {
        cell.font = { name: 'Calibri', size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PINK } }
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
        cell.border = allBorders
      })
    })

    // Blank fill for the dayNum row's forecast columns (kept blank, just styled)
    ;[8, 9, 10, 11].forEach(c => {
      const cell = ws.getCell(dayNumRow, c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
      cell.border = allBorders
    })

    const labelValue = (row, col, label) => {
      const labelCell = ws.getCell(row, col)
      labelCell.value = label
      labelCell.font = { name: 'Calibri', size: 10, bold: true }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
      labelCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      labelCell.border = allBorders

      const valueCell = ws.getCell(row, col + 1)
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } }
      valueCell.border = boxBorders
    }

    labelValue(amRow, 8, 'WEEK Forecast:')
    labelValue(amRow, 10, 'MTD Forecast:')
    labelValue(pmRow, 8, 'WEEK Actual:')
    labelValue(pmRow, 10, 'MTD Actual:')

    ws.getRow(dayNumRow).height = 18
    ws.getRow(amRow).height = 55
    ws.getRow(pmRow).height = 55

    r = pmRow + 1
  })

  r += 1
  if (itinerary.notes) {
    ws.mergeCells(r, 2, r, 11)
    const notesCell = ws.getCell(r, 2)
    notesCell.value = `Notes: ${itinerary.notes}`
    notesCell.font = { name: 'Calibri', size: 10, italic: true }
    notesCell.alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = 30
    r += 2
  } else {
    r += 1
  }

  const notesHeader = ws.getCell(r, 2)
  notesHeader.value = 'Important Notes:'
  notesHeader.font = { name: 'Calibri', size: 12, bold: true }
  r += 1
  ;['1. MCP Weekly Input, FCR as attachment.', '2. MCP must be reviewed and signed by Line Manager.'].forEach(line => {
    ws.getCell(r, 2).value = line
    ws.getCell(r, 2).font = { name: 'Calibri', size: 11 }
    r += 1
  })

  r += 2
  ws.getCell(r, 3).value = submitterName || ''
  ws.getCell(r, 3).border = { bottom: thin }
  ws.getCell(r, 3).font = { name: 'Calibri', size: 11 }
  ws.mergeCells(r, 3, r, 5)
  ws.getCell(r, 8).value = approverName || ''
  ws.getCell(r, 8).border = { bottom: thin }
  ws.getCell(r, 8).font = { name: 'Calibri', size: 11 }
  ws.mergeCells(r, 8, r, 10)
  r += 1
  ws.getCell(r, 3).value = 'SUBMITTED BY'
  ws.getCell(r, 3).font = { name: 'Calibri', size: 10, bold: true }
  ws.getCell(r, 3).alignment = { horizontal: 'center' }
  ws.mergeCells(r, 3, r, 5)
  ws.getCell(r, 8).value = 'REVIEWED & APPROVED BY'
  ws.getCell(r, 8).font = { name: 'Calibri', size: 10, bold: true }
  ws.getCell(r, 8).alignment = { horizontal: 'center' }
  ws.mergeCells(r, 8, r, 10)

  const buffer = await wb.xlsx.writeBuffer()
  return buffer
}

export const downloadMCPWorkbook = async (params) => {
  const buffer = await buildMCPWorkbook(params)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const monthDate = params.itinerary.month ? parseISO(params.itinerary.month) : new Date()
  a.href = url
  a.download = `MCP - ${format(monthDate, 'MMMM yyyy')}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
