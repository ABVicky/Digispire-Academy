import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, Clock, Layers, ChevronRight, Award, QrCode, CreditCard, X, Mail, Phone, User, GraduationCap, ShieldCheck
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.enrolledBatches.map(b => (
              <div key={b.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-xs truncate">{b.name || b.id}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5 font-mono">
                    {b.startTime} – {b.endTime} {b.educator ? `· ${b.educator}` : ''}
                  </p>
                </div>
                <span className="badge-premium-blue shrink-0">Enrolled</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Scheduled Lectures ─── */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Clock size={14} className="text-slate-600" /> Scheduled Lectures & Timetable
        </h2>
        {data.upcomingClasses.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center italic">No lectures scheduled for today or tomorrow.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.upcomingClasses.map(cls => (
              <div key={cls.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-xs truncate">{cls.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">{cls.time} · {cls.educator}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                  cls.day === 'Today' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {cls.day}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Assigned Academic Advisor ─── */}
      {data.mentor && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <User size={14} className="text-slate-600" /> Assigned Academic Advisor
          </h2>
          <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
            <div className="h-10 w-10 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
              {data.mentor.photoURL ? (
                <img src={data.mentor.photoURL} alt={data.mentor.name} className="h-full w-full object-cover" />
              ) : (
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1 bg-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 text-xs truncate">{data.mentor.name}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{data.mentor.role || 'Faculty Advisor'}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500">
                {data.mentor.email && (
                  <a href={`mailto:${data.mentor.email}`} className="hover:text-[#1E3A5F] flex items-center gap-1">
                    <Mail size={12} className="text-slate-400" /> {data.mentor.email}
                  </a>
                )}
                {data.mentor.phone && (
                  <a href={`tel:${data.mentor.phone}`} className="hover:text-[#1E3A5F] flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" /> {data.mentor.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DIGITAL ID CARD MODAL ── */}
      {showIdCardModal && (
        <div className="modal-backdrop-premium" onClick={() => setShowIdCardModal(false)}>
          <div className="modal-container-premium max-w-sm sm:max-w-md bg-transparent border-transparent shadow-none" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center px-4 py-2.5 bg-[#0F172A] rounded-t-xl border-b border-slate-700">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Official Student Identity Document</span>
              <button onClick={() => setShowIdCardModal(false)} className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 bg-[#1E293B] rounded-b-xl flex flex-col items-center gap-4">
              {/* Card Container */}
              <div className="id-card-perspective w-76 h-[460px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`id-card-inner rounded-2xl shadow-xl ${isFlipped ? 'id-card-flipped' : ''}`}>
                  
                  {/* Card Front */}
                  <div className="id-card-front bg-[#1E3A5F] text-white flex flex-col justify-between p-5 absolute inset-0 border border-slate-600 select-none">
                    <div className="flex items-center justify-between border-b border-white/15 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 bg-white rounded-md flex items-center justify-center p-1 shrink-0">
                          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <h4 className="font-heading font-extrabold tracking-tight text-xs leading-none">DIGISPIRE ACADEMY</h4>
                          <span className="text-[7px] text-slate-300 tracking-widest uppercase mt-0.5 block">Academic Credential</span>
                        </div>
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300 border border-white/20 px-1.5 py-0.5 rounded bg-white/5">
                        STUDENT
                      </span>
                    </div>

                    <div className="text-center my-auto py-2 space-y-3">
                      <div className="h-24 w-24 rounded-xl bg-white p-1 border border-white/20 mx-auto overflow-hidden">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt={userProfile.name} className="h-full w-full object-cover rounded-lg" />
                        ) : (
                          <div className="h-full w-full bg-slate-100 flex items-center justify-center rounded-lg p-2">
                            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">{userProfile?.name}</h3>
                        <p className="text-[10px] text-slate-300 mt-0.5">{userProfile?.course || 'General Curriculum'}</p>
                      </div>
                    </div>

                    <div className="border-t border-white/15 pt-3 flex items-end justify-between text-xs">
                      <div className="space-y-1">
                        <p className="text-[8px] font-bold uppercase text-slate-300">Registration ID</p>
                        <p className="font-mono font-bold text-white tracking-wider">{userProfile?.studentId || 'DS000000'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold uppercase text-slate-300">Issue Date</p>
                        <p className="text-[10px] font-medium text-slate-200">{userProfile?.joiningDate || '2026'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Back */}
                  <div className="id-card-back bg-[#1E3A5F] text-white flex flex-col justify-between p-5 absolute inset-0 border border-slate-600 select-none">
                    <div className="text-center border-b border-white/15 pb-2">
                      <h4 className="font-heading font-bold text-xs tracking-tight">DIGISPIRE ACADEMY</h4>
                      <span className="text-[7px] text-slate-300 uppercase tracking-wider block mt-0.5">Verification & Access Barcode</span>
                    </div>

                    <div className="my-auto text-center space-y-2">
                      <div className="w-32 h-32 bg-white p-2 rounded-xl flex items-center justify-center mx-auto border border-white/20">
                        {qrCodeUrl ? (
                          <img src={qrCodeUrl} alt="QR Code" className="h-full w-full object-contain" />
                        ) : (
                          <div className="text-xs text-slate-400">Loading...</div>
                        )}
                      </div>
                      <p className="text-[8px] font-mono text-slate-300 uppercase tracking-widest">Scan for Official Verification</p>
                    </div>

                    <div className="border-t border-white/15 pt-3 text-[8px] text-slate-300 text-center leading-normal">
                      This credential certifies official academic status at DIGISPIRE Academy. Property of DIGISPIRE.
                    </div>
                  </div>

                </div>
              </div>

              <button 
                type="button"
                onClick={() => setIsFlipped(!isFlipped)} 
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Flip Document View
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
