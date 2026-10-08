import clsx from 'clsx'

export function SourceBadge({ source }) {
  const map = {
    blagh: 'bg-emerald-100 text-emerald-700',
    assyst: 'bg-sky-100 text-sky-700',
  }
  return (
    <span className={clsx('badge', map[source] || 'bg-slate-100 text-slate-600')}>
      {source === 'blagh' ? 'blagh' : 'IFS assyst'}
    </span>
  )
}

export function ScoreBar({ label, value, color = 'bg-brand-500' }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function VerdictBadge({ verdict, confidence }) {
  if (!verdict) {
    return <span className="badge bg-slate-100 text-slate-500">no LLM verdict</span>
  }
  const dup = verdict === 'duplicate'
  return (
    <span
      className={clsx(
        'badge',
        dup ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {dup ? 'LLM: duplicate' : 'LLM: distinct'}
      {confidence != null && ` · ${Math.round(confidence * 100)}%`}
    </span>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 text-slate-500 text-sm py-8 justify-center">
      <span className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      {label}
    </div>
  )
}

export function Empty({ title, hint }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  )
}
