import { useQuery } from '@tanstack/react-query';
import { officialsApi } from '../api/officials';
import { EmptyState } from '../components/ui';
import PageHeader from '../components/PageHeader';
import OfficialsPyramid from '../components/OfficialsPyramid';

// The Sangguniang Kabataan Officials, as a pyramid: the SK Chairperson, then the SK
// Secretary and SK Treasurer, then the SK Kagawads.
export default function OfficialsPublic() {
  const { data, isLoading } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });
  const officials = data?.officials || [];

  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
      <PageHeader
        title="Sangguniang Kabataan Officials"
        description="Meet the SK Officials serving our community."
      />

      <div className="mt-8">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : officials.length === 0 ? (
          <EmptyState
            title="No SK Officials listed yet"
            description="The SK Officials will appear here once they are added."
          />
        ) : (
          <OfficialsPyramid officials={officials} />
        )}
      </div>
    </div>
  );
}
