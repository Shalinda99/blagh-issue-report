import { useState } from 'react'
import { EMPLOYEES } from '../data/mockData'
import './Employees.css'

const STATUS_COLOR = { Active: 'success', 'On Leave': 'warn', Inactive: 'neutral' }

const DEPT_COLORS = ['blue', 'purple', 'green', 'amber', 'rose', 'teal']
const deptColorMap = {}
let colorIdx = 0
EMPLOYEES.forEach(e => {
  if (!deptColorMap[e.department]) {
    deptColorMap[e.department] = DEPT_COLORS[colorIdx % DEPT_COLORS.length]
    colorIdx++
  }
})

export default function Employees() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [syncMsg, setSyncMsg] = useState('')

  const filtered = EMPLOYEES.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.department.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All' || e.status === statusFilter
    return matchSearch && matchStatus
  })

  function handleSync() {
    setSyncMsg('Syncing…')
    // Intentional failing fetch for widget demo — will be captured as failed API
    fetch('https://hrms.csiconnect.internal/api/sync/employees')
      .catch(() => {
        console.warn('HRMS sync endpoint unreachable: https://hrms.csiconnect.internal')
        setSyncMsg('Sync failed — HRMS unavailable')
        setTimeout(() => setSyncMsg(''), 3000)
      })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">{EMPLOYEES.length} total employees across all departments</p>
        </div>
        <button className="btn-primary" onClick={handleSync}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Sync with HRMS
          {syncMsg && <span className="sync-msg">{syncMsg}</span>}
        </button>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, email, department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {['All', 'Active', 'On Leave', 'Inactive'].map(s => (
            <button
              key={s}
              className={'filter-tab' + (statusFilter === s ? ' active' : '')}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No employees found matching your search.
                  </td>
                </tr>
              ) : filtered.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div className="emp-cell">
                      <div className={'emp-avatar emp-avatar-' + (emp.id.charCodeAt(3) % 5)}>
                        {emp.avatar}
                      </div>
                      <div>
                        <div className="emp-name">{emp.name}</div>
                        <div className="emp-email">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={'dept-tag dept-' + deptColorMap[emp.department]}>
                      {emp.department}
                    </span>
                  </td>
                  <td className="role-cell">{emp.role}</td>
                  <td>
                    <span className={'badge badge-' + STATUS_COLOR[emp.status]}>
                      <span className="badge-dot" />
                      {emp.status}
                    </span>
                  </td>
                  <td className="date-cell">{emp.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
