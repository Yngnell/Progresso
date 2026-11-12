import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SettingsTabs from '../components/settings/SettingsTabs';
import { isStaff } from '../utils/roles';

// Settings on the public site, for residents. SK accounts use Settings in the admin panel.
export default function Account() {
  const { user } = useAuth();
  const location = useLocation();
  if (isStaff(user)) return <Navigate to={`/admin/settings${location.search}`} replace />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to the website
      </Link>
      <h1 className="mt-4 page-title">Settings</h1>
      <div className="mt-6">
        <SettingsTabs />
      </div>
    </div>
  );
}
