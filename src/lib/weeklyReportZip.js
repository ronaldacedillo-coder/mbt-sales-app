import JSZip from 'jszip'
import { getFCRPdfBlob } from './fcrPdf'
import { getMCPPdfBlob } from './mcpPdf'
import { accountsFromSnapshot } from './mcpActual'

// Bundles every acknowledged FCR (each already has an exportable PDF once
// acknowledged -- see fcrPdf.js) plus every MCP (Actual) archive entry for
// the period into a single .zip and triggers one browser download. Used by
// the Weekly Report page linked from the Friday digest email.
export const downloadWeeklyReportZip = async ({ acknowledgedFcrs, mcpEntries, label }) => {
  const zip = new JSZip()
  const fcrFolder = zip.folder('Field Contact Reports')
  const mcpFolder = zip.folder('MCP (Actual)')

  for (const fcr of acknowledgedFcrs) {
    const { blob, filename } = await getFCRPdfBlob({
      record: fcr,
      account: fcr.account,
      submitterName: fcr.creator?.full_name,
    })
    fcrFolder.file(filename, blob)
  }

  for (const entry of mcpEntries) {
    const snapshot = entry.snapshot || {}
    const { blob, filename } = await getMCPPdfBlob({
      month: snapshot.month || entry.month,
      visits: snapshot.visits || [],
      accounts: accountsFromSnapshot(snapshot),
      submitterName: snapshot.submitterName,
      approverName: '',
      title: 'MONTHLY COVERAGE PLAN (ACTUAL)',
      filenamePrefix: `MCP (Actual) - ${snapshot.submitterName || 'Report'}`,
    })
    mcpFolder.file(filename, blob)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `MBT Weekly Report - ${label}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
