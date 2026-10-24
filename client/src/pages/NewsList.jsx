import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { newsApi } from '../api/news';
import { Card, Badge } from '../components/ui';
import { formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';

export default function NewsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['news', 'public'],
    queryFn: () => newsApi.list({}),
  });
  const news = data?.news || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="News & Updates"
        description="Announcements and updates from your Barangay Sangguniang Kabataan."
      />

      <div className="mt-8">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : news.length === 0 ? (
          <Card className="p-10 text-center text-slate-600">
            No news published yet. Check back soon!
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => (
              <Card
                key={item.id}
                className="flex flex-col p-5 transition-shadow duration-200 hover:shadow-cardHover"
              >
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {item.category && <Badge tone="blue">{item.category}</Badge>}
                  <span>{formatDate(item.publishedAt || item.createdAt)}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-snug text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-3 flex-1 text-slate-600">
                  {item.excerpt || item.content}
                </p>
                <Link
                  to={`/news/${item.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  Read more <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
