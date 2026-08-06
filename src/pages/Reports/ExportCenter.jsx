import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLES } from '../../utils/roles'
import { downloadExportExcel } from '../../lib/excelExport'
import { buildExportReportPdf } from '../../lib/exportReportPdf'
import { downloadMemberFcrsZip } from '../../lib/weeklyReportZip'
import { downloadVisitationCensusExcel } from '../../lib/visitationCensusExcel'
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  ClipboardCheck,
  Archive,
  AlertCircle,
  Download,
  Users,
  CalendarCheck,
} from 'lucide-react'

// A cross-team export -- unlike Weekly Report Download (which is scoped to
// one week and links out from the Friday digest email), this lets an
// approver or Viewer/Admin pick any date range and pull a single beautified
// Excel workbook or PDF report covering every acknowledged FCR (including
// its Minutes of the Meeting) and every MCP (Actual) archive entry in that
// window. Scope is entirely RLS-driven, same as everywhere else in this
// app: NSM only ever sees the MBT Sales team; Commercial AC Head and
// VIEWER/Admin see both teams -- so this file never filters by
// submitter_role itself, it just queries and lets the database decide
// what comes back.
export const ExportCenter = () => {
  const { role, profile } = useAuth()
  // Optional ?start=&end= lets a link (e.g. the monthly MCP (Actual) digest
  // email) land here pre-scoped to a specific period instead of defaulting
  // to the current month -- same idea as Weekly Report Download's params.
  const [searchParams] = useSearchParams()

  const [start, setStart] = useState(searchParams.get('start') || format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(searchParams.get('end') || format(new Date(), 'yyyy-MM-dd'))
  const [fcrs, setFcrs] = useState([])
  const [mcpEntries, setMcpEntries] = useState([])
  const [approvedFcrs, setApprovedFcrs] = useState([])
  const [censusFcrs, setCensusFcrs] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCensus, setExportingCensus] = useState(false)
  const [downloadingMemberId, setDownloadingMemberId] = useState(null)
  const [error, setError] = useState('')

  const rangeLabel = `${format(parseISO(start), 'MMM d, yyyy')} - ${format(parseISO(end), 'MMM d, yyyy')}`
  const scopeLabel =
    role === ROLES.NSM ? 'MBT Sales Team' :
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

      const [{ data: fcrData, error: fcrError }, { data: mcpData, error: mcpError }, { data: approvedData, error: approvedError }, { data: memberData, error: memberError }, { data: censusData, error: censusError }] = await Promise.all([
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
        // Per-rep download buttons below use internal approval status
        // (status = 'approved'), not client acknowledgment -- a different,
        // broader set than the ack_status-gated fcrs query above.
        supabase
          .from('fcrs')
          .select(`
            *,
            account:accounts(company_name, city, trade_terms),
            creator:user_profiles!fcrs_created_by_fkey(full_name:name),
            approver:user_profiles!fcrs_approved_by_fkey(full_name:name)
          `)
          .eq('status', 'approved')
          .gte('visit_date', start)
          .lte('visit_date', end)
          .order('visit_date', { ascending: false }),
        // Same "working team member" list Dashboard's Team Overview uses --
        // NSM only ever gets Sales Engineers back (RLS), everyone else who
        // can reach this page sees both.
        supabase
          .from('user_profiles')
          .select('id, name, role')
          .in('role', ['se', 'bd'])
          .or('sales_app_role_override.is.null,sales_app_role_override.neq.viewer')
          .order('name'),
        // Visitation Census needs every FCR in the range regardless of
        // status (Filed/Acknowledged/Approved/Pending/Draft all get their
        // own column), unlike the acknowledged-only query above.
        supabase
          .from('fcrs')
          .select(`
            *,
            account:accounts(company_name),
            creator:user_profiles!fcrs_created_by_fkey(full_name:name),
            companion:user_profiles!fcrs_companion_id_fkey(name),
            companion2:user_profiles!fcrs_companion2_id_fkey(name)
          `)
          .gte('visit_date', start)
          .lte('visit_date', end)
          .order('visit_date', { ascending: true }),
      ])
      if (fcrError) throw fcrError
      if (mcpError) throw mcpError
      if (approvedError) throw approvedError
      if (memberError) throw memberError
      if (censusError) throw censusError
      setFcrs(fcrData || [])
      setMcpEntries(mcpData || [])
      setApprovedFcrs(approvedData || [])
      setTeamMembers(memberData || [])
      setCensusFcrs(censusData || [])
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

  const handleCensus = async () => {
    setExportingCensus(true)
    setError('')
    try {
      await downloadVisitationCensusExcel({ fcrs: censusFcrs, teamMembers, start, end, rangeLabel, scopeLabel, generatedBy: profile?.full_name })
    } catch (err) {
      setError(err.message || 'Failed to build the Visitation Census')
    } finally {
      setExportingCensus(false)
    }
  }

  // Per-rep breakdown for the "Download by Team Member" section below --
  // same salesTeamMembers/bdTeamMembers split Dashboard's Team Overview
  // uses. BD group is hidden entirely for NSM (their RLS never returns BD
  // members or BD FCRs anyway).
  const salesTeamMembers = teamMembers.filter(m => m.role === 'se')
  const bdTeamMembers = teamMembers.filter(m => m.role === 'bd')

  const handleDownloadMember = async (member) => {
    const memberFcrs = approvedFcrs.filter(f => f.created_by === member.id)
    if (memberFcrs.length === 0) return
    setDownloadingMemberId(member.id)
    setError('')
    try {
      await downloadMemberFcrsZip({ fcrs: memberFcrs, memberName: member.name, rangeLabel })
    } catch (err) {
      setError(err.message || `Failed to build ${member.name}'s download`)
    } finally {
      setDownloadingMemberId(null)
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
          <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
            <p className="text-2xl font-bold text-primary-700">{loading ? '-' : mcpEntries.length}</p>
            <p className="text-xs text-primary-700 mt-0.5">MCP (Actual) Entries</p>
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

      {!loading && teamMembers.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <CalendarCheck size={16} /> Visitation Census
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Every active MBT Sales/BD team member, broken out by Sunday-Saturday week within {rangeLabel} -- FCRs filed, acknowledged, and approved, plus the accounts each rep visited. Includes reps with zero visits, so it reads as a full roster census.
          </p>
          <button
            onClick={handleCensus}
            disabled={loading || exportingCensus}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} />
            {exportingCensus ? 'Building Census...' : 'Download Visitation Census (.xlsx)'}
          </button>
        </div>
      )}

      {!loading && teamMembers.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Users size={16} /> Download by Team Member
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Every approved Field Contact Report per rep for {rangeLabel}, zipped as individual PDFs.
          </p>
          <div className="space-y-6">
            <MemberDownloadTable
              title="MBT Sales Team"
              members={salesTeamMembers}
              approvedFcrs={approvedFcrs}
              downloadingMemberId={downloadingMemberId}
              onDownload={handleDownloadMember}
            />
            {role !== ROLES.NSM && (
              <MemberDownloadTable
                title="BD Team"
                members={bdTeamMembers}
                approvedFcrs={approvedFcrs}
                downloadingMemberId={downloadingMemberId}
                onDownload={handleDownloadMember}
              />
            )}
          </div>
        </div>
      )}

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

// One row per Sales/BD Engineer with their approved-FCR count for the
// selected range and a per-rep download button -- hidden entirely (returns
// null) when the team has no members, same as Dashboard's TeamMemberTable,
// so NSM never renders an empty "BD Team" section.
const MemberDownloadTable = ({ title, members, approvedFcrs, downloadingMemberId, onDownload }) => {
  if (members.length === 0) return null

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="space-y-2">
        {members.map(m => {
          const count = approvedFcrs.filter(f => f.created_by === m.id).length
          const downloading = downloadingMemberId === m.id
          return (
            <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-500">
                  {count} approved FCR{count === 1 ? '' : 's'}
                </p>
              </div>
              <button
                onClick={() => onDownload(m)}
                disabled={downloading || count === 0}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title={count === 0 ? 'No approved FCRs in this period' : ''}
              >
                <Download size={14} />
                {downloading ? 'Building ZIP...' : 'Download'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
