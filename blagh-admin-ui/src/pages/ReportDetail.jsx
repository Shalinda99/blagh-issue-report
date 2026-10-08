import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getReport, updateReportStatus } from '../api/reports.js';
import StatusBadge from '../components/StatusBadge.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import './ReportDetail.css';

const STATUS_FLOW = ['open', 'in_progress', 'resolved', 'closed'];

function groupFailedApiCalls(calls = []) {
  const groups = new Map();
  for (const call of calls) {
    const key = `${call.method}|${call.url}|${call.status_code}|${call.status_text || ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { ...call, count: 1 });
    }
  }
  return Array.from(groups.values());
}

function Section({ title, children }) {
  return (
    <div className="detail-section">
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="detail-field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

export default function ReportDetail() {
  const { refId }      = useParams();
  const navigate       = useNavigate();
  const [report, setReport]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [updating, setUpdating]       = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    getReport(refId)
      .then(data => {
        setReport(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refId]);

  async function handleStatusChange(newStatus) {
    setUpdating(true);
    try {
      const updated = await updateReportStatus(refId, newStatus);
      setReport(prev => ({ ...prev, status: updated.status }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <div className="loading" style={{padding:60}}>Loading report…</div>;
  if (error)   return <div className="error-banner" style={{margin:32}}>{error}</div>;
  if (!report) return null;

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(report.status) + 1];

  return (
    <div className="report-detail">
      <div className="detail-topbar">
        <button className="btn-ghost back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="detail-badges">
          <StatusBadge status={report.status} />
          <PriorityBadge priority={report.priority} />
        </div>
        {nextStatus && (
          <button
            className="btn-primary"
            onClick={() => handleStatusChange(nextStatus)}
            disabled={updating}
          >
            {updating ? 'Updating…' : `Mark as ${nextStatus.replace('_', ' ')}`}
          </button>
        )}
      </div>

      <div className="detail-hero card">
        <div className="ref-tag">{report.ref_id}</div>
        <h1 className="report-title">{report.summary}</h1>
        <div className="report-meta">
          <span>Project: <code>{report.project_id}</code></span>
          {report.reported_at_utc && (
            <span>Reported: {new Date(report.reported_at_utc).toLocaleString()}</span>
          )}
          {report.timezone && <span>{report.timezone}</span>}
        </div>
        <div className="report-desc">{report.description}</div>
      </div>

      <div className="detail-grid">
        <div className="detail-left">
          <Section title="👤 Reporter">
            <Field label="Name"       value={report.user_name} />
            <Field label="Email"      value={report.user_email} />
            <Field label="Role"       value={report.user_role} />
            <Field label="User ID"    value={report.user_id} />
            <Field label="User Agent" value={report.user_agent} />
          </Section>

          <Section title="📍 Page Context">
            <Field label="URL"        value={report.page_url} />
            <Field label="Title"      value={report.page_title} />
            <Field label="Referrer"   value={report.referrer} />
            <Field label="Browser"    value={report.browser} />
            <Field label="OS"         value={report.os} />
            <Field label="Device"     value={report.device} />
            <Field label="Viewport"   value={report.viewport} />
            <Field label="Resolution" value={report.screen_resolution} />
          </Section>
        </div>

        <div className="detail-right">
          <Section title="🖥️ Console Errors & Warnings">
            {report.console_logs?.length === 0 ? (
              <p className="none-label">None captured</p>
            ) : (
              <div className="log-list">
                {report.console_logs.map(log => (
                  <div key={log.id} className={`log-entry log-${log.level}`}>
                    <div className="log-header">
                      <span className={`log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                      {log.source && (
                        <span className="log-source">
                          {log.source}{log.line_number ? `:${log.line_number}` : ''}
                        </span>
                      )}
                      {log.captured_at && (
                        <span className="log-time">
                          {new Date(log.captured_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <pre className="log-message">{log.message}</pre>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="🌐 Failed API Calls">
            {report.failed_api_calls?.length === 0 ? (
              <p className="none-label">None captured</p>
            ) : (
              <div className="api-list">
                {groupFailedApiCalls(report.failed_api_calls).map(call => (
                  <div key={call.id} className="api-entry">
                    <div className="api-header">
                      <span className="api-method">{call.method}</span>
                      <span className={`api-status ${call.status_code >= 500 ? 'status-5xx' : 'status-4xx'}`}>
                        {call.status_code}
                      </span>
                      {call.count > 1 && (
                        <span className="api-count" title={`This request failed ${call.count} times`}>
                          ×{call.count}
                        </span>
                      )}
                      {call.duration_ms != null && (
                        <span className="api-duration">{call.duration_ms}ms</span>
                      )}
                    </div>
                    <div className="api-url" title={call.url}>{call.url}</div>
                    {call.status_text && (
                      <div className="api-status-text">{call.status_text}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {report.screenshots?.length > 0 && (
        <div className="detail-section card screenshot-section">
          <h3 className="section-title">
            📷 Screenshots
            <span className="screenshot-count">{report.screenshots.length}</span>
          </h3>
          <div className="screenshot-grid">
            {report.screenshots.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer" title={`Screenshot ${i + 1} — click to open full size`}>
                <img
                  className="screenshot-img"
                  src={src}
                  alt={`Screenshot ${i + 1}`}
                />
              </a>
            ))}
          </div>
          <p className="screenshot-hint">Click any image to open full size</p>
        </div>
      )}

      {report.voice_recordings?.length > 0 && (
        <div className="detail-section card screenshot-section">
          <h3 className="section-title">
            🎤 Voice Recordings
            <span className="screenshot-count">{report.voice_recordings.length}</span>
          </h3>
          <div className="recording-list">
            {report.voice_recordings.map((src, i) => (
              <div key={i} className="recording-item">
                <span className="recording-label">Voice Recording {i + 1}</span>
                <audio controls src={src} className="recording-audio" />
              </div>
            ))}
          </div>
        </div>
      )}

      {report.video_recordings?.length > 0 && (
        <div className="detail-section card screenshot-section">
          <h3 className="section-title">
            🎬 Screen Recordings
            <span className="screenshot-count">{report.video_recordings.length}</span>
          </h3>
          <div className="recording-list">
            {report.video_recordings.map((src, i) => (
              <div key={i} className="recording-item">
                <span className="recording-label">Screen Recording {i + 1}</span>
                <video controls src={src} className="recording-video" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="status-actions card">
        <h3>Update Status</h3>
        <div className="status-btn-row">
          {STATUS_FLOW.map(s => (
            <button
              key={s}
              className={`status-btn${report.status === s ? ' current' : ''}`}
              onClick={() => report.status !== s && handleStatusChange(s)}
              disabled={updating || report.status === s}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
