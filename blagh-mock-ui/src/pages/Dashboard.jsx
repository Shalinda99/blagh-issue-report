import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser } from '../utils/auth'
import { STATS, LEAVE_REQUESTS, ANNOUNCEMENTS } from '../data/mockData'
import './Dashboard.css'

const STATUS_COLOR = { Pending: 'warn', Approved: 'success', Rejected: 'danger' }

const FAILED_APIS = [
  { label: '404 Not Found',        fn: () => fetch('/api/employees/99999') },
  { label: '500 Server Error',     fn: () => fetch('/api/payroll/run', { method: 'POST', body: '{}' }) },
  { label: 'Network Unreachable',  fn: () => fetch('https://api.csiconnect.internal/v1/sync') },
  { label: 'Auth 401',             fn: () => fetch('/api/admin/secret', { headers: { Authorization: 'Bearer bad-token' } }) },
  { label: 'Timeout (XHR)',        fn: () => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'https://httpstat.us/200?sleep=30000')
    xhr.timeout = 1000
    xhr.ontimeout = () => console.warn('[XHR] Request timed out: /200?sleep=30000')
    xhr.send()
  }},
]

const CONSOLE_ERRORS = [
  { label: 'console.error',   fn: () => console.error('TypeError: Cannot read properties of undefined (reading "employeeId")') },
  { label: 'console.warn',    fn: () => console.warn('Deprecation warning: LeaveRequest.approver field is deprecated, use approvedBy') },
  { label: 'Uncaught Error',  fn: () => { setTimeout(() => { throw new Error('Unhandled: payroll batch job failed unexpectedly') }, 0) } },
  { label: 'console.error ×3', fn: () => {
    console.error('DB connection pool exhausted (pool size: 10/10)')
    console.error('Failed to acquire lock on employees table')
    console.error('Rollback triggered — transaction ID: TXN-8821')
  }},
]

export default function Dashboard() {
  const user = getUser()
  const navigate = useNavigate()

  useEffect(() => {
    fetch('https://api.csiconnect.internal/v1/analytics/summary')
      .catch(() => {})
    setTimeout(() => {
      console.error('Failed to load real-time analytics: ERR_NAME_NOT_RESOLVED')
    }, 800)
  }, [])

  const recentLeaves = LEAVE_REQUESTS.slice(0, 5)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Welcome back, <strong>{user?.name}</strong> — here's what's happening today.</p>
        </div>
        <div className="page-date">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          color="blue"
          icon={<PeopleIcon />}
          label="Total Employees"
          value={STATS.totalEmployees}
          sub={`${STATS.activeEmployees} active`}
        />
        <StatCard
          color="amber"
          icon={<ClockIcon />}
          label="Pending Leaves"
          value={STATS.pendingLeaves}
          sub="Awaiting approval"
        />
        <StatCard
          color="green"
          icon={<CheckIcon />}
          label="Approved This Month"
          value={STATS.approvedLeaves}
          sub="Leave requests"
        />
        <StatCard
          color="purple"
          icon={<BellIcon />}
          label="Announcements"
          value={ANNOUNCEMENTS.length}
          sub="Active notices"
        />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Leave Requests</h3>
            <button className="card-link" onClick={() => navigate('/leave-requests')}>View all →</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLeaves.map(lr => (
                  <tr key={lr.id}>
                    <td><span className="emp-name">{lr.employeeName}</span></td>
                    <td><span className="type-tag">{lr.type}</span></td>
                    <td className="date-cell">{lr.from} → {lr.to}</td>
                    <td><span className={'badge badge-' + STATUS_COLOR[lr.status]}>{lr.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Announcements</h3>
          </div>
          <div className="announcements">
            {ANNOUNCEMENTS.map(a => (
              <div key={a.id} className={'announcement announcement-' + a.priority}>
                <div className="ann-dot" />
                <div>
                  <div className="ann-title">{a.title}</div>
                  <div className="ann-body">{a.body}</div>
                  <div className="ann-date">{a.date}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="quick-actions">
            <p className="qa-title">Quick Actions</p>
            <div className="qa-grid">
              <button className="qa-btn" onClick={() => navigate('/employees')}>
                <PeopleIcon /> View Employees
              </button>
              <button className="qa-btn" onClick={() => navigate('/leave-requests')}>
                <ClockIcon /> Leave Requests
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card diag-panel">
        <div className="card-header">
          <h3 className="card-title">🧪 Diagnostics Test Panel</h3>
          <span className="diag-hint">Click any button → open widget → submit report → check captured diagnostics</span>
        </div>

        <div className="diag-section">
          <p className="diag-label">Failed API Calls</p>
          <div className="diag-grid">
            {FAILED_APIS.map(({ label, fn }) => (
              <button key={label} className="diag-btn diag-btn-api" onClick={() => { fn().catch(() => {}) }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="diag-section">
          <p className="diag-label">Console Errors</p>
          <div className="diag-grid">
            {CONSOLE_ERRORS.map(({ label, fn }) => (
              <button key={label} className="diag-btn diag-btn-err" onClick={fn}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={'stat-card stat-' + color}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
