import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, StudentRoute } from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';

import AdminLayout from './layouts/AdminLayout';
import StudentLayout from './layouts/StudentLayout';
import LoginPage from './pages/LoginPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import AttendancePage from './pages/admin/AttendancePage';
import CoursesPage from './pages/admin/CoursesPage';
import ContentPage from './pages/admin/ContentPage';
import AttendanceReportPage from './pages/admin/AttendanceReportPage';
import StaffPage from './pages/admin/StaffPage';
import RevisionAppealsPage from './pages/admin/RevisionAppealsPage';
import SubmissionsPage from './pages/admin/SubmissionsPage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentCoursesPage from './pages/student/StudentCoursesPage';
import StudentContentPage from './pages/student/StudentContentPage';
import StudentSubmissionsPage from './pages/student/StudentSubmissionsPage';

// Shared pages
import ProfilePage from './pages/ProfilePage';

function App() {
  useEffect(() => {
    // Fix for 100vh on mobile
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);

    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <InstallPrompt />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes - wrapped with AdminLayout as parent */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="reports" element={<AttendanceReportPage />} />
              <Route path="revisions" element={<RevisionAppealsPage />} />
              <Route path="submissions" element={<SubmissionsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* Student routes */}
          <Route element={<StudentRoute />}>
            <Route path="/student" element={<StudentLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="courses" element={<StudentCoursesPage />} />
              <Route path="content" element={<StudentContentPage />} />
              <Route path="submissions" element={<StudentSubmissionsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
