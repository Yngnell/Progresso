// The heading of each project-process form: "Form 3 · Project Request".
export const formTitle = (number, name) => `Form ${number} · ${name}`;

// As a page heading (Form 3 has its own page); the modal forms pass formTitle() as their title.
export default function FormHeader({ number, name, description }) {
  return (
    <div className="min-w-0">
      <h1 className="page-title">{formTitle(number, name)}</h1>
      {description && <p className="mt-3 max-w-2xl text-slate-600">{description}</p>}
    </div>
  );
}
