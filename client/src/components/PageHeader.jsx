// Title block at the top of every page, public and admin: the serif page title with
// its short clay rule, one line saying what the page is for, and the page's main
// action at the top right.
export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-slate-600">{description}</p>}
      </div>
      {actions && <div className="actions-stack flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}
