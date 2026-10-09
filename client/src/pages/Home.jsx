import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { newsApi } from '../api/news';
import { officialsApi } from '../api/officials';
import { Button, Card, Badge } from '../components/ui';
import { formatDate } from '../utils/format';

function Hero() {
  return (
    <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <Badge tone="amber" className="mb-4 bg-accent-500/20 text-accent-100">
          Sangguniang Kabataan
        </Badge>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Barangay SK Project Monitoring System
        </h1>
        <p className="mt-4 max-w-xl text-lg text-brand-100">
          Transparency for our community. Track youth programs, projects, and
          announcements from your Sangguniang Kabataan — all in one place.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/projects">
            <Button variant="accent" size="lg">
              View Projects
            </Button>
          </Link>
          <Link to="/register">
            <Button
              size="lg"
              className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              Join as a Viewer
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function NewsCard({ item }) {
  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-cardHover">
      <div className="h-40 w-full bg-gradient-to-br from-brand-100 to-accent-100" />
      <div className="flex flex-1 flex-col p-5">
        {item.category && (
          <Badge tone="blue" className="mb-2 w-fit">
            {item.category}
          </Badge>
        )}
        <h3 className="text-base font-semibold text-slate-800 line-clamp-2">
          {item.title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-slate-500 line-clamp-3">
          {item.excerpt || item.content}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>{formatDate(item.publishedAt || item.createdAt)}</span>
          <Link
            to={`/news/${item.id}`}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Read more →
          </Link>
        </div>
      </div>
    </Card>
  );
}

function OfficialChip({ official }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
        {official.name?.charAt(0) || '?'}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{official.name}</p>
        <p className="truncate text-xs text-slate-500">{official.position}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: newsData } = useQuery({
    queryKey: ['news', 'featured'],
    queryFn: () => newsApi.list({ featured: 'true' }),
  });
  const { data: officialsData } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });

  const featured = (newsData?.news || []).slice(0, 3);
  const officials = (officialsData?.officials || []).slice(0, 4);

  return (
    <div>
      <Hero />

      {/* Featured news */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">News &amp; Updates</h2>
            <p className="text-sm text-slate-500">The latest from your SK council.</p>
          </div>
          <Link
            to="/news"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all →
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-sm text-slate-500">
            No news published yet. Check back soon!
          </Card>
        )}
      </section>

      {/* Officials preview */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Meet the Officials</h2>
              <p className="text-sm text-slate-500">Your Sangguniang Kabataan council.</p>
            </div>
            <Link
              to="/officials"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </Link>
          </div>

          {officials.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {officials.map((o) => (
                <OfficialChip key={o.id} official={o} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-sm text-slate-500">
              Officials directory coming soon.
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

