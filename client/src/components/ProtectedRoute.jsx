import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards a route. Redirects to /login if not authenticated,
// and redirects users whose role is not allowed here.
// `allow` is an extra check on the user (e.g. only the SK Chairperson for the QR code).
export default function ProtectedRoute({ children, roles, allow }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Signed in but not allowed here: residents go to the public site, staff to the
  // dashboard (e.g. the chairman opening an admin-only page).
  if ((roles && !roles.includes(user.role)) || (allow && !allow(user))) {
    const staff = ['ADMIN', 'CHAIRMAN', 'OFFICIAL'].includes(user.role);
    return <Navigate to={staff ? '/admin' : '/'} replace />;
  }

  return children;
}
