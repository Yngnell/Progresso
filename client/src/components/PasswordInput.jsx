import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// A password field with an eye button that shows or hides what was typed.
// Used for every password field in the system.
export default function PasswordInput({ label, error, className = '', id, ...props }) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        <input id={inputId} className="input pr-11" type={visible ? 'text' : 'password'} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-controls={inputId}
        >
          {visible ? (
            <EyeOff size={19} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye size={19} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
