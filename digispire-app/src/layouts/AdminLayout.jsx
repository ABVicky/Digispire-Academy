import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CalendarCheck, BookOpen, FileText,
  LogOut, Menu, X, GraduationCap, User, ChevronRight, BarChart3,
  FileSpreadsheet, Zap, Globe
} from 'lucide-react';

const navItems = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'students', label: 'Students', icon: Users },
  { path: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { path: 'courses', label: 'Courses', icon: GraduationCap },
  { path: 'content', label: 'Resources', icon: FileText },
  { path: 'analytics', label: 'Analytics', icon: BarChart3 },
  { path: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { path: 'tools', label: 'Arsenal', icon: Zap },
  { path: 'community', label: 'Wall of Fame', icon: Globe },
];

export default function AdminLayout() {
  const { userProfile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-[#255A84] rounded-lg flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="h-5 w-5 invert brightness-0" />
          </div>
          <span className="font-bold text-slate-800 tracking-tight">DIGISPIRE</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-100 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="hidden md:flex items-center gap-3 mb-10 px-2">
            <div className="h-10 w-10 bg-[#255A84] rounded-xl flex items-center justify-center shadow-lg shadow-[#255A84]/20">
              <img src="/logo.png" alt="Logo" className="h-6 w-6 invert brightness-0" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 tracking-tight leading-none">DIGISPIRE</h1>
              <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest mt-1">Admin Panel</p>
            </div>
          </div>

          {/* User Mini Card */}
          <NavLink
            to="/admin/profile"
            onClick={closeSidebar}
            className="mb-8 p-4 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-3 hover:bg-slate-100 transition group"
          >
            <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center text-[#255A84] font-bold shadow-sm border border-slate-100 uppercase overflow-hidden">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
              ) : (
                userProfile?.name?.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">{userProfile?.name}</p>
              <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest truncate">Educator</p>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-[#255A84] transition" />
          </NavLink>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 ${isActive ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="pt-6 border-t border-slate-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
