import { useEffect, useState } from 'react'
import {
  RefreshCw, Database, Copy, Cpu, Sparkles, AlertCircle, Trash2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../api/client.js'
import { Spinner } from '../components/ui.jsx'

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl grid place-items-center ${tint}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [days, setDays] = useState(7)
  const [runLlm, setRunLlm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    try {
      setStats(await api.stats())
    } catch (e) {
      setError('Could not reach the similarity service. Is it running on :8090?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const runSync = async () => {
    setSyncing(true)
    setError('')
    setNotice('')
    try {
      const res = await api.sync({ days: Number(days), run_llm: runLlm })
      setNotice(
        `Synced ${res.assyst_count} assyst incidents · ${res.pairs_found} duplicate pairs found.`,
      )
      await load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Sync failed. Check the IFS assyst service is up.')
    } finally {
      setSyncing(false)
    }
  }

  const doReset = async () => {
    if (!confirm('Wipe all stored issues, pairs and history?')) return
    await api.reset()
    setNotice('Store reset.')
    await load()
  }

  if (loading) return <Spinner label="Loading dashboard…" />

  const chartData = [
    { name: 'Incidents', value: stats?.assyst_count || 0, fill: '#0ea5e9' },
    { name: 'Duplicate pairs', value: stats?.duplicate_pairs || 0, fill: '#f43f5e' },
  ]

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">
            Index the latest IFS assyst incidents and detect duplicates.
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Window (days)</span>
            <input
              type="number" min="1" max="90" value={days}
              onChange={(e) => setDays(e.target.value)}
              className="input w-28"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
            <input type="checkbox" checked={runLlm} onChange={(e) => setRunLlm(e.target.checked)} />
            LLM judge
          </label>
          <button className="btn-primary" onClick={runSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Run Sync'}
          </button>
          <button className="btn-ghost" onClick={doReset} title="Reset store">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {error && (
        <div className="card p-4 border-rose-200 bg-rose-50 text-rose-700 flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {notice && (
        <div className="card p-4 border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Database} label="assyst incidents" value={stats?.assyst_count ?? 0} tint="bg-sky-100 text-sky-700" />
        <StatCard icon={Copy} label="Duplicate pairs" value={stats?.duplicate_pairs ?? 0} tint="bg-rose-100 text-rose-700" />
        <StatCard icon={Sparkles} label="LLM judge" value={stats?.llm_enabled ? 'On' : 'Off'} tint="bg-brand-100 text-brand-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-700 mb-4">Index overview</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Engine configuration</h2>
          <div className="flex items-center gap-3 text-sm">
            <Cpu size={18} className="text-brand-600" />
            <span className="text-slate-500">Embedder</span>
            <span className="ml-auto font-semibold text-slate-700">{stats?.embedder}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Sparkles size={18} className="text-brand-600" />
            <span className="text-slate-500">LLM judge</span>
            <span className="ml-auto font-semibold text-slate-700">
              {stats?.llm_enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Copy size={18} className="text-brand-600" />
            <span className="text-slate-500">Dup. threshold</span>
            <span className="ml-auto font-semibold text-slate-700">
              {Math.round((stats?.duplicate_threshold || 0) * 100)}%
            </span>
          </div>
          {stats?.latest_run && (
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
              Last run: <span className="font-medium text-slate-600">{stats.latest_run.status}</span>
              {stats.latest_run.finished_at && ` · ${new Date(stats.latest_run.finished_at).toLocaleString()}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
