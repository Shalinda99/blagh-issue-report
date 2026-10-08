import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getReports } from '../api/reports.js';
import StatusBadge from '../components/StatusBadge.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import './Reports.css';

const STATUSES = ['', 'open', 'in_progress', 'resolved', 'closed'];
const PAGE_SIZE = 20;

export default function Reports() {
  const [data,       setData]       = useState({ items: [], total: 0, pages: 0 });
  const [page,       setPage]       = useState(1);
  const [status,     setStatus]     = useState('');
  const [projectId,  setProjectId]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const searchRef = useRef();

  function load(p = page, s = status, pid = projectId, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setLoading(true);
    getReports({ page: p, pageSize: PAGE_SIZE, status: s || undefined, projectId: pid || undefined })
      .then(d => { setData(d ?? { items: [], total: 0, pages: 0 }); setError(''); })
      .catch(err => setError(err.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  function handleRefresh() { load(page, status, projectId, true); }

  useEffect(() => { load(1, status, projectId); }, [status, projectId]);

  function handleSearch(e) {
    e.preventDefault();
    const pid = searchRef.current.value.trim();
    setProjectId(pid);
    setPage(1);
  }

  function goPage(p) {
    setPage(p);
    load(p, status, projectId);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Reports <span className="total-badge">{data.total}</span></h1>
        <button className={`btn-refresh${refreshing ? ' spinning' : ''}`} onClick={handleRefresh} disabled={refreshing || loading} title="Refresh reports">
          <span className="refresh-icon">&#8635;</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="filters card">
        <form onSubmit={handleSearch} className="filter-row">
          <input
            ref={searchRef}
            defaultValue={projectId}
            placeholder="Filter by project ID…"
            style={{ maxWidth: 240 }}
          />
          <button type="submit" className="btn-ghost">Search</button>
          {projectId && (
            <button type="button" className="btn-ghost" onClick={() => { searchRef.current.value=''; setProjectId(''); }}>
              Clear
            </button>
          )}
        </form>

        <div className="status-tabs">
          {STATUSES.map(s => (
            <button
              key={s || 'all'}
              className={`tab-btn${status === s ? ' active' : ''}`}
              onClick={() => { setStatus(s); setPage(1); }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner" style={{marginTop:16}}>{error}</div>}

      <div className="card" style={{ marginTop: 16 }}>
        {loading ? (
          <div className="loading">Loading reports…</div>
        ) : data.items.length === 0 ? (
          <div className="empty-state">No reports match your filters.</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Summary</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reporter</th>
                  <th>Project</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(r => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/reports/${r.ref_id}`} className="ref-link">
                        {r.ref_id}
                      </Link>
                    </td>
                    <td className="summary-cell" title={r.summary}>
                      {r.summary.length > 55 ? r.summary.slice(0, 55) + '…' : r.summary}
                    </td>
                    <td><PriorityBadge priority={r.priority} /></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.user_name || <span style={{color:'var(--muted)'}}>—</span>}</td>
                    <td><code className="project-chip">{r.project_id}</code></td>
                    <td className="date-cell">
                      {r.reported_at_utc
                        ? new Date(r.reported_at_utc).toLocaleDateString()
                        : new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.pages > 1 && (
              <div className="pagination">
                <button
                  className="btn-ghost"
                  onClick={() => goPage(page - 1)}
                  disabled={page === 1}
                >
                  ← Prev
                </button>
                <span className="page-info">Page {page} of {data.pages}</span>
                <button
                  className="btn-ghost"
                  onClick={() => goPage(page + 1)}
                  disabled={page === data.pages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
