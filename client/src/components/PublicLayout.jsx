import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

const publicLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/news', label: 'News & Updates' },
  { to: '/projects', label: 'Projects' },
  { to: '/officials', label: 'Officials' },
  { to: '/events', label: 'Events' },
];

// The seal and the SK's name, used in the header and the footer.
function Nameplate({ light = false }) {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/logo.jpg"
        alt="Sangguniang Kabataan Salinas 1 seal"
        className="h-11 w-11 rounded-full bg-white object-cover"
      />
      <span className="leading-tight">
        <span
          className={`seal-type block text-xl ${light ? 'text-white' : 'text-slate-900'}`}
        >
          SK Salinas 1
        </span>
        <span className={`block text-xs font-medium ${light ? 'text-brand-200' : 'text-slate-500'}`}>
          Project Monitoring
        </span>
      </span>
    </span>
  );
}

// Only SK staff and the Barangay Chairman have a dashboard; residents (viewers) do not.
const STAFF = ['ADMIN', 'CHAIRMAN'];

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const isStaff = STAFF.includes(user?.role);
  const firstName = (user?.name || '').split(' ')[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" onClick={closeMenu} aria-label="SK Salinas 1 home">
            <Nameplate />
          </Link>

          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="Main">
            {publicLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex items-center border-b-[3px] px-3 text-[15px] font-semibold transition-colors ${
                    isActive
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  {isStaff ? (
                    <Link
                      to="/admin"
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <span className="px-2 text-sm font-semibold text-slate-700">Hi, {firstName}</span>
                  )}
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

            <button
              type="button"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X size={24} strokeWidth={1.75} /> : <Menu size={24} strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {/* Phone menu */}
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2" aria-label="Main">
              {publicLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-3 text-base font-semibold ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <div className="mt-2 flex gap-2 border-t border-slate-100 py-3">
                {user ? (
                  <>
                    {isStaff ? (
                      <Link to="/admin" onClick={closeMenu} className="flex-1">
                        <Button variant="secondary" className="w-full">
                          Dashboard
                        </Button>
                      </Link>
                    ) : (
                      <span className="flex flex-1 items-center text-base font-semibold text-slate-700">
                        Hi, {firstName}
                      </span>
                    )}
                    <Button variant="ghost" className="flex-1" onClick={logout}>
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={closeMenu} className="flex-1">
                      <Button variant="secondary" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link to="/register" onClick={closeMenu} className="flex-1">
                      <Button variant="accent" className="w-full">
                        Register
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-brand-900">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <Nameplate light />
            <div className="text-sm text-brand-200">
              <p className="font-semibold text-white">Barangay SK Project Monitoring System</p>
              <p className="mt-1">Sangguniang Kabataan — transparency for our community.</p>
            </div>
          </div>
          <p className="mt-8 border-t border-white/15 pt-5 text-xs text-brand-300">
            © {new Date().getFullYear()} Sangguniang Kabataan, Barangay Salinas 1, City of Bacoor.
            All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
