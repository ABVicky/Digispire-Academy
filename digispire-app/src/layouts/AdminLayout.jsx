import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CalendarCheck, BookOpen, FileText,
  LogOut, Menu, X, GraduationCap, ChevronRight, BarChart3,
  FileSpreadsheet, Zap, Globe, History, ExternalLink, CalendarDays
} from 'lucide-react';

const navItems = [
  { path: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard, category: 'Operations & Registry' },
  { path: 'students', label: 'Student Registry', icon: Users, category: 'Operations & Registry' },
  { path: 'attendance', label: 'Live Class Console', icon: CalendarCheck, category: 'Operations & Registry' },
  
  { path: 'courses', label: 'Course Curriculum', icon: GraduationCap, category: 'Curriculum & Learning' },
  { path: 'content', label: 'Resources Library', icon: FileText, category: 'Curriculum & Learning' },
  { path: 'https://marketing.abvicky.in', label: 'Study Portal', icon: BookOpen, isExternal: true, category: 'Curriculum & Learning' },
  
  { path: 'reports', label: 'Attendance Ledgers', icon: FileSpreadsheet, category: 'Evaluation & Audits' },
  { path: 'revisions', label: 'Academic Appeals', icon: History, category: 'Evaluation & Audits' },
  { path: 'analytics', label: 'Performance Analytics', icon: BarChart3, category: 'Evaluation & Audits' },
  
  { path: 'community', label: 'Wall of Fame', icon: Globe, category: 'Portfolios & Utilities' },
  { path: 'tools', label: 'Marketing Arsenal', icon: Zap, category: 'Portfolios & Utilities' },
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
    <div className="min-h-screen-ios bg-slate-50/50 flex flex-col md:flex-row font-sans selection:bg-[#255A84]/15">
      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-heading font-bold text-slate-800 tracking-tight text-lg">DIGISPIRE</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 md:hidden backdrop-blur-sm animate-in fade-in duration-300" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-[280px] bg-white z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-100/60`}>
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="flex items-center justify-between md:block mb-8">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-slate-800 tracking-tight leading-none text-xl">DIGISPIRE</h1>
                <p className="text-[9px] font-bold text-[#255A84] uppercase tracking-widest mt-1.5 font-sans">Faculty Portal</p>
              </div>
            </div>
            <button onClick={closeSidebar} className="md:hidden p-2 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {/* User Mini Card */}
          <NavLink
            to="/admin/profile"
            onClick={closeSidebar}
            className="mb-8 p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/80 rounded-3xl flex items-center gap-3 transition-all duration-300 active:scale-[0.98] group"
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
              <p className="text-[9px] font-bold text-[#255A84] uppercase tracking-widest truncate mt-0.5 font-sans">Faculty Officer</p>
            </div>
            <ChevronRight size={14} className="text-slate-400 group-hover:text-[#255A84] transition-colors" />
          </NavLink>

          {/* Navigation with categorized groupings */}
          <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar py-2 pr-1">
            {['Operations & Registry', 'Curriculum & Learning', 'Evaluation & Audits', 'Portfolios & Utilities'].map((category) => {
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
                          onClick={closeSidebar}
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
                        onClick={closeSidebar}
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

          {/* Logout */}
          <div className="pt-4 mt-4 border-t border-slate-100/60">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-[0.98]"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full page-transition relative min-h-screen-ios overflow-hidden">
        {/* Glow Spots */}
        <div className="absolute top-10 left-10 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] rounded-full ambient-glow-2 pointer-events-none -z-10" />
        
        <Outlet />
      </main>
    </div>
  );
}
