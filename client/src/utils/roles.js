// Who may do what (the server checks the same rules in server/src/utils/roles.js).
//   ADMIN     SK Admin: full access
//   CHAIRMAN  Barangay Chairman: approves, otherwise views
//   OFFICIAL  an SK official's own account; the one whose position is "SK Chairperson"
//             (user.isSkChair) also marks projects complete, cancels projects and manages the QR,
//             accounts and settings. Every other official has the same access as ADMIN.
//   VIEWER    a registered resident (public site only)
export const STAFF_ROLES = ['ADMIN', 'CHAIRMAN', 'OFFICIAL'];

export const isStaff = (user) => STAFF_ROLES.includes(user?.role);
// SK officials have the same access as the SK Admin. Only the SK Chairperson
// (user.isSkChair) shows the attendance QR, marks projects complete and cancels projects.
export const isAdmin = (user) => user?.role === 'ADMIN' || user?.role === 'OFFICIAL';
// The role used for access checks: an official counts as the admin.
export const accessRole = (user) => (user?.role === 'OFFICIAL' ? 'ADMIN' : user?.role);
// Deletes anyone's project pictures.
export const isManager = (user) => isAdmin(user);
// Adds project pictures.
export const isWorker = (user) => user?.role === 'ADMIN' || user?.role === 'OFFICIAL';

// Name of the person's role, shown under their name.
export function roleLabel(user) {
  if (!user) return '';
  if (user.position) return user.position;
  if (user.role === 'ADMIN') return 'SK Admin';
  if (user.role === 'CHAIRMAN') return 'Barangay Chairman';
  if (user.role === 'OFFICIAL') return user.official?.position || 'SK Official';
  return 'Resident';
}
