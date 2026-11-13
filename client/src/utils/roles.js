// Who may do what (the server checks the same rules in server/src/utils/roles.js).
//   ADMIN     SK Admin: full access
//   CHAIRMAN  Barangay Chairman: Approvals (Project Requests), otherwise views; no Meetings
//             or Attendance
//   OFFICIAL  no accounts any more: the SK officials are a list of names (Settings)
//   VIEWER    a registered resident (public site only)
// The SK Admin account shows the attendance QR, manages the settings and runs the
// project stages.
export const STAFF_ROLES = ['ADMIN', 'CHAIRMAN', 'OFFICIAL'];

export const isStaff = (user) => STAFF_ROLES.includes(user?.role);
export const isAdmin = (user) => user?.role === 'ADMIN' || user?.role === 'OFFICIAL';
// The role used for access checks: an official counts as the admin.
export const accessRole = (user) => (user?.role === 'OFFICIAL' ? 'ADMIN' : user?.role);

// Name of the person's role, shown under their name.
export function roleLabel(user) {
  if (!user) return '';
  if (user.position) return user.position;
  if (user.role === 'ADMIN') return 'SK Admin';
  if (user.role === 'CHAIRMAN') return 'Barangay Chairman';
  if (user.role === 'OFFICIAL') return user.official?.position || 'SK Official';
  return 'Resident';
}
