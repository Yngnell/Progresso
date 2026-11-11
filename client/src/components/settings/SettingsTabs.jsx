import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProfileTab from './ProfileTab';
import SecurityTab from './SecurityTab';
import SystemTab from './SystemTab';

// The Settings page body: Profile and Security for everyone signed in, System for the SK
// Chairperson. The open tab is kept in the address (?tab=security) so it survives a reload.
export default function SettingsTabs() {
  const { user, refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();

  // Fresh copy of the account (last login, a waiting email change, the position).
  useEffect(() => {
    refreshUser().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    { id: 'profile', label: 'Profile', Icon: UserRound },
    { id: 'security', label: 'Security', Icon: ShieldCheck },
    ...(user?.role === 'ADMIN' ? [{ id: 'system', label: 'System', Icon: Settings2 }] : []),
  ];
  const wanted = params.get('tab');
  const [active, setActive] = useState(tabs.some((t) => t.id === wanted) ? wanted : 'profile');
  const current = tabs.some((t) => t.id === active) ? active : 'profile';

  function open(id) {
    setActive(id);
    setParams(id === 'profile' ? {} : { tab: id }, { replace: true });
  }

  function onKeyDown(e) {
    const i = tabs.findIndex((t) => t.id === current);
    if (e.key === 'ArrowRight') open(tabs[(i + 1) % tabs.length].id);
    if (e.key === 'ArrowLeft') open(tabs[(i - 1 + tabs.length) % tabs.length].id);
  }

  return (
    <div>
      <div role="tablist" aria-label="Settings" className="flex gap-1 border-b border-slate-200" onKeyDown={onKeyDown}>
        {tabs.map(({ id, label, Icon }) => {
          const selected = id === current;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => open(id)}
              className={`-mb-px inline-flex items-center gap-2 border-b-[3px] px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                selected
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      <div id={`panel-${current}`} role="tabpanel" aria-labelledby={`tab-${current}`} className="mt-6">
        {current === 'profile' && <ProfileTab user={user} refreshUser={refreshUser} />}
        {current === 'security' && <SecurityTab user={user} />}
        {current === 'system' && user?.role === 'ADMIN' && <SystemTab />}
      </div>
    </div>
  );
}
