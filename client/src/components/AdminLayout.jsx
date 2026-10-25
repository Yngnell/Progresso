import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Newspaper,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../api/projects';
import NotificationBell from './NotificationBell';

// `roles` limits a link to those roles; omit it to show the link to everyone
// who can open the admin panel.
const groups = [
  {
    label: 'Work',
    links: [
      { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
      { to: '/admin/projects', label: 'Projects', Icon: FolderKanban },
      // The chairman approves; the admin only follows the status of their proposals.
      {
        to: '/admin/proposals',
        label: 'Approvals',
        labelFor: { ADMIN: 'Proposals' },
        Icon: ClipboardCheck,
        badge: true,
        firstFor: ['CHAIRMAN'],
      },
      { to: '/admin/calendar', label: 'Calendar', Icon: CalendarDays },
      { to: '/admin/attendance', label: 'Attendance', Icon: ListChecks },
    ],
  },
  {
    label: 'Records',
    links: [
      { to: '/admin/archive', label: 'Archive', Icon: Archive },
      { to: '/admin/officials', label: 'Officials', Icon: Users, roles: ['ADMIN'] },
      { to: '/admin/news', label: 'News & Updates', Icon: Newspaper, roles: ['ADMIN'] },
    ],
  },
];

const ROLE_LABEL = { ADMIN: 'SK Admin', CHAIRMAN: 'Barangay Chairman' };

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

  // Each role sees only its own links, under the name that fits what it can do there.
  // A link marked `firstFor` a role moves to the top of its group for that role.
  const role = user?.role;
  const links = groups
    .map((g) => {
      const visible = g.links
        .filter((l) => !l.roles || l.roles.includes(role))
        .map((l) => ({ ...l, label: l.labelFor?.[role] || l.label }));
      const first = visible.filter((l) => l.firstFor?.includes(role));
      return { ...g, links: [...first, ...visible.filter((l) => !first.includes(l))] };
    })
    .filter((g) => g.links.length > 0);

  // Items that need the current user's action: pending proposals for the
  // chairman, returned proposals for the admin.
  const { data: proposalData } = useQuery({
    queryKey: ['projects', 'proposals'],
    queryFn: () => projectsApi.list({ status: 'PROPOSED' }),
  });
  const isChairman = user?.role === 'CHAIRMAN';
  const actionState = isChairman ? 'PENDING' : 'RETURNED';
  const { data: deletionData } = useQuery({
    queryKey: ['deletion-requests', 'pending'],
    queryFn: () => projectsApi.deletionRequests({ status: 'PENDING' }),
    enabled: isChairman,
  });
  // Chairman also decides deletion requests; admin only needs to act on returns.
  const pendingCount =
    (proposalData?.projects || []).filter((p) => p.approvalState === actionState).length +
    (isChairman ? (deletionData?.requests || []).length : 0);

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
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-600">{ROLE_LABEL[user?.role] || user?.role}</p>
            </div>
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
