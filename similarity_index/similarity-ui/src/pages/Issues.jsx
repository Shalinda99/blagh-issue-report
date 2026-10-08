import { useEffect, useState } from 'react'
import { Search, AlertTriangle, Wifi } from 'lucide-react'
import { api } from '../api/client.js'
import { ScoreBar, Spinner, Empty } from '../components/ui.jsx'

export default function Issues() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [matches, setMatches] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = { source: 'assyst' }
      if (q.trim()) params.q = q.trim()
      const data = await api.issues(params)
      setItems(Array.isArray(data) ? data : data.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openDetail = async (issue) => {
    setSelected(issue.uid)
    setDetail(null)
    setMatches([])
    setDetailLoading(true)
    try {
      const d = await api.issueDetail(issue.uid)
      setDetail(d.issue ?? d)
      setMatches(d.matches ?? [])
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    load()
  }

  const raw = detail?.raw ?? {}
  const consoleLogs = raw.console_logs ?? []
  const failedCalls = raw.failed_api_calls ?? []
  const consoleErrors = consoleLogs.filter((l) => ['error', 'warning'].includes(l.level?.toLowerCase()))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-800">Incidents</h1>
        <p className="text-slate-500">Browse the IFS assyst incidents in the similarity index.</p>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-8 w-full"
              placeholder="Search title or body…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="card overflow-hidden">
          {loading ? (
            <Spinner label="Loading issues…" />
          ) : items.length === 0 ? (
            <Empty title="No issues found" hint="Run a sync first or adjust your filters." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((issue) => (
                <li
                  key={issue.uid}
                  onClick={() => openDetail(issue)}
                  className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selected === issue.uid ? 'bg-brand-50 border-l-2 border-brand-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{issue.title || '(no title)'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{issue.ref || issue.source_id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {issue.status && (
                        <span className="badge bg-slate-100 text-slate-500">{issue.status}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            {!selected ? (
              <Empty title="Select an issue" hint="Click any row to view details." />
            ) : detailLoading ? (
              <Spinner label="Loading detail…" />
            ) : detail ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 flex-wrap">
                  {detail.status && <span className="badge bg-slate-100 text-slate-500">{detail.status}</span>}
                  {detail.priority && <span className="badge bg-amber-100 text-amber-700">{detail.priority}</span>}
                </div>
                <h2 className="text-lg font-bold text-slate-800">{detail.title || '(no title)'}</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                  {detail.ref && <span>Ref: <span className="font-medium text-slate-700">{detail.ref}</span></span>}
                  {detail.category && <span>Category: <span className="font-medium text-slate-700">{detail.category}</span></span>}
                  {detail.reporter && <span>Reporter: <span className="font-medium text-slate-700">{detail.reporter}</span></span>}
                  {detail.created_at && <span>{new Date(detail.created_at).toLocaleString()}</span>}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</p>
                  {detail.body ? (
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{detail.body}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No description.</p>
                  )}
                </div>

                {consoleErrors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <AlertTriangle size={12} /> Console Errors &amp; Warnings
                    </p>
                    <ul className="space-y-1">
                      {consoleErrors.map((l, i) => (
                        <li key={i} className={`text-xs rounded px-2 py-1 font-mono ${l.level?.toLowerCase() === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          <span className="font-bold uppercase mr-1">{l.level}</span>{l.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {failedCalls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Wifi size={12} /> Failed API Calls
                    </p>
                    <ul className="space-y-1">
                      {failedCalls.map((c, i) => (
                        <li key={i} className="text-xs bg-slate-50 rounded px-2 py-1 font-mono flex items-center gap-2">
                          <span className="badge bg-slate-200 text-slate-700">{c.method}</span>
                          <span className={`badge ${c.status_code >= 500 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{c.status_code}</span>
                          <span className="truncate text-slate-600">{c.url}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.url && (
                  <a href={detail.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                    Open in source system ↗
                  </a>
                )}
              </div>
            ) : null}
          </div>

          {matches.length > 0 && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Nearest Similar Issues</h3>
              <ul className="space-y-2">
                {matches.map((m) => (
                  <li key={m.uid} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {m.ref && <span className="badge bg-sky-100 text-sky-700 shrink-0">{m.ref}</span>}
                        <span className="text-sm text-slate-700 truncate">{m.title || m.uid}</span>
                      </div>
                      <span className="text-xs font-bold text-brand-700 shrink-0">{Math.round(m.vector_score * 100)}%</span>
                    </div>
                    <ScoreBar label="" value={m.vector_score} color="bg-brand-400" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
