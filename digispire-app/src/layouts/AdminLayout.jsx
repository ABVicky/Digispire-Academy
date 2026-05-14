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
  { path: 'tools', label: 'Tools', icon: Zap },
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
    <div className="min-h-screen-ios bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-bold text-slate-800 tracking-tight text-lg">DIGISPIRE</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-slate-500">
          <Menu size={26} />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 md:hidden animate-in fade-in duration-300" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-100`}>
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="flex items-center justify-between md:block mb-8">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 tracking-tight leading-none text-xl">DIGISPIRE</h1>
                <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest mt-1">Admin Panel</p>
              </div>
            </div>
            <button onClick={closeSidebar} className="md:hidden p-2 text-slate-300">
              <X size={24} />
            </button>
          </div>

          {/* User Mini Card */}
          <NavLink
            to="/admin/profile"
            onClick={closeSidebar}
            className="mb-8 p-4 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-3 hover:bg-slate-100 transition group active:scale-95 duration-200"
          >
            <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-[#255A84] font-bold shadow-sm border border-slate-100 uppercase overflow-hidden">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
              ) : (
                userProfile?.name?.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">{userProfile?.name}</p>
              <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest truncate">Academic Admin</p>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-[#255A84] transition" />
          </NavLink>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-4 rounded-2xl text-xs font-bold transition-all duration-300 ${isActive ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="pt-6 mt-6 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-xs font-bold text-red-500 hover:bg-red-50 transition-all active:scale-95"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full page-transition">
        <Outlet />
      </main>
    </div>
  );
}
