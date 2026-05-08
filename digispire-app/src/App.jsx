import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, StudentRoute } from './components/ProtectedRoute';

import AdminLayout from './layouts/AdminLayout';
import StudentLayout from './layouts/StudentLayout';
import LoginPage from './pages/LoginPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import AttendancePage from './pages/admin/AttendancePage';
import CoursesPage from './pages/admin/CoursesPage';
import ContentPage from './pages/admin/ContentPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import AttendanceReportPage from './pages/admin/AttendanceReportPage';
import AdminToolsPage from './pages/admin/AdminToolsPage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentCoursesPage from './pages/student/StudentCoursesPage';
import StudentContentPage from './pages/student/StudentContentPage';
import MarketingToolsPage from './pages/student/MarketingToolsPage';
import PortfolioPage from './pages/student/PortfolioPage';
import CommunityPortfolioPage from './pages/student/CommunityPortfolioPage';

// Shared pages
import ProfilePage from './pages/ProfilePage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes - wrapped with AdminLayout as parent */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="reports" element={<AttendanceReportPage />} />
              <Route path="tools" element={<AdminToolsPage />} />
              <Route path="community" element={<CommunityPortfolioPage />} />
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
              <Route path="tools" element={<MarketingToolsPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="community" element={<CommunityPortfolioPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
