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

// Wraps routes that require specific roles.
// Usage: <Route element={<ProtectedRoute allowedRoles={['admin']} />}> ... </Route>
function ProtectedRoute({ allowedRoles }) {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userProfile?.role)) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Named convenience exports used in App.jsx
export function AdminRoute() {
  return <ProtectedRoute allowedRoles={['admin', 'educator']} />;
}

export function StudentRoute() {
  return <ProtectedRoute allowedRoles={['student']} />;
}

export default ProtectedRoute;
