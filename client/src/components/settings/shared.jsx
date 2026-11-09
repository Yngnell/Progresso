// Small pieces shared by the Settings tabs.

export function Notice({ ok, children }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm font-medium ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
      role={ok ? 'status' : 'alert'}
    >
      {children}
    </p>
  );
}

// A titled section inside a tab.
export function Section({ title, description, children, actions }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const errorText = (err, fallback) => err?.response?.data?.message || fallback;

// Pictures accepted for a profile picture or the SK logo.
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function checkImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Choose a JPG, JPEG, PNG or WEBP picture.';
  if (file.size > MAX_IMAGE_BYTES) return 'The picture must be 5 MB or smaller.';
  return null;
}
