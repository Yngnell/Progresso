import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

const publicLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/news', label: 'News & Updates' },
  { to: '/projects', label: 'Projects' },
  { to: '/officials', label: 'Officials' },
];

export default function PublicLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
              SK
            </div>
            <span className="text-lg font-bold text-slate-800">SK Monitoring</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {publicLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/admin"
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:block"
                >
                  Dashboard
                </Link>
                <Button variant="secondary" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="accent" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-slate-700">Barangay SK Project Monitoring System</p>
              <p className="mt-1">Sangguniang Kabataan — transparency for our community.</p>
            </div>
            <p>© {new Date().getFullYear()} Barangay SK. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
