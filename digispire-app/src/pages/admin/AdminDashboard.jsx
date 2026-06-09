import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Users, CalendarCheck, Clock, UserPlus, Layers,
  ChevronRight, Calendar, AlertCircle, Sparkles, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, color, colorBg, description }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 hover:shadow-md transition duration-300 group">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${colorBg} shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon size={20} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black text-slate-800 leading-none tracking-tight">{value}</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">{label}</p>
        {description && <p className="text-[10px] text-slate-300 mt-0.5 hidden sm:block">{description}</p>}
      </div>
    </div>
  );
}

// Mobile-only card-style student row
function StudentCardMobile({ student, batches }) {
  return (
    <div className="student-card-mobile">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-bold text-sm shrink-0">
          {student.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{student.name}</p>
          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase mt-0.5">{student.studentId}</p>
        </div>
        <span className="text-[10px] text-slate-400 font-medium shrink-0">{student.joiningDate || '—'}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {(student.batchIds || [student.batchId || 'morning']).map(bId => {
          const name = batches.find(b => b.id === bId)?.name || bId;
          return (
            <span key={bId} className="badge-premium-blue">{name}</span>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [toggleMode, setToggleMode] = useState(null);
  const viewMode = toggleMode || (userProfile?.role === 'admin' ? 'admin' : 'educator');

  const [data, setData] = useState({
    students: [], batches: [], attendance: [],
    todayAttendance: [], courses: 0, classSessionsToday: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const [usersSnap, attSnap, batchesSnap, coursesSnap, classSessionsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'batches')),
          getDocs(collection(db, 'courses')),
          getDocs(collection(db, 'class_sessions'))
        ]);
        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allAtt = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allBatches = batchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const classSessionsToday = classSessionsSnap.docs.map(d => d.data()).filter(s => s.date === todayStr);
        setData({
          students: allUsers.filter(u => u.role === 'student'),
          batches: allBatches,
          attendance: allAtt,
          todayAttendance: allAtt.filter(a => a.date === todayStr),
          courses: coursesSnap.size,
          classSessionsToday
        });
      } catch (err) { console.error('Error fetching dashboard stats:', err); }
      finally { setLoading(false); }
    };
    fetchDashboardData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#255A84] border-t-transparent" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest animate-pulse">Loading...</p>
      </div>
    </div>
  );

  const dayOfWeek = new Date().getDay();
  const getWeeklyDays = (b) => {
    if (b.weeklyDays && Array.isArray(b.weeklyDays)) return b.weeklyDays;
    if (b.schedule && Array.isArray(b.schedule)) {
      const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      return b.schedule.map(d => dayMap[d.toLowerCase()]).filter(d => d !== undefined);
    }
    return [];
  };

  const batchesToday = data.batches.filter(b => getWeeklyDays(b).includes(dayOfWeek));
  const todayClassesCount = batchesToday.length;
  const totalStudents = data.students.length;
  const activeStudents = data.students.filter(s => (s.batchIds && s.batchIds.length > 0) || s.batchId).length;
  const totalBatches = data.batches.length;
  const attendanceTodayCount = data.todayAttendance.length;
  const recentAdmissions = [...data.students]
    .sort((a, b) => (b.joiningDate || '').localeCompare(a.joiningDate || ''))
    .slice(0, 5);

  const todayClassesList = batchesToday.map(b => ({
    id: b.id,
    name: b.name || b.id,
    time: `${b.startTime || '09:00'} – ${b.endTime || '11:00'}`,
    educator: b.educator || 'Faculty'
  }));
  const attendancePendingList = batchesToday.filter(b => !data.classSessionsToday.some(s => s.batchId === b.id));
  const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;
  const tomorrowClasses = data.batches.filter(b => getWeeklyDays(b).includes(tomorrowDayOfWeek)).map(b => ({
    id: b.id,
    name: b.name || b.id,
    time: `${b.startTime || '09:00'} – ${b.endTime || '11:00'}`,
    educator: b.educator || 'Faculty'
  }));

  return (
    <div className="space-y-5 font-sans pb-4">
      {/* ─── Page Header ─── */}
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            {viewMode === 'admin' ? 'Administrator Console' : 'Educator Workspace'}
          </h1>
          <p className="text-slate-400 text-xs mt-0.5 font-medium">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* View switcher – admins only */}
        {userProfile?.role === 'admin' && (
          <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto shrink-0">
            <button
              onClick={() => setToggleMode('admin')}
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${viewMode === 'admin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Admin
            </button>
            <button
              onClick={() => setToggleMode('educator')}
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${viewMode === 'educator' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Educator
            </button>
          </div>
        )}
      </div>

      {/* ============================================================
          ADMIN VIEW
      ============================================================ */}
      {viewMode === 'admin' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Stat Cards — 2 col mobile, 3 col sm, 5 col lg */}
          <div className="stat-grid lg:grid-cols-5">
            <StatCard icon={Users} label="Total Students" value={totalStudents} colorBg="bg-blue-50" color="text-blue-600" description="Total registrations" />
            <StatCard icon={Sparkles} label="Active Students" value={activeStudents} colorBg="bg-emerald-50" color="text-emerald-600" description="Enrolled in batches" />
            <StatCard icon={Layers} label="Batches" value={totalBatches} colorBg="bg-purple-50" color="text-purple-600" description="Active course groups" />
            <StatCard icon={CalendarCheck} label="Classes Today" value={todayClassesCount} colorBg="bg-orange-50" color="text-orange-500" description="Scheduled today" />
            <StatCard icon={Clock} label="Check-ins Today" value={attendanceTodayCount} colorBg="bg-indigo-50" color="text-indigo-600" description="Logged entries" />
          </div>

          {/* Recent Admissions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <UserPlus size={16} className="text-[#255A84]" /> Recent Admissions
              </h2>
              <Link to="/admin/students" className="text-xs font-bold text-[#255A84] hover:underline flex items-center gap-0.5">
                View All <ChevronRight size={13} />
              </Link>
            </div>

            {/* Desktop Table */}
            <div className="data-table-wrap hidden md:block">
              <table className="w-full text-sm table-as-cards" style={{ display: 'table' }}>
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-left">
                    <th className="px-5 py-3">Student</th>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3">Admitted</th>
                    <th className="px-4 py-3">Enrolled Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                  {recentAdmissions.length === 0 ? (
                    <tr><td colSpan="4" className="py-8 text-center text-slate-400 text-xs">No recent students found</td></tr>
                  ) : (
                    recentAdmissions.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800 text-sm">{student.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{student.studentId}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{student.joiningDate || 'N/A'}</td>
                        <td className="px-4 py-3">
                          {(student.batchIds || [student.batchId || 'morning']).map(bId => {
                            const name = data.batches.find(b => b.id === bId)?.name || bId;
                            return <span key={bId} className="badge-premium-blue mr-1">{name}</span>;
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="p-4 md:hidden">
              {recentAdmissions.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-6">No recent students found</p>
              ) : (
                <div className="cards-list" style={{ display: 'flex' }}>
                  {recentAdmissions.map(student => (
                    <StudentCardMobile key={student.id} student={student} batches={data.batches} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          EDUCATOR VIEW
      ============================================================ */}
      {viewMode === 'educator' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Quick Action Banner – mobile first */}
          <Link
            to="/admin/attendance"
            className="flex items-center justify-between p-4 bg-gradient-to-r from-[#255A84] to-[#1a4261] rounded-2xl text-white shadow-lg shadow-[#255A84]/20 active:scale-[0.99] transition"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Quick Action</p>
              <p className="font-bold text-base mt-0.5">Open Live Console</p>
              <p className="text-[11px] text-blue-200 font-medium mt-0.5">Broadcast QR · Mark Attendance</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <CalendarCheck size={24} className="text-white" />
            </div>
          </Link>

          {/* Educator Stats */}
          <div className="stat-grid">
            <StatCard icon={CalendarCheck} label="Classes Today" value={todayClassesCount} colorBg="bg-blue-50" color="text-blue-600" description="Scheduled today" />
            <StatCard icon={AlertCircle} label="Attendance Due" value={attendancePendingList.length} colorBg="bg-amber-50" color="text-amber-600" description="Unverified codes" />
            <StatCard icon={TrendingUp} label="Check-ins" value={attendanceTodayCount} colorBg="bg-emerald-50" color="text-emerald-600" description="Today's logs" />
          </div>

          {/* Today + Tomorrow Classes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Today's Classes */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <Clock size={15} className="text-[#255A84]" /> Today's Classes
              </h2>
              {todayClassesList.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center italic">No classes today.</p>
              ) : (
                todayClassesList.map(cls => {
                  const isPending = attendancePendingList.some(p => p.id === cls.id);
                  return (
                    <div key={cls.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{cls.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">{cls.time} · {cls.educator}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shrink-0 ${
                        isPending ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {isPending ? 'Pending' : 'Done'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tomorrow's Classes */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={15} className="text-purple-500" /> Tomorrow's Classes
              </h2>
              {tomorrowClasses.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center italic">No classes tomorrow.</p>
              ) : (
                tomorrowClasses.map(cls => (
                  <div key={cls.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{cls.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{cls.time}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">{cls.educator}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Batch Enrollment Summary */}
          {data.batches.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users size={15} className="text-emerald-500" /> Students Per Batch
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.batches.map(batch => {
                  const count = data.students.filter(s => (s.batchIds || [s.batchId || 'morning']).includes(batch.id)).length;
                  return (
                    <div key={batch.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 text-xs truncate">{batch.name || batch.id}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{batch.startTime}–{batch.endTime}</p>
                      </div>
                      <span className="h-9 w-9 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
