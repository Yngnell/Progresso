// Title block used at the top of every page, public and admin: the heading in the
// seal's condensed lettering, a short line of help under it, actions on the right.
export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-slate-900">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
