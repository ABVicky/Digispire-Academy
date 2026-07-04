import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Users,
  Download, Search, Briefcase, GraduationCap, X, CalendarDays
} from 'lucide-react';
import { calculateAttendance } from '../../utils/attendanceEngine';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import { downloadCSV } from '../../utils/csvExport';

export default function AttendanceReportPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [batches, setBatches] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('academic'); // academic, internship
  const [inspectStudent, setInspectStudent] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [topics, setTopics] = useState([]);



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

  const processReport = () => {
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
        let targetBatchId = 'morning';
        if (reportType === 'internship') {
          targetBatchId = 'internship';
        } else if (selectedBatchId !== 'all') {
          targetBatchId = selectedBatchId;
        } else {
          targetBatchId = student.batchId || student.batchIds?.[0] || 'morning';
        }
        const batchSchedule = batches.find(b => b.id === targetBatchId);
        
        // Filter attendance logs for this student and batch
        const studentLogs = attendance.filter(r => 
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

        return {
          ...student,
          totalHeld: calculation.eligibleClasses,
          attended: calculation.presentClasses,
          absent: Math.max(0, calculation.eligibleClasses - calculation.presentClasses - calculation.leaveClasses),
          leaves: calculation.leaveClasses,
          percentage: calculation.attendancePercentage,
          dailyStatus: calculation.dailyStatus,
          logs: studentLogs,
          batchScheduleObj: batchSchedule
        };
      });

    return report.filter(s => {
      const q = search.toLowerCase();
      return !q || s.name?.toLowerCase().includes(q) || s.studentId?.includes(q);
    });
  };

  const filteredReport = processReport();

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
      let batchName = 'Unknown';
      if (reportType === 'internship') {
        batchName = 'Internship';
      } else if (selectedBatchId !== 'all') {
        const bObj = batches.find(b => b.id === selectedBatchId);
        batchName = bObj ? bObj.name : selectedBatchId;
      } else {
        const targetBatchId = student.batchId || student.batchIds?.[0] || 'morning';
        const bObj = batches.find(b => b.id === targetBatchId);
        batchName = bObj ? bObj.name : targetBatchId;
      }

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

  return (
    <div className="space-y-5">
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
            onClick={() => { setReportType('academic'); setSelectedBatchId('all'); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${reportType === 'academic' ? 'bg-[#255A84] text-white shadow-md' : 'text-slate-400'}`}
          >
            <GraduationCap size={13} /> Academic
          </button>
          <button
            onClick={() => { setReportType('internship'); setSelectedBatchId('all'); }}
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
              onChange={e => setSelectedBatchId(e.target.value)}
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
                    <tr key={s.id} onClick={() => setInspectStudent(s)} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 overflow-hidden ${reportType === 'internship' ? 'bg-emerald-500' : 'bg-[#255A84]'}`}>
                            {s.photoURL ? <img src={s.photoURL} alt={s.name} className="h-full w-full object-cover" /> : <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1 bg-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.studentId}</p>
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
                <button
                  key={s.id}
                  onClick={() => setInspectStudent(s)}
                  className="w-full student-card-mobile text-left active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-3">
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
                </button>
              ))}
            </div>
          </>
        )}
      </div>

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
              </div>

              {/* Dynamic Calendar */}
              <div className="md:col-span-2">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
