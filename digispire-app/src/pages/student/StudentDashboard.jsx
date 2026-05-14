import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck, BookOpen, TrendingUp, Award,
  Clock, ArrowRight, Star, FileText, Globe, CheckCircle2,
  Zap, Briefcase, Sparkles, Megaphone, Newspaper, QrCode, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';

function detectType(url) {
  if (!url) return 'link';
  const lower = url.toLowerCase();
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) return 'gdrive';
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'pdf';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
  return 'link';
}

function ResourceMiniCard({ item }) {
  const type = detectType(item.fileUrl);
  return (
    <a
      href={item.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-[#255A84]/30 hover:shadow-sm transition group"
    >
      <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
        {type === 'pdf' ? <FileText size={14} className="text-red-500" /> : <Globe size={14} className="text-blue-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-[#255A84] transition-colors">{item.title}</p>
        <p className="text-[10px] text-slate-400 truncate">{item.subject || 'Resource'}</p>
      </div>
      <ArrowRight size={12} className="text-slate-300 group-hover:text-[#255A84] transition-colors" />
    </a>
  );
}

export default function StudentDashboard() {
  const { userProfile } = useAuth();
  const [data, setData] = useState({
    attendance: 0,
    totalClasses: 0,
    courses: 0,
    topicsDone: 0,
    totalTopics: 0,
    recentResources: [],
    portfolioCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const fetchStudentData = async () => {
      try {
        const [attSnap, coursesSnap, topicsSnap, resSnap, portSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'courses')),
          getDocs(collection(db, 'topics')),
          getDocs(query(collection(db, 'content'), orderBy('createdAt', 'desc'), limit(3))),
          getDocs(collection(db, 'portfolios'))
        ]);

        const myAtt = attSnap.docs.filter(d => d.data().studentId === userProfile.studentId);
        const myTopics = topicsSnap.docs.filter(d => d.data().completedStudents?.includes(userProfile.uid));
        const myPortfolio = portSnap.docs.filter(d => d.data().uid === userProfile.uid);

        const batchDates = new Set(attSnap.docs
          .filter(d => d.data().batchId === userProfile.batchId)
          .map(d => d.data().date)
        );

        setData({
          attendance: myAtt.length,
          totalClasses: Math.max(batchDates.size, myAtt.length, 1),
          courses: coursesSnap.size,
          topicsDone: myTopics.length,
          totalTopics: topicsSnap.size,
          recentResources: resSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          portfolioCount: myPortfolio.length
        });
      } catch (err) {
        console.error('Error fetching student stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentData();
  }, [userProfile]);

  const attendancePct = Math.max(0, Math.round((data.attendance / (data.totalClasses || 1)) * 100));
  const courseProgress = data.totalTopics > 0 ? Math.round((data.topicsDone / data.totalTopics) * 100) : 0;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-medium">Syncing your marketing hub...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Welcome Card */}
      <div className="relative bg-gradient-to-br from-[#255A84] to-[#1a4261] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 text-white overflow-hidden shadow-lg border border-white/10">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl sm:rounded-3xl bg-white/20 backdrop-blur-md p-1 border border-white/20 shadow-xl overflow-hidden flex-shrink-0">
              <div className="h-full w-full rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center text-white font-bold text-xl sm:text-2xl overflow-hidden">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
                ) : (
                  userProfile?.name?.charAt(0)
                )}
              </div>
            </div>
            <div>
              <p className="text-blue-100 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em]">Academy Member</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight truncate max-w-[200px] sm:max-w-none">{userProfile?.name || 'Marketer'}</h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg sm:rounded-xl border border-white/10 shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                    {userProfile?.batchId === 'morning' ? '🌅 Morning' : '🌆 Evening'}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg sm:rounded-xl border border-white/10 shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest">
                    {userProfile?.studentId}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-[#F48B1F]/20 rounded-full blur-3xl" />
        <div className="absolute right-10 top-10 w-20 h-20 bg-blue-400/10 rounded-full blur-2xl animate-pulse" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Zap, label: 'Attendance', value: `${attendancePct}%`, color: 'text-[#255A84]', bg: 'bg-blue-50' },
          { icon: Briefcase, label: 'Portfolio', value: data.portfolioCount, color: 'text-purple-600', bg: 'bg-purple-50' },
          { icon: Award, label: 'Completion', value: `${courseProgress}%`, color: 'text-[#F48B1F]', bg: 'bg-orange-50' },
          { icon: Sparkles, label: 'Academy ID', value: userProfile?.studentId?.substring(2) || '---', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-[1.5rem] sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-50 hover:shadow-md transition-all duration-300 group active:scale-95">
            <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl ${bg} flex items-center justify-center mb-3 sm:mb-4 transition-transform group-hover:scale-110`}>
              <Icon size={20} className={color} />
            </div>
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${color}`}>{value}</p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Certification Card */}
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-50 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h2 className="font-bold text-slate-800 text-[10px] sm:text-xs uppercase tracking-[0.15em] flex items-center gap-2">
                <Award size={18} className="text-[#F48B1F]" /> Certification
              </h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-2xl sm:text-3xl font-bold text-slate-800">{courseProgress}%</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-1.5">Mastery Level</span>
              </div>
              <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-[#F48B1F] to-[#f7a552] rounded-full transition-all duration-1000"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 leading-relaxed">
                Complete {Math.max(0, 100 - courseProgress)}% more of the curriculum to unlock your final Digital Marketing Master certification.
              </p>
            </div>
          </div>
          <div className="absolute -right-4 -top-4 opacity-[0.03] pointer-events-none">
             <Award size={120} />
          </div>
        </div>

        {/* Marketing Tools Card */}
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-50">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="font-bold text-slate-800 text-[10px] sm:text-xs uppercase tracking-[0.15em] flex items-center gap-2">
              <Zap size={18} className="text-[#255A84]" /> Tools
            </h2>
            <Link to="/student/tools" className="text-[9px] sm:text-[10px] font-bold text-[#255A84] hover:underline uppercase tracking-widest">Explore</Link>
          </div>
          <div className="space-y-3">
             {[
               { name: 'Ads Library', icon: Megaphone, color: 'text-purple-500' },
               { name: 'Analytics', icon: TrendingUp, color: 'text-emerald-500' },
               { name: 'Keyword Hub', icon: Search, color: 'text-blue-500' }
             ].map((t, idx) => (
               <Link key={idx} to="/student/tools" className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors active:scale-95">
                  <div className="flex items-center gap-3">
                    <t.icon size={14} className={t.color} />
                    <span className="text-xs font-bold text-slate-600">{t.name}</span>
                  </div>
                  <ArrowRight size={12} className="text-slate-300" />
               </Link>
             ))}
          </div>
        </div>

        {/* Industry Trends Card */}
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
           <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="font-bold text-slate-800 text-[10px] sm:text-xs uppercase tracking-[0.15em] flex items-center gap-2">
              <Newspaper size={18} className="text-emerald-600" /> Market Trends
            </h2>
          </div>
          <div className="space-y-4">
             {[
               { title: 'AI in Meta Ads', desc: 'How Advantage+ campaigns are changing the game...', icon: Star, color: 'text-emerald-600', bg: 'bg-emerald-50' },
               { title: 'Google SGE Update', desc: 'Search Generative Experience and its impact on SEO...', icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' }
             ].map((trend, idx) => (
               <div key={idx} className="flex gap-4 p-1">
                  <div className={`flex-shrink-0 h-11 w-11 ${trend.bg} rounded-xl flex items-center justify-center ${trend.color} shadow-sm`}>
                    <trend.icon size={18} />
                  </div>
                  <div className="min-w-0">
                     <h4 className="text-xs font-bold text-slate-700 truncate">{trend.title}</h4>
                     <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{trend.desc}</p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Date & Check-in Bar */}
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-5 shadow-sm border border-slate-50 flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        <div className="flex items-center gap-4 w-full sm:w-auto p-2">
          <div className="h-14 w-14 rounded-2xl bg-[#255A84] flex flex-col items-center justify-center text-white flex-shrink-0 shadow-lg shadow-[#255A84]/20">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase leading-none opacity-80">{new Date().toLocaleString('en-IN', { month: 'short' })}</span>
            <span className="text-2xl font-bold leading-tight">{new Date().getDate()}</span>
          </div>
          <div>
            <p className="text-base font-bold text-slate-800 leading-tight">{new Date().toLocaleDateString('en-IN', { weekday: 'long' })}</p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <div className="w-full sm:ml-auto sm:w-auto pb-2 sm:pb-0">
          <Link
            to="/student/attendance"
            className="flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-4.5 bg-[#F48B1F] hover:bg-[#cc7214] text-white text-[11px] font-bold rounded-2xl transition-all shadow-lg shadow-[#F48B1F]/20 uppercase tracking-widest active:scale-95"
          >
            <QrCode size={18} /> Daily Check-in
          </Link>
        </div>
      </div>
    </div>
  );
}
