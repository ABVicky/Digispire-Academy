import { useEffect, useMemo, useState } from 'react';
import { X, Send, FlaskConical, Loader2, Mail, AlertTriangle, BookOpen, UserX } from 'lucide-react';
import { callEmailApi } from '../../utils/emailApi';
import { newRequestId } from '../../utils/emailFormat';
import { STUDENT_EMAIL_TYPES } from '../../utils/studentReport';
import { EmailPreviewFrame, ErrorNotice, ModalPortal, SkippedRecipients } from './EmailBits';

const TYPE_ICONS = { low_attendance: AlertTriangle, syllabus_due: BookOpen, absenteeism: UserX };

/**
 * Individual emails (never a group mail) to the selected students, each filled
 * with that student's own report data.
 */
export default function StudentEmailModal({ students, track, batchId, thresholds, initialType = 'low_attendance', onClose }) {
  const [type, setType] = useState(initialType);
  const [note, setNote] = useState('');
  const [debouncedNote, setDebouncedNote] = useState('');
  const [previewUid, setPreviewUid] = useState(students[0]?.uid || students[0]?.id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState(null);
  const [requestId] = useState(() => newRequestId());
  const [cc, setCc] = useState(true);

  const studentUids = useMemo(() => students.map(s => s.uid || s.id), [students]);
  const payload = useMemo(() => ({ type, studentUids, track, batchId, thresholds, note: debouncedNote, previewUid }), [type, studentUids, track, batchId, thresholds, debouncedNote, previewUid]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedNote(note), 600);
    return () => clearTimeout(t);
  }, [note]);

  useEffect(() => {
    let cancelled = false;
    callEmailApi('student.preview', payload)
      .then(res => { if (!cancelled) { setData(res); setError(''); } })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [payload]);

  const rows = data?.rows || [];
  const sendable = rows.filter(r => !r.skip);
  const skipped = rows.filter(r => r.skip).map(r => ({ ...r, label: r.skipLabel }));
  const typeLabel = STUDENT_EMAIL_TYPES.find(t => t.id === type)?.label || type;

  const changeType = (id) => { setLoading(true); setType(id); setResult(null); setNotice(''); };
  const choosePreview = (uid) => { setLoading(true); setPreviewUid(uid); };

  const send = async () => {
    if (!sendable.length) return;
    if (!window.confirm(`Send ${sendable.length} individual "${typeLabel}" email(s)? Each student receives only their own email.`)) return;
    setSending(true);
    setError('');
    try {
      const res = await callEmailApi('student.send', { ...payload, note, requestId, cc });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError('');
    setNotice('');
    try {
      const res = await callEmailApi('student.sendTest', { ...payload, note });
      setNotice(`Test copy of ${data?.preview?.name || 'this student'}'s email queued to ${res.to}. The student was not emailed.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-backdrop-premium" onClick={onClose}>
      <div className="modal-container-premium w-full sm:max-w-6xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header-premium">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Email students individually</h2>
            <p className="text-xs font-bold text-[#255A84] uppercase tracking-wider mt-0.5">{students.length} selected · one private email each</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="modal-body-premium">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4 min-w-0">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {STUDENT_EMAIL_TYPES.map(t => {
                  const Icon = TYPE_ICONS[t.id] || Mail;
                  const active = type === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => changeType(t.id)}
                      className={`text-left p-3 rounded-xl border transition ${active ? 'border-[#255A84] bg-blue-50/70 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <p className={`flex items-center gap-1.5 text-xs font-bold ${active ? 'text-[#255A84]' : 'text-slate-700'}`}><Icon size={13} /> {t.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">{t.description}</p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Personal note (optional, added to every email)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={3000} className="textarea-premium text-sm"
                  placeholder="e.g. Please meet me after Thursday's class so we can plan your catch-up." />
              </div>

              {data?.ccAddress && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer">
                  <input type="checkbox" checked={cc} onChange={e => setCc(e.target.checked)} className="rounded border-slate-300 text-[#255A84] focus:ring-[#255A84]" />
                  <span className="text-xs font-semibold text-slate-700">CC <span className="font-bold">{data.ccAddress}</span> <span className="text-slate-400 font-medium">(a copy of each email)</span></span>
                </label>
              )}

              <div className="rounded-xl border border-slate-200 bg-white">
                <p className="px-3 pt-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Recipients — tap a name to preview their email</p>
                <ul className="max-h-72 overflow-y-auto divide-y divide-slate-50 p-1">
                  {rows.map(r => (
                    <li key={r.uid}>
                      <button type="button" onClick={() => choosePreview(r.uid)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-3 transition ${data?.preview?.uid === r.uid ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-slate-800 truncate">{r.name}</span>
                          <span className={`block text-[11px] truncate ${r.skip ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>{r.skip ? r.skipLabel : r.email}</span>
                        </span>
                        {r.summary && (
                          <span className="text-right shrink-0 text-[10px] font-bold text-slate-500 leading-tight">
                            <span className={r.summary.pct >= 75 ? 'text-emerald-600' : r.summary.pct >= 50 ? 'text-amber-600' : 'text-rose-600'}>{r.summary.pct}%</span>
                            {' · '}{r.summary.absent} absent{r.summary.leave ? ` · ${r.summary.leave} leave` : ''}<br />
                            {r.summary.streak ? `${r.summary.streak} in a row · ` : ''}{r.summary.missedTopics + r.summary.pendingTopics} topic(s) pending
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <SkippedRecipients skipped={skipped} />

              <ErrorNotice message={error} />
              {notice && <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">{notice}</div>}
              {result && (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold space-y-1">
                  <p>{result.queued} email(s) queued and sending in the background.</p>
                  {result.alreadyQueued > 0 && <p>{result.alreadyQueued} were already queued from this window and were not sent twice.</p>}
                  {result.skipped?.length > 0 && <p>{result.skipped.length} skipped (see list above).</p>}
                </div>
              )}
            </div>

            <div className="min-w-0 lg:sticky lg:top-0 self-start">
              <EmailPreviewFrame
                subject={data?.preview?.subject}
                html={data?.preview?.html}
                loading={loading}
                meta={data?.preview ? `To: ${data.preview.name} only${cc && data.ccAddress ? ` · CC: ${data.ccAddress}` : ''}` : ''}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer-premium flex-wrap">
          <button type="button" onClick={sendTest} disabled={testing || !data?.preview} className="btn-outline-premium px-4 py-2.5 flex items-center gap-2 text-xs">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Send test to me
          </button>
          <button type="button" onClick={send} disabled={sending || loading || !sendable.length || !!result}
            className="btn-primary-premium px-5 py-2.5 flex items-center gap-2 text-xs">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {result ? 'Sent' : `Send ${sendable.length} email(s)`}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
