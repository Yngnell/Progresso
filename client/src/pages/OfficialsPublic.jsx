import { useQuery } from '@tanstack/react-query';
import { officialsApi } from '../api/officials';
import { Card, EmptyState } from '../components/ui';
import { formatDate } from '../utils/format';

export default function OfficialsPublic() {
  const { data, isLoading } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });
  const officials = data?.officials || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800">Barangay Officials</h1>
      <p className="mt-2 text-slate-500">
        Meet the Sangguniang Kabataan serving our community.
      </p>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : officials.length === 0 ? (
          <EmptyState
            title="No officials listed yet"
            description="The officials directory will appear here once published."
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {officials.map((o) => (
              <Card key={o.id} className="flex flex-col items-center p-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
                  {o.name?.charAt(0) || '?'}
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-800">{o.name}</h3>
                <p className="text-sm text-brand-600">{o.position}</p>
                {o.committee && (
                  <p className="mt-1 text-xs text-slate-400">{o.committee}</p>
                )}
                {o.termStart && (
                  <p className="mt-3 text-xs text-slate-400">
                    Term: {formatDate(o.termStart)}
                    {o.termEnd ? ` – ${formatDate(o.termEnd)}` : ' – present'}
                  </p>
                )}
                {o.contact && (
                  <p className="mt-1 text-xs text-slate-500">{o.contact}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
