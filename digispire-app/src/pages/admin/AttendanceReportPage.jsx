import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Users,
  Download, Search, Briefcase, GraduationCap, X, CalendarDays, Mail, Flag, CheckSquare, Square
} from 'lucide-react';
import { calculateAttendance } from '../../utils/attendanceEngine';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { downloadCSV } from '../../utils/csvExport';
import {
  DEFAULT_THRESHOLDS, attendancePctExcludingLeave, buildSessionBatchMap, checkEmail, computeAbsenceStats,
  evaluateFlags, getReportBatchId, isStudentActive, resolveAttendanceLogs
} from '../../utils/studentReport';
import { emailFeaturesEnabled } from '../../utils/platform';
import { readPref, writePref } from '../../utils/emailFormat';
import StudentEmailModal from '../../components/email/StudentEmailModal';
import EmailHistoryList from '../../components/email/EmailHistoryList';

const THRESHOLD_PREF_KEY = 'digispire.attendanceFlags';

function FlagChips({ s, thresholds }) {
  const chips = [];
  if (!s.active) chips.push({ key: 'inactive', text: 'Inactive', cls: 'bg-slate-100 text-slate-500 border-slate-200' });
  if (s.active && s.flags.lowAttendance) chips.push({ key: 'low', text: `Below ${thresholds.lowAttendancePct}%`, cls: 'bg-rose-50 text-rose-600 border-rose-200' });
  if (s.active && s.flags.consecutive) chips.push({ key: 'row', text: `${s.absenceStats.currentConsecutiveAbsences} absent in a row`, cls: 'bg-orange-50 text-orange-700 border-orange-200' });
  if (s.active && s.flags.frequent) chips.push({ key: 'freq', text: `${s.absenceStats.recentAbsentDates.length} absences / ${thresholds.frequentWindowDays}d`, cls: 'bg-amber-50 text-amber-700 border-amber-200' });
  if (s.active && !s.emailOk) chips.push({ key: 'mail', text: 'No valid email', cls: 'bg-slate-50 text-slate-500 border-slate-200' });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {chips.map(c => (
        <span key={c.key} className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${c.cls}`}>{c.text}</span>
      ))}
    </div>
  );
}

function ThresholdInput({ label, value, onChange, min, max, suffix }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
      {label}
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-[#255A84]"
      />
      {suffix}
    </label>
  );
}

export default function AttendanceReportPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [batches, setBatches] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [classSessions, setClassSessions] = useState([]);

  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('academic'); // academic, internship
  const [inspectStudent, setInspectStudent] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);

  // Email features (web only)
  const emailEnabled = emailFeaturesEnabled();
  const [thresholds, setThresholds] = useState(() => readPref(THRESHOLD_PREF_KEY, DEFAULT_THRESHOLDS));
  const [selected, setSelected] = useState(() => new Set());
  const [emailTarget, setEmailTarget] = useState(null);

  const updateThreshold = (key, value) => {
    setThresholds(prev => {
      const next = { ...prev, [key]: value };
      writePref(THRESHOLD_PREF_KEY, next);
      return next;
    });
  };

  const handleUpdateStatus = async (dateStr, newStatus) => {
    if (!inspectStudent) return;
    try {
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', inspectStudent.studentId),
        where('date', '==', dateStr),
        where('type', '==', reportType)
      );
      const snap = await getDocs(q);

      if (newStatus === 'absent') {
        if (!snap.empty) {
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        }
      } else {
        if (!snap.empty) {
          await Promise.all(snap.docs.map(d => updateDoc(d.ref, {
            status: newStatus,
            timestamp: serverTimestamp()
          })));
        } else {
          await addDoc(collection(db, 'attendance'), {
            studentId: inspectStudent.studentId,
            uid: inspectStudent.uid || inspectStudent.id,
            name: inspectStudent.name,
            batchId: inspectStudent.batchId || 'morning',
            isIntern: !!inspectStudent.isIntern,
            type: reportType,
            date: dateStr,
            timestamp: serverTimestamp(),
            status: newStatus
          });
        }
      }

      await fetchData();
      alert(`Updated status for ${dateStr} to ${newStatus}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const fetchData = async () => {
    setLoading(true);

    try {
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      setStudents(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }

    try {
      const aSnap = await getDocs(collection(db, 'attendance'));
      setAttendance(aSnap.docs.map(d => d.data()));
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    }

    try {
      const bSnap = await getDocs(collection(db, 'batches'));
      setBatches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    }

    try {
      const hSnap = await getDocs(collection(db, 'holidays'));
      setHolidays(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    }

    try {
      const canSnap = await getDocs(collection(db, 'cancelled_classes'));
      setCancellations(canSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch cancellations:', err);
    }

    try {
      const csSnap = await getDocs(collection(db, 'class_sessions'));
      setClassSessions(csSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch class sessions:', err);
    }

    try {
      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }

    try {
      const mSnap = await getDocs(collection(db, 'modules'));
      setModules(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    }

    try {
      const tSnap = await getDocs(collection(db, 'topics'));
      setTopics(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Older check-ins stored the student's primary batch; use the scanned session's batch instead.
  const resolvedAttendance = useMemo(
    () => resolveAttendanceLogs(attendance, buildSessionBatchMap(classSessions)),
    [attendance, classSessions]
  );

  const processReport = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    // Process each student through the central calculation engine
    const report = students
      .filter(s => {
        if (reportType === 'internship') return s.isIntern;
        if (selectedBatchId !== 'all') {
          const enrolled = s.batchIds || (s.batchId ? [s.batchId] : []);
          return enrolled.includes(selectedBatchId);
        }
        return true;
      })
      .map(student => {
        // Find batch schedule
        const targetBatchId = getReportBatchId(student, reportType, selectedBatchId);
        const batchSchedule = batches.find(b => b.id === targetBatchId);

        // Filter attendance logs for this student and batch
        const studentLogs = resolvedAttendance.filter(r =>
          r.studentId === student.studentId &&
          (r.type || 'academic') === reportType &&
          (reportType === 'internship' ? true : r.batchId === targetBatchId)
        );

        const calculation = calculateAttendance({
          student,
          attendanceLogs: studentLogs,
          batchSchedule,
          holidays,
          cancelledClasses: cancellations
        });

        const absenceStats = computeAbsenceStats(calculation.dailyStatus, { endDateStr: todayStr, windowDays: thresholds.frequentWindowDays });
        const pctExcludingLeave = attendancePctExcludingLeave(calculation);

        return {
          ...student,
          totalHeld: calculation.eligibleClasses,
          attended: calculation.presentClasses,
          absent: Math.max(0, calculation.eligibleClasses - calculation.presentClasses - calculation.leaveClasses),
          leaves: calculation.leaveClasses,
          percentage: calculation.attendancePercentage,
          dailyStatus: calculation.dailyStatus,
          logs: studentLogs,
          batchScheduleObj: batchSchedule,
          active: isStudentActive(student),
          emailOk: checkEmail(student.email).ok,
          absenceStats,
          pctExcludingLeave,
          flags: evaluateFlags({ ...calculation, pctExcludingLeave, absenceStats }, thresholds)
        };
      });

    return report.filter(s => {
      const q = search.toLowerCase();
      return !q || s.name?.toLowerCase().includes(q) || s.studentId?.includes(q);
    });
  };

  const filteredReport = processReport();
  const flaggedVisible = filteredReport.filter(s => s.active && s.flags.any);
  const selectedRows = filteredReport.filter(s => selected.has(s.id));

  const toggleSelected = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelected(new Set());
  const switchTrack = (type) => { setReportType(type); setSelectedBatchId('all'); clearSelection(); };

  const openEmail = (rows) => {
    const sendable = rows.filter(r => r.active);
    if (!sendable.length) return;
    const allAbsentee = sendable.every(r => r.flags.absenteeism && !r.flags.lowAttendance);
    setEmailTarget({
      students: sendable.map(r => ({ id: r.id, uid: r.uid || r.id, name: r.name })),
      initialType: allAbsentee ? 'absenteeism' : 'low_attendance',
    });
  };

  const handleDownloadExcel = () => {
    if (filteredReport.length === 0) {
      alert("No attendance data to download.");
      return;
    }

    // 1. Gather all unique dates across all students in the report (excluding 'no-class' days)
    const allDatesSet = new Set();
    filteredReport.forEach(student => {
      if (student.dailyStatus) {
        Object.keys(student.dailyStatus).forEach(dateStr => {
          if (student.dailyStatus[dateStr] !== 'no-class') {
            allDatesSet.add(dateStr);
          }
        });
      }
    });

    const sortedDates = Array.from(allDatesSet).sort();

    // 2. Define headers
    const headers = [
      'Student ID',
      'Name',
      'Batch',
      'Course',
      'Eligible Classes',
      'Present Classes',
      'Leaves',
      'Absent Classes',
      'Attendance Score (%)',
      ...sortedDates
    ];

    // Status display map
    const statusMap = {
      present: 'Present',
      makeup: 'Makeup',
      leave: 'Leave',
      absent: 'Absent',
      holiday: 'Holiday',
      cancelled: 'Cancelled',
      'no-class': '-'
    };

    // 3. Build rows
    const rows = filteredReport.map(student => {
      const batchName = reportType === 'internship'
        ? 'Internship'
        : selectedBatchId !== 'all'
          ? (batches.find(b => b.id === selectedBatchId)?.name || selectedBatchId)
          : (() => {
              const targetBatchId = student.batchId || student.batchIds?.[0] || 'morning';
              return batches.find(b => b.id === targetBatchId)?.name || targetBatchId;
            })();

      const dateStatuses = sortedDates.map(dateStr => {
        const status = student.dailyStatus?.[dateStr] || 'no-class';
        return statusMap[status] || status;
      });

      return [
        student.studentId || '',
        student.name || '',
        batchName,
        student.course || '',
        student.totalHeld,
        student.attended,
        student.leaves,
        student.absent,
        `${student.percentage}%`,
        ...dateStatuses
      ];
    });

    const trackLabel = reportType === 'internship' ? 'Internship' : 'Academic';
    const filename = `Attendance_Report_${trackLabel}_${selectedBatchId}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(headers, rows, filename);
  };

  // Keep currently inspected student updated with fresh data
  const inspectStudentId = inspectStudent?.id;
  useEffect(() => {
    if (inspectStudentId) {
      const updated = filteredReport.find(s => s.id === inspectStudentId);
      if (updated) {
        const timer = setTimeout(() => setInspectStudent(updated), 0);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, attendance, inspectStudentId]);

  const renderSelectBox = (s) => {
    if (!emailEnabled) return null;
    const isOn = selected.has(s.id);
    return (
      <button
        type="button"
        disabled={!s.active}
        onClick={e => { e.stopPropagation(); toggleSelected(s.id); }}
        className={`p-1 rounded-md transition ${s.active ? 'text-slate-400 hover:text-[#255A84]' : 'text-slate-200 cursor-not-allowed'}`}
        aria-label={isOn ? `Deselect ${s.name}` : `Select ${s.name}`}
        title={s.active ? 'Select for email' : 'Inactive students cannot be emailed'}
      >
        {isOn ? <CheckSquare size={17} className="text-[#255A84]" /> : <Square size={17} />}
      </button>
    );
  };

  return (
    <div className={`space-y-5 ${selectedRows.length ? 'pb-24' : ''}`}>
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Attendance Ledger</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Auto-computed statistics for regular and internship tracks</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button onClick={() => window.print()} className="flex items-center gap-2 btn-outline-premium px-4 py-2.5">
            <Download size={14} /> Print Report
          </button>
          <button onClick={handleDownloadExcel} className="flex items-center gap-2 btn-primary-premium px-4 py-2.5">
            <Download size={14} /> Download Excel
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        {/* Track Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-fit">
          <button
            onClick={() => switchTrack('academic')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${reportType === 'academic' ? 'bg-[#255A84] text-white shadow-md' : 'text-slate-400'}`}
          >
            <GraduationCap size={13} /> Academic
          </button>
          <button
            onClick={() => switchTrack('internship')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${reportType === 'internship' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            <Briefcase size={13} /> Internship
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Batch Filter */}
          {reportType === 'academic' && (
            <select
              value={selectedBatchId}
              onChange={e => { setSelectedBatchId(e.target.value); clearSelection(); }}
              className="select-premium text-xs font-bold text-slate-600 sm:min-w-[150px] cursor-pointer"
            >
              <option value="all">All Batches</option>
              {batches.filter(b => b.id !== 'internship').map(b => (
                <option key={b.id} value={b.id}>{b.name || b.id}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search students..."
              className="input-premium pl-10 text-sm"
            />
          </div>
        </div>

        {/* Highlight thresholds & email selection (web only) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 print:hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Flag size={12} /> Highlight</span>
            <ThresholdInput label="Below" value={thresholds.lowAttendancePct} min={1} max={100} suffix="%" onChange={v => updateThreshold('lowAttendancePct', v)} />
            <ThresholdInput label="" value={thresholds.consecutiveAbsences} min={1} max={60} suffix="+ absent in a row" onChange={v => updateThreshold('consecutiveAbsences', v)} />
            <ThresholdInput label="" value={thresholds.frequentAbsences} min={1} max={60} suffix={`+ absences in ${thresholds.frequentWindowDays} days`} onChange={v => updateThreshold('frequentAbsences', v)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {emailEnabled && (
              <button
                onClick={() => setSelected(new Set(flaggedVisible.map(s => s.id)))}
                disabled={!flaggedVisible.length}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold disabled:opacity-40"
              >
                <Flag size={13} /> Select flagged ({flaggedVisible.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Display */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-[#255A84] border-t-transparent rounded-full" /></div>
        ) : filteredReport.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users size={48} className="mx-auto mb-3 opacity-10" />
            <p className="text-xs font-bold uppercase tracking-widest">No data for this track</p>
          </div>
        ) : (
          <>
            {/* ── Desktop Table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {emailEnabled && <th className="w-10 pl-4 py-4 print:hidden"></th>}
                    <th className="text-left px-6 py-4">Student</th>
                    <th className="text-center px-4 py-4">Eligible</th>
                    <th className="text-center px-4 py-4">Present</th>
                    <th className="text-center px-4 py-4">Leaves</th>
                    <th className="text-center px-4 py-4">Missed</th>
                    <th className="text-center px-4 py-4">Score</th>
                    <th className="text-right px-6 py-4">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredReport.map(s => (
                    <tr key={s.id} onClick={() => setInspectStudent(s)} className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${selected.has(s.id) ? 'bg-blue-50/40' : ''} ${s.active ? '' : 'opacity-60'}`}>
                      {emailEnabled && <td className="pl-4 py-3.5 print:hidden">{renderSelectBox(s)}</td>}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 overflow-hidden ${reportType === 'internship' ? 'bg-emerald-500' : 'bg-[#255A84]'}`}>
                            {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1 bg-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.studentId}</p>
                            <FlagChips s={s} thresholds={thresholds} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-500 text-sm">{s.totalHeld}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-600 text-sm">{s.attended}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-amber-500 text-sm">{s.leaves}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-red-400 text-sm">{s.absent}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-black ${s.percentage >= 75 ? 'text-emerald-600' : s.percentage >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {s.percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-[#255A84] px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                          <CalendarDays size={12} /> Audit
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile Card List ── */}
            <div className="md:hidden p-3 space-y-2">
              {filteredReport.map(s => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setInspectStudent(s)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspectStudent(s); } }}
                  className={`w-full student-card-mobile text-left active:scale-[0.99] transition cursor-pointer ${selected.has(s.id) ? 'ring-2 ring-[#255A84]/30' : ''} ${s.active ? '' : 'opacity-60'}`}
                >
                  <div className="flex items-center gap-3">
                    {emailEnabled && renderSelectBox(s)}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden ${reportType === 'internship' ? 'bg-emerald-500' : 'bg-[#255A84]'}`}>
                      {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1 bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">{s.studentId}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-black ${s.percentage >= 75 ? 'text-emerald-500' : s.percentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {s.percentage}%
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">{s.attended}/{s.totalHeld} present</p>
                    </div>
                  </div>
                  <FlagChips s={s} thresholds={thresholds} />
                  {/* Progress bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.percentage >= 75 ? 'bg-emerald-500' : s.percentage >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${s.percentage}%` }} />
                  </div>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="text-emerald-600">{s.attended} present</span>
                    <span className="text-amber-500">{s.leaves} leaves</span>
                    <span className="text-red-400">{s.absent} missed</span>
                    <span className="ml-auto flex items-center gap-0.5 text-[#255A84]"><CalendarDays size={11} /> View Log</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Selection bar */}
      {emailEnabled && selectedRows.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl print:hidden">
          <div className="flex items-center justify-between gap-3 bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-2xl">
            <p className="text-xs font-bold">{selectedRows.length} student(s) selected</p>
            <div className="flex items-center gap-2">
              <button onClick={clearSelection} className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white">Clear</button>
              <button onClick={() => openEmail(selectedRows)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-900 text-[11px] font-black">
                <Mail size={13} /> Email individually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Inspector Dialog */}
      {inspectStudent && (
        <div className="modal-backdrop-premium" onClick={() => setInspectStudent(null)}>
          <div className="modal-container-premium max-w-3xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Student Attendance Audit</h2>
                <p className="text-xs font-bold text-[#255A84] uppercase tracking-wider mt-0.5">{inspectStudent.name} ({inspectStudent.studentId})</p>
              </div>
              <button onClick={() => setInspectStudent(null)} className="p-2 text-slate-400 hover:text-slate-600 transition"><X size={20} /></button>
            </div>

            <div className="modal-body-premium grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile/Metrics Info */}
              <div className="md:col-span-1 space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Computation Profile</h3>
                  <div className="mt-3 text-xs space-y-2 text-slate-600 font-medium">
                    <p><span className="text-slate-400">Joining Date:</span> {inspectStudent.joiningDate || 'N/A'}</p>
                    <p><span className="text-slate-400">Batch Assignment:</span> {inspectStudent.batchId || 'morning'}</p>
                    <p><span className="text-slate-400">Track Type:</span> <span className="uppercase font-bold text-[#255A84]">{reportType}</span></p>
                    {!inspectStudent.active && <p className="font-bold text-slate-500">Inactive — no emails are sent</p>}
                  </div>
                </div>

                <div className="bg-[#255A84]/5 rounded-xl p-5 border border-[#255A84]/10 text-center space-y-3">
                  <p className="text-[11px] font-bold text-[#255A84] uppercase tracking-widest">Calculated Attendance Rate</p>
                  <p className={`text-5xl font-black ${
                    inspectStudent.percentage >= 75 ? 'text-emerald-500' :
                    inspectStudent.percentage >= 50 ? 'text-[#F48B1F]' : 'text-rose-500'
                  }`}>{inspectStudent.percentage}%</p>

                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-2 font-medium">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="text-sm font-bold text-slate-800 block">{inspectStudent.attended}</span>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider">Present</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="text-sm font-bold text-slate-800 block">{inspectStudent.totalHeld}</span>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider">Eligible</span>
                    </div>
                  </div>
                </div>

                {emailEnabled && inspectStudent.active && (
                  <button onClick={() => openEmail([inspectStudent])} className="btn-primary-premium w-full px-4 py-2.5 flex items-center justify-center gap-2 text-xs">
                    <Mail size={14} /> Email this student
                  </button>
                )}
              </div>

              {/* Dynamic Calendar */}
              <div className="md:col-span-2 space-y-4">
                <AttendanceCalendar
                  student={inspectStudent}
                  dailyStatus={inspectStudent.dailyStatus}
                  attendanceLogs={inspectStudent.logs}
                  batchSchedule={inspectStudent.batchScheduleObj}
                  holidays={holidays}
                  cancelledClasses={cancellations}
                  courses={courses}
                  modules={modules}
                  topics={topics}
                  onUpdateStatus={handleUpdateStatus}
                />
                {emailEnabled && <EmailHistoryList studentUid={inspectStudent.uid || inspectStudent.id} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {emailTarget && (
        <StudentEmailModal
          students={emailTarget.students}
          initialType={emailTarget.initialType}
          track={reportType}
          batchId={selectedBatchId}
          thresholds={thresholds}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  );
}
