import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Frame for the login and register pages: the seal and the SK's name on a panel beside
// the form on wide screens; a compact band above the form on phones.
export default function AuthShell({ title, description, children }) {
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] lg:grid-cols-[minmax(360px,5fr)_7fr] lg:grid-rows-1">
      <aside className="flex flex-col border-b border-line bg-panel px-6 py-6 lg:justify-between lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-pine hover:underline"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to the public site
        </Link>

        <div className="my-6 flex items-center gap-4 lg:my-0 lg:flex-col lg:items-start lg:gap-8">
          <img
            src="/logo.jpg"
            alt="Sangguniang Kabataan Salinas 1 seal"
            className="h-16 w-16 rounded-full border border-line bg-white object-cover lg:h-36 lg:w-36"
          />
          <div>
            <p className="font-display text-3xl leading-tight text-ink lg:text-5xl">SK Salinas 1</p>
            <p className="mt-1 text-slate-600 lg:mt-3 lg:text-lg">Project Monitoring System</p>
          </div>
        </div>

        <p className="hidden max-w-sm border-t border-dashed border-line pt-6 text-slate-600 lg:block">
          Sangguniang Kabataan, Barangay Salinas 1, City of Bacoor. Every project, budget and
          receipt in one place.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-md">
          <h1 className="page-title">{title}</h1>
          {description && <p className="mt-3 text-slate-600">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
