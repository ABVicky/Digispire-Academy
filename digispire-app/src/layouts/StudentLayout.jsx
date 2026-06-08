import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, BookOpen, QrCode, User, 
  LogOut, Menu, X, ChevronRight, Bell,
  Zap, Briefcase, Globe, FileText, ExternalLink, GraduationCap
} from 'lucide-react';

const navItems = [
  { path: 'dashboard', label: 'Portal Overview', icon: LayoutDashboard, category: 'Core Portal' },
  { path: 'attendance', label: 'QR Scan Check-in', icon: QrCode, category: 'Core Portal' },
  { path: 'profile', label: 'My Academic Profile', icon: User, category: 'Core Portal' },

  { path: 'courses', label: 'Syllabus & Modules', icon: BookOpen, category: 'Academic Resources' },
  { path: 'content', label: 'Content Library', icon: FileText, category: 'Academic Resources' },

  { path: 'portfolio', label: 'My Portfolio', icon: Briefcase, category: 'Wall & Careers' },
  { path: 'community', label: 'Wall of Fame', icon: Globe, category: 'Wall & Careers' },
  { path: 'tools', label: 'Marketing Arsenal', icon: Zap, category: 'Wall & Careers' },
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
    <div className="min-h-screen-ios bg-slate-50/50 flex flex-col md:flex-row pb-20 md:pb-0 font-sans selection:bg-[#255A84]/15">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-heading font-bold text-slate-800 tracking-tight text-lg">DIGISPIRE</span>
        </div>
        <div className="flex items-center gap-1">
           <button className="p-3 text-slate-400 relative">
             <Bell size={20} />
             <span className="absolute top-3 right-3 h-1.5 w-1.5 bg-red-500 rounded-full border border-white"></span>
           </button>
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 md:hidden backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-100/60`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between md:block mb-8">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              </div>
              <h1 className="font-heading font-extrabold text-slate-800 tracking-tight leading-none text-xl">DIGISPIRE</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {/* User Mini Card */}
          <NavLink
            to="/student/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="mb-8 p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-2xl flex items-center gap-3 transition-all duration-300 active:scale-[0.98] group"
          >
            <div className="h-11 w-11 rounded-2xl bg-white flex items-center justify-center text-[#255A84] font-heading font-bold shadow-sm border border-slate-100/60 uppercase overflow-hidden">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
              ) : (
                userProfile?.name?.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-xs truncate font-sans">{userProfile?.name}</p>
              <p className="text-[9px] font-bold text-[#255A84] uppercase tracking-widest truncate mt-0.5 font-sans">Student Portal (SIS)</p>
            </div>
            <ChevronRight size={14} className="text-slate-400 group-hover:text-[#255A84] transition-colors" />
          </NavLink>

          {/* Navigation with categorized groupings */}
          <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar py-2 pr-1">
            {['Core Portal', 'Academic Resources', 'Wall & Careers'].map((category) => {
              const items = navItems.filter(item => item.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="space-y-1">
                  <p className="px-4 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5 font-sans">{category}</p>
                  {items.map((item) => {
                    if (item.isExternal) {
                      return (
                        <a
                          key={item.path}
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsSidebarOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-[#F48B1F]/5 border border-transparent hover:border-[#F48B1F]/10 hover:text-[#F48B1F] transition-all duration-300 group"
                        >
                          <item.icon size={16} className="shrink-0 text-slate-400 group-hover:text-[#F48B1F]" />
                          <span className="font-sans font-semibold">{item.label}</span>
                          <ExternalLink size={10} className="ml-auto opacity-50 shrink-0" />
                        </a>
                      );
                    }
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-300 border ${
                          isActive 
                            ? 'bg-gradient-to-r from-[#255A84] to-[#1a4261] text-white border-transparent shadow-md shadow-[#255A84]/15' 
                            : 'text-slate-500 hover:text-[#255A84] hover:bg-[#255A84]/5 border-transparent'
                        }`}
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon size={16} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="font-sans">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="pt-4 mt-4 border-t border-slate-100/60">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-[0.98]">
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto w-full page-transition relative min-h-screen-ios overflow-hidden">
        {/* Glow Spots */}
        <div className="absolute top-10 left-10 w-[400px] h-[400px] rounded-full ambient-glow-1 pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] rounded-full ambient-glow-2 pointer-events-none -z-10" />

        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (PWA Style) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+8px)] z-40 flex justify-around items-center">
        {[
          navItems.find(i => i.path === 'dashboard'),
          navItems.find(i => i.path === 'courses'),
          navItems.find(i => i.path === 'tools'),
          navItems.find(i => i.path === 'attendance'),
          navItems.find(i => i.path === 'community')
        ].map((item) => {
          const isActive = location.pathname.includes(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[56px] ${isActive ? 'text-[#255A84]' : 'text-slate-400'}`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-50/80' : ''}`}>
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-[0.1em] transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.label.split(' ')[0]}
              </span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
