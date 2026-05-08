import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  FileSpreadsheet, Calendar, Users, CheckCircle2, XCircle,
  AlertTriangle, Download, ChevronLeft, ChevronRight, Search,
  Briefcase, GraduationCap
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AttendanceReportPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('academic'); // academic, internship

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uSnap, aSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'attendance'))
      ]);
      setStudents(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAttendance(aSnap.docs.map(d => d.data()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const processReport = () => {
    const monthStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;
    
    // 1. Filter attendance by type (Academic vs Internship)
    const filteredAttendance = attendance.filter(r => (r.type || 'academic') === reportType);

    // 2. Identify "Class Dates" held for each batch
    const classDates = {}; 
    filteredAttendance.forEach(record => {
      if (record.date?.startsWith(monthStr)) {
        const key = reportType === 'internship' ? 'internship' : record.batchId;
        if (!classDates[key]) classDates[key] = new Set();
        classDates[key].add(record.date);
      }
    });

    // 3. Process each student
    const report = students
      .filter(s => reportType === 'internship' ? s.isIntern : true) // Only interns in intern report
      .map(student => {
        const studentAttended = filteredAttendance.filter(r => 
          r.studentId === student.studentId && r.date?.startsWith(monthStr)
        ).length;

        const batchKey = reportType === 'internship' ? 'internship' : student.batchId;
        const totalHeld = classDates[batchKey]?.size || 0;
        
        return {
          ...student,
          totalHeld,
          attended: studentAttended,
          absent: Math.max(0, totalHeld - studentAttended),
          percentage: totalHeld > 0 ? Math.round((studentAttended / totalHeld) * 100) : 0
        };
      });

    return report.filter(s => {
      const q = search.toLowerCase();
      return !q || s.name?.toLowerCase().includes(q) || s.studentId?.includes(q);
    });
  };

  const filteredReport = processReport();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Ledger</h1>
          <p className="text-sm text-slate-500 font-medium">Monthly audit for {reportType === 'academic' ? 'regular classes' : 'internship track'}</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-[#255A84] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[#255A84]/20 hover:bg-[#1a4261] transition">
          <Download size={14} /> Export Report
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        {/* Track Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setReportType('academic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${reportType === 'academic' ? 'bg-[#255A84] text-white shadow-md' : 'text-slate-400'}`}
          >
            <GraduationCap size={14} /> Academic
          </button>
          <button 
            onClick={() => setReportType('internship')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${reportType === 'internship' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            <Briefcase size={14} /> Internship
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
          <button onClick={() => setSelectedMonth(m => (m === 0 ? 11 : m - 1))} className="p-2 hover:bg-white rounded-xl transition text-slate-400"><ChevronLeft size={16} /></button>
          <span className="text-[10px] font-bold text-slate-700 min-w-[110px] text-center uppercase tracking-[0.2em]">
            {MONTHS[selectedMonth]} {selectedYear}
          </span>
          <button onClick={() => setSelectedMonth(m => (m === 11 ? 0 : m + 1))} className="p-2 hover:bg-white rounded-xl transition text-slate-400"><ChevronRight size={16} /></button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-transparent rounded-2xl text-sm focus:bg-white focus:border-[#255A84] transition outline-none"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-[#255A84] border-t-transparent rounded-full" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm responsive-table">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="text-left px-8 py-4">Student Name</th>
                  <th className="text-center px-4 py-4">Total Sessions</th>
                  <th className="text-center px-4 py-4">Attended</th>
                  <th className="text-center px-4 py-4">Missed</th>
                  <th className="text-center px-4 py-4">Score (%)</th>
                  <th className="text-right px-8 py-4">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredReport.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-4" data-label="Student Name">
                      <div className="flex items-center gap-4">
                        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 ${reportType === 'internship' ? 'bg-emerald-500' : 'bg-[#255A84]'}`}>
                          {s.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{s.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{s.studentId} · {s.batchId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-500" data-label="Total Sessions">{s.totalHeld}</td>
                    <td className="px-4 py-4 text-center font-bold text-emerald-600 bg-emerald-50/20" data-label="Attended">{s.attended}</td>
                    <td className="px-4 py-4 text-center font-bold text-red-400 bg-red-50/20" data-label="Missed">{s.absent}</td>
                    <td className="px-4 py-4 text-center" data-label="Score (%)">
                      <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
                        <span className={`text-xs font-bold ${s.percentage >= 75 ? 'text-emerald-600' : s.percentage >= 50 ? 'text-[#F48B1F]' : 'text-red-500'}`}>
                          {s.percentage}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.percentage >= 75 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${s.percentage}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right" data-label="Verdict">
                      <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-widest ${
                        s.percentage >= 75 ? 'bg-emerald-50 text-emerald-600' : 
                        s.percentage >= 40 ? 'bg-orange-50 text-[#F48B1F]' : 
                        'bg-red-50 text-red-500'
                      }`}>
                        {s.percentage >= 75 ? 'Excellent' : s.percentage >= 40 ? 'Review' : 'Alert'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredReport.length === 0 && (
              <div className="py-20 text-center text-slate-400">
                <Users size={48} className="mx-auto mb-3 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest">No data available for this track</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
