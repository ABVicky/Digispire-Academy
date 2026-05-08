import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Users, CalendarCheck, TrendingUp, BookOpen,
  Clock, ArrowRight, FileText, Globe, Link2
} from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, color, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-slate-500">{label}</p>
          {trend && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">+{trend}%</span>}
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ item }) {
  const type = item.type || 'link';
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition group">
      <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
        {type === 'pdf' ? <FileText size={14} className="text-red-500" /> : <Globe size={14} className="text-blue-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 truncate">{item.title}</p>
        <p className="text-[10px] text-slate-400 capitalize">{item.type} · {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</p>
      </div>
      <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-300 hover:text-[#255A84] group-hover:text-[#255A84] transition">
        <ArrowRight size={14} />
      </a>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState({
    students: [],
    attendance: [],
    courses: 0,
    recentResources: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);

        const [usersSnap, attSnap, coursesSnap, resSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'courses')),
          getDocs(query(collection(db, 'content'), orderBy('createdAt', 'desc'), limit(4))),
        ]);

        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allAtt = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setData({
          students: allUsers.filter(u => u.role === 'student'),
          attendance: allAtt,
          todayAttendance: allAtt.filter(a => a.date === todayStr),
          courses: coursesSnap.size,
          recentResources: resSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const totalStudents = data.students.length;
  const todayCount = data.todayAttendance?.length || 0;
  const attendancePct = totalStudents > 0 ? Math.round((todayCount / totalStudents) * 100) : 0;

  const morningStudents = data.students.filter(s => s.batchId === 'morning');
  const eveningStudents = data.students.filter(s => s.batchId === 'evening');

  if (loading) return (
    <div className="flex items-center justify-center h-screen -mt-20">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#255A84] border-t-transparent" />
        <p className="text-slate-400 text-sm font-medium animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex -space-x-2">
          {data.students.slice(0, 5).map((s, i) => (
            <div key={s.id} className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase" style={{ zIndex: 10 - i }}>
              {s.name?.charAt(0)}
            </div>
          ))}
          {totalStudents > 5 && (
            <div className="h-8 w-8 rounded-full border-2 border-white bg-[#255A84] flex items-center justify-center text-[10px] font-bold text-white z-0">
              +{totalStudents - 5}
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Enrolled Students" value={totalStudents} color="bg-[#255A84]" />
        <StatCard icon={CalendarCheck} label="Present Today" value={todayCount} color="bg-[#F48B1F]" />
        <StatCard icon={TrendingUp} label="Daily Avg" value={`${attendancePct}%`} color="bg-emerald-500" />
        <StatCard icon={BookOpen} label="Courses" value={data.courses} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batch Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-[#255A84]" /> Batch Analysis
            </h2>
            <Link to="/admin/students" className="text-xs font-semibold text-[#255A84] hover:underline">Manage All</Link>
          </div>

          <div className="space-y-6 flex-1">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-slate-700">🌅 Morning Batch</span>
                <span className="font-bold text-[#255A84]">{morningStudents.length} / {totalStudents}</span>
              </div>
              <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div
                  className="h-full bg-gradient-to-r from-[#255A84] to-[#3a7ba6] rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(37,90,132,0.3)]"
                  style={{ width: totalStudents > 0 ? `${(morningStudents.length / totalStudents) * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-slate-700">🌆 Evening Batch</span>
                <span className="font-bold text-[#F48B1F]">{eveningStudents.length} / {totalStudents}</span>
              </div>
              <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div
                  className="h-full bg-gradient-to-r from-[#F48B1F] to-[#f7a552] rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(244,139,31,0.3)]"
                  style={{ width: totalStudents > 0 ? `${(eveningStudents.length / totalStudents) * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div className="pt-4 grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-bold text-[#255A84] uppercase mb-1">Morning Activity</p>
                <p className="text-xl font-bold text-slate-800">High</p>
              </div>
              <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                <p className="text-[10px] font-bold text-[#F48B1F] uppercase mb-1">Evening Activity</p>
                <p className="text-xl font-bold text-slate-800">Stable</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Resources */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Recent Activity</h2>
            <Link to="/admin/content" className="p-1.5 hover:bg-slate-50 rounded-lg transition text-slate-400"><ArrowRight size={16} /></Link>
          </div>

          <div className="space-y-3 flex-1">
            {data.recentResources.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                  <Link2 size={20} className="text-slate-300" />
                </div>
                <p className="text-xs text-slate-400">No resources added yet.</p>
              </div>
            ) : (
              data.recentResources.map(item => <ResourceItem key={item.id} item={item} />)
            )}
          </div>

          <Link to="/admin/content" className="mt-6 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-[#255A84] text-xs font-bold rounded-xl transition text-center">
            View All Resources
          </Link>
        </div>
      </div>
    </div>
  );
}
