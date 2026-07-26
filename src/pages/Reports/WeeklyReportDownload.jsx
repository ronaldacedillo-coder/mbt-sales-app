import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES } from '../../utils/roles'
import { downloadWeeklyReportZip } from '../../lib/weeklyReportZip'
import { startOfWeek, format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import {
  Download,
  FileText,
  Archive,
  CheckCircle2,
  Clock3,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'

// Reached from the "Download this week's reports" link in the Friday 3PM
// digest email (see the weekly-digest Edge Function). Scope is driven
// entirely by the logged-in user's own role/RLS -- an NSM only ever sees
// the SE team's FCRs and MCPs, a Head only ever sees the BD team's, exactly
// like FCR/MCP (Plan) Approvals already work. The date range comes from the
// email link's ?start=&end= query params, defaulting to the current week.
export const WeeklyReportDownload = () => {
  const { user, role } = useAuth()
  const [searchParams] = useSearchParams()

  const [fcrs, setFcrs] = useState([])
  const [mcpEntries, setMcpEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const start = searchParams.get('start') || format(monday, 'yyyy-MM-dd')
  const end = searchParams.get('end') || format(new Date(), 'yyyy-MM-dd')
  const label = `${start} to ${end}`

  useEffect(() => {
    if (!user || !role) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, start, end])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const submitterRole = role === ROLES.NSM ? ROLES.SALES_ENGINEER : ROLES.BD_ENGINEER

      const monthDate = parseISO(end)
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')

      const [{ data: fcrData, error: fcrError }, { data: mcpData, error: mcpError }] = await Promise.all([
        supabase
          .from('fcrs')
          .select(`
            *,
            account:accounts(company_name, city, trade_terms),
            creator:user_profiles!fcrs_created_by_fkey(full_name:name)
          `)
          .eq('submitter_role', submitterRole)
          .neq('status', 'draft')
          .gte('visit_date', start)
          .lte('visit_date', end)
          .order('visit_date', { ascending: false }),
        supabase
          .from('mcp_archive')
          .select(`*, generator:user_profiles!mcp_archive_generated_by_fkey(full_name:name)`)
          .eq('submitter_role', submitterRole)
          .gte('month', monthStart)
          .lte('month', monthEnd)
          .order('month', { ascending: false }),
      ])
      if (fcrError) throw fcrError
      if (mcpError) throw mcpError
      setFcrs(fcrData || [])
      setMcpEntries(mcpData || [])
    } catch (err) {
      setError(err.message || 'Failed to load this week\'s report')
    } finally {
      setLoading(false)
    }
  }

  const acknowledgedFcrs = fcrs.filter(f => f.ack_status === 'acknowledged')
  const notYetAcknowledged = fcrs.filter(f => f.ack_status !== 'acknowledged')

  const handleDownload = async () => {
    setDownloading(true)
    setError('')
    try {
      await downloadWeeklyReportZip({ acknowledgedFcrs, mcpEntries, label })
    } catch (err) {
      setError(err.message || 'Failed to build the download')
    } finally {
      setDownloading(false)
    }
  }

  const hasNothingToDownload = acknowledgedFcrs.length === 0 && mcpEntries.length === 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Report Download</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {label} &middot; {role === ROLES.NSM ? 'MBT Sales Engineers' : 'Business Development team'}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Ready to download</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Bundles every acknowledged FCR and MCP (Actual) below into one .zip of PDFs.
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || hasNothingToDownload}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed self-start"
          >
            <Download size={16} />
            {downloading ? 'Building ZIP...' : 'Download All (.zip)'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-2xl font-bold text-emerald-700">{acknowledgedFcrs.length}</p>
            <p className="text-xs text-emerald-700 mt-0.5">Acknowledged FCRs</p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-2xl font-bold text-purple-700">{mcpEntries.length}</p>
            <p className="text-xs text-purple-700 mt-0.5">MCP (Actual) archived this month</p>
          </div>
        </div>

        {hasNothingToDownload && (
          <p className="text-sm text-gray-400">Nothing acknowledged or archived yet for this period.</p>
        )}
      </div>

      {notYetAcknowledged.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Submitted, not yet acknowledged</h2>
          <p className="text-sm text-gray-500 mb-3">
            These FCRs were filed this period but can't be exported to PDF until the account confirms the meeting.
          </p>
          <div className="space-y-2">
            {notYetAcknowledged.map(item => (
              <Link
                key={item.id}
                to={`/fcr/${item.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.customer_info?.company_name || item.account?.company_name || 'Field Contact Report'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.visit_date ? format(parseISO(item.visit_date), 'MMM dd, yyyy') : 'No date'}
                    {' · '}{item.creator?.full_name || 'Unknown'}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <Clock3 size={12} /> {item.ack_status === 'pending' ? 'Awaiting client' : 'Not sent yet'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {acknowledgedFcrs.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={16} /> Acknowledged FCRs included
          </h2>
          <div className="space-y-2">
            {acknowledgedFcrs.map(item => (
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
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={12} /> Acknowledged
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mcpEntries.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Archive size={16} /> MCP (Actual) included
          </h2>
          <div className="space-y-2">
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
    </div>
  )
}
