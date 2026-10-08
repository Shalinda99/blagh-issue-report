import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle, Clock, CheckCircle2, XCircle,
  TrendingUp, Database, Activity, RefreshCw,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { fetchEvents } from '@/api/events';
import { fetchAdminStats, fetchAdminConfig } from '@/api/admin';
import { statusColor, priorityColor, formatDate, elapsedSince } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#3b82f6', IN_PROGRESS: '#6366f1', PENDING: '#f59e0b',
  RESOLVED: '#22c55e', CLOSED: '#94a3b8', CANCELLED: '#e2e8f0',
};
const PRIORITY_COLORS: Record<string, string> = {
  P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#22c55e',
};

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: recentEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['events-dashboard', refreshKey],
    queryFn: () => fetchEvents({ startRow: 0, numberOfRows: 10, sortField: 'creationDate', sortOrder: 'desc' }),
  });

  const { data: allOpen } = useQuery({
    queryKey: ['events-open', refreshKey],
    queryFn: () => fetchEvents({ eventStatus: 'OPEN,IN_PROGRESS,PENDING', numberOfRows: 100 }),
  });

  const { data: stats } = useQuery({ queryKey: ['admin-stats', refreshKey], queryFn: fetchAdminStats });
  const { data: config } = useQuery({ queryKey: ['admin-config'], queryFn: fetchAdminConfig });

  const statusData = allOpen
    ? Object.entries(
        allOpen.reduce<Record<string, number>>((acc, e) => {
          const s = e.eventStatus ?? 'UNKNOWN';
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }))
    : [];

  const priorityData = allOpen
    ? Object.entries(
        allOpen.reduce<Record<string, number>>((acc, e) => {
          const p = e.priorityCode ?? 'Unknown';
          acc[p] = (acc[p] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }))
    : [];

  const statCards = [
    { label: 'Total Incidents', value: stats?.eventCount ?? '—', icon: Database, color: 'text-brand-600 bg-brand-50' },
    { label: 'Open', value: allOpen?.filter(e => e.eventStatus === 'OPEN').length ?? '—', icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
    { label: 'In Progress', value: allOpen?.filter(e => e.eventStatus === 'IN_PROGRESS').length ?? '—', icon: Clock, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Pending', value: allOpen?.filter(e => e.eventStatus === 'PENDING').length ?? '—', icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
    { label: 'Resolved', value: '—', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
    { label: 'Support Groups', value: stats?.teamCount ?? '—', icon: Activity, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Live view of Axios assyst incident data"
        actions={
          <Button
            variant="outline" size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {config && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800">
            <span className="font-medium">⚠ Mock Environment</span>
            <span className="text-amber-600">· {config.appName} · API {config.apiVersion} · Auth: {config.auth.username}</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${color} mb-3`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Open Incidents by Status</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name} (${value})`}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Open Incidents by Priority</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Incidents">
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recent Incidents</h2>
            <Link to="/incidents" className="text-xs text-brand-600 hover:underline">View all →</Link>
          </div>
          {loadingEvents ? (
            <PageLoader />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentEvents?.map((evt) => (
                <Link
                  key={evt.id}
                  to={`/incidents/${evt.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-slate-400">{evt.eventRef}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusColor(evt.eventStatus)}`}>
                        {evt.eventStatus?.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${priorityColor(evt.priorityCode)}`}>
                        {evt.priorityCode}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 truncate">{evt.shortDescription}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{elapsedSince(evt.creationDate)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
