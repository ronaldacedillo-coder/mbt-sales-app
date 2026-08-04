import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { searchPipelineProjects, pipelineProjectUrl } from '../../lib/pipeline'
import { Search, Link2, Unlink, Loader2, AlertCircle, Import, ExternalLink } from 'lucide-react'
import { ConfirmDialog } from '../../components/ConfirmDialog'

const money = (n) => (n || n === 0) ? `PHP ${Number(n).toLocaleString()}` : ''

const statusStyle = (status) => {
  const s = (status || '').toLowerCase()
  if (s.includes('award') || s.includes('deliver')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (s.includes('lost')) return 'bg-red-50 text-red-700 border-red-200'
  if (s.includes('bid')) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

// Shows MBT Project Pipeline project inquiries linked to this account, plus
// (when canEdit) a search box to find and link more. Pipeline is a separate
// Supabase project reached only through the search-account-projects Edge
// Function -- see src/lib/pipeline.js. Reused inside the FCR form (with an
// onImport handler) so a linked project's Name/Amount/Status can be dropped
// straight into the Project Opportunities table instead of retyped.
export const PipelineProjectsPanel = ({ accountId, companyName, canEdit = false, onImport = null, compact = false }) => {
  const { user } = useAuth()
  const [linked, setLinked] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState(companyName || '')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [unlinkTarget, setUnlinkTarget] = useState(null)

  useEffect(() => {
    if (accountId) fetchLinked()
  }, [accountId])

  const fetchLinked = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('accounts_pipeline_links')
        .select('*')
        .eq('account_id', accountId)
        .order('linked_at', { ascending: false })
      if (error) throw error
      setLinked(data || [])
    } catch (err) {
      console.error('Failed to load linked Pipeline projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const runSearch = async () => {
    setSearching(true)
    setError('')
    try {
      const found = await searchPipelineProjects(query)
      setResults(found)
    } catch (err) {
      setError('Could not reach MBT Project Pipeline right now. Try again in a moment.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const linkProject = async (project) => {
    setBusyId(project.id)
    try {
      const { error } = await supabase.from('accounts_pipeline_links').insert([{
        account_id: accountId,
        pipeline_project_id: project.id,
        pipeline_project_name: project.name,
        pipeline_data: project,
        linked_by: user.id,
      }])
      if (error && error.code !== '23505') throw error // ignore "already linked"
      await fetchLinked()
    } catch (err) {
      setError(err.message || 'Failed to link project')
    } finally {
      setBusyId(null)
    }
  }

  const unlinkProject = async (linkId) => {
    setBusyId(linkId)
    try {
      const { error } = await supabase.from('accounts_pipeline_links').delete().eq('id', linkId)
      if (error) throw error
      setLinked(prev => prev.filter(l => l.id !== linkId))
    } catch (err) {
      setError(err.message || 'Failed to unlink project')
    } finally {
      setBusyId(null)
    }
  }

  const isAlreadyLinked = (projectId) => linked.some(l => l.pipeline_project_id === projectId)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Link2 size={16} /> Related Pipeline Projects {linked.length > 0 && `(${linked.length})`}
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowSearch(v => !v)}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <Search size={13} /> {showSearch ? 'Hide search' : 'Search Pipeline'}
          </button>
        )}
      </div>

      {!compact && (
        <p className="text-xs text-gray-400 mb-3">
          Project inquiries from MBT Project Pipeline linked to this account -- useful context to bring up in an FCR or meeting.
        </p>
      )}

      {showSearch && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search by dealer, end-user, consultant, GC, distributor..."
              className="input text-sm flex-1"
            />
            <button onClick={runSearch} disabled={searching} className="btn-primary text-sm flex items-center gap-1.5 whitespace-nowrap">
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>

          {results !== null && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No matching Pipeline projects found.</p>
              ) : results.map(project => (
                <div key={project.id} className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      matched on <span className="font-medium">{project.matched_on}</span>: "{project.matched_value}"
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {project.status && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusStyle(project.status)}`}>{project.status}</span>}
                      {project.equipment?.length > 0 && <span className="text-xs text-gray-500">{project.equipment.join(', ')}</span>}
                      {project.delivery && <span className="text-xs text-gray-500">Target: {project.delivery}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {money(project.srp_value) && <span>SRP {money(project.srp_value)}</span>}
                      {money(project.discounted_value) && <span className="font-medium text-gray-700">Discounted {money(project.discounted_value)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => linkProject(project)}
                    disabled={busyId === project.id || isAlreadyLinked(project.id)}
                    className="btn-secondary text-xs whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                  >
                    {isAlreadyLinked(project.id) ? 'Linked' : busyId === project.id ? '...' : 'Link'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : linked.length === 0 ? (
        <p className="text-sm text-gray-400">
          {canEdit ? 'No Pipeline projects linked yet -- use "Search Pipeline" above.' : 'No Pipeline projects linked yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {linked.map(link => {
            const p = link.pipeline_data || {}
            const url = pipelineProjectUrl(link.pipeline_project_id)
            return (
              <div key={link.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{link.pipeline_project_name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                      {p.status && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusStyle(p.status)}`}>{p.status}</span>}
                      {p.equipment?.length > 0 && <span>{p.equipment.join(', ')}</span>}
                      {p.delivery && <span>Target delivery: {p.delivery}</span>}
                      {(p.se || p.bd_person) && <span>{p.se || p.bd_person}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {money(p.srp_value) && <span>SRP {money(p.srp_value)}</span>}
                      {money(p.discounted_value) && <span className="font-medium text-gray-700">Discounted {money(p.discounted_value)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {onImport && (
                      <button
                        onClick={() => onImport(p)}
                        className="p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Import into Project Opportunities"
                      >
                        <Import size={15} />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => setUnlinkTarget(link.id)}
                        disabled={busyId === link.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Unlink"
                      >
                        <Unlink size={15} />
                      </button>
                    )}
                  </div>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    <ExternalLink size={12} /> Open MBT Project Pipeline (search for this project to update it)
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={unlinkTarget !== null}
        onOpenChange={(isOpen) => !isOpen && setUnlinkTarget(null)}
        title="Remove this linked Pipeline project?"
        confirmLabel="Remove"
        onConfirm={() => unlinkProject(unlinkTarget)}
      />
    </div>
  )
}
