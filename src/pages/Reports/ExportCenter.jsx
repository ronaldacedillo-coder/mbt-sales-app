import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES } from '../../utils/roles'
import { downloadExportExcel } from '../../lib/excelExport'
import { buildExportReportPdf } from '../../lib/exportReportPdf'
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  ClipboardCheck,
  Archive,
  AlertCircle,
} from 'lucide-react'

// A cross-team export -- unlike Weekly Report Download (which is scoped to
// one week and links out from the Friday digest email), this lets an
// approver or Viewer/Admin pick any date range and pull a single beautified
// Excel workbook or PDF report covering every acknowledged FCR (including
// its Minutes of the Meeting) and every MCP (Actual) archive entry in that
// window. Scope is entirely RLS-driven, same as everywhere else in this
// app: NSM only ever sees the MBT Sales team, Commercial AC Head only BD,
// VIEWER/Admin sees both -- so this file never filters by submitter_role
// itself, it just queries and lets the database decide what comes back.
export const ExportCenter = () => {
  const { role, profile } = useAuth()

  const [start, setStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fcrs, setFcrs] = useState([])
  const [mcpEntries, setMcpEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState('')

  const rangeLabel = `${format(parseISO(start), 'MMM d, yyyy')} - ${format(parseISO(end), 'MMM d, yyyy')}`
  const scopeLabel =
    role === ROLES.NSM ? 'MBT Sales Team' :
    role === ROLES.COMMERCIAL_AC_HEAD ? 'Business Development Team' :
    'MBT Sales & BD Teams'

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const monthStart = format(startOfMonth(parseISO(start)), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(parseISO(end)), 'yyyy-MM-dd')

      const [{ data: fcrData, error: fcrError }, { data: mcpData, error: mcpError }] = await Promise.all([
        supabase
          .from('fcrs')
          .select(`
            *,
            account:accounts(company_name, city, trade_terms),
            creator:user_profiles!fcrs_created_by_fkey(full_name:name)
          `)
          .eq('ack_status', 'acknowledged')
          .gte('visit_date', start)
          .lte('visit_date', end)
          .order('visit_date', { ascending: false }),
        supabase
          .from('mcp_archive')
          .select(`*, generator:user_profiles!mcp_archive_generated_by_fkey(full_name:name)`)
          .gte('month', monthStart)
          .lte('month', monthEnd)
          .order('month', { ascending: false }),
      ])
      if (fcrError) throw fcrError
      if (mcpError) throw mcpError
      setFcrs(fcrData || [])
      setMcpEntries(mcpData || [])
    } catch (err) {
      setError(err.message || 'Failed to load export data')
    } finally {
      setLoading(false)
    }
  }

  const hasNothing = fcrs.length === 0 && mcpEntries.length === 0

  const handleExcel = async () => {
    setExportingExcel(true)
    setError('')
    try {
      await downloadExportExcel({ fcrs, mcpEntries, rangeLabel, scopeLabel, generatedBy: profile?.full_name })
    } catch (err) {
      setError(err.message || 'Failed to build the Excel export')
    } finally {
      setExportingExcel(false)
    }
  }

  const handlePdf = async () => {
    setExportingPdf(true)
    setError('')
    try {
      await buildExportReportPdf({ fcrs, mcpEntries, rangeLabel, scopeLabel, generatedBy: profile?.full_name })
    } catch (err) {
      setError(err.message || 'Failed to build the PDF export')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Export Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Download acknowledged FCRs (with Minutes of the Meeting) and MCP (Actual) &middot; {scopeLabel}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">From</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" max={end} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" min={start} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-2xl font-bold text-emerald-700">{loading ? '-' : fcrs.length}</p>
            <p className="text-xs text-emerald-700 mt-0.5">Acknowledged FCRs</p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-2xl font-bold text-purple-700">{loading ? '-' : mcpEntries.length}</p>
            <p className="text-xs text-purple-700 mt-0.5">MCP (Actual) Entries</p>
          </div>
        </div>

        {!loading && hasNothing && (
          <p className="text-sm text-gray-400">Nothing acknowledged or archived yet for this period.</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExcel}
            disabled={loading || exportingExcel || hasNothing}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} />
            {exportingExcel ? 'Building Excel...' : 'Download Excel (.xlsx)'}
          </button>
          <button
            onClick={handlePdf}
            disabled={loading || exportingPdf || hasNothing}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={16} />
            {exportingPdf ? 'Building PDF...' : 'Download PDF (.pdf)'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {fcrs.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ClipboardCheck size={16} /> Acknowledged FCRs included ({fcrs.length})
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {fcrs.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.customer_info?.company_name || item.account?.company_name || 'Field Contact Report'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.visit_date ? format(parseISO(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                        {' · '}{item.creator?.full_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mcpEntries.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Archive size={16} /> MCP (Actual) included ({mcpEntries.length})
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {mcpEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {entry.snapshot?.submitterName || entry.generator?.full_name || 'MCP (Actual)'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(entry.month), 'MMMM yyyy')} &middot; {entry.fcr_count} visit{entry.fcr_count === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
