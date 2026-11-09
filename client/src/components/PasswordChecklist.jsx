import { Check, Circle } from 'lucide-react';

// The password rules (the server checks the same ones in server/src/utils/password.js).
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'At least 1 uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'At least 1 lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'At least 1 number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'At least 1 special character (e.g. ! @ # ?)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// True when the password follows every rule and (when a confirmation is given) matches it.
export function passwordOk(password, confirm) {
  const p = password || '';
  const rulesMet = PASSWORD_RULES.every((r) => r.test(p));
  return confirm === undefined ? rulesMet : rulesMet && p === confirm;
}

function Row({ met, children }) {
  return (
    <li className={`flex items-center gap-2 ${met ? 'text-green-700' : 'text-slate-600'}`}>
      {met ? (
        <Check size={16} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
      ) : (
        <Circle size={14} strokeWidth={2} className="mx-px shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span>{children}</span>
      <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
    </li>
  );
}

// Live checklist under a new-password field: each rule turns green with a check once met.
// Pass `confirm` to add a "Both passwords match" row.
export default function PasswordChecklist({ password = '', confirm }) {
  return (
    <ul className="mt-2 space-y-1 text-sm" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => (
        <Row key={r.id} met={r.test(password)}>
          {r.label}
        </Row>
      ))}
      {confirm !== undefined && (
        <Row met={password.length > 0 && password === confirm}>Both passwords match</Row>
      )}
    </ul>
  );
}
