import { useEffect, useState } from 'react'
import './Payroll.css'

const PAYROLL_DATA = [
  { id: 'EMP-001', name: 'Amal Shalinda',   dept: 'Engineering',  salary: 185000, status: 'Paid',    date: '2026-09-01' },
  { id: 'EMP-002', name: 'Nirosha Perera',  dept: 'HR',           salary: 142000, status: 'Paid',    date: '2026-09-01' },
  { id: 'EMP-003', name: 'Kasun Bandara',   dept: 'Finance',      salary: 165000, status: 'Pending', date: '—'          },
  { id: 'EMP-004', name: 'Dilini Jayasena', dept: 'Engineering',  salary: 178000, status: 'Paid',    date: '2026-09-01' },
  { id: 'EMP-005', name: 'Ruwan Silva',     dept: 'Operations',   salary: 138000, status: 'Failed',  date: '—'          },
  { id: 'EMP-006', name: 'Chamari Wijesinghe', dept: 'Marketing', salary: 155000, status: 'Paid',    date: '2026-09-01' },
]

const STATUS_STYLE = {
  Paid:    { background: '#f0fdf4', color: '#16a34a' },
  Pending: { background: '#fffbeb', color: '#d97706' },
  Failed:  { background: '#fef2f2', color: '#dc2626' },
}

const DUMMY_API_FAILURES = [
  { url: '/api/payroll/batch/run',               method: 'POST', status: 503, text: 'Service Unavailable — payroll engine is down' },
  { url: '/api/payroll/employee/EMP-003/salary', method: 'GET',  status: 404, text: 'Not Found'                                    },
  { url: '/api/bank/transfer/initiate',          method: 'POST', status: 500, text: 'Internal Server Error — bank gateway timeout'  },
  { url: '/api/payroll/tax-calculation',         method: 'GET',  status: 401, text: 'Unauthorized — token expired'                 },
]

export default function Payroll() {
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)

  // Auto-trigger failures on mount to simulate a broken payroll page
  useEffect(() => {
    fetch('/api/payroll/summary')                           // 404 — no such endpoint in dev
      .catch(() => {})
    fetch('/api/bank/gateway/health')                       // network error
      .catch(() => {})
    setTimeout(() => {
      console.error('PayrollService: Failed to connect to bank gateway — ERR_CONNECTION_REFUSED')
      console.error('TaxEngine: Could not load tax table for FY2026 — module not initialized')
    }, 400)
  }, [])

  function addLog(msg, type) {
    setLog(prev => [{ msg, type, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 12))
  }

  async function runBatchPayroll() {
    setRunning(true)
    addLog('Starting batch payroll run…', 'info')

    for (const api of DUMMY_API_FAILURES) {
      await new Promise(resolve => setTimeout(resolve, 350))
      try {
        const resp = await fetch(api.url, { method: api.method })
        if (!resp.ok) {
          addLog(`${api.method} ${api.url} → ${api.status} ${api.text}`, 'error')
        }
      } catch {
        addLog(`${api.method} ${api.url} → Network Error`, 'error')
      }
    }

    console.error('BatchPayroll: 3 of 6 payments failed — manual review required')
    addLog('Batch complete — 3 failures detected. Check technical details in the reporter.', 'warn')
    setRunning(false)
  }

  async function triggerGatewayTimeout() {
    addLog('Calling bank gateway…', 'info')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/bank/transfer/initiate')
    xhr.timeout = 800
    xhr.ontimeout = () => { addLog('XHR timed out: /api/bank/transfer/initiate', 'error'); console.error('BankGateway: XHR timeout after 800ms') }
    xhr.onerror  = () =>  addLog('XHR network error: /api/bank/transfer/initiate', 'error')
    xhr.send(JSON.stringify({ amount: 185000, currency: 'LKR' }))
  }

  function triggerConsoleErrors() {
    console.error('PayrollCalculator: NullPointerException — employee.bankAccount is null (EMP-003)')
    console.error('TaxService: Rate lookup failed for bracket 0.24 — DB connection lost')
    console.warn('AuditLog: Failed to write payroll audit record — retrying (attempt 2/3)')
    addLog('Console errors fired — open Technical Details to see them.', 'warn')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll Management</h1>
          <p className="page-sub">September 2026 · Run ID: PR-20260901</p>
        </div>
        <div className="payroll-header-actions">
          <button className="pr-btn pr-btn-secondary" onClick={triggerGatewayTimeout}>
            💳 Bank Gateway (XHR)
          </button>
          <button className="pr-btn pr-btn-secondary" onClick={triggerConsoleErrors}>
            🖥 Fire Console Errors
          </button>
          <button className="pr-btn pr-btn-danger" onClick={runBatchPayroll} disabled={running}>
            {running ? '⏳ Running…' : '▶ Run Batch Payroll'}
          </button>
        </div>
      </div>

      <div className="payroll-stats">
        {[
          { label: 'Total Employees', value: '6',        color: '#6366f1' },
          { label: 'Paid',            value: '4',        color: '#16a34a' },
          { label: 'Pending',         value: '1',        color: '#d97706' },
          { label: 'Failed',          value: '1',        color: '#dc2626' },
          { label: 'Total Disbursed', value: 'LKR 660K', color: '#0ea5e9' },
        ].map(s => (
          <div key={s.label} className="pr-stat-card">
            <div className="pr-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="pr-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="payroll-grid">
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Salary (LKR)</th>
                <th>Status</th>
                <th>Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {PAYROLL_DATA.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="pr-emp-name">{row.name}</div>
                    <div className="pr-emp-id">{row.id}</div>
                  </td>
                  <td>{row.dept}</td>
                  <td>{row.salary.toLocaleString()}</td>
                  <td>
                    <span className="pr-badge" style={STATUS_STYLE[row.status]}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pr-log-panel">
          <div className="pr-log-title">⚡ Live Action Log</div>
          <div className="pr-hint">
            Use the buttons above to trigger API failures and console errors, then open the widget
            and check <strong>Technical Details</strong> — errors will be grouped by this page.
          </div>
          {log.length === 0
            ? <div className="pr-log-empty">No actions yet</div>
            : log.map((l, i) => (
                <div key={i} className={'pr-log-item pr-log-' + l.type}>
                  <span className="pr-log-ts">{l.ts}</span>
                  <span>{l.msg}</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}
