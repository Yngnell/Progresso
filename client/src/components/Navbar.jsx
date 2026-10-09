import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow px-6 py-3 flex items-center justify-between">
      <Link to="/" className="font-bold text-lg text-blue-700">
        SK Monitoring
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link className="text-gray-700 hover:text-blue-700" to="/admin">
              Dashboard
            </Link>
            <span className="text-gray-500 text-sm">
              {user.name} ({user.role})
            </span>
            <button
              className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              onClick={logout}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="text-gray-700 hover:text-blue-700" to="/login">
              Login
            </Link>
            <Link
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              to="/register"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
