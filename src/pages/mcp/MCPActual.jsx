import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { MonthCalendar } from '../itinerary/MonthCalendar'
import { fetchAcknowledgedVisits, buildMcpActualSnapshot, fetchDailyNotes, saveDailyNote } from '../../lib/mcpActual'
import { downloadMCPPdf } from '../../lib/mcpPdf'
import { format, parseISO, startOfMonth } from 'date-fns'
import { FileText, ClipboardCheck, Archive, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

// MCP (Actual) -- what really happened this month, rolled up from FCRs the
// account has acknowledged. Always computed live (no separate save step to
// keep in sync); "Generate & Export PDF" both downloads the PDF and drops a
// snapshot into the MCP Archive in the same action, so every export leaves
// a permanent record you can get back to later.
export const MCPActual = () => {
  const { user, profile, role } = useAuth()
  const [month, setMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [visits, setVisits] = useState([])
  const [accounts, setAccounts] = useState([])
  const [dailyNotes, setDailyNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const noteSaveTimers = useRef({})

  useEffect(() => {
    if (!user) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [visitData, { data: accountData }, notesData] = await Promise.all([
        fetchAcknowledgedVisits({ userId: user.id, month }),
        supabase.from('accounts').select('id, company_name'),
        fetchDailyNotes({ userId: user.id, month }),
      ])
      setVisits(visitData)
      setAccounts(accountData || [])
      setDailyNotes(notesData)
    } catch (err) {
      setError(err.message || 'Failed to load acknowledged visits')
    } finally {
      setLoading(false)
    }
  }

  // Updates the on-screen note immediately (so typing feels responsive) and
  // debounces the actual save so we're not writing to the DB on every
  // keystroke -- one save per date, 700ms after the user stops typing there.
  const handleNoteChange = (dateStr, text) => {
    setDailyNotes(prev => ({ ...prev, [dateStr]: text }))
    clearTimeout(noteSaveTimers.current[dateStr])
    noteSaveTimers.current[dateStr] = setTimeout(() => {
      saveDailyNote({ userId: user.id, date: dateStr, note: text }).catch(err => {
        setError(err.message || 'Failed to save note')
      })
    }, 700)
  }

  const handleGenerateAndExport = async () => {
    setExporting(true)
    setError('')
    setSuccess('')
    try {
      const submitterName = profile?.full_name || ''
      const snapshot = buildMcpActualSnapshot({ month, visits, accounts, submitterName, dailyNotes })

      const { error: insertError } = await supabase.from('mcp_archive').insert([{
        month,
        snapshot,
        fcr_count: visits.length,
        generated_by: user.id,
        submitter_role: role,
      }])
      if (insertError) throw insertError

      await downloadMCPPdf({
        month,
        visits,
        accounts,
        dailyNotes,
        submitterName,
        approverName: '',
        title: 'MONTHLY COVERAGE PLAN (ACTUAL)',
        filenamePrefix: 'MCP (Actual)',
      })

      setSuccess('Saved to MCP Archive and downloaded.')
    } catch (err) {
      setError(err.message || 'Failed to generate MCP (Actual)')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCP (Actual)</h1>
          <p className="text-gray-500 mt-1">What actually happened -- built from your approved Field Contact Reports</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={format(parseISO(month), 'yyyy-MM')}
            onChange={(e) => setMonth(e.target.value + '-01')}
            className="input"
          />
          <button
            onClick={handleGenerateAndExport}
            disabled={exporting || visits.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
            title={visits.length === 0 ? 'No approved FCRs for this month yet' : ''}
          >
            <FileText size={16} /> {exporting ? 'Generating...' : 'Generate & Export PDF'}
          </button>
          <Link to="/mcp-archive" className="btn-secondary flex items-center gap-2">
            <Archive size={16} /> Archive
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="card flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
          <ClipboardCheck size={20} className="text-primary-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{visits.length}</p>
          <p className="text-sm text-gray-500">Approved visit{visits.length === 1 ? '' : 's'} in {format(parseISO(month), 'MMMM yyyy')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{format(parseISO(month), 'MMMM yyyy')}</h3>
          <p className="text-xs text-gray-400 mb-3">
            Add a note on any day for things an FCR wouldn't capture -- on leave, a site visit, out of office, etc.
          </p>
          <MonthCalendar
            month={month}
            visits={visits}
            accounts={accounts}
            dailyNotes={dailyNotes}
            onNoteChange={handleNoteChange}
            notesEditable
          />
        </div>
      )}
    </div>
  )
}
