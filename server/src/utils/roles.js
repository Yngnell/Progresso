// Who may do what. The roles in the system:
//   ADMIN     the SK Admin, who runs the system day to day (full access)
//   CHAIRMAN  the Barangay Chairman: approves proposals and deletions, otherwise views
//   OFFICIAL  an SK official's own account: ticks checklist items, adds pictures, checks in
//   VIEWER    a registered resident (public site only)
// The SK Chairperson is the OFFICIAL account linked to the official whose position is
// "SK Chairperson" (Sehj Miranda). They manage checklists, the attendance QR, accounts
// and the system settings.

const SK_CHAIR_POSITION = /^sk chair(person|man)$/i;
const STAFF_ROLES = ['ADMIN', 'CHAIRMAN', 'OFFICIAL'];

// req.user carries { official: { position } } (see middleware/auth.js).
function isSkChair(user) {
  return Boolean(user?.official && SK_CHAIR_POSITION.test(String(user.official.position || '').trim()));
}

const isStaff = (user) => STAFF_ROLES.includes(user?.role);
// Manages checklists and pictures of everyone: the SK Admin or the SK Chairperson.
const isManager = (user) => user?.role === 'ADMIN' || isSkChair(user);
// Does the work on a project (ticks items, uploads pictures): the admin and the officials.
const isWorker = (user) => user?.role === 'ADMIN' || user?.role === 'OFFICIAL';

function guard(test, message) {
  return (req, res, next) => {
    if (req.user && test(req.user)) return next();
    return res.status(403).json({ message });
  };
}

module.exports = {
  STAFF_ROLES,
  isSkChair,
  isStaff,
  isManager,
  isWorker,
  requireSkChair: guard(isSkChair, 'Only the SK Chairperson can do this.'),
  requireManager: guard(isManager, 'Only the SK Chairperson or the SK Admin can do this.'),
  requireStaff: guard(isStaff, 'Forbidden — you do not have permission'),
  requireWorker: guard(isWorker, 'Only SK officials and the SK Admin can do this.'),
};
