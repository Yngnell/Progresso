import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards a route. Redirects to /login if not authenticated,
// and blocks access if the user's role is not allowed.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="p-8 text-center text-red-600 font-medium">
        You do not have permission to view this page.
      </div>
    );
  }

  return children;
}
