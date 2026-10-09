import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { newsApi } from '../api/news';
import { Card, Badge } from '../components/ui';
import { formatDate } from '../utils/format';

export default function NewsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['news', 'public'],
    queryFn: () => newsApi.list({}),
  });
  const news = data?.news || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800">News &amp; Updates</h1>
      <p className="mt-2 text-slate-500">
        Announcements and updates from your Barangay Sangguniang Kabataan.
      </p>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : news.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-500">
            No news published yet. Check back soon!
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => (
              <Card
                key={item.id}
                className="flex flex-col overflow-hidden transition-shadow hover:shadow-cardHover"
              >
                <div className="h-36 w-full bg-gradient-to-br from-brand-100 to-accent-100" />
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
