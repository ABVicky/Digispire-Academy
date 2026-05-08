import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, BookOpen, QrCode, User, 
  LogOut, Menu, X, ChevronRight, Bell,
  Zap, Briefcase, Globe
} from 'lucide-react';

const navItems = [
  { path: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { path: 'courses', label: 'Academy', icon: BookOpen },
  { path: 'tools', label: 'Arsenal', icon: Zap },
  { path: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { path: 'community', label: 'Wall of Fame', icon: Globe },
  { path: 'attendance', label: 'Check-in', icon: QrCode },
  { path: 'profile', label: 'Account', icon: User },
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
    <div className="min-h-screen-ios bg-slate-50 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-[#255A84] rounded-xl flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-5 w-5 invert brightness-0" />
          </div>
          <span className="font-bold text-slate-800 tracking-tight text-lg">DIGISPIRE</span>
        </div>
        <div className="flex items-center gap-1">
           <button className="p-3 text-slate-400 relative">
             <Bell size={22} />
             <span className="absolute top-3.5 right-3.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
           </button>
           <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-slate-500">
            <Menu size={26} />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 md:hidden animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar (Desktop & Mobile Menu) */}
      <aside className={`fixed inset-y-0 left-0 w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-100`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between md:block mb-8">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 bg-[#255A84] rounded-xl flex items-center justify-center shadow-lg shadow-[#255A84]/20">
                <img src="/logo.png" alt="Logo" className="h-6 w-6 invert brightness-0" />
              </div>
              <h1 className="font-bold text-slate-800 tracking-tight leading-none text-xl">DIGISPIRE</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-300">
              <X size={24} />
            </button>
          </div>

          {/* User Mini Card */}
          <NavLink
            to="/student/profile"
            onClick={() => setIsSidebarOpen(false)}
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
              <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest truncate">Academy Student</p>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-[#255A84] transition" />
          </NavLink>

          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${isActive ? 'bg-[#255A84] text-white shadow-lg shadow-[#255A84]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-6 mt-6 border-t border-slate-100">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all active:scale-95">
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto w-full page-transition">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (PWA Style) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+8px)] z-40 flex justify-around items-center">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname.includes(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 min-w-[56px] ${isActive ? 'text-[#255A84]' : 'text-slate-400'}`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-50' : ''}`}>
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-[0.1em] transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
