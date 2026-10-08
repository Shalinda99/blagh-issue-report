import { NavLink, Route, Routes } from 'react-router-dom'
import { Compass, LayoutDashboard, ListChecks, Copy, FlaskConical } from 'lucide-react'
import clsx from 'clsx'
import Dashboard from './pages/Dashboard.jsx'
import Issues from './pages/Issues.jsx'
import Duplicates from './pages/Duplicates.jsx'
import Compare from './pages/Compare.jsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/issues', label: 'Issues', icon: ListChecks },
  { to: '/duplicates', label: 'Duplicates', icon: Copy },
  { to: '/compare', label: 'Compare Lab', icon: FlaskConical },
]

export default function App() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-600 text-white grid place-items-center">
            <Compass size={22} />
          </div>
          <div>
            <p className="font-extrabold text-slate-800 leading-tight">Similarity</p>
            <p className="text-xs text-slate-500">Check Index</p>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-[11px] text-slate-400 border-t border-slate-200">
          Deduplication over IFS assyst incidents
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
