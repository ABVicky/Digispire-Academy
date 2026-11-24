import { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, StudentRoute } from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import PwaUpdateReload from './components/PwaUpdateReload';
import NativeAppInitializer from './components/NativeAppInitializer';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyPage } from './utils/lazyPage';

import AdminLayout from './layouts/AdminLayout';
import StudentLayout from './layouts/StudentLayout';

// Lazy Loaded Pages for performance and fast initial load
const LoginPage = lazyPage(() => import('./pages/LoginPage'));

// Admin pages
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
const StudentsPage = lazyPage(() => import('./pages/admin/StudentsPage'));
const AttendancePage = lazyPage(() => import('./pages/admin/AttendancePage'));
const CoursesPage = lazyPage(() => import('./pages/admin/CoursesPage'));
const ContentPage = lazyPage(() => import('./pages/admin/ContentPage'));
const AttendanceReportPage = lazyPage(() => import('./pages/admin/AttendanceReportPage'));
const CourseCompletionReportPage = lazyPage(() => import('./pages/admin/CourseCompletionReportPage'));
const StaffPage = lazyPage(() => import('./pages/admin/StaffPage'));
const RevisionAppealsPage = lazyPage(() => import('./pages/admin/RevisionAppealsPage'));
const SubmissionsPage = lazyPage(() => import('./pages/admin/SubmissionsPage'));
const AnnouncementsPage = lazyPage(() => import('./pages/admin/AnnouncementsPage'));
const EmailCenterPage = lazyPage(() => import('./pages/admin/EmailCenterPage'));

// Student pages
const StudentDashboard = lazyPage(() => import('./pages/student/StudentDashboard'));
const StudentAttendancePage = lazyPage(() => import('./pages/student/StudentAttendancePage'));
const StudentCoursesPage = lazyPage(() => import('./pages/student/StudentCoursesPage'));
const StudentContentPage = lazyPage(() => import('./pages/student/StudentContentPage'));
const StudentSubmissionsPage = lazyPage(() => import('./pages/student/StudentSubmissionsPage'));

// Shared pages
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'));
const PrivacyPolicyPage = lazyPage(() => import('./pages/PrivacyPolicyPage'));

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
        <NativeAppInitializer />
        <NetworkStatusIndicator />
        <PwaUpdateReload />
        <InstallPrompt />
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />

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
                <Route path="emails" element={<EmailCenterPage />} />
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
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

