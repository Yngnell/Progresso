// Reusable UI primitives for the SK Monitoring System ("calm paper notebook" look).
import { X } from 'lucide-react';

// Written out in full (not built as `btn-${variant}`) so Tailwind sees each class and
// keeps it in the stylesheet.
const VARIANTS = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  // Every button is 40px tall; sm only uses smaller padding and text.
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-[15px]',
    lg: 'px-5 py-2.5 text-base',
  };
  return (
    <button
      type={type}
      className={`btn ${VARIANTS[variant] || VARIANTS.primary} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

// Status pill: a coloured dot and the word.
//   green = done (sage), amber = pending (mustard), red = overdue / rejected (clay),
//   blue = in progress (pine), slate = neutral.
const BADGE_TONES = {
  slate: { pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  green: { pill: 'bg-sage-wash text-sage-text', dot: 'bg-sage' },
  amber: { pill: 'bg-mustard-wash text-mustard-text', dot: 'bg-mustard' },
  red: { pill: 'bg-clay-wash text-clay-text', dot: 'bg-clay' },
  blue: { pill: 'bg-pine-light text-pine', dot: 'bg-pine' },
};
export function Badge({ children, tone = 'slate', className = '' }) {
  const t = BADGE_TONES[tone] || BADGE_TONES.slate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5 ${t.pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className="input" {...props} />
      {error && <p className="mt-1 text-[13px] text-clay-text">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className="input" rows={props.rows || 5} {...props} />
      {error && <p className="mt-1 text-[13px] text-clay-text">{error}</p>}
    </div>
  );
}

export function Select({ label, options = [], className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="input" {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Modal dialog. size: 'md' (default) or 'xl' for document-style forms.
const MODAL_SIZES = { md: 'max-w-lg', xl: 'max-w-3xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      {/* Capped to the viewport: body scrolls, header and footer stay visible. */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[calc(100vh-2rem)] w-full ${
          MODAL_SIZES[size] || MODAL_SIZES.md
        } flex-col rounded-card border border-line bg-panel`}
      >
        <div className="card-head flex shrink-0 items-center justify-between gap-4 px-6 py-4">
          <h3 className="section-title">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-control p-1.5 text-slate-600 hover:bg-pine-light hover:text-pine"
            aria-label="Close"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse justify-end gap-2 border-t border-line px-6 py-4 sm:flex-row sm:gap-3">
            {footer}
          </div>
        )}
        {!footer && <div className="shrink-0 pb-6" />}
      </div>
    </div>
  );
}

// Empty state: one plain sentence saying what to do next, and one button.
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line bg-panel px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="mt-1 max-w-xl text-[15px] text-slate-600">{description}</p>}
      </div>
      {action && <div className="actions-stack w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}
