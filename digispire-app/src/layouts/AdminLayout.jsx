import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CalendarCheck, FileText,
  LogOut, Menu, X, GraduationCap, ChevronRight,
  FileSpreadsheet, UserCog, History, FolderOpen, Award
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import TriColorConfetti from '../components/TriColorConfetti';
import { isIndependenceDayActive } from '../utils/independenceDayTheme';
import PatrioticDecorations from '../components/PatrioticDecorations';

const navItems = [
  { path: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, category: 'Operations & Registry' },
  { path: 'students', label: 'Student Registry', shortLabel: 'Students', icon: Users, category: 'Operations & Registry' },
  { path: 'staff', label: 'Staff Management', shortLabel: 'Staff', icon: UserCog, category: 'Operations & Registry' },
  { path: 'attendance', label: 'Live Class Console', shortLabel: 'Attendance', icon: CalendarCheck, category: 'Operations & Registry' },
  { path: 'courses', label: 'Course Curriculum', shortLabel: 'Courses', icon: GraduationCap, category: 'Curriculum & Learning' },
  { path: 'content', label: 'Resources Library', shortLabel: 'Library', icon: FileText, category: 'Curriculum & Learning' },
  { path: 'reports', label: 'Attendance Ledgers', shortLabel: 'Reports', icon: FileSpreadsheet, category: 'Evaluation & Audits' },
  { path: 'completion-reports', label: 'Course Completion Reports', shortLabel: 'Completions', icon: Award, category: 'Evaluation & Audits' },
  { path: 'revisions', label: 'Revision Appeals', shortLabel: 'Revisions', icon: History, category: 'Evaluation & Audits' },
  { path: 'submissions', label: 'Student Submissions', shortLabel: 'Submissions', icon: FolderOpen, category: 'Evaluation & Audits' },
];

// Bottom nav shows only the 5 most critical items for one-handed thumb reach
const bottomNavItems = [
  navItems.find(i => i.path === 'dashboard'),
  navItems.find(i => i.path === 'students'),
  navItems.find(i => i.path === 'staff'),
  navItems.find(i => i.path === 'attendance'),
  navItems.find(i => i.path === 'courses'),
];

export default function AdminLayout() {
  const { userProfile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingRevisionsCount, setPendingRevisionsCount] = useState(0);
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);
  const isFestiveActive = isIndependenceDayActive();

  useEffect(() => {
    const qRevisions = query(
      collection(db, 'revision_appeals'),
      where('status', '==', 'pending')
    );
    const unsubscribeRevisions = onSnapshot(qRevisions, (snap) => {
      setPendingRevisionsCount(snap.size);
    }, (err) => {
      console.error('Error listening to pending revision appeals:', err);
    });

    const qSubmissions = query(
      collection(db, 'submissions'),
      where('status', '==', 'pending')
    );
    const unsubscribeSubmissions = onSnapshot(qSubmissions, (snap) => {
      setPendingSubmissionsCount(snap.size);
    }, (err) => {
      console.error('Error listening to pending submissions:', err);
    });

    return () => {
      unsubscribeRevisions();
      unsubscribeSubmissions();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="min-h-screen-ios bg-slate-50/50 flex flex-col md:flex-row font-sans selection:bg-[#255A84]/15 relative">
      {/* TriColor Confetti & Festoon Decorations Overlay */}
      {isFestiveActive && (
        <>
          <TriColorConfetti />
          <PatrioticDecorations />
        </>
      )}

      {/* Top Tri-Color Ribbon */}
      {isFestiveActive && (
        <div className="fixed top-0 left-0 right-0 h-1.5 z-50 flex pointer-events-none">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>
      )}

      {/* ── Mobile Top Header ── */}
      <div className="md:hidden bg-white/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 z-40 shadow-sm shadow-slate-100/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <span className="font-heading font-bold text-slate-800 tracking-tight text-base">DIGISPIRE</span>
            {isFestiveActive && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-100 text-[9px] font-black text-orange-700">🇮🇳 15 Aug</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NavLink
            to="/admin/profile"
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-[#255A84] font-bold text-sm uppercase overflow-hidden border border-slate-200/60"
          >
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
            ) : (
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5" />
            )}
          </NavLink>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2.5 text-slate-500 hover:text-slate-700 transition active:scale-90"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* ── Sidebar Overlay ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 md:hidden backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar (Desktop always visible / Mobile drawer) ── */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-100/60 shadow-xl shadow-slate-200/30 md:shadow-none`}>
        <div className="flex flex-col h-full p-5">
          {/* Logo */}
          <div className="flex items-center justify-between md:block mb-6">
            <div className="flex items-center gap-3 px-1">
              <div className="h-10 w-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center shadow-sm">
                <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-heading font-extrabold text-slate-800 tracking-tight leading-none text-xl">DIGISPIRE</h1>
                  {isFestiveActive && <span className="text-sm">🇮🇳</span>}
                </div>
                <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest mt-1 font-sans">Faculty Portal</p>
              </div>
            </div>
            <button onClick={closeSidebar} className="md:hidden p-2 text-slate-400 hover:text-slate-600 transition rounded-lg hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>

          {/* User Card */}
          <NavLink
            to="/admin/profile"
            onClick={closeSidebar}
            className="mb-6 p-3.5 bg-slate-50 hover:bg-slate-100/60 border border-slate-100/80 rounded-2xl flex items-center gap-3 transition-all duration-200 active:scale-[0.98] group"
          >
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-[#255A84] font-heading font-bold shadow-sm border border-slate-100/60 uppercase overflow-hidden shrink-0">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
              ) : (
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-xs truncate">{userProfile?.name}</p>
              <p className="text-[10px] font-bold text-[#255A84] uppercase tracking-widest truncate mt-0.5">Faculty Officer</p>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-[#255A84] transition-colors shrink-0" />
          </NavLink>

          {/* Nav Groups */}
          <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
            {['Operations & Registry', 'Curriculum & Learning', 'Evaluation & Audits'].map((category) => {
              const items = navItems.filter(item => item.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="space-y-0.5">
                  <p className="px-3 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">{category}</p>
                  {items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeSidebar}
                      className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#255A84] to-[#1a4261] text-white shadow-md shadow-[#255A84]/15'
                          : 'text-slate-500 hover:text-[#255A84] hover:bg-[#255A84]/5'
                      }`}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={15} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                          {item.path === 'revisions' && pendingRevisionsCount > 0 && (
                            <span className="ml-auto bg-amber-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                              {pendingRevisionsCount}
                            </span>
                          )}
                          {item.path === 'submissions' && pendingSubmissionsCount > 0 && (
                            <span className="ml-auto bg-[#255A84] text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                              {pendingSubmissionsCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="pt-4 mt-3 border-t border-slate-100/60">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-[0.97]"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full page-transition relative min-h-screen-ios has-bottom-nav md:pb-0 overflow-hidden">
        {/* Ambient glow decorations */}
        <div className="absolute top-10 left-10 w-[500px] h-[500px] rounded-full ambient-glow-1 pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] rounded-full ambient-glow-2 pointer-events-none -z-10" />
        <Outlet />
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="bottom-nav md:hidden" aria-label="Primary navigation">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname.includes(`/admin/${item.path}`);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`bottom-nav-icon ${isActive ? 'bg-blue-50' : ''}`}>
                <item.icon
                  size={19}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? 'text-[#255A84]' : 'text-slate-400'}
                />
              </div>
              <span className={`bottom-nav-label ${isActive ? 'text-[#255A84]' : 'text-slate-400'}`}>
                {item.shortLabel}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
