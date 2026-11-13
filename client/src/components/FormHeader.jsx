// The heading of a form that has its own page (the Project Request).
export default function FormHeader({ name, description }) {
  return (
    <div className="min-w-0">
      <h1 className="page-title">{name}</h1>
      {description && <p className="mt-3 max-w-2xl text-slate-600">{description}</p>}
    </div>
  );
}
