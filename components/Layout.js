import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export default function Layout({ title, active, username, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    router.push('/login');
  }

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-text">License Admin</span>
        </div>
        <nav className="side-nav">
          <Link href="/dashboard" className={active === 'dashboard' ? 'active' : ''}>
            <span className="nav-icon">▦</span>
            <span>Dashboard</span>
          </Link>
          <Link href="/licenses" className={active === 'keys' ? 'active' : ''}>
            <span className="nav-icon">🔑</span>
            <span>Licenses</span>
          </Link>
          <Link href="/trials" className={active === 'trials' ? 'active' : ''}>
            <span className="nav-icon">⏱</span>
            <span>Trials</span>
          </Link>
          <Link href="/settings" className={active === 'settings' ? 'active' : ''}>
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </Link>
        </nav>
        <div className="sidebar-footer">
          <a
            href="#"
            className="logout-link"
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
          >
            ⎋ Log out
          </a>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">
            ☰
          </button>
          <h1>{title}</h1>
          <div className="topbar-spacer"></div>
          <ThemeToggle />
          <span className="admin-chip">👤 {username}</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
