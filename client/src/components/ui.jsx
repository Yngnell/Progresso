// Reusable UI primitives for the SK Monitoring System.
import { Inbox, X } from 'lucide-react';

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

// Status pill. tone maps to a color scheme.
export function Badge({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-accent-100 text-accent-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-brand-100 text-brand-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className="input" {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className="input" rows={props.rows || 5} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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

// Simple modal dialog. size: 'md' (default) or 'xl' for document-style forms.
const MODAL_SIZES = { md: 'max-w-lg', xl: 'max-w-3xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Capped to the viewport: body scrolls, header and footer stay visible. */}
      <div
        className={`relative z-10 flex max-h-[calc(100vh-2rem)] w-full ${
          MODAL_SIZES[size] || MODAL_SIZES.md
        } flex-col rounded-2xl bg-white shadow-cardHover`}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
          <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        )}
        {!footer && <div className="shrink-0 pb-6" />}
      </div>
    </div>
  );
}

// Empty-state placeholder.
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Inbox size={24} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
