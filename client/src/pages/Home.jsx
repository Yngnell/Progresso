import OfficialAvatar from '../components/OfficialAvatar';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { officialsApi } from '../api/officials';
import { eventsApi } from '../api/events';
import { projectsApi } from '../api/projects';
import { EVENT_TYPE, formatDateTime } from '../utils/format';
import { Button, Card, Badge } from '../components/ui';
import { StageSteps, StatusRibbon } from '../components/Roundel';
import EventTypeIcon from '../components/EventTypeIcon';

// Hero: the promise on the left, the proof on the right. The panel lists real
// projects with their stage, so a resident sees the system working at once.
function Hero({ projects, loading }) {
  return (
    <section className="bg-brand-900">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
        <div>
          {/* The seal leads the public face of the system */}
          <img
            src="/logo.jpg"
            alt="Sangguniang Kabataan Salinas 1 seal"
            className="mb-6 h-24 w-24 rounded-full bg-white object-cover shadow-cardHover sm:h-28 sm:w-28"
          />
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-wide text-white sm:text-6xl">
            Barangay SK Project Monitoring System
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-100">
            Transparency for our community. Track youth programs, projects, and announcements from
            your Sangguniang Kabataan — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/projects">
              <Button variant="accent" size="lg">
                View Projects
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="secondary" size="lg">
                Join as a Viewer
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-cardHover sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
              Happening now
            </h2>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              All projects <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No projects are running right now. Check the Projects page for what is planned.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="block rounded-lg py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-base font-bold text-slate-900">{p.title}</span>
                      <StatusRibbon status={p.status} />
                    </span>
                    <StageSteps status={p.status} showLabels={false} className="mt-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHead({ title, subtitle, to, linkLabel = 'View all' }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-slate-900">
          {title}
        </h2>
        <p className="mt-0.5 text-slate-600">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        {linkLabel} <ArrowRight size={16} strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function OfficialChip({ official }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <OfficialAvatar
        official={official}
        className="h-12 w-12 ring-2 ring-ink"
        letterClass="font-display text-xl font-bold text-brand-800"
      />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{official.name}</p>
        <p className="truncate text-sm text-slate-600">{official.position}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: officialsData } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });
  const { data: eventsData } = useQuery({
    queryKey: ['events', 'home'],
    queryFn: () => eventsApi.list({ upcoming: 'true' }),
  });
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'home'],
    queryFn: () => projectsApi.list({ status: 'ONGOING' }),
  });

  const officials = (officialsData?.officials || []).slice(0, 4);
  const upcomingEvents = (eventsData?.events || []).slice(0, 3);
  const ongoing = (projectsData?.projects || []).slice(0, 3);

  return (
    <div>
      <Hero projects={ongoing} loading={projectsLoading} />

      {/* Upcoming events */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHead
          title="Upcoming Events"
          subtitle="Meetings, sessions, and activities."
          to="/events"
        />
        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map((e) => {
              const t = EVENT_TYPE[e.type] || { label: e.type };
              const date = new Date(e.startAt);
              return (
                <Card key={e.id} className="flex items-center gap-4 p-4">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-900 text-white">
                    <span className="font-display text-2xl font-bold leading-none">
                      {date.getDate()}
                    </span>
                    <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-200">
                      {date.toLocaleDateString('en-PH', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-semibold text-slate-900">
                      <EventTypeIcon type={e.type} className="text-brand-600" />
                      <span className="truncate">{e.title}</span>
                    </p>
                    <p className="text-sm text-slate-600">{formatDateTime(e.startAt)}</p>
                  </div>
                  <Badge tone={t.tone} className="hidden sm:inline-flex">
                    {t.label}
                  </Badge>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center text-slate-600">No upcoming events scheduled.</Card>
        )}
      </section>

      {/* Officials preview */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHead
            title="Meet the Officials"
            subtitle="Your Sangguniang Kabataan council."
            to="/officials"
          />
          {officials.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {officials.map((o) => (
                <OfficialChip key={o.id} official={o} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-slate-600">Officials directory coming soon.</Card>
          )}
        </div>
      </section>
    </div>
  );
}
