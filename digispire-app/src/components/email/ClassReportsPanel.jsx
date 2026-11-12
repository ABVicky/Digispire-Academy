import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Mail, RefreshCw, CalendarDays, ClipboardList, BookOpen, Check } from 'lucide-react';
import {
  DEFAULT_TIMEZONE, addDays, buildSessionBatchMap, buildSessionIndex, classSessionDocId, formatDateLabel,
  getSessionAttendance, getSessionTime, resolveAttendanceLogs, zonedNow,
} from '../../utils/studentReport';
import { formatDateTime } from '../../utils/emailFormat';
import { EmailStatusBadge, TestModeBadge } from './EmailBits';
import SendClassReportModal from './SendClassReportModal';

function SentStatus({ report }) {
  if (!report?.sendCount) {
    return <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Not sent</span>;
  }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <EmailStatusBadge status={report.lastStatus} />
        {report.testMode && <TestModeBadge />}
      </div>
      <p className="text-[10px] text-slate-500 font-medium leading-tight">
        Sent {formatDateTime(report.lastSentAt)}<br />by {report.lastSentBy?.name || '—'}{report.sendCount > 1 ? ` · ${report.sendCount}×` : ''}
      </p>
    </div>
  );
}

/** "Class Reports" tab of Take Attendance: one row per batch per day. */
export default function ClassReportsPanel({ batches = [], students = [], staff = [], courses = [], modules = [], topics = [] }) {
  const today = zonedNow(DEFAULT_TIMEZONE).date;
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [batchFilter, setBatchFilter] = useState('all');
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState(null);

  // Live: class sessions in range (status chips update as emails send)
  useEffect(() => {
    if (!from || !to || from > to) return undefined;
    const q = query(collection(db, 'class_sessions'), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, snap => setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.error('class_sessions sync error:', err));
  }, [from, to]);

  useEffect(() => {
    if (!from || !to || from > to) return undefined;
    let cancelled = false;
    getDocs(query(collection(db, 'attendance'), where('date', '>=', from), where('date', '<=', to)))
      .then(snap => { if (!cancelled) setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); })
      .catch(err => console.error('attendance load error:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, reloadKey]);

  const rows = useMemo(() => {
    const resolved = resolveAttendanceLogs(logs, buildSessionBatchMap(sessions));
    const index = buildSessionIndex({ classSessions: sessions, logs: resolved });
    const keys = new Set(index.keys());
    for (const l of resolved) {
      const b = l.type === 'internship' ? 'internship' : l.batchId;
      if (b && l.date) keys.add(classSessionDocId(b, l.date));
    }
    return [...keys].map(key => {
      const session = index.get(key);
      const date = key.slice(-10);
      const batchId = key.slice(0, -11);
      const batch = batches.find(b => b.id === batchId);
      if (!batch) return null;
      const att = getSessionAttendance({ batchId, date, students, logs: resolved });
      return {
        key, batchId, date, batch, session,
        time: getSessionTime(batch, date).label,
        present: att.present.length, enrolled: att.enrolled.length, guests: att.guests.length,
        topicCount: session?.coveredTopics?.length || 0,
        hasTasks: !!session?.tasks,
      };
    })
      .filter(Boolean)
      .filter(r => batchFilter === 'all' || r.batchId === batchFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || (a.batch.name || '').localeCompare(b.batch.name || ''));
  }, [logs, sessions, batches, students, batchFilter]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Mail size={16} className="text-[#255A84]" /> Class Reports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">After class, open a session to email the report to the students who were present.</p>
          </div>
          <button onClick={() => { setLoading(true); setReloadKey(k => k + 1); }} className="btn-outline-premium px-3 py-2 flex items-center gap-1.5 text-xs self-start">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="select-premium text-xs col-span-2 sm:col-span-2 cursor-pointer">
            <option value="all">All batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
          </select>
          <input type="date" value={from} max={to} onChange={e => { setLoading(true); setFrom(e.target.value); }} className="input-premium text-xs" aria-label="From date" />
          <input type="date" value={to} min={from} max={today} onChange={e => { setLoading(true); setTo(e.target.value); }} className="input-premium text-xs" aria-label="To date" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-[#255A84] border-t-transparent rounded-full" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No class sessions in this range</p>
            <p className="text-[11px] mt-1">Sessions appear once a QR is broadcast or attendance is marked.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="text-left px-5 py-3.5">Class</th>
                    <th className="text-center px-3 py-3.5">Present</th>
                    <th className="text-left px-3 py-3.5">Report</th>
                    <th className="text-left px-3 py-3.5">Email</th>
                    <th className="text-right px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(r => (
                    <tr key={r.key} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800 text-sm">{r.batch.name || r.batchId}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{formatDateLabel(r.date)} · {r.time}</p>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700">
                        {r.present}<span className="text-slate-400 font-semibold">/{r.enrolled}</span>
                        {r.guests ? <span className="block text-[10px] text-slate-400">+{r.guests} guest</span> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5 text-[11px] font-semibold">
                          <span className={r.topicCount ? 'text-slate-600' : 'text-slate-300'}><BookOpen size={11} className="inline mr-1" />{r.topicCount} topic(s)</span>
                          <span className={r.hasTasks ? 'text-emerald-600' : 'text-slate-300'}>{r.hasTasks ? <Check size={11} className="inline mr-1" /> : <ClipboardList size={11} className="inline mr-1" />}{r.hasTasks ? 'Tasks saved' : 'No tasks yet'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><SentStatus report={r.session?.emailReport} /></td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setOpen(r)} className={`${r.session?.emailReport?.sendCount ? 'btn-outline-premium' : 'btn-primary-premium'} px-3 py-2 text-xs inline-flex items-center gap-1.5`}>
                          <Mail size={13} /> {r.session?.emailReport?.sendCount ? 'View / Resend' : 'Send Class Report'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-3 space-y-2">
              {rows.map(r => (
                <div key={r.key} className="student-card-mobile">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{r.batch.name || r.batchId}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{formatDateLabel(r.date)} · {r.time}</p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-1">
                        {r.present}/{r.enrolled} present · {r.topicCount} topic(s) · {r.hasTasks ? 'tasks saved' : 'no tasks yet'}
                      </p>
                    </div>
                    <SentStatus report={r.session?.emailReport} />
                  </div>
                  <button onClick={() => setOpen(r)} className={`${r.session?.emailReport?.sendCount ? 'btn-outline-premium' : 'btn-primary-premium'} w-full px-3 py-2.5 text-xs flex items-center justify-center gap-1.5`}>
                    <Mail size={13} /> {r.session?.emailReport?.sendCount ? 'View / Resend' : 'Send Class Report'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {open && (
        <SendClassReportModal
          batchId={open.batchId}
          date={open.date}
          staff={staff}
          courses={courses}
          modules={modules}
          topics={topics}
          onClose={() => { setOpen(null); setReloadKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
