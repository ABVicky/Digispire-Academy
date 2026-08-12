import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, Layers, ChevronRight, Award, QrCode, CreditCard, X, Mail, Phone, User, GraduationCap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateAttendance } from '../../utils/attendanceEngine';
import QRCode from 'qrcode';
import IndependenceDayBanner from '../../components/IndependenceDayBanner';
import { isIndependenceDayActive } from '../../utils/independenceDayTheme';
import AshokaChakra from '../../components/AshokaChakra';

export default function StudentDashboard() {
  const { userProfile } = useAuth();
  const isFestiveActive = isIndependenceDayActive();
  const [data, setData] = useState({
    attendancePct: 0,
    enrolledBatches: [],
    upcomingClasses: [],
    mentor: null,
    instructors: []
  });
  const [loading, setLoading] = useState(true);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (userProfile) {
      const payload = {
        uid: userProfile.uid,
        name: userProfile.name,
        role: userProfile.role,
        studentId: userProfile.studentId || '',
        phone: userProfile.phone || ''
      };
      QRCode.toDataURL(JSON.stringify(payload), {
        margin: 1,
        width: 256
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR code:', err));
    }
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile?.uid || !userProfile?.studentId) return;

    const fetchStudentDashboardData = async () => {
      try {
        const studentBatchIds = [...(userProfile.batchIds || (userProfile.batchId ? [userProfile.batchId] : ['morning']))];
        if (userProfile.isIntern && !studentBatchIds.includes('internship')) {
          studentBatchIds.push('internship');
        }
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

        let mentorData = null;
        if (userProfile.mentorId) {
          try {
            const mSnap = await getDoc(doc(db, 'users', userProfile.mentorId));
            if (mSnap.exists()) {
              mentorData = { id: mSnap.id, ...mSnap.data() };
            }
          } catch (err) {
            console.error('Failed to fetch mentor:', err);
          }
        }

        const educatorNames = enrolledBatches
          .map(b => b.educator)
          .filter(name => name && typeof name === 'string' && name.trim() !== '');

        let instructorsList = [];
        if (educatorNames.length > 0) {
          try {
            const staffSnap = await getDocs(
              query(collection(db, 'users'), where('role', 'in', ['admin', 'educator']))
            );
            const staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Match staff by name (case-insensitive, trimmed comparison)
            instructorsList = staffList.filter(s => 
              educatorNames.some(name => s.name?.toLowerCase().trim() === name.toLowerCase().trim())
            );
          } catch (err) {
            console.error('Failed to fetch instructors:', err);
          }
        }

        setData({ 
          attendancePct, 
          enrolledBatches, 
          upcomingClasses, 
          mentor: mentorData,
          instructors: instructorsList
        });
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
      {/* ─── Festive Independence Day Banner ─── */}
      <IndependenceDayBanner />

      {/* ─── Hero Welcome Card ─── */}
      <div className="relative bg-gradient-to-br from-[#255A84] via-[#1d486b] to-[#163650] rounded-2xl p-5 text-white overflow-hidden shadow-lg border border-white/10">
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 shadow-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover" />
            ) : (
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-2 bg-white rounded-xl" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.2em]">Student Portal</p>
              {isFestiveActive && (
                <span className="text-[10px] font-black tracking-wider text-amber-300 uppercase px-1.5 py-0.5 rounded bg-white/10 border border-white/10 inline-flex items-center gap-1">
                  🇮🇳 Happy 15 Aug
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold mt-0.5 tracking-tight truncate">{userProfile?.name || 'Student'}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono font-bold text-blue-300">ID: {userProfile?.studentId}</span>
              <button 
                type="button"
                onClick={() => setShowIdCardModal(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-md text-[9px] font-black tracking-wider uppercase transition border border-white/10 cursor-pointer shrink-0 select-none"
              >
                <CreditCard size={10} /> View ID
              </button>
            </div>
          </div>
        </div>

        {/* Ambient Backdrops (Saffron + Green + Blue glows if festive active) */}
        {isFestiveActive ? (
          <>
            <div className="absolute -right-6 -top-6 w-36 h-36 bg-[#FF9933]/30 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-6 -bottom-6 w-36 h-36 bg-[#138808]/30 rounded-full blur-2xl pointer-events-none" />
            <div className="chakra-watermark pointer-events-none text-white/10">
              <AshokaChakra size={180} animate={true} />
            </div>
          </>
        ) : (
          <>
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-[#F48B1F]/20 rounded-full blur-2xl" />
            <div className="absolute -left-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-xl" />
          </>
        )}
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
                    {b.startTime} – {b.endTime} {b.educator ? `· ${b.educator}` : ''}
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

      {/* ─── Assigned Mentor ─── */}
      {data.mentor && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <User size={14} className="text-emerald-500" /> Assigned Mentor
          </h2>
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="h-12 w-12 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
              {data.mentor.photoURL ? (
                <img src={data.mentor.photoURL} alt={data.mentor.name} className="h-full w-full object-cover" />
              ) : (
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5 bg-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 text-sm truncate">{data.mentor.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{data.mentor.role || 'Educator'}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500 font-medium">
                {data.mentor.email && (
                  <a href={`mailto:${data.mentor.email}`} className="hover:text-[#255A84] transition-colors flex items-center gap-1">
                    <Mail size={12} className="text-slate-400" /> {data.mentor.email}
                  </a>
                )}
                {data.mentor.phone && (
                  <a href={`tel:${data.mentor.phone}`} className="hover:text-[#255A84] transition-colors flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" /> {data.mentor.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Teaching Faculty ─── */}
      {data.instructors && data.instructors.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <GraduationCap size={14} className="text-blue-500" /> Teaching Faculty
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {data.instructors.map(inst => (
              <div key={inst.id} className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="h-12 w-12 rounded-xl bg-[#255A84] text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                  {inst.photoURL ? (
                    <img src={inst.photoURL} alt={inst.name} className="h-full w-full object-cover" />
                  ) : (
                    <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1.5 bg-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-sm truncate">{inst.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{inst.role === 'admin' ? 'Lead Faculty' : 'Educator'}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500 font-medium">
                    {inst.email && (
                      <a href={`mailto:${inst.email}`} className="hover:text-[#255A84] transition-colors flex items-center gap-1">
                        <Mail size={12} className="text-slate-400" /> {inst.email}
                      </a>
                    )}
                    {inst.phone && (
                      <a href={`tel:${inst.phone}`} className="hover:text-[#255A84] transition-colors flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" /> {inst.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
      {/* ── DIGITAL ID CARD MODAL ── */}
      {showIdCardModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowIdCardModal(false)}>
          <div className="modal-container-premium max-w-sm sm:max-w-md bg-transparent border-transparent shadow-none" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-t-2xl border-b border-white/10">
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">Identity Verification</span>
              <button onClick={() => setShowIdCardModal(false)} className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-white/10 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-900/60 backdrop-blur-md rounded-b-2xl flex flex-col items-center gap-5">
              {/* Flipping Card */}
              <div className="id-card-perspective w-80 h-[480px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`id-card-inner rounded-3xl shadow-2xl ${isFlipped ? 'id-card-flipped' : ''}`}>
                  
                  {/* Card Front */}
                  <div className="id-card-front bg-gradient-to-br from-[#1a3852] via-[#255A84] to-[#0c1a26] text-white flex flex-col justify-between p-6 absolute inset-0 overflow-hidden select-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#F48B1F]/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#255A84]/40 rounded-full blur-2xl pointer-events-none" />
                    {isFestiveActive && (
                      <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none text-white">
                        <AshokaChakra size={160} animate={true} />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm shrink-0">
                          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <h4 className="font-heading font-black tracking-wider text-xs leading-none">DIGISPIRE</h4>
                          <span className="text-[7px] text-[#F48B1F] tracking-[0.25em] font-extrabold uppercase mt-0.5 block">Academy Portal</span>
                        </div>
                      </div>
                      {isFestiveActive ? (
                        <span className="text-[7px] font-black uppercase tracking-wider text-amber-300 border border-amber-300/40 px-2 py-0.5 rounded bg-gradient-to-r from-orange-500/30 to-emerald-500/30 flex items-center gap-1 shadow-sm">
                          🇮🇳 80th Independence Edition
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300 border border-white/15 px-2 py-0.5 rounded bg-white/5">
                          ID Badge
                        </span>
                      )}
                    </div>

                    <div className="text-center my-auto py-2 space-y-4">
                      <div className="h-28 w-28 rounded-2xl bg-white/5 p-1 border border-white/20 shadow-2xl mx-auto overflow-hidden relative">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover rounded-xl" />
                        ) : (
                          <div className="h-full w-full bg-white flex items-center justify-center rounded-xl p-2.5">
                            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-heading font-extrabold text-white tracking-tight leading-snug">{userProfile?.name}</h3>
                        <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-1.5 bg-emerald-500 text-white">
                          Student
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 flex items-end justify-between">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div>
                          <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Identifier ID</p>
                          <p className="text-xs font-mono font-bold text-white tracking-wide">{userProfile?.studentId || 'DS000000'}</p>
                        </div>
                        <div>
                          <p className="text-[7px] font-bold uppercase text-slate-400 tracking-wider">Enrolled Course</p>
                          <p className="text-[10px] font-semibold text-slate-200 truncate pr-4">{userProfile?.course || 'General Curriculum'}</p>
                        </div>
                      </div>
                      <div className="h-7 w-9 rounded bg-gradient-to-br from-yellow-300 to-yellow-600 opacity-60 border border-yellow-200/50 shadow-inner flex flex-col gap-0.5 p-1 shrink-0">
                        <div className="flex gap-1 h-full"><div className="w-1/2 border-r border-yellow-700/30"></div><div className="w-1/2"></div></div>
                      </div>
                    </div>
                  </div>

                  {/* Card Back */}
                  <div className="id-card-back bg-gradient-to-br from-[#1a3852] via-[#255A84] to-[#0c1a26] text-white flex flex-col justify-between p-6 absolute inset-0 overflow-hidden select-none">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-[#255A84]/40 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#F48B1F]/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="text-center border-b border-white/10 pb-2.5">
                      <h4 className="font-heading font-black tracking-wider text-xs leading-none">DIGISPIRE ACADEMY</h4>
                      <span className="text-[6px] text-slate-400 uppercase tracking-widest mt-1 block">Verification & Access</span>
                    </div>

                    <div className="my-auto text-center space-y-3">
                      <div className="w-36 h-36 bg-white p-2.5 rounded-2xl shadow-2xl flex items-center justify-center mx-auto border border-white/10 relative">
                        {qrCodeUrl ? (
                          <img src={qrCodeUrl} alt="QR Code" className="h-full w-full object-contain" />
                        ) : (
                          <div className="animate-pulse h-full w-full bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-xs">
                            Generating...
                          </div>
                        )}
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Scan for Verification</p>
                    </div>

                    <div className="border-t border-white/10 pt-3.5 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div>
                          <span className="text-slate-400 block text-[7px] uppercase tracking-wider font-medium">Contact Phone</span>
                          <span className="font-semibold text-slate-200">{userProfile?.phone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[7px] uppercase tracking-wider font-medium">Enrolled Date</span>
                          <span className="font-semibold text-slate-200">{userProfile?.joiningDate || '—'}</span>
                        </div>
                      </div>

                      <p className="text-[7px] text-slate-400 leading-tight font-medium text-center pt-1">
                        This digital card certifies enrollment status. If found, please return to Admin Office.
                      </p>

                      <div className="flex justify-center items-center gap-0.5 opacity-30 pt-1">
                        {[1,3,2,1,4,2,1,3,2,1,4,1,2,3,1,2,4,1,2,3].map((w, i) => (
                          <div key={i} className="bg-white h-5" style={{ width: `${w}px` }} />
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Flip Button */}
              <button 
                type="button"
                onClick={() => setIsFlipped(!isFlipped)} 
                className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                Flip Card
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
