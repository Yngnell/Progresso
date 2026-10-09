import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import NewsList from './pages/NewsList';
import NewsDetail from './pages/NewsDetail';
import ProjectsPublic from './pages/ProjectsPublic';
import OfficialsPublic from './pages/OfficialsPublic';

import Dashboard from './pages/admin/Dashboard';
import AdminOfficials from './pages/admin/AdminOfficials';
import AdminNews from './pages/admin/AdminNews';

export default function App() {
  return (
    <Routes>
      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/projects" element={<ProjectsPublic />} />
        <Route path="/officials" element={<OfficialsPublic />} />
      </Route>

      {/* Auth pages (standalone) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin panel */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="officials" element={<AdminOfficials />} />
        <Route path="news" element={<AdminNews />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

