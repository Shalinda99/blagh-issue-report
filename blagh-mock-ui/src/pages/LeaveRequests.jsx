import { useState } from 'react'
import { LEAVE_REQUESTS } from '../data/mockData'
import './LeaveRequests.css'

const STATUS_COLOR = { Pending: 'warn', Approved: 'success', Rejected: 'danger' }
const TYPE_COLOR   = { 'Annual Leave': 'blue', 'Sick Leave': 'rose', 'Work From Home': 'teal', 'Casual Leave': 'purple' }

export default function LeaveRequests() {
  const [activeTab, setActiveTab] = useState('All')
  const [requests, setRequests] = useState(LEAVE_REQUESTS)

  const tabs = ['All', 'Pending', 'Approved', 'Rejected']
  const counts = {}
  tabs.forEach(t => {
    counts[t] = t === 'All' ? LEAVE_REQUESTS.length : LEAVE_REQUESTS.filter(r => r.status === t).length
  })

  const filtered = activeTab === 'All' ? requests : requests.filter(r => r.status === activeTab)

  function updateStatus(id, status) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="page-sub">{counts.Pending} pending approval</p>
        </div>
      </div>

      <div className="lr-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={'lr-tab' + (activeTab === tab ? ' active' : '')}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className={'lr-count' + (activeTab === tab ? ' active-count' : '')}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Applied On</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No {activeTab.toLowerCase()} leave requests.
                  </td>
                </tr>
              ) : filtered.map(lr => (
                <tr key={lr.id}>
                  <td className="id-cell">{lr.id}</td>
                  <td>
                    <div className="emp-mini">
                      <div className="mini-avatar">{lr.employeeName.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                      <span className="emp-name">{lr.employeeName}</span>
                    </div>
                  </td>
                  <td>
                    <span className={'type-badge type-' + (TYPE_COLOR[lr.type] || 'blue')}>
                      {lr.type}
                    </span>
                  </td>
                  <td className="date-cell">{lr.from}</td>
                  <td className="date-cell">{lr.to}</td>
                  <td className="days-cell">{lr.days}d</td>
                  <td className="date-cell">{lr.applied}</td>
                  <td>
                    <span className={'badge badge-' + STATUS_COLOR[lr.status]}>
                      <span className="badge-dot" />{lr.status}
                    </span>
                  </td>
                  <td>
                    {lr.status === 'Pending' ? (
                      <div className="action-btns">
                        <button
                          className="action-btn approve"
                          title="Approve"
                          onClick={() => updateStatus(lr.id, 'Approved')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Approve
                        </button>
                        <button
                          className="action-btn reject"
                          title="Reject"
                          onClick={() => updateStatus(lr.id, 'Rejected')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="no-action">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
