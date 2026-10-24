import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

  if (isLoading) return <p className="p-10 text-slate-600">Loading…</p>;
  if (isError || !item)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-700">Article not found.</p>
        <Link to="/news" className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-700">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to News
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to="/news"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to News
      </Link>

      <article className="mt-5">
        {item.category && (
          <Badge tone="blue" className="mb-3">
            {item.category}
          </Badge>
        )}
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-slate-900 sm:text-5xl">
          {item.title}
        </h1>
        <p className="mt-3 text-slate-600">
          By {item.author?.name || 'SK'} · {formatDate(item.publishedAt || item.createdAt)}
        </p>

        <Card className="mt-6 p-6 sm:p-8">
          <div className="max-w-prose whitespace-pre-wrap text-[17px] leading-relaxed text-slate-700">
            {item.content}
          </div>
        </Card>
      </article>
    </div>
  );
}
