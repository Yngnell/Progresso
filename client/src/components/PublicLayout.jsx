import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

const publicLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/officials', label: 'SK Officials' },
];

// The seal and the SK's name, used in the header and the footer.
function Nameplate() {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/logo.jpg"
        alt="Sangguniang Kabataan Salinas 1 seal"
        className="h-10 w-10 rounded-full border border-line bg-white object-cover"
      />
      <span className="leading-tight">
        <span
          className="block font-display text-lg text-ink"
        >
          SK Salinas 1
        </span>
        <span className="block text-[13px] text-slate-600">
          Project Monitoring
        </span>
      </span>
    </span>
  );
}

// Only SK staff and the Barangay Chairman have a dashboard; residents (viewers) do not.
const STAFF = ['ADMIN', 'CHAIRMAN', 'OFFICIAL'];

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const isStaff = STAFF.includes(user?.role);
  const firstName = (user?.name || '').split(' ')[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 border-b border-line bg-panel">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-8">
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
                  `flex items-center border-b-[3px] px-3 text-[15px] transition-colors ${
                    isActive
                      ? 'border-pine font-medium text-pine'
                      : 'border-transparent text-slate-700 hover:text-pine'
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
                      className="rounded-control px-3 py-2 text-sm font-medium text-pine hover:bg-pine-light"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      {user.canShowQr && (
                        <Link
                          to="/attendance-qr"
                          className="rounded-control px-3 py-2 text-sm font-medium text-pine hover:bg-pine-light"
                        >
                          Attendance QR
                        </Link>
                      )}
                      <Link
                        to="/account"
                        className="rounded-control px-3 py-2 text-sm font-medium text-slate-700 hover:bg-pine-light"
                      >
                        Hi, {firstName}
                      </Link>
                    </>
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
              className="rounded-control p-2 text-slate-700 hover:bg-pine-light hover:text-pine md:hidden"
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
          <div className="border-t border-line bg-panel md:hidden">
            <nav className="mx-auto flex max-w-content flex-col px-4 py-2" aria-label="Main">
              {publicLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `rounded-control px-3 py-3 text-base ${
                      isActive ? 'bg-pine-light font-medium text-pine' : 'text-slate-700'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              {user?.canShowQr && (
                <NavLink
                  to="/attendance-qr"
                  onClick={closeMenu}
                  className="rounded-control px-3 py-3 text-base font-medium text-pine"
                >
                  Attendance QR
                </NavLink>
              )}
              <div className="mt-2 flex gap-2 border-t border-dashed border-line py-3">
                {user ? (
                  <>
                    {isStaff ? (
                      <Link to="/admin" onClick={closeMenu} className="flex-1">
                        <Button variant="secondary" className="w-full">
                          Dashboard
                        </Button>
                      </Link>
                    ) : (
                      <Link to="/account" onClick={closeMenu} className="flex flex-1 items-center text-base font-medium text-slate-700">
                        Hi, {firstName}
                      </Link>
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
      <footer className="border-t border-line bg-panel">
        <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <Nameplate />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-ink">Barangay SK Project Monitoring System</p>
              <p className="mt-1">Sangguniang Kabataan — transparency for our community.</p>
            </div>
          </div>
          <p className="mt-8 border-t border-dashed border-line pt-5 text-[13px] text-slate-600">
            © {new Date().getFullYear()} Sangguniang Kabataan, Barangay Salinas 1, City of Bacoor.
            All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
