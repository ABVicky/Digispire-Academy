import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, BookOpen, QrCode, User,
  LogOut, Menu, X, ChevronRight,
  FileText, FolderUp
} from 'lucide-react';
import AmbientBackground from '../components/AmbientBackground';
import AnnouncementNotificationWatcher from '../components/AnnouncementNotificationWatcher';
import { triggerHaptic } from '../utils/haptic';

const navItems = [
  { path: '/student/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard, category: 'Main Menu' },
  { path: '/student/attendance', label: 'Mark Attendance', shortLabel: 'Attendance', icon: QrCode, category: 'Main Menu' },
  { path: '/student/courses', label: 'My Courses', shortLabel: 'Courses', icon: BookOpen, category: 'Courses & Learning' },
  { path: '/student/content', label: 'Study Materials', shortLabel: 'Materials', icon: FileText, category: 'Courses & Learning' },
  { path: '/student/submissions', label: 'Assignments', shortLabel: 'Assignments', icon: FolderUp, category: 'Courses & Learning' },
  { path: '/student/profile', label: 'My Profile', shortLabel: 'Profile', icon: User, category: 'Main Menu' },
];

const bottomNavItems = [
  { path: '/student/dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { path: '/student/attendance', shortLabel: 'Attendance', icon: QrCode },
  { path: '/student/courses', shortLabel: 'Courses', icon: BookOpen },
  { path: '/student/content', shortLabel: 'Materials', icon: FileText },
  { path: '/student/profile', shortLabel: 'Profile', icon: User },
];

export default function StudentLayout() {
  const { userProfile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen-ios bg-[#F8FAFC] flex flex-col md:flex-row font-sans selection:bg-[#1E3A5F] selection:text-white">
      {/* ── Mobile Institutional Header ── */}
      <header className="md:hidden bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 z-40 shadow-xs pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 shadow-2xs">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="font-heading font-extrabold text-slate-900 text-sm tracking-tight leading-none block">DIGISPIRE</span>
            <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase mt-0.5 block">Student Portal</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <NavLink
            to="/student/profile"
            onClick={() => triggerHaptic('light')}
            className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[#1E3A5F] font-bold text-xs uppercase overflow-hidden border border-slate-200"
          >
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
            ) : (
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1" />
            )}
          </NavLink>
          <button
            onClick={() => {
              triggerHaptic('light');
              setIsSidebarOpen(true);
            }}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ── Sidebar Overlay ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 md:hidden transition-opacity duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Formal Institutional Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-200 ease-in-out md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-200 flex flex-col`}>
        <div className="flex flex-col h-full p-4.5 pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[max(1.125rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-1.5 shadow-2xs">
                <img src="/logo.png" alt="DIGISPIRE" className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-slate-900 tracking-tight text-base leading-none">DIGISPIRE</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Student Portal</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer">
              <X size={18} />
            </button>
          </div>

          {/* Student Dossier Card */}
          <NavLink
            to="/student/profile"
            onClick={() => {
              triggerHaptic('light');
              setIsSidebarOpen(false);
            }}
            className="mb-4 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl flex items-center gap-3.5 transition-colors group shadow-2xs"
          >
            <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center text-[#1E3A5F] font-heading font-bold text-sm border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
              ) : (
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-extrabold text-slate-900 text-base sm:text-lg leading-tight truncate group-hover:text-[#1E3A5F] transition-colors">
                {userProfile?.name || 'Student'}
              </p>
              <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider truncate mt-0.5">
                {userProfile?.studentId || 'STUDENT'}
              </p>
            </div>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-700 transition-transform shrink-0" />
          </NavLink>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-4 overflow-y-auto no-scrollbar custom-scrollbar pr-1">
            {['Main Menu', 'Courses & Learning'].map((category) => {
              const items = navItems.filter(item => item.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="space-y-0.5">
                  <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{category}</p>
                  {items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        triggerHaptic('light');
                        setIsSidebarOpen(false);
                      }}
                      className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#1E3A5F] text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={15} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="pt-3 mt-2 border-t border-slate-100">
            <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer">
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Real-Time Announcement System Notification Watcher ── */}
      <AnnouncementNotificationWatcher />

      {/* ── Ambient Background Mesh & Gradient Shapes ── */}
      <AmbientBackground variant="light" />

      {/* ── Main Content ── */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto w-full has-bottom-nav md:pb-8 relative z-10">
        <Outlet />
      </main>

      {/* ── Formal Mobile Bottom Navigation ── */}
      <nav className="bottom-nav md:hidden" aria-label="Student navigation">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/student/dashboard' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                triggerHaptic('light');
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              }}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`bottom-nav-icon ${isActive ? 'text-[#1E3A5F]' : 'text-slate-400'}`}>
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? 'text-[#1E3A5F]' : 'text-slate-400'}
                />
              </div>
              <span className={`bottom-nav-label ${isActive ? 'text-[#1E3A5F]' : 'text-slate-400'}`}>
                {item.shortLabel}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
