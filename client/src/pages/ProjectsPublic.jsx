import { Link } from 'react-router-dom';
import { Card, Badge } from '../components/ui';

// Public Projects page. Full project management (with real data + progress)
// arrives in Phase 2; this is the designed placeholder so the layout is complete.
export default function ProjectsPublic() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800">SK Projects</h1>
      <p className="mt-2 text-slate-500">
        Follow the progress of programs and projects run by your Sangguniang
        Kabataan.
      </p>

      <Card className="mt-8 flex flex-col items-center p-12 text-center">
        <div className="text-4xl">🚧</div>
        <h2 className="mt-4 text-lg font-semibold text-slate-700">
          Projects coming soon
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Our SK is setting up the project tracker. Soon you'll be able to see
          each project's budget, progress, and status right here.
        </p>
        <Badge tone="amber" className="mt-4">
          In progress
        </Badge>
        <Link
          to="/"
          className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to Home
        </Link>
      </Card>
    </div>
  );
}
