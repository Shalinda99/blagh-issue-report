import { useEffect, useState } from 'react';
import { getProjects, createProject, updateProject } from '../api/projects.js';
import './Projects.css';

function Modal({ onClose, onSave }) {
  const [appId, setAppId]   = useState('');
  const [name,  setName]    = useState('');
  const [url,   setUrl]     = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ app_id: appId, name, origin_url: url || undefined });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>Register New Project</h2>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>App ID <span className="req">*</span></label>
            <input
              value={appId}
              onChange={e => setAppId(e.target.value)}
              placeholder="my-app-id  (lowercase, hyphens ok)"
              required
              pattern="[a-z0-9_-]+"
            />
            <small>Must be unique. This is the <code>data-project-id</code> in your widget tag.</small>
          </div>
          <div className="form-group">
            <label>Display Name <span className="req">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Application"
              required
            />
          </div>
          <div className="form-group">
            <label>Origin URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://myapp.example.com"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [showModal, setShowModal] = useState(false);

  function load() {
    setLoading(true);
    getProjects()
      .then(data => setProjects(data ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(data) {
    await createProject(data);
    load();
  }

  async function toggleActive(project) {
    try {
      await updateProject(project.app_id, { is_active: !project.is_active });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Register Project
        </button>
      </div>

      {error && <div className="error-banner" style={{marginBottom:16}}>{error}</div>}

      <div className="card">
        {loading ? (
          <div className="loading">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div style={{fontSize:32, marginBottom:8}}>📁</div>
            <p>No projects registered yet.</p>
            <p style={{marginTop:4, fontSize:13}}>
              Register a project and embed the widget with its <code>data-project-id</code>.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Name</th>
                <th>Origin URL</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id}>
                  <td><code className="project-chip">{p.app_id}</code></td>
                  <td style={{fontWeight:600}}>{p.name}</td>
                  <td>
                    {p.origin_url
                      ? <a href={p.origin_url} target="_blank" rel="noreferrer" className="url-link">{p.origin_url}</a>
                      : <span style={{color:'var(--muted)'}}>—</span>}
                  </td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-resolved' : 'badge-closed'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="date-cell">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      className={`btn-ghost toggle-btn${p.is_active ? ' deactivate' : ''}`}
                      onClick={() => toggleActive(p)}
                    >
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{marginTop:20}}>
        <h3 style={{marginBottom:12}}>Widget Integration Snippet</h3>
        <p style={{color:'var(--muted)', fontSize:13, marginBottom:12}}>
          Add this to your application's <code>index.html</code>. Replace <code>YOUR-APP-ID</code> with your project's App ID.
        </p>
        <pre className="code-snippet">{`<script
  src="https://your-cdn.example.com/blagh.js"
  data-project-id="YOUR-APP-ID"
  data-api-url="http://localhost:8002"
  data-theme="#1d4ed8"
  data-label="Report Issue"
  defer>
</script>`}</pre>
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} onSave={handleCreate} />
      )}
    </div>
  );
}
