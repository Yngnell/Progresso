import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/projects', label: 'Projects', icon: '📁' },
  { to: '/admin/calendar', label: 'Calendar', icon: '📅' },
  { to: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { to: '/admin/officials', label: 'Officials', icon: '👥' },
  { to: '/admin/news', label: 'News & Updates', icon: '📰' },
  { to: '/admin/viewers', label: 'Public Viewers', icon: '🙋' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col bg-brand-900 lg:flex">
        <div className="flex h-16 items-center gap-2 px-6 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-bold">
            SK
          </div>
          <span className="text-lg font-bold">SK Monitoring</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {adminLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                }`
              }
            >
              <span aria-hidden="true">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-brand-800 p-4">
          <Link to="/" className="text-xs text-brand-200 hover:text-white">
            ← View public site
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <span className="text-sm text-slate-500 lg:hidden">SK Monitoring — Admin</span>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          {adminLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-600'
                }`
              }
            >
              {l.icon} {l.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
