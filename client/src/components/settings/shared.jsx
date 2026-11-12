// Small pieces shared by the Settings tabs.

export function Notice({ ok, children }) {
  return (
    <p
      className={`notice text-sm font-medium ${ok ? 'notice-ok' : 'notice-error'}`}
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
      <div className="card-head -mx-5 flex flex-wrap items-start justify-between gap-3 px-5 pb-3 sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
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
