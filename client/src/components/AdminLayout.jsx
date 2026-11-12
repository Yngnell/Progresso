import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../api/projects';
import NotificationBell from './NotificationBell';
import ConfirmDialog from './ConfirmDialog';
import { accessRole, isAdmin, roleLabel } from '../utils/roles';

// `roles` limits a link to those roles; omit it to show the link to everyone
// who can open the admin panel.
const groups = [
  {
    label: 'Work',
    links: [
      { to: '/admin', label: 'Dashboard', Icon: LayoutDashboard, end: true },
      // For the Barangay Chairman: view only; the badge counts deletion requests to decide.
      { to: '/admin/projects', label: 'Projects', Icon: FolderKanban, badge: 'deletions' },
      // The Barangay Chairman's Project Requests to approve or reject (badge: how many).
      { to: '/admin/approvals', label: 'Approvals', Icon: ClipboardCheck, badge: 'proposals', roles: ['CHAIRMAN'] },
      { to: '/admin/meetings', label: 'Meetings', Icon: CalendarDays, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Reports',
    links: [
      // Completed, cancelled and deleted projects (view only)
      { to: '/admin/archive', label: 'Archives', Icon: Archive },
      { to: '/admin/attendance', label: 'Attendance', Icon: ListChecks, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Account',
    links: [{ to: '/admin/settings', label: 'Settings', Icon: SettingsIcon }],
  },
];


// The seal and the SK's name at the top of the sidebar.
function Nameplate() {
  return (
    <Link to="/admin" className="flex items-center gap-3 rounded-control" aria-label="Dashboard">
      <img
        src="/logo.jpg"
        alt="Sangguniang Kabataan Salinas 1 seal"
        className="h-10 w-10 rounded-full border border-line bg-white object-cover"
      />
      <span className="leading-tight">
        <span className="block font-display text-lg text-ink">SK Salinas 1</span>
        <span className="block text-[13px] text-slate-600">Project Monitoring</span>
      </span>
    </Link>
  );
}

// The menu itself, shared by the desktop sidebar and the phone drawer. Each group is a
// planner tab label; the active page gets a pine-light row with a pine bar on its left edge.
function Menu_({ links, counts, onNavigate }) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin">
      {links.map((group) => (
        <div key={group.label}>
          <p className="section-label px-3 pb-2">{group.label}</p>
          <ul className="space-y-0.5">
            {group.links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-control px-3 py-2 text-[15px] transition-colors ${
                      isActive
                        ? 'bg-pine-light font-medium text-pine before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-pine'
                        : 'text-slate-700 hover:bg-pine-light/60 hover:text-pine'
                    }`
                  }
                >
                  <l.Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className="flex-1">{l.label}</span>
                  {l.badge && counts[l.badge] > 0 && (
                    <span className="rounded-full bg-clay px-2 py-px text-[13px] font-medium leading-5 text-white">
                      {counts[l.badge]}
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

// The name of the page in the top bar: the menu entry the address belongs to.
function currentTitle(links, pathname) {
  let best = null;
  links.forEach((g) =>
    g.links.forEach((l) => {
      const hit = l.end ? pathname === l.to : pathname === l.to || pathname.startsWith(`${l.to}/`);
      if (hit && (!best || l.to.length > best.to.length)) best = l;
    })
  );
  return best ? best.label : 'Dashboard';
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const location = useLocation();

  // A new page closes the phone menu.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Each role sees only its own links.
  const role = accessRole(user); // an SK official sees what the admin sees
  const links = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.roles || l.roles.includes(role)) }))
    .filter((g) => g.links.length > 0);

  // What waits for the Barangay Chairman: proposals to approve or reject (Approvals), and
  // deletion requests (Projects). Only the chairman sees the counts.
  const isChairman = user?.role === 'CHAIRMAN';
  const { data: proposalData } = useQuery({
    queryKey: ['projects', 'proposals'],
    // Requests the SK Admin submitted and the chairman has not decided yet
    queryFn: () => projectsApi.list({ status: 'PENDING_APPROVAL', submitted: 'true' }),
    enabled: isChairman,
  });
  const { data: deletionData } = useQuery({
    queryKey: ['deletion-requests', 'pending'],
    queryFn: () => projectsApi.deletionRequests({ status: 'PENDING' }),
    enabled: isChairman,
  });
  const counts = isChairman
    ? { proposals: (proposalData?.projects || []).length, deletions: (deletionData?.requests || []).length }
    : {};

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const title = currentTitle(links, location.pathname);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-panel focus:px-4 focus:py-2 focus:font-medium focus:text-pine"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (240px) */}
      <aside className="sticky top-0 hidden h-screen w-sidebar shrink-0 flex-col border-r border-line bg-panel nav:flex">
        <div className="card-head flex h-16 items-center px-5">
          <Nameplate />
        </div>
        <Menu_ links={links} counts={counts} />
        <p className="border-t border-line px-5 py-3 text-[13px] text-slate-600">{today}</p>
      </aside>

      {/* Phone drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 nav:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-panel">
            <div className="card-head flex h-16 items-center justify-between px-5">
              <Nameplate />
              <button
                type="button"
                className="rounded-control p-2 text-slate-700 hover:bg-pine-light hover:text-pine"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={22} strokeWidth={1.75} />
              </button>
            </div>
            <Menu_ links={links} counts={counts} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper px-4 sm:px-8">
          <button
            type="button"
            className="-ml-1 rounded-control p-2 text-slate-700 hover:bg-pine-light hover:text-pine nav:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <p className="truncate font-display text-xl text-ink">{title}</p>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <NotificationBell />
            <Link
              to="/admin/settings"
              className="hidden rounded-control px-2 py-1 text-right leading-tight hover:bg-pine-light sm:block"
              title="Settings"
            >
              <span className="block text-sm font-medium text-ink">{user?.displayName || user?.name}</span>
              <span className="block text-[13px] text-slate-600">{roleLabel(user)}</span>
            </Link>
            <button
              type="button"
              // The admin confirms first; the other accounts log out at once.
              onClick={() => (isAdmin(user) ? setConfirmLogout(true) : logout())}
              className="inline-flex items-center gap-2 rounded-control px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-pine-light hover:text-pine"
              aria-label="Log out"
            >
              <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-content flex-1 px-4 py-6 sm:p-8">
          <Outlet />
        </main>
        <ConfirmDialog
          open={confirmLogout}
          title="Log out"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      </div>
    </div>
  );
}
