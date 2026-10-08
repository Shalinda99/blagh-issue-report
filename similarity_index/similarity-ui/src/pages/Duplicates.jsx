import { useEffect, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { api } from '../api/client.js'
import { ScoreBar, VerdictBadge, Spinner, Empty } from '../components/ui.jsx'

export default function Duplicates() {
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [notice, setNotice] = useState('')
  const [useLlm, setUseLlm] = useState(false)
  const [llm, setLlm] = useState({ available: false, provider: '', model: '' })

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.duplicates({})
      setPairs(Array.isArray(data) ? data : data.pairs ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    api.stats()
      .then((s) => setLlm({ available: !!s.llm_available, provider: s.llm_provider || '', model: s.llm_judge_model || '' }))
      .catch(() => {})
  }, [])

  const redetect = async () => {
    setDetecting(true)
    setNotice('')
    try {
      const res = await api.detect({ run_llm: useLlm && llm.available })
      const withLlm = useLlm && llm.available
      setNotice(
        `Detection complete — ${res.pairs_found} duplicate pairs found` +
        (withLlm ? ` · judged with ${llm.model}.` : '.'),
      )
      await load()
    } catch (e) {
      setNotice(e?.response?.data?.detail || 'Detection failed. Is the service running?')
    } finally {
      setDetecting(false)
    }
  }

  const toggle = (id) => setExpanded((prev) => (prev === id ? null : id))

  // Only surface meaningful duplications (>= 50%); >= 80% are flagged as duplicates.
  const DUPLICATE_MARK = 0.8
  const visible = pairs.filter((p) => (p.combined_score || 0) >= 0.5)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Duplicates</h1>
          <p className="text-slate-500">Similar IFS assyst incidents above 50% — pairs at 80%+ are flagged as duplicates.</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-1">
          <label
            className="flex items-center gap-2 text-sm text-slate-600"
            title={llm.available ? `${llm.provider} · ${llm.model}` : 'No LLM API key configured'}
          >
            <input
              type="checkbox"
              checked={useLlm && llm.available}
              onChange={(e) => setUseLlm(e.target.checked)}
              disabled={!llm.available || detecting}
            />
            <Sparkles size={14} className={llm.available ? 'text-brand-600' : 'text-slate-400'} />
            Check with LLM
            {llm.available
              ? <span className="text-xs text-slate-400">({llm.model})</span>
              : <span className="text-xs text-rose-500">(no API key)</span>}
          </label>
          <button className="btn-primary" onClick={redetect} disabled={detecting}>
            <RefreshCw size={15} className={detecting ? 'animate-spin' : ''} />
            {detecting ? (useLlm && llm.available ? 'Checking with LLM…' : 'Detecting…') : 'Check Similarity'}
          </button>
        </div>
      </header>

      {notice && (
        <div className="card p-4 border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">{notice}</div>
      )}

      {loading ? (
        <Spinner label="Loading pairs…" />
      ) : visible.length === 0 ? (
        <Empty title="No duplications above 50%" hint="Run detection or sync to find similar incidents." />
      ) : (
        <div className="space-y-3">
          {visible.map((pair) => {
            const key = pair.id ?? `${pair.uid_a}-${pair.uid_b}`
            const isOpen = expanded === key
            const pct = Math.round((pair.combined_score || 0) * 100)
            const isDuplicate = (pair.combined_score || 0) >= DUPLICATE_MARK
            return (
              <div key={key} className="card overflow-hidden">
                <button
                  onClick={() => toggle(key)}
                  className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge bg-sky-100 text-sky-700 shrink-0">A</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{pair.title_a || pair.uid_a}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge bg-sky-100 text-sky-700 shrink-0">B</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{pair.title_b || pair.uid_b}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-lg font-extrabold ${isDuplicate ? 'text-rose-600' : 'text-brand-700'}`}>
                        {pct}%
                      </span>
                      {isDuplicate && (
                        <span className="badge bg-rose-100 text-rose-700 font-bold">Duplicate</span>
                      )}
                      <VerdictBadge verdict={pair.llm_verdict} confidence={pair.llm_confidence} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {pair.vector_score > 0 && (
                        <ScoreBar label="Vector similarity" value={pair.vector_score} color="bg-sky-500" />
                      )}
                      {pair.rule_score > 0 && (
                        <ScoreBar label="Rule score" value={pair.rule_score} color="bg-emerald-500" />
                      )}
                      <ScoreBar
                        label={pair.vector_score > 0 || pair.rule_score > 0 ? 'Combined' : 'LLM similarity'}
                        value={pair.combined_score}
                        color="bg-brand-500"
                      />
                    </div>
                    {pair.llm_reason && (
                      <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg p-3">
                        <span className="font-semibold text-slate-700 block mb-1">LLM reasoning</span>
                        {pair.llm_reason}
                      </div>
                    )}
                    {pair.detected_at && (
                      <p className="text-xs text-slate-400">
                        Detected: {new Date(pair.detected_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
