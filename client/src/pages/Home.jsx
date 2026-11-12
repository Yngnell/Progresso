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
import DateTile from '../components/DateTile';

// Opening: what the site is for on the left, the proof on the right. The panel lists
// real projects with their stage, so a resident sees the system working at once.
function Hero({ projects, loading }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-content gap-10 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-14">
        <div>
          <img
            src="/logo.jpg"
            alt="Sangguniang Kabataan Salinas 1 seal"
            className="mb-6 h-20 w-20 rounded-full border border-line bg-white object-cover"
          />
          <h1 className="page-title !text-[34px] sm:!text-[40px]">Barangay SK Project Monitoring System</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-700">
            Transparency for our community. Track youth programs, projects, and announcements from
            your Sangguniang Kabataan — all in one place.
          </p>
          <div className="actions-stack mt-8 flex flex-wrap gap-3">
            <Link to="/projects">
              <Button variant="primary" size="lg">
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

        <div className="card p-5 sm:p-6">
          <div className="card-head -mx-5 flex items-baseline justify-between gap-3 px-5 pb-3 sm:-mx-6 sm:px-6">
            <h2 className="section-title">
              Happening now
            </h2>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-sm font-medium text-pine hover:underline"
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
            <ul className="mt-2 divide-y divide-line">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="-mx-2 block rounded-control px-2 py-3 transition-colors hover:bg-pine-light"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-base font-medium text-ink">{p.title}</span>
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
        <h2 className="section-title sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-slate-600">{subtitle}</p>
      </div>
      <Link
        to={to}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-pine hover:underline"
      >
        {linkLabel} <ArrowRight size={16} strokeWidth={1.75} />
      </Link>
    </div>
  );
}

function OfficialChip({ official }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <OfficialAvatar
        official={official}
        className="h-12 w-12 ring-1 ring-line"
        letterClass="font-display text-xl text-pine"
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{official.name}</p>
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
      <section className="mx-auto max-w-content px-4 py-12 sm:px-8">
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
                  <DateTile date={date} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium text-ink">
                      <EventTypeIcon type={e.type} className="text-pine" />
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
          <Card className="p-6 text-slate-600">No upcoming events scheduled. Check back soon.</Card>
        )}
      </section>

      {/* Officials preview */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-content px-4 py-12 sm:px-8">
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
            <Card className="p-6 text-slate-600">The list of SK officials will appear here.</Card>
          )}
        </div>
      </section>
    </div>
  );
}
