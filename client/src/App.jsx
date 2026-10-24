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
import ProjectDetailPublic from './pages/ProjectDetailPublic';
import OfficialsPublic from './pages/OfficialsPublic';
import EventsPublic from './pages/EventsPublic';

import Dashboard from './pages/admin/Dashboard';
import AdminOfficials from './pages/admin/AdminOfficials';
import AdminNews from './pages/admin/AdminNews';
import AdminProjects from './pages/admin/AdminProjects';
import AdminProposals from './pages/admin/AdminProposals';
import ProjectReport from './pages/admin/ProjectReport';
import AdminArchive from './pages/admin/AdminArchive';
import AdminProjectDetail from './pages/admin/AdminProjectDetail';
import AdminCalendar from './pages/admin/AdminCalendar';
import AdminEventDetail from './pages/admin/AdminEventDetail';
import AdminAttendance from './pages/admin/AdminAttendance';

export default function App() {
  return (
    <Routes>
      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/projects" element={<ProjectsPublic />} />
        <Route path="/projects/:id" element={<ProjectDetailPublic />} />
        <Route path="/officials" element={<OfficialsPublic />} />
        <Route path="/events" element={<EventsPublic />} />
      </Route>

      {/* Auth pages (standalone) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Printable Accomplishment Report (standalone: no admin sidebar when printing) */}
      <Route
        path="/admin/projects/:id/report"
        element={
          <ProtectedRoute roles={['ADMIN', 'CHAIRMAN']}>
            <ProjectReport />
          </ProtectedRoute>
        }
      />

      {/* Admin panel */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN', 'CHAIRMAN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="officials"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminOfficials />
            </ProtectedRoute>
          }
        />
        <Route
          path="news"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminNews />
            </ProtectedRoute>
          }
        />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="proposals" element={<AdminProposals />} />
        <Route path="archive" element={<AdminArchive />} />
        <Route path="projects/:id" element={<AdminProjectDetail />} />
        <Route path="calendar" element={<AdminCalendar />} />
        <Route path="calendar/:id" element={<AdminEventDetail />} />
        <Route path="attendance" element={<AdminAttendance />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
