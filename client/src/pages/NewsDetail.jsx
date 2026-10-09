import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { newsApi } from '../api/news';
import { Card, Badge } from '../components/ui';
import { formatDate } from '../utils/format';

export default function NewsDetail() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['news', id],
    queryFn: () => newsApi.get(id),
  });
  const item = data?.news;

  if (isLoading) return <p className="p-10 text-sm text-slate-500">Loading…</p>;
  if (isError || !item)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-600">Article not found.</p>
        <Link to="/news" className="mt-4 inline-block text-brand-600">
          ← Back to News
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/news" className="text-sm text-brand-600 hover:text-brand-700">
        ← Back to News
      </Link>

      <div className="mt-4">
        {item.category && (
          <Badge tone="blue" className="mb-3">
            {item.category}
          </Badge>
        )}
        <h1 className="text-3xl font-bold text-slate-800">{item.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
          <span>By {item.author?.name || 'SK'}</span>
          <span>·</span>
          <span>{formatDate(item.publishedAt || item.createdAt)}</span>
        </div>
      </div>

      <div className="mt-6 h-56 w-full rounded-xl bg-gradient-to-br from-brand-100 to-accent-100" />

      <Card className="mt-6 p-6">
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
          {item.content}
        </div>
      </Card>
    </div>
  );
}
