import { ANNOUNCEMENTS } from '../data/mockData'
import './Dashboard.css'

const PRIORITY_LABEL = { high: 'Urgent', medium: 'Notice', low: 'Info' }
const PRIORITY_COLOR = { high: 'danger', medium: 'warn', low: 'success' }

export default function Announcements() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-sub">{ANNOUNCEMENTS.length} active announcements</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ANNOUNCEMENTS.map(a => (
          <div key={a.id} className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={'badge badge-' + PRIORITY_COLOR[a.priority]}>
                  {PRIORITY_LABEL[a.priority]}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.date}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{a.title}</h3>
              <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{a.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
