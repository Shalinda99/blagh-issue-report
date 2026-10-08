import { useEffect, useState } from 'react'
import { FlaskConical, Sparkles } from 'lucide-react'
import { api } from '../api/client.js'
import { ScoreBar, VerdictBadge } from '../components/ui.jsx'

const EMPTY_FORM = {
  title_a: '', text_a: '', title_b: '', text_b: '',
  priority_a: '', priority_b: '',
  category_a: '', category_b: '',
  run_llm: false,
}

export default function Compare() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [llm, setLlm] = useState({ available: false, provider: '', model: '' })

  useEffect(() => {
    api.stats()
      .then((s) => setLlm({ available: !!s.llm_available, provider: s.llm_provider || '', model: s.llm_model || '' }))
      .catch(() => {})
  }, [])

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.text_a.trim() || !form.text_b.trim()) {
      setError('Both text fields are required.')
      return
    }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const body = { text_a: form.text_a, text_b: form.text_b, run_llm: form.run_llm }
      if (form.title_a) body.title_a = form.title_a
      if (form.title_b) body.title_b = form.title_b
      if (form.priority_a) body.priority_a = form.priority_a
      if (form.priority_b) body.priority_b = form.priority_b
      if (form.category_a) body.category_a = form.category_a
      if (form.category_b) body.category_b = form.category_b
      const data = await api.compare(body)
      setResult(data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Compare failed. Is the service running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-800">Compare Lab</h1>
        <p className="text-slate-500">Paste two issue texts and score their similarity on demand.</p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {['a', 'b'].map((side) => (
            <div key={side} className="card p-5 space-y-3">
              <h2 className="font-semibold text-slate-700">Issue {side.toUpperCase()}</h2>
              <input
                className="input w-full"
                placeholder="Title / short description"
                value={form[`title_${side}`]}
                onChange={set(`title_${side}`)}
              />
              <textarea
                className="input w-full h-32 resize-none font-mono text-sm"
                placeholder="Full description / details…"
                value={form[`text_${side}`]}
                onChange={set(`text_${side}`)}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">
                  <span className="block text-slate-500 mb-1">Priority</span>
                  <input
                    className="input w-full"
                    placeholder="e.g. high"
                    value={form[`priority_${side}`]}
                    onChange={set(`priority_${side}`)}
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-slate-500 mb-1">Category</span>
                  <input
                    className="input w-full"
                    placeholder="e.g. network"
                    value={form[`category_${side}`]}
                    onChange={set(`category_${side}`)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-600" title={llm.available ? `${llm.provider} · ${llm.model}` : 'No LLM API key configured'}>
            <input type="checkbox" checked={form.run_llm} onChange={set('run_llm')} disabled={!llm.available} />
            <Sparkles size={14} className={llm.available ? 'text-brand-600' : 'text-slate-400'} />
            LLM comparison
            {llm.available
              ? <span className="text-xs text-slate-400">({llm.provider} · {llm.model})</span>
              : <span className="text-xs text-rose-500">(no API key)</span>}
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            <FlaskConical size={16} />
            {loading ? 'Comparing…' : 'Compare'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setForm(EMPTY_FORM); setResult(null); setError('') }}
          >
            Clear
          </button>
        </div>

        {error && (
          <div className="card p-4 border-rose-200 bg-rose-50 text-rose-700 text-sm">{error}</div>
        )}
      </form>

      {result && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-semibold text-slate-700">Results</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {result.llm_used && (
                <VerdictBadge verdict={result.llm_verdict} confidence={result.llm_confidence} />
              )}
              <span
                className={`badge text-base font-extrabold px-3 py-1 ${
                  result.is_duplicate
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {result.is_duplicate ? 'Duplicate' : 'Not duplicate'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ScoreBar label="Vector similarity" value={result.vector_score} color="bg-sky-500" />
            <ScoreBar label="Rule score" value={result.rule_score} color="bg-emerald-500" />
            <ScoreBar label="Combined" value={result.combined_score} color="bg-brand-500" />
          </div>

          {result.llm_used && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-brand-600" />
                  <span className="font-semibold text-slate-700">LLM comparison</span>
                  {result.llm_model && (
                    <span className="text-xs text-slate-400">{result.llm_model}</span>
                  )}
                </div>
                {result.llm_similarity != null && (
                  <span className="badge bg-brand-100 text-brand-700 font-bold">
                    {Math.round(result.llm_similarity * 100)}% similar
                  </span>
                )}
              </div>

              {result.llm_error ? (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  {result.llm_error}
                </div>
              ) : (
                <>
                  {result.llm_similarity != null && (
                    <ScoreBar label="LLM similarity" value={result.llm_similarity} color="bg-brand-500" />
                  )}
                  {result.llm_reason && (
                    <div className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-700 block mb-1">Reasoning</span>
                      {result.llm_reason}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.llm_matching_factors?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Matching factors</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.llm_matching_factors.map((f, i) => (
                            <span key={i} className="badge bg-emerald-100 text-emerald-700">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.llm_differing_factors?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Differing factors</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.llm_differing_factors.map((f, i) => (
                            <span key={i} className="badge bg-amber-100 text-amber-700">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
