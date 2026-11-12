import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarClock,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Flag,
  Mail,
  Target,
  TrendingUp,
} from 'lucide-react';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';

// Drawn icon and tint per alert type (replaces the old emoji).
const TYPE_STYLE = {
  PROGRESS_50: { Icon: Target, tone: 'bg-brand-50', color: 'text-brand-700' },
  PROGRESS_75: { Icon: TrendingUp, tone: 'bg-brand-50', color: 'text-brand-700' },
  PROGRESS_90: { Icon: Flag, tone: 'bg-green-50', color: 'text-green-700' },
  ENDING_3D: { Icon: CalendarClock, tone: 'bg-amber-50', color: 'text-amber-700' },
  ENDING_1D: { Icon: CalendarClock, tone: 'bg-amber-100', color: 'text-amber-800' },
  // Calendar reminders
  EVENT_1D: { Icon: CalendarClock, tone: 'bg-brand-50', color: 'text-brand-700' },
  EVENT_1H: { Icon: CalendarClock, tone: 'bg-brand-100', color: 'text-brand-800' },
  // Project Requests: submitted (to the chairman), approved or rejected (to the SK Admin)
  REQUEST_SUBMITTED: { Icon: ClipboardCheck, tone: 'bg-amber-50', color: 'text-amber-800' },
  REQUEST_APPROVED: { Icon: CircleCheck, tone: 'bg-green-50', color: 'text-green-700' },
  REQUEST_REJECTED: { Icon: CircleX, tone: 'bg-red-50', color: 'text-red-700' },
};

function timeAgo(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

// Bell with an unread badge and a dropdown list. Alerts: progress milestones
// (50%, 75%, 90%), projects that are about to end, and calendar events starting soon.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 60 * 1000, // check again every minute
  });
  const notifications = data?.notifications || [];
  const unread = data?.unread || 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readMutation = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const readAllMutation = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

  function openNotification(n) {
    if (!n.read) readMutation.mutate(n.id);
    setOpen(false);
    if (n.event) {
      if (user?.role !== 'CHAIRMAN') navigate(`/admin/meetings/${n.event.id}`);
    } else if (n.project) navigate(`/admin/projects/${n.project.id}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={22} strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[13px] font-medium leading-none text-white ring-2 ring-paper">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 top-[76px] z-40 rounded-card border border-slate-200 bg-panel shadow-cardHover sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="section-title">
                Notifications
              </p>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                  onClick={() => readAllMutation.mutate()}
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto sm:max-h-96">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-600">
                  No notifications yet. You will be alerted about Project Requests, meetings coming up,
                  and projects about to end.
                </p>
              ) : (
                notifications.map((n) => {
                  const style = TYPE_STYLE[n.type] || {
                    Icon: Bell,
                    tone: 'bg-slate-50',
                    color: 'text-slate-600',
                  };
                  return (
                    <button
                      type="button"
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                        n.read ? '' : style.tone
                      }`}
                    >
                      <style.Icon
                        size={20}
                        strokeWidth={1.75}
                        className={`mt-0.5 shrink-0 ${style.color}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[15px] ${
                            n.read ? 'text-slate-600' : 'font-semibold text-slate-900'
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.read && (
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {/* Alerts are emailed automatically to the account's registered email */}
            {user?.email && (
              <p className="flex items-start gap-2 border-t border-dashed border-line px-4 py-3 text-[13px] text-slate-600">
                <Mail size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />
                <span>
                  Alerts are also emailed to <span className="font-medium text-ink">{user.email}</span>.
                </span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
