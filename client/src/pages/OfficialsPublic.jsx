import { useQuery } from '@tanstack/react-query';
import { officialsApi } from '../api/officials';
import { Card, EmptyState } from '../components/ui';
import { formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';

export default function OfficialsPublic() {
  const { data, isLoading } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });
  const officials = data?.officials || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Barangay Officials"
        description="Meet the Sangguniang Kabataan serving our community."
      />

      <div className="mt-8">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : officials.length === 0 ? (
          <EmptyState
            title="No officials listed yet"
            description="The officials directory will appear here once published."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {officials.map((o) => (
              <Card key={o.id} className="flex flex-col items-center p-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 font-display text-4xl font-bold text-brand-800 ring-[3px] ring-ink">
                  {o.name?.charAt(0) || '?'}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{o.name}</h3>
                <p className="font-semibold text-brand-700">{o.position}</p>
                {o.committee && <p className="mt-1 text-sm text-slate-600">{o.committee}</p>}
                {o.termStart && (
                  <p className="mt-3 text-sm text-slate-600">
                    Term: {formatDate(o.termStart)}
                    {o.termEnd ? ` – ${formatDate(o.termEnd)}` : ' – present'}
                  </p>
                )}
                {o.contact && <p className="mt-1 text-sm text-slate-600">{o.contact}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
