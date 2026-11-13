// Who may do what. The roles in the system:
//   ADMIN     the SK Admin, who runs the system day to day (full access)
//   CHAIRMAN  the Barangay Chairman: reviews Project Requests and deletions, otherwise views
//             (no Meetings or Attendance)
//   OFFICIAL  (no accounts any more: the SK officials are a list of names, see Settings)
//   VIEWER    a registered resident (public site only)
// The attendance QR, the settings and the project stages belong to the SK Admin account
// (requireSkAdmin).

const STAFF_ROLES = ['ADMIN', 'CHAIRMAN', 'OFFICIAL'];

const isStaff = (user) => STAFF_ROLES.includes(user?.role);
// Admin-level access: the SK Admin and every SK official.
const isAdminLevel = (user) => user?.role === 'ADMIN' || user?.role === 'OFFICIAL';
// The SK Admin account itself (not the officials who share its access).
const isSkAdmin = (user) => user?.role === 'ADMIN';

function guard(test, message) {
  return (req, res, next) => {
    if (req.user && test(req.user)) return next();
    return res.status(403).json({ message });
  };
}

module.exports = {
  STAFF_ROLES,
  isStaff,
  isAdminLevel,
  isSkAdmin,
  // Only the SK Admin account
  requireSkAdmin: guard(isSkAdmin, 'Only the SK Admin can do this.'),
  requireStaff: guard(isStaff, 'Forbidden — you do not have permission'),
  // Meetings and Attendance: the SK side without the Barangay Chairman
  requireSkSide: guard(isAdminLevel, 'The Barangay Chairman has no access to Meetings or Attendance.'),
};
