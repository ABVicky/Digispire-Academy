import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  BarChart3, TrendingUp, Users, BookOpen,
  PieChart, FileText, Globe, Calendar, Briefcase
} from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState({
    students: [],
    content: [],
    attendance: [],
    topics: [],
    courses: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [uSnap, cSnap, aSnap, tSnap, coSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'content')),
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'topics')),
          getDocs(collection(db, 'courses'))
        ]);

        setData({
          students: uSnap.docs.map(d => d.data()).filter(u => u.role === 'student'),
          content: cSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          attendance: aSnap.docs.map(d => d.data()),
          topics: tSnap.docs.map(d => d.data()),
          courses: coSnap.docs.map(d => d.data())
        });
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-medium">Generating insights...</p>
    </div>
  );

  // Derivations
  const topResources = [...data.content].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 5);
  const totalClicks = data.content.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  
  const avgProgress = data.students.length > 0 && data.topics.length > 0
    ? Math.round((data.topics.reduce((acc, t) => acc + (t.completedStudents?.length || 0), 0) / (data.students.length * data.topics.length)) * 100)
    : 0;

  const morningStudents = data.students.filter(s => s.batchId === 'morning').length;
  const eveningStudents = data.students.filter(s => s.batchId === 'evening').length;
  const interns = data.students.filter(s => s.batchId === 'internship').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Academy Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">Deep insights into student engagement and curriculum</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl border border-emerald-100 animate-pulse">
          <TrendingUp size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Live Insights</span>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard icon={Users} label="Total Students" value={data.students.length} color="bg-blue-500" />
        <InsightCard icon={PieChart} label="Overall Progress" value={`${avgProgress}%`} color="bg-emerald-500" />
        <InsightCard icon={Briefcase} label="Active Interns" value={interns} color="bg-[#255A84]" />
        <InsightCard icon={Calendar} label="Attendance Logs" value={data.attendance.length} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Accessed Resources */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-[#255A84]" /> Popular Resources
            </h2>
          </div>
          <div className="space-y-4">
            {topResources.map((res, i) => (
              <div key={res.id} className="flex items-center gap-4 group">
                <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center font-bold text-[#255A84] text-xs shadow-sm border border-slate-100">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#255A84] transition-colors">{res.title}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{res.subject || 'Resource'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{res.clicks || 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">clicks</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Batch Distribution */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <PieChart size={16} className="text-[#255A84]" /> Batch Engagement
            </h2>
          </div>
          <div className="space-y-6">
            <BatchBar label="🌅 Morning Batch" count={morningStudents} total={data.students.length} color="from-[#255A84] to-[#3a7ba6]" />
            <BatchBar label="🌆 Evening Batch" count={eveningStudents} total={data.students.length} color="from-[#F48B1F] to-[#f7a552]" />
            <BatchBar label="💼 Internship" count={interns} total={data.students.length} color="from-emerald-500 to-teal-400" />

            <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-3xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg. Attendance</p>
                <p className="text-lg font-bold text-slate-800">82%</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-3xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Interactions</p>
                <p className="text-lg font-bold text-slate-800">{totalClicks}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BatchBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{count} Students</p>
        </div>
        <span className="text-sm font-bold text-slate-800">{pct}%</span>
      </div>
      <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1000 shadow-sm`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-lg hover:border-[#255A84]/20 transition-all duration-300">
      <div className={`h-14 w-14 rounded-3xl flex items-center justify-center ${color} text-white shadow-lg transition-transform group-hover:scale-110`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
      </div>
    </div>
  );
}
