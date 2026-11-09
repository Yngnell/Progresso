// Password rules, checked on sign-up, password reset, password change and new accounts.
// The client shows the same list as a live checklist (client/src/components/PasswordChecklist.jsx).
const RULES = [
  { label: 'at least 8 characters', test: (p) => p.length >= 8 },
  { label: 'an uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'a lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'a number', test: (p) => /[0-9]/.test(p) },
  { label: 'a special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// Returns a readable error, or null when the password follows every rule.
function passwordError(password) {
  const p = String(password || '');
  const missing = RULES.filter((r) => !r.test(p)).map((r) => r.label);
  if (missing.length === 0) return null;
  return `The password needs ${missing.join(', ')}.`;
}

module.exports = { passwordError };
