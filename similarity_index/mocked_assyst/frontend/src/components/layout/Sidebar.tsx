import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, AlertCircle, Users, Shield,
  Tag, Layers, Cpu, Terminal, Settings, Beaker, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/incidents',   icon: AlertCircle,     label: 'Incidents' },
  { to: '/users',       icon: Users,           label: 'Users' },
  { to: '/teams',       icon: Shield,          label: 'Support Groups' },
  { to: '/categories',  icon: Tag,             label: 'Categories' },
  { to: '/services',    icon: Layers,          label: 'Services' },
  { to: '/similarity',  icon: Beaker,          label: 'Similarity Lab' },
  { to: '/api-explorer',icon: Terminal,        label: 'API Explorer' },
  { to: '/api-contract',icon: BookOpen,        label: 'API Contract' },
  { to: '/settings',    icon: Settings,        label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Cpu className="w-6 h-6 text-brand-400" />
          <div>
            <p className="text-sm font-bold text-white leading-none">Axios</p>
            <p className="text-[10px] text-slate-400 mt-0.5">assystREST API</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium rounded-full bg-amber-500/20 text-amber-300 px-2 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          MOCK ENVIRONMENT
        </span>
      </div>
    </aside>
  );
}
