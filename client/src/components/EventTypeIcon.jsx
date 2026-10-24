import { CalendarDays, Landmark, PartyPopper, Pin, Users } from 'lucide-react';

// One drawn icon per kind of calendar entry (replaces the old emoji).
const ICONS = {
  MEETING: Users,
  SESSION: Landmark,
  ACTIVITY: PartyPopper,
  APPOINTMENT: Pin,
};

export default function EventTypeIcon({ type, size = 16, className = '' }) {
  const Icon = ICONS[type] || CalendarDays;
  return <Icon size={size} strokeWidth={1.75} className={`shrink-0 ${className}`} aria-hidden="true" />;
}
