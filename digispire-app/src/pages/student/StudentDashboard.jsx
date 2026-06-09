import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, Layers, ChevronRight, Award, QrCode
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateAttendance } from '../../utils/attendanceEngine';

export default function StudentDashboard() {
  const { userProfile } = useAuth();
  const [data, setData] = useState({
    attendancePct: 0,
    enrolledBatches: [],
    upcomingClasses: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.studentId) return;

    const fetchStudentDashboardData = async () => {
      try {
        const studentBatchIds = userProfile.batchIds || (userProfile.batchId ? [userProfile.batchId] : ['morning']);
        const [attSnap, batchesSnap, holidaysSnap, cancellationsSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'batches')),
          getDocs(collection(db, 'holidays')),
          getDocs(collection(db, 'cancelled_classes'))
        ]);
        const myAtt = attSnap.docs.map(d => d.data()).filter(d => d.studentId === userProfile.studentId);
        const allBatches = batchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const holidays = holidaysSnap.docs.map(d => d.data());
        const cancellations = cancellationsSnap.docs.map(d => d.data());
        const enrolledBatches = allBatches.filter(b => studentBatchIds.includes(b.id));

        let totalPct = 0, countedBatches = 0;
        enrolledBatches.forEach(bSchedule => {
          const stats = calculateAttendance({
            student: userProfile,
            attendanceLogs: myAtt,
            batchSchedule: bSchedule,
            holidays,
            cancelledClasses: cancellations
          });
          totalPct += stats.attendancePercentage;
          countedBatches++;
        });
        const attendancePct = countedBatches > 0 ? Math.round(totalPct / countedBatches) : 100;

        const dayOfWeek = new Date().getDay();
        const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;
        const getWeeklyDays = (b) => {
          if (b.weeklyDays && Array.isArray(b.weeklyDays)) return b.weeklyDays;
          if (b.schedule && Array.isArray(b.schedule)) {
            const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
            return b.schedule.map(d => dayMap[d.toLowerCase()]).filter(d => d !== undefined);
          }
          return [];
        };

        const upcomingClasses = [];
        enrolledBatches.forEach(b => {
          const days = getWeeklyDays(b);
          if (days.includes(dayOfWeek)) {
            upcomingClasses.push({ id: `${b.id}-today`, name: b.name || b.id, time: `${b.startTime || '09:00'} – ${b.endTime || '11:00'}`, day: 'Today', educator: b.educator || 'Faculty' });
          }
          if (days.includes(tomorrowDayOfWeek)) {
            upcomingClasses.push({ id: `${b.id}-tomorrow`, name: b.name || b.id, time: `${b.startTime || '09:00'} – ${b.endTime || '11:00'}`, day: 'Tomorrow', educator: b.educator || 'Faculty' });
          }
        });
        setData({ attendancePct, enrolledBatches, upcomingClasses });
      } catch (err) {
        console.error('Error fetching student stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentDashboardData();
  }, [userProfile]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#255A84] border-t-transparent" />
      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading...</p>
    </div>
  );

  const pctColor = data.attendancePct >= 75 ? 'text-emerald-500' : data.attendancePct >= 50 ? 'text-amber-500' : 'text-rose-500';
  const pctBg = data.attendancePct >= 75 ? 'bg-emerald-50' : data.attendancePct >= 50 ? 'bg-amber-50' : 'bg-rose-50';
  const pctBar = data.attendancePct >= 75 ? 'bg-emerald-500' : data.attendancePct >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-4 pb-4 font-sans">
      {/* ─── Hero Welcome Card ─── */}
      <div className="relative bg-gradient-to-br from-[#255A84] to-[#1a4261] rounded-2xl p-5 text-white overflow-hidden shadow-lg border border-white/10">
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 shadow-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-white font-bold text-xl">{userProfile?.name?.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.2em]">Student Portal</p>
            <h1 className="text-lg font-bold mt-0.5 tracking-tight truncate">{userProfile?.name || 'Student'}</h1>
            <p className="text-[11px] font-mono font-bold text-blue-300 mt-0.5">ID: {userProfile?.studentId}</p>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-[#F48B1F]/20 rounded-full blur-2xl" />
        <div className="absolute -left-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-xl" />
      </div>

      {/* ─── Attendance + Quick Check-in Row ─── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Attendance % */}
        <div className={`${pctBg} rounded-2xl p-4 border border-slate-100 flex flex-col justify-between min-h-[110px]`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attendance</p>
            <Award size={16} className={pctColor} />
          </div>
          <div>
            <p className={`text-3xl font-black ${pctColor} leading-none`}>{data.attendancePct}%</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Goal: 75%+</p>
            {/* Mini progress bar */}
            <div className="mt-2 h-1 bg-slate-200/60 rounded-full overflow-hidden">
              <div className={`h-full ${pctBar} rounded-full transition-all`} style={{ width: `${Math.min(data.attendancePct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Quick Check-in CTA */}
        <Link
          to="/student/attendance"
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[110px] active:scale-[0.98] transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Check-In</p>
            <QrCode size={16} className="text-[#255A84]" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">Scan QR Code</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Mark attendance</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] font-bold text-[#255A84]">Open terminal</span>
              <ChevronRight size={11} className="text-[#255A84]" />
            </div>
          </div>
        </Link>
      </div>

      {/* ─── Enrolled Batches ─── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} className="text-[#255A84]" /> Enrolled Batches
        </h2>
        {data.enrolledBatches.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">Not enrolled in any active batch.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {data.enrolledBatches.map(b => (
              <div key={b.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{b.name || b.id}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {b.startTime} – {b.endTime}
                  </p>
                </div>
                <span className="badge-premium-blue shrink-0">Enrolled</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Upcoming Classes ─── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
          <Clock size={14} className="text-orange-500" /> Upcoming Classes
        </h2>
        {data.upcomingClasses.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center italic">No classes today or tomorrow.</p>
        ) : (
          data.upcomingClasses.map(cls => (
            <div key={cls.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{cls.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{cls.time} · {cls.educator}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shrink-0 ${
                cls.day === 'Today' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {cls.day}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ─── Attendance History shortcut ─── */}
      <Link
        to="/student/attendance"
        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl active:scale-[0.99] transition hover:bg-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-blue-50 text-[#255A84] rounded-xl flex items-center justify-center shrink-0">
            <Calendar size={16} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-xs">View Attendance Calendar</p>
            <p className="text-[10px] text-slate-400 font-medium">Full history & check-in logs</p>
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-400 shrink-0" />
      </Link>
    </div>
  );
}
