import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  X, Send, RefreshCw, FlaskConical, Users, CalendarDays, Clock, GraduationCap, ClipboardList, BookOpen, Check, Loader2, RotateCcw,
} from 'lucide-react';
import { callEmailApi } from '../../utils/emailApi';
import { formatDateTime, tsMillis } from '../../utils/emailFormat';
import { classSessionDocId } from '../../utils/studentReport';
import { EmailPreviewFrame, EmailStatusBadge, ErrorNotice, ModalPortal, SkippedRecipients, TestModeBadge } from './EmailBits';

const label = 'block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1';

export default function SendClassReportModal({ batchId, date, staff = [], courses = [], modules = [], topics = [], onClose }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ topicIds: [], topicsNote: '', tasks: '', takenByUid: '' });
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showRecipients, setShowRecipients] = useState('');
  const [deliveries, setDeliveries] = useState([]);
  const [previewTab, setPreviewTab] = useState('attended');
  const [cc, setCc] = useState(true);

  const docId = classSessionDocId(batchId, date);

  const loadPreview = useCallback(async (overrides) => {
    const res = await callEmailApi('classReport.preview', { batchId, date, ...(overrides || {}) });
    setData(res);
    return res;
  }, [batchId, date]);

  // Initial load: server fills topics/tasks/faculty from the class session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadPreview();
        if (cancelled) return;
        setForm({ topicIds: res.form.topicIds, topicsNote: res.form.topicsNote, tasks: res.form.tasks, takenByUid: res.form.takenByUid });
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadPreview]);

  // Course to browse in the topic picker: the user's choice, else the course of the saved topics.
  const defaultCourseId = useMemo(() => {
    const firstTopic = topics.find(t => t.id === data?.defaults?.topicIds?.[0]);
    return modules.find(m => m.id === firstTopic?.moduleId)?.courseId || courses[0]?.id || '';
  }, [data, topics, modules, courses]);
  const activeCourseId = courseId || defaultCourseId;

  // Live delivery log for this class session.
  useEffect(() => {
    const q = query(collection(db, 'email_outbox'), where('classSessionId', '==', docId));
    return onSnapshot(q, snap => {
      setDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.purpose === 'live').sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)));
    }, () => setDeliveries([]));
  }, [docId]);

  const courseModules = useMemo(() => modules.filter(m => m.courseId === activeCourseId).sort((a, b) => (a.order || 0) - (b.order || 0)), [modules, activeCourseId]);
  const topicById = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics]);
  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules]);

  const toggleTopic = (id) => setForm(f => ({ ...f, topicIds: f.topicIds.includes(id) ? f.topicIds.filter(t => t !== id) : [...f.topicIds, id] }));

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try { await loadPreview(form); } catch (err) { setError(err.message); } finally { setRefreshing(false); }
  };

  const status = data?.status || { sendCount: 0 };
  const alreadySent = status.sendCount > 0;
  const attendedCount = data?.audiences?.attended?.recipients?.length || 0;
  const missedCount = data?.audiences?.missed?.recipients?.length || 0;
  const recipientCount = attendedCount + missedCount;
  const ccAddress = data?.ccAddress || '';

  const send = async (resend) => {
    setError('');
    setNotice('');
    if (!form.tasks.trim()) { setError('Please enter the tasks given today. This is the only field you must fill in.'); return; }
    if (resend && !window.confirm(
      `This class report was already sent on ${formatDateTime(status.lastSentAt)} by ${status.lastSentBy?.name || 'someone'}.\n\nSend it AGAIN to ${attendedCount} attended + ${missedCount} missed student(s)? They will receive a second email.`
    )) return;
    setSending(true);
    try {
      const res = await callEmailApi('classReport.send', { batchId, date, ...form, cc, resend, expectedSendCount: status.sendCount });
      setNotice(`${resend ? 'Resend queued' : 'Class report queued'}: ${res.recipients} attended + ${res.missedRecipients} missed student(s)${res.cc?.length ? `, CC ${res.cc.join(', ')}` : ''}. It is sending in the background — you can close this window.`);
      await loadPreview(form);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) await loadPreview(form).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const sendTest = async () => {
    setError('');
    setNotice('');
    if (!form.tasks.trim()) { setError('Enter the tasks first so the test shows the real email.'); return; }
    setTesting(true);
    try {
      const res = await callEmailApi('classReport.sendTest', { batchId, date, ...form });
      setNotice(`Test copies of both emails (attended and missed) queued to ${res.to}. Students were not emailed.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const latestSendNo = deliveries.reduce((n, d) => Math.max(n, d.sendNo || 0), 0);
  const latest = deliveries.filter(d => d.sendNo === latestSendNo);

  return (
    <ModalPortal>
    <div className="modal-backdrop-premium" onClick={onClose}>
      <div className="modal-container-premium w-full sm:max-w-6xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header-premium">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">Send Class Report</h2>
            <p className="text-xs font-bold text-[#255A84] uppercase tracking-wider mt-0.5 truncate">
              {data?.batch?.name || batchId} · {data?.dateLabel || date}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="modal-body-premium">
          {loading ? (
            <div className="py-20 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-[#255A84] border-t-transparent rounded-full" /></div>
          ) : !data ? (
            <ErrorNotice message={error || 'Could not load this class session.'} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ── Left: details & form ── */}
              <div className="space-y-4 min-w-0">

                {/* Attendance summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { icon: CalendarDays, k: 'Date', v: data.dateLabel },
                    { icon: GraduationCap, k: 'Batch', v: data.batch.name },
                    { icon: Clock, k: 'Time', v: data.time.label },
                    { icon: Users, k: 'Present', v: `${data.attendance.present} / ${data.attendance.enrolled}${data.attendance.guests ? ` +${data.attendance.guests}` : ''}` },
                  ].map(({ icon: Icon, k, v }) => (
                    <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
                      <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400"><Icon size={11} /> {k}</p>
                      <p className="text-xs font-bold text-slate-800 mt-1 break-words">{v}</p>
                    </div>
                  ))}
                </div>
                {(data.attendance.leave > 0 || data.attendance.absent > 0) && (
                  <p className="text-[11px] text-slate-500 font-medium -mt-2 ml-1">
                    {data.attendance.absent} absent · {data.attendance.leave} on leave — they get the “you missed today’s class” email.
                  </p>
                )}

                {/* Sent status */}
                {alreadySent ? (
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Check size={15} className="text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-800">
                        Sent on {formatDateTime(status.lastSentAt)} by {status.lastSentBy?.name || '—'}
                      </p>
                      <EmailStatusBadge status={status.lastStatus} />
                      {status.testMode && <TestModeBadge />}
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      {status.sendCount > 1 ? `Sent ${status.sendCount} times. ` : ''}Last send: {status.lastRecipientCount} attended · {status.lastMissedCount} missed.
                    </p>
                    {latest.some(d => d.status === 'failed') && (
                      <p className="text-[11px] text-rose-700 font-semibold">
                        Some batches failed: {latest.filter(d => d.status === 'failed').map(d => d.lastError).filter(Boolean)[0] || 'see Email Center'}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1">Not sent yet</p>
                )}

                {/* Faculty */}
                <div>
                  <label className={label}>Faculty / mentor who took the class</label>
                  <select value={form.takenByUid} onChange={e => setForm(f => ({ ...f, takenByUid: e.target.value }))} className="select-premium cursor-pointer">
                    <option value="">{staff.length ? 'Use batch educator' : 'No staff found'}</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                  </select>
                </div>

                {/* Topics */}
                <div className="space-y-2">
                  <label className={label}><BookOpen size={11} className="inline mr-1" />Topics covered / what students learnt</label>
                  {data.curriculumSource === 'attendance' && (
                    <p className="text-[11px] text-slate-500 ml-1">Filled in from the attendance records of this day.</p>
                  )}
                  {form.topicIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {form.topicIds.map(id => {
                        const t = topicById.get(id);
                        return (
                          <button key={id} type="button" onClick={() => toggleTopic(id)} title="Remove from this report"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-bold text-[#255A84] hover:bg-blue-100 transition">
                            {moduleById.get(t?.moduleId)?.title ? `${moduleById.get(t.moduleId).title} — ` : ''}{t?.title || id} <X size={11} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 ml-1">No topics selected.</p>
                  )}
                  <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
                    <select value={activeCourseId} onChange={e => setCourseId(e.target.value)} className="select-premium text-xs cursor-pointer">
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                      {courseModules.length === 0 && <p className="text-xs text-slate-400">No modules in this course.</p>}
                      {courseModules.map(m => {
                        const modTopics = topics.filter(t => t.moduleId === m.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                        if (!modTopics.length) return null;
                        return (
                          <div key={m.id}>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{m.title}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {modTopics.map(t => (
                                <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-xs font-semibold text-slate-600">
                                  <input type="checkbox" checked={form.topicIds.includes(t.id)} onChange={() => toggleTopic(t.id)} className="rounded border-slate-300 text-[#255A84] focus:ring-[#255A84]" />
                                  <span className="truncate">{t.title}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 ml-1">Topics you add are marked complete for the students who were present.</p>
                  <textarea
                    value={form.topicsNote}
                    onChange={e => setForm(f => ({ ...f, topicsNote: e.target.value }))}
                    rows={2}
                    maxLength={3000}
                    placeholder="Anything else covered (optional)"
                    className="textarea-premium text-sm"
                  />
                </div>

                {/* Tasks */}
                <div>
                  <label className={label}><ClipboardList size={11} className="inline mr-1" />Tasks given today *</label>
                  <textarea
                    value={form.tasks}
                    onChange={e => setForm(f => ({ ...f, tasks: e.target.value }))}
                    rows={4}
                    maxLength={5000}
                    placeholder="e.g. Complete the keyword research worksheet for your project brand."
                    className="textarea-premium text-sm"
                  />
                </div>

                {/* Recipients: two emails */}
                {[
                  { key: 'attended', title: 'Attended', note: 'get the class report' },
                  { key: 'missed', title: 'Missed', note: 'get the “you missed today’s class” email' },
                ].map(({ key, title, note }) => {
                  const a = data.audiences[key];
                  const open = showRecipients === key;
                  return (
                    <div key={key} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                      <button type="button" onClick={() => setShowRecipients(open ? '' : key)} className="w-full flex items-center justify-between text-left gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          <Users size={13} className={`inline mr-1 ${key === 'attended' ? 'text-emerald-600' : 'text-rose-500'}`} />
                          {title}: {a.recipients.length} student(s) {note}
                          {a.chunks > 1 ? ` · ${a.chunks} emails of up to ${data.bccChunkSize}` : ''}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-[#255A84] shrink-0">{open ? 'Hide' : 'Show'}</span>
                      </button>
                      {open && (
                        <ul className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                          {a.recipients.length === 0 && <li className="py-1.5 text-xs text-slate-400">Nobody</li>}
                          {a.recipients.map(r => (
                            <li key={r.uid || r.email} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-700 truncate">
                                {r.name}
                                {r.guest ? <span className="ml-1 text-[10px] text-slate-400">(other batch)</span> : null}
                                {r.status === 'leave' ? <span className="ml-1 text-[10px] text-amber-600">(on leave)</span> : null}
                              </span>
                              <span className="text-slate-400 truncate">{r.email}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <SkippedRecipients skipped={a.skipped} title={`${title} but no usable email`} />
                    </div>
                  );
                })}
                <p className="text-[11px] text-slate-400 ml-1 -mt-2">Both emails go in BCC with our own address in To, so students never see each other’s email.</p>

                {/* CC */}
                {ccAddress && (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer">
                    <input type="checkbox" checked={cc} onChange={e => setCc(e.target.checked)} className="rounded border-slate-300 text-[#255A84] focus:ring-[#255A84]" />
                    <span className="text-xs font-semibold text-slate-700">CC <span className="font-bold">{ccAddress}</span> <span className="text-slate-400 font-medium">(one copy of each email)</span></span>
                  </label>
                )}

                <ErrorNotice message={error} />
                {notice && <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold">{notice}</div>}
              </div>

              {/* ── Right: preview ── */}
              <div className="space-y-3 min-w-0 lg:sticky lg:top-0 self-start">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[['attended', `Attended (${attendedCount})`], ['missed', `Missed (${missedCount})`]].map(([key, text]) => (
                    <button key={key} type="button" onClick={() => setPreviewTab(key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition ${previewTab === key ? 'bg-white text-[#255A84] shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>
                      {text}
                    </button>
                  ))}
                </div>
                <EmailPreviewFrame
                  subject={data.audiences[previewTab].content.subject}
                  html={data.audiences[previewTab].content.html}
                  loading={refreshing}
                  meta={`To: our address${cc && ccAddress ? ` · CC: ${ccAddress}` : ''} · BCC: ${data.audiences[previewTab].recipients.length} student(s)`}
                />
                <button type="button" onClick={refresh} disabled={refreshing} className="btn-outline-premium w-full px-4 py-2.5 flex items-center justify-center gap-2 text-xs">
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Update preview with my changes
                </button>
              </div>
            </div>
          )}
        </div>

        {data && (
          <div className="modal-footer-premium flex-wrap">
            <button type="button" onClick={sendTest} disabled={testing || sending} className="btn-outline-premium px-4 py-2.5 flex items-center gap-2 text-xs">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Send test to me
            </button>
            {alreadySent ? (
              <button type="button" onClick={() => send(true)} disabled={sending || !recipientCount} className="btn-secondary-premium px-5 py-2.5 flex items-center gap-2 text-xs">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Resend…
              </button>
            ) : (
              <button type="button" onClick={() => send(false)} disabled={sending || !recipientCount} className="btn-primary-premium px-5 py-2.5 flex items-center gap-2 text-xs">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send ({attendedCount} attended · {missedCount} missed)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
