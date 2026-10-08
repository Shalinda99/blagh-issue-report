import Sidebar from './Sidebar.jsx';
import './Layout.css';

export default function Layout({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <main className="layout-main">{children}</main>
    </div>
  );
}
