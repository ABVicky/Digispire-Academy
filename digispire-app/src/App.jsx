import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, StudentRoute } from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import PwaUpdateReload from './components/PwaUpdateReload';

import AdminLayout from './layouts/AdminLayout';
import StudentLayout from './layouts/StudentLayout';

// Lazy Loaded Pages for performance and fast initial load
const LoginPage = lazy(() => import('./pages/LoginPage'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage'));
const AttendancePage = lazy(() => import('./pages/admin/AttendancePage'));
const CoursesPage = lazy(() => import('./pages/admin/CoursesPage'));
const ContentPage = lazy(() => import('./pages/admin/ContentPage'));
const AttendanceReportPage = lazy(() => import('./pages/admin/AttendanceReportPage'));
const CourseCompletionReportPage = lazy(() => import('./pages/admin/CourseCompletionReportPage'));
const StaffPage = lazy(() => import('./pages/admin/StaffPage'));
const RevisionAppealsPage = lazy(() => import('./pages/admin/RevisionAppealsPage'));
const SubmissionsPage = lazy(() => import('./pages/admin/SubmissionsPage'));
const AnnouncementsPage = lazy(() => import('./pages/admin/AnnouncementsPage'));

// Student pages
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentAttendancePage = lazy(() => import('./pages/student/StudentAttendancePage'));
const StudentCoursesPage = lazy(() => import('./pages/student/StudentCoursesPage'));
const StudentContentPage = lazy(() => import('./pages/student/StudentContentPage'));
const StudentSubmissionsPage = lazy(() => import('./pages/student/StudentSubmissionsPage'));

// Shared pages
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Sleek minimal page loader during route transitions
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-3">
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-3 border-slate-200 border-t-[#255A84] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 bg-[#255A84] rounded-full" />
        </div>
      </div>
      <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Loading...</p>
    </div>
  );
}

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
        <NetworkStatusIndicator />
        <PwaUpdateReload />
        <InstallPrompt />
        <Suspense fallback={<PageLoader />}>
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
                <Route path="completion-reports" element={<CourseCompletionReportPage />} />
                <Route path="revisions" element={<RevisionAppealsPage />} />
                <Route path="submissions" element={<SubmissionsPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

