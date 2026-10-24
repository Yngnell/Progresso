import { useState } from 'react';

// Place names default to this SK's barangay; override with VITE_REPORT_* in client/.env.
export const PROVINCE = import.meta.env.VITE_REPORT_PROVINCE || 'Cavite';
export const CITY = import.meta.env.VITE_REPORT_CITY || 'Bacoor';
export const BARANGAY = import.meta.env.VITE_REPORT_BARANGAY || 'Salinas 1';

// A seal image that quietly disappears if its file has not been added yet.
function Seal({ src, alt }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setMissing(true)}
      className="h-16 w-16 rounded-full object-cover"
    />
  );
}

// Official letterhead used on the project proposal form and the accomplishment report.
// Seals: client/public/barangay-logo.jpg (optional) and client/public/logo.jpg (SK seal).
export default function Letterhead() {
  return (
    <header className="text-center font-serif text-slate-900">
      <div className="mb-2 flex items-center justify-center gap-3">
        <Seal src="/barangay-logo.jpg" alt="Barangay seal" />
        <Seal src="/logo.jpg" alt="Sangguniang Kabataan seal" />
      </div>
      <p className="text-sm">Republic of the Philippines</p>
      <p className="text-sm">Province of {PROVINCE}</p>
      <p className="text-sm font-semibold uppercase text-red-600">City of {CITY}</p>
      <p className="text-base font-bold uppercase">Barangay {BARANGAY}</p>
      <p className="text-base font-bold uppercase">Office of the Sangguniang Kabataan</p>
    </header>
  );
}
