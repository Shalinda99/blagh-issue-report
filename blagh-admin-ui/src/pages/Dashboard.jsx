import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReports } from '../api/reports.js';
import { getProjects } from '../api/projects.js';
import StatusBadge from '../components/StatusBadge.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import './Dashboard.css';

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-value" style={{ color }}>{value ?? '…'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [recent,      setRecent]      = useState([]);
  const [projects,    setProjects]    = useState([]);
  const [totals,      setTotals]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    setLoading(prev => prev || true);
    Promise.all([
      getReports({ pageSize: 10 }),
      getProjects(),
      getReports({ pageSize: 1, status: 'open' }),
      getReports({ pageSize: 1, status: 'in_progress' }),
      getReports({ pageSize: 1, status: 'resolved' }),
      getReports({ pageSize: 1 }),
    ])
      .then(([recent, projects, open, inProg, resolved, all]) => {
        setRecent(recent?.items ?? []);
        setProjects(projects ?? []);
        setTotals({
          all:         all?.total         ?? 0,
          open:        open?.total        ?? 0,
          in_progress: inProg?.total      ?? 0,
          resolved:    resolved?.total    ?? 0,
        });
        setError('');
      })
      .catch(err => setError(err.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [refreshCount]);

  function handleRefresh() {
    setRefreshing(true);
    setRefreshCount(c => c + 1);
  }

  if (loading) return <div className="loading">Loading dashboard…</div>;
  if (error)   return <div className="error-banner">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className={`btn-refresh${refreshing ? ' spinning' : ''}`} onClick={handleRefresh} disabled={refreshing} title="Refresh dashboard">
          <span className="refresh-icon">&#8635;</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Reports" value={totals.all}         color="var(--primary)" />
        <StatCard label="Open"          value={totals.open}        color="var(--info)" />
        <StatCard label="In Progress"   value={totals.in_progress} color="var(--warning)" />
        <StatCard label="Resolved"      value={totals.resolved}    color="var(--success)" />
        <StatCard label="Projects"      value={projects.length}    color="#7c3aed" />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-header">
          <h2>Recent Reports</h2>
          <Link to="/reports" className="view-all">View all →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">No reports yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Summary</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Reporter</th>
                <th>Project</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(r => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/reports/${r.ref_id}`} className="ref-link">
                      {r.ref_id}
                    </Link>
                  </td>
                  <td className="summary-cell" title={r.summary}>
                    {r.summary.length > 60 ? r.summary.slice(0, 60) + '…' : r.summary}
                  </td>
                  <td><PriorityBadge priority={r.priority} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.user_name || <span style={{color:'var(--muted)'}}>—</span>}</td>
                  <td><code className="project-chip">{r.project_id}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
