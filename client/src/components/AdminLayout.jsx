import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  UserRound,
  Archive,
  CalendarDays,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../api/projects';
import NotificationBell from './NotificationBell';
import { accessRole, roleLabel } from '../utils/roles';
import { accountApi } from '../api/account';

// `roles` limits a link to those roles; omit it to show the link to everyone
// who can open the admin panel.
const groups = [
  {
    label: 'Work',
    links: [
      { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
      // The badge counts what waits for the Barangay Chairman's decision.
      { to: '/admin/projects', label: 'Projects', Icon: FolderKanban, badge: true },
      { to: '/admin/calendar', label: 'Calendar', Icon: CalendarDays },
      { to: '/admin/attendance', label: 'Attendance', Icon: ListChecks },
    ],
  },
  {
    label: 'Records',
    links: [
      // Completed, cancelled and deleted projects (view only)
      { to: '/admin/archive', label: 'Archives', Icon: Archive },
      { to: '/admin/officials', label: 'Officials', Icon: Users, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Account',
    links: [{ to: '/admin/settings', label: 'Settings', Icon: SettingsIcon }],
  },
];


// The seal and the SK's name at the top of the rail.
function Nameplate() {
  return (
    <Link to="/admin" className="flex items-center gap-3" aria-label="Dashboard">
      <img
        src="/logo.jpg"
        alt="Sangguniang Kabataan Salinas 1 seal"
        className="h-11 w-11 rounded-full bg-white object-cover"
      />
      <span className="leading-tight">
        <span className="seal-type block text-xl text-white">SK Salinas 1</span>
        <span className="block text-xs font-medium text-brand-200">Project Monitoring</span>
      </span>
    </Link>
  );
}

// The menu itself, shared by the desktop rail and the phone drawer.
function Menu_({ links, pendingCount, onNavigate }) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin">
      {links.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                      isActive
                        ? 'bg-white text-brand-900'
                        : 'text-brand-100 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <l.Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                  <span className="flex-1">{l.label}</span>
                  {l.badge && pendingCount > 0 && (
                    <span className="rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-ink">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // A new page closes the phone menu.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Each role sees only its own links.
  const role = accessRole(user); // an SK official sees what the admin sees
  const links = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.roles || l.roles.includes(role)) }))
    .filter((g) => g.links.length > 0);

  // What waits for the Barangay Chairman: proposals to approve or reject, and
  // deletion requests. Only the chairman sees the count.
  const isChairman = user?.role === 'CHAIRMAN';
  const { data: proposalData } = useQuery({
    queryKey: ['projects', 'proposals'],
    queryFn: () => projectsApi.list({ status: 'PROPOSED' }),
    enabled: isChairman,
  });
  const { data: deletionData } = useQuery({
    queryKey: ['deletion-requests', 'pending'],
    queryFn: () => projectsApi.deletionRequests({ status: 'PENDING' }),
    enabled: isChairman,
  });
  const pendingCount = isChairman
    ? (proposalData?.projects || []).length + (deletionData?.requests || []).length
    : 0;

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const footer = (
    <div className="border-t border-white/10 p-4">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-brand-200 hover:text-white"
      >
        <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
        View public site
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-700"
      >
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-brand-900 lg:flex">
        <div className="flex h-[68px] items-center px-5">
          <Nameplate />
        </div>
        <Menu_ links={links} pendingCount={pendingCount} />
        {footer}
      </aside>

      {/* Phone drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-brand-900 shadow-cardHover">
            <div className="flex h-[68px] items-center justify-between px-5">
              <Nameplate />
              <button
                type="button"
                className="rounded-lg p-2 text-brand-100 hover:bg-white/10"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={22} strokeWidth={1.75} />
              </button>
            </div>
            <Menu_ links={links} pendingCount={pendingCount} onNavigate={() => setDrawerOpen(false)} />
            {footer}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="-ml-1 rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} strokeWidth={1.75} />
          </button>
          <p className="text-[15px] font-medium text-slate-600">{today}</p>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <NotificationBell />
            <Link
              to="/admin/settings"
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left leading-tight hover:bg-slate-100 sm:px-2"
              title="Settings"
            >
              {accountApi.photoUrl(user) ? (
                <img
                  src={accountApi.photoUrl(user)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                  aria-hidden="true"
                >
                  <UserRound size={20} strokeWidth={1.75} />
                </span>
              )}
              <span className="hidden sm:block">
                <span className="block text-sm font-semibold text-slate-900">{user?.displayName || user?.name}</span>
                <span className="block text-xs text-slate-600">{roleLabel(user)}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              aria-label="Log out"
            >
              <LogOut size={19} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
