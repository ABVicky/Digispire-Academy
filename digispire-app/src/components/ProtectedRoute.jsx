import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#255A84] border-t-transparent" />
        <p className="text-slate-500 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}

// Wraps routes that require a specific role.
// Usage: <Route element={<ProtectedRoute role="admin" />}> ... </Route>
function ProtectedRoute({ role }) {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && userProfile?.role !== role) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Named convenience exports used in App.jsx
export function AdminRoute() {
  return <ProtectedRoute role="admin" />;
}

export function StudentRoute() {
  return <ProtectedRoute role="student" />;
}

export default ProtectedRoute;
