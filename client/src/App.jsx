import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Unsubscribe from './pages/Unsubscribe';
import CheckIn from './pages/CheckIn';
import Account from './pages/Account';
import EventQrCheckin from './pages/admin/EventQrCheckin';
import MeetingQrList from './pages/MeetingQrList';
import ProjectsPublic from './pages/ProjectsPublic';
import ProjectDetailPublic from './pages/ProjectDetailPublic';
import OfficialsPublic from './pages/OfficialsPublic';

import Dashboard from './pages/admin/Dashboard';
import AdminProjects from './pages/admin/AdminProjects';
import AdminApprovals from './pages/admin/AdminApprovals';
import AdminArchive from './pages/admin/AdminArchive';
import AdminProjectDetail from './pages/admin/AdminProjectDetail';
import AdminMeetings from './pages/admin/AdminMeetings';
import AdminEventDetail from './pages/admin/AdminEventDetail';
import AdminAttendance from './pages/admin/AdminAttendance';
import Settings from './pages/admin/Settings';
import Budget from './pages/admin/Budget';
import ProjectRequestForm from './pages/admin/ProjectRequestForm';

export default function App() {
  return (
    <Routes>
      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<ProjectsPublic />} />
        <Route path="/projects/:id" element={<ProjectDetailPublic />} />
        <Route path="/officials" element={<OfficialsPublic />} />
        {/* Events are no longer on the public site: old links go to the home page. */}
        <Route path="/events" element={<Navigate to="/" replace />} />
        <Route
          path="/attendance-qr"
          element={
            <ProtectedRoute allow={(u) => u.canShowQr}>
              <MeetingQrList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Auth pages (standalone) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/checkin" element={<CheckIn />} />

      {/* Full-screen QR for a meeting (shown on a projector, no sidebar) */}
      <Route
        path="/attendance-qr/:id"
        element={
          <ProtectedRoute allow={(u) => u.canShowQr}>
            <EventQrCheckin />
          </ProtectedRoute>
        }
      />

      {/* Admin panel */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN', 'CHAIRMAN', 'OFFICIAL']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="archive" element={<AdminArchive />} />
        {/* Form 1 and Form 2: the SK Admin records them; the Barangay Chairman views them */}
        <Route
          path="budget"
          element={
            <ProtectedRoute roles={['ADMIN', 'CHAIRMAN']}>
              <Budget />
            </ProtectedRoute>
          }
        />
        <Route path="projects/:id" element={<AdminProjectDetail />} />
        {/* Form 3: Project Request (the SK Admin) */}
        <Route
          path="projects/new"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <ProjectRequestForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:id/edit"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <ProjectRequestForm />
            </ProtectedRoute>
          }
        />
        {/* Approvals: the Barangay Chairman only */}
        <Route
          path="approvals"
          element={
            <ProtectedRoute roles={['CHAIRMAN']}>
              <AdminApprovals />
            </ProtectedRoute>
          }
        />
        {/* Meetings and Attendance: not for the Barangay Chairman */}
        <Route
          path="meetings"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminMeetings />
            </ProtectedRoute>
          }
        />
        <Route
          path="meetings/:id"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminEventDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminAttendance />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
