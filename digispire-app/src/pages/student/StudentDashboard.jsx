import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, Layers, ChevronRight, Award, QrCode, CreditCard,
  X, Mail, Phone, User, GraduationCap, ShieldCheck, Megaphone,
  AlertTriangle, Bell, Pin, ChevronLeft, Eye, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateAttendance } from '../../utils/attendanceEngine';
import QRCode from 'qrcode';

export default function StudentDashboard() {
  const { userProfile } = useAuth();
  const [data, setData] = useState({
    attendancePct: 0,
    enrolledBatches: [],
    upcomingClasses: [],
    mentor: null,
    instructors: [],
    announcements: []
  });
  const [loading, setLoading] = useState(true);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Announcements state
  const [dismissedIds, setDismissedIds] = useState([]);
  const [showAllAnnouncementsModal, setShowAllAnnouncementsModal] = useState(false);

  useEffect(() => {
    if (userProfile?.studentId) {
      try {
        const stored = localStorage.getItem(`ds_dismissed_announcements_${userProfile.studentId}`);
        if (stored) {
          setDismissedIds(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Error loading dismissed announcements:', err);
      }
    }
  }, [userProfile]);

  const dismissAnnouncement = (id, e) => {
    if (e) e.stopPropagation();
    if (!userProfile?.studentId) return;
    const updated = [...new Set([...dismissedIds, id])];
    setDismissedIds(updated);
    try {
      localStorage.setItem(`ds_dismissed_announcements_${userProfile.studentId}`, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving dismissed announcement:', err);
    }
  };

  const restoreDismissedAnnouncements = () => {
    if (!userProfile?.studentId) return;
    setDismissedIds([]);
    localStorage.removeItem(`ds_dismissed_announcements_${userProfile.studentId}`);
  };

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
        
        const [attSnap, batchesSnap, holidaysSnap, cancellationsSnap, annSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'batches')),
          getDocs(collection(db, 'holidays')),
          getDocs(collection(db, 'cancelled_classes')),
          getDocs(collection(db, 'announcements'))
        ]);

        const myAtt = attSnap.docs.map(d => d.data()).filter(d => d.studentId === userProfile.studentId);
        const allBatches = batchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const holidays = holidaysSnap.docs.map(d => d.data());
        const cancellations = cancellationsSnap.docs.map(d => d.data());
        const enrolledBatches = allBatches.filter(b => studentBatchIds.includes(b.id));

        // Process batch announcements
        const rawAnnouncements = annSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const relevantAnnouncements = rawAnnouncements.filter(a => {
          const targetList = Array.isArray(a.targetBatchIds)
            ? a.targetBatchIds
            : (a.targetBatchId ? [a.targetBatchId] : ['all']);

          if (targetList.includes('all')) return true;
          return studentBatchIds.some(bId => targetList.includes(bId));
        });

        relevantAnnouncements.sort((a, b) => {
          if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });

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
          instructors: instructorsList,
          announcements: relevantAnnouncements
        });
      } catch (err) {
        console.error('Error fetching student stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentDashboardData();
  }, [userProfile]);

  // Active (non-dismissed) announcements
  const activeAnnouncements = useMemo(() => {
    return data.announcements.filter(a => !dismissedIds.includes(a.id));
  }, [data.announcements, dismissedIds]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#1E3A5F] border-t-transparent" />
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Loading Academic Dossier...</p>
    </div>
  );

  const pctColor = data.attendancePct >= 75 ? 'text-emerald-700' : data.attendancePct >= 50 ? 'text-amber-700' : 'text-rose-700';
  const pctBg = data.attendancePct >= 75 ? 'bg-emerald-50 border-emerald-200' : data.attendancePct >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
  const pctBar = data.attendancePct >= 75 ? 'bg-emerald-600' : data.attendancePct >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-5 pb-6 font-sans">
      {/* ─── Formal Student Dossier Banner ─── */}
      <div className="bg-[#1E3A5F] rounded-xl p-5 sm:p-6 text-white shadow-sm border border-slate-700/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white p-1 shadow-sm border border-white/20 shrink-0 overflow-hidden flex items-center justify-center">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover rounded-lg" />
              ) : (
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Official Student Record</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-0.5 truncate">{userProfile?.name || 'Student'}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-300">
                <span className="font-mono font-bold tracking-wider">ID: {userProfile?.studentId}</span>
                <span>·</span>
                <span className="font-medium text-slate-200">{userProfile?.course || 'General Curriculum'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setShowIdCardModal(true)}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition border border-white/20 cursor-pointer"
          >
            <CreditCard size={14} />
            <span>Digital Identity Badge</span>
          </button>
        </div>
      </div>

      {/* ─── Academic Announcements / Alert Banners ─── */}
      {activeAnnouncements.length > 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Megaphone size={14} className="text-[#1E3A5F]" />
              <span>Official Academic Notices</span>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold flex items-center justify-center">
                {activeAnnouncements.length}
              </span>
            </div>
            {data.announcements.length > activeAnnouncements.length && (
              <button
                onClick={() => setShowAllAnnouncementsModal(true)}
                className="text-[11px] font-bold text-[#1E3A5F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Notice Archive</span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {activeAnnouncements.map((ann) => {
              const isUrgent = ann.priority === 'urgent';
              const isImportant = ann.priority === 'important';
              
              const bannerBg = isUrgent
                ? 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-xs'
                : isImportant
                  ? 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-xs'
                  : 'bg-blue-50/95 border-blue-200 text-slate-900 shadow-2xs';

              const badgeColor = isUrgent
                ? 'bg-rose-600 text-white'
                : isImportant
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#1E3A5F] text-white';

              const dateStr = ann.createdAt?.seconds
                ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString('en-IN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })
                : 'Recent';

              return (
                <div
                  key={ann.id}
                  className={`rounded-xl border p-4 sm:p-5 relative transition-all ${bannerBg}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${badgeColor}`}>
                        {isUrgent ? <AlertTriangle size={18} /> : isImportant ? <Bell size={18} /> : <Megaphone size={18} />}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            isUrgent ? 'bg-rose-200/80 text-rose-800' : isImportant ? 'bg-amber-200/80 text-amber-900' : 'bg-blue-200/80 text-[#1E3A5F]'
                          }`}>
                            {isUrgent ? 'Urgent Alert' : isImportant ? 'Important Notice' : 'Faculty Broadcast'}
                          </span>
                          {ann.pinned && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Pin size={10} /> Pinned
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-medium">
                            {dateStr}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug tracking-tight">
                          {ann.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={(e) => dismissAnnouncement(ann.id, e)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-black/5 transition cursor-pointer shrink-0"
                      title="Dismiss alert banner"
                      aria-label="Dismiss announcement"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="mt-3 pl-12">
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-line">
                      {ann.message}
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-black/5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                      <span>
                        Audience: <strong className="text-slate-700 uppercase">
                          {Array.isArray(ann.targetBatchIds)
                            ? (ann.targetBatchIds.includes('all') ? 'All Batches' : ann.targetBatchIds.join(', '))
                            : (ann.targetBatchId === 'all' ? 'All Batches' : (ann.targetBatchId || 'Enrolled Track'))}
                        </strong>
                      </span>
                      <span>
                        Published by: <strong className="text-slate-700">{ann.authorName}</strong> ({ann.authorRole})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Attendance Record & Quick Terminal CTA ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Attendance Percentage Metric */}
        <div className={`${pctBg} rounded-xl p-5 border flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Attendance Compliance</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Minimum standard: 75.0% required</p>
            </div>
            <Award size={18} className={pctColor} />
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-extrabold ${pctColor} leading-none font-mono`}>{data.attendancePct}%</p>
              <span className="text-xs text-slate-500 font-semibold">
                {data.attendancePct >= 75 ? 'Compliant' : 'Attention Required'}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
              <div className={`h-full ${pctBar} rounded-full transition-all`} style={{ width: `${Math.min(data.attendancePct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Attendance Terminal Link */}
        <Link
          to="/student/attendance"
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Classroom Check-In</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">Session Verification Terminal</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[#1E3A5F]">
              <QrCode size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-[#1E3A5F]">Scan Session Broadcaster</span>
            <ChevronRight size={14} className="text-[#1E3A5F]" />
          </div>
        </Link>
      </div>

      {/* ─── Enrolled Academic Batches ─── */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Layers size={14} className="text-[#1E3A5F]" /> Enrolled Academic Batches
        </h2>
        {data.enrolledBatches.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">No active batch enrolment recorded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {data.enrolledBatches.map(b => (
              <div key={b.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs tracking-tight">{b.name || b.id}</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Schedule: {b.startTime || '09:00'} – {b.endTime || '11:00'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Lead: {b.educator || 'Faculty Lead'}
                  </p>
                </div>
                <span className="badge-premium-blue text-[9px]">Enrolled</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Scheduled Lectures Timetable ─── */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Calendar size={14} className="text-[#1E3A5F]" /> Scheduled Lectures
        </h2>
        {data.upcomingClasses.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">No scheduled lectures today or tomorrow.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {data.upcomingClasses.map(c => (
              <div key={c.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      c.day === 'Today' ? 'bg-[#1E3A5F] text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {c.day}
                    </span>
                    <span className="font-bold text-slate-800 text-xs">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><Clock size={11} /> {c.time}</span>
                    <span>·</span>
                    <span>{c.educator}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Assigned Faculty & Academic Mentorship ─── */}
      {(data.mentor || data.instructors.length > 0) && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <GraduationCap size={14} className="text-[#1E3A5F]" /> Faculty & Mentorship Directory
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {data.mentor && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Assigned Advisor</span>
                  <h3 className="font-bold text-slate-800 text-xs truncate mt-0.5">{data.mentor.name}</h3>
                  <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                    {data.mentor.email && <p className="flex items-center gap-1.5 truncate"><Mail size={10} /> {data.mentor.email}</p>}
                    {data.mentor.phone && <p className="flex items-center gap-1.5"><Phone size={10} /> {data.mentor.phone}</p>}
                  </div>
                </div>
              </div>
            )}
            {data.instructors.map(inst => (
              <div key={inst.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <GraduationCap size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Course Faculty</span>
                  <h3 className="font-bold text-slate-800 text-xs truncate mt-0.5">{inst.name}</h3>
                  <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                    {inst.email && <p className="flex items-center gap-1.5 truncate"><Mail size={10} /> {inst.email}</p>}
                    {inst.phone && <p className="flex items-center gap-1.5"><Phone size={10} /> {inst.phone}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Digital ID Card Modal ─── */}
      {showIdCardModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowIdCardModal(false)}>
          <div className="modal-container-premium max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Digital Student ID</span>
              <button onClick={() => setShowIdCardModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={16} />
              </button>
            </div>
            
            <div className="modal-body-premium flex flex-col items-center gap-4 py-4">
              <div className="id-card-perspective w-68 h-[420px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`id-card-inner rounded-2xl shadow-xl ${isFlipped ? 'id-card-flipped' : ''}`}>
                  
                  {/* CARD FRONT */}
                  <div className="id-card-front bg-[#1E3A5F] text-white flex flex-col justify-between p-5 absolute inset-0 border border-slate-600 select-none">
                    <div className="flex items-center justify-between border-b border-white/15 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-white rounded-md flex items-center justify-center p-1 shrink-0">
                          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <h4 className="font-heading font-extrabold tracking-tight text-xs leading-none">DIGISPIRE ACADEMY</h4>
                          <span className="text-[7px] text-slate-300 tracking-widest uppercase mt-0.5 block">Official Credential</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300 border border-white/20 px-1.5 py-0.5 rounded bg-white/5">
                        STUDENT
                      </span>
                    </div>

                    <div className="text-center my-auto py-2 space-y-2.5">
                      <div className="h-20 w-20 rounded-xl bg-white p-1 border border-white/20 mx-auto overflow-hidden">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover rounded-lg" />
                        ) : (
                          <div className="h-full w-full bg-slate-100 flex items-center justify-center rounded-lg p-1.5">
                            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">{userProfile?.name}</h3>
                        <p className="text-[9px] text-slate-300 mt-0.5">{userProfile?.course || 'General Curriculum'}</p>
                      </div>
                    </div>

                    <div className="border-t border-white/15 pt-2.5 flex items-end justify-between text-xs">
                      <div className="space-y-0.5">
                        <p className="text-[7px] font-bold uppercase text-slate-300">Identifier ID</p>
                        <p className="font-mono font-bold text-white text-[11px] tracking-wider">{userProfile?.studentId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-bold uppercase text-slate-300">Status</p>
                        <p className="text-[9px] font-semibold text-emerald-300">Verified</p>
                      </div>
                    </div>
                  </div>

                  {/* CARD BACK */}
                  <div className="id-card-back bg-[#1E3A5F] text-white flex flex-col justify-between p-5 absolute inset-0 border border-slate-600 select-none">
                    <div className="text-center border-b border-white/15 pb-2">
                      <h4 className="font-heading font-bold text-xs tracking-tight">DIGISPIRE ACADEMY</h4>
                      <span className="text-[7px] text-slate-300 uppercase tracking-wider block mt-0.5">Verification Barcode</span>
                    </div>

                    <div className="my-auto text-center space-y-2">
                      <div className="w-28 h-28 bg-white p-2 rounded-xl flex items-center justify-center mx-auto border border-white/20">
                        {qrCodeUrl ? (
                          <img src={qrCodeUrl} alt="QR Code" className="h-full w-full object-contain" />
                        ) : (
                          <div className="text-xs text-slate-400">Loading...</div>
                        )}
                      </div>
                      <p className="text-[7px] font-mono text-slate-300 uppercase tracking-widest">Scan for Verification</p>
                    </div>

                    <div className="border-t border-white/15 pt-2 text-[7px] text-slate-300 text-center leading-normal">
                      This digital credential certifies official enrollment. Property of DIGISPIRE Academy.
                    </div>
                  </div>

                </div>
              </div>

              <button 
                type="button"
                onClick={() => setIsFlipped(!isFlipped)} 
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Flip Credential
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Notice Archive Drawer Modal ─── */}
      {showAllAnnouncementsModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowAllAnnouncementsModal(false)}>
          <div className="modal-container-premium max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-[#1E3A5F]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Official Notice Archive</h3>
              </div>
              <button onClick={() => setShowAllAnnouncementsModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body-premium space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-[11px] text-slate-500">All broadcast notices for your enrolled tracks</span>
                {dismissedIds.length > 0 && (
                  <button
                    onClick={restoreDismissedAnnouncements}
                    className="text-[11px] font-bold text-[#1E3A5F] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} /> Restore All to Dashboard
                  </button>
                )}
              </div>

              {data.announcements.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">No broadcast announcements recorded.</p>
              ) : (
                data.announcements.map(ann => {
                  const isDismissed = dismissedIds.includes(ann.id);
                  const dateStr = ann.createdAt?.seconds
                    ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString('en-IN', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : 'Recent';

                  return (
                    <div key={ann.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            ann.priority === 'urgent' ? 'bg-rose-100 text-rose-700' : ann.priority === 'important' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#1E3A5F]'
                          }`}>
                            {ann.priority}
                          </span>
                          <span className="text-[10px] text-slate-400">{dateStr}</span>
                        </div>
                        {isDismissed && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Dismissed</span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-800">{ann.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{ann.message}</p>
                      <p className="text-[10px] text-slate-400 pt-1">Author: {ann.authorName} ({ann.authorRole})</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
