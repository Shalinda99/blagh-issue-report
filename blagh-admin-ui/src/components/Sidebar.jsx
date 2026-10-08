import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Sidebar.css';

const NAV = [
  { to: '/',         label: 'Dashboard',  icon: '📊' },
  { to: '/reports',  label: 'Reports',    icon: '🐛' },
  { to: '/projects', label: 'Projects',   icon: '📁' },
];

export default function Sidebar() {
  const { logout, userInfo } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const displayName  = userInfo?.name || userInfo?.preferred_username || '';
  const displayEmail = userInfo?.email || '';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">🛡️</span>
        <div>
          <div className="sidebar-name">Blagh</div>
          <div className="sidebar-role">Admin Panel</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {(displayName || displayEmail) && (
          <div className="sidebar-user-block">
            <div className="sidebar-user-avatar">
              {(displayName || displayEmail).substring(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-user-meta">
              {displayName && <div className="sidebar-user-display-name">{displayName}</div>}
              {displayEmail && <div className="sidebar-user-display-email">{displayEmail}</div>}
            </div>
          </div>
        )}
        <button className="sidebar-logout" onClick={handleLogout}>
          <span>↩</span> Logout
        </button>
      </div>
    </aside>
  );
}
