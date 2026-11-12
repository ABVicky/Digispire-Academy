import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Mail, Settings, FlaskConical, Play, RefreshCw, Loader2, CalendarRange, CheckCircle2, AlertTriangle, Eye, RotateCcw, X, Inbox,
} from 'lucide-react';
import { callEmailApi } from '../../utils/emailApi';
import { emailTypeLabel, formatDateTime } from '../../utils/emailFormat';
import { DEFAULT_TIMEZONE, EMAIL_TYPE_LABELS, zonedNow } from '../../utils/studentReport';
import { emailFeaturesEnabled } from '../../utils/platform';
import { EmailPreviewFrame, EmailStatusBadge, ErrorNotice, ModalPortal, SkippedRecipients, TestModeBadge, TestModeNotice } from '../../components/email/EmailBits';

function Card({ title, icon: Icon, children, action }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Icon size={16} className="text-[#255A84]" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ConfigCard({ config, error, onReload }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const run = async (action, label) => {
    setBusy(action); setMsg(''); setErr('');
    try {
      const res = await callEmailApi(action);
      setMsg(action === 'smtp.test' ? `SMTP test sent to ${res.to}. Check that inbox (and spam).` : `Worker started (${res.due} message(s) due now).`);
    } catch (e) {
      setErr(`${label}: ${e.message}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <Card title="Email setup" icon={Settings} action={
      <button onClick={onReload} className="btn-outline-premium px-3 py-2 text-xs flex items-center gap-1.5"><RefreshCw size={13} /> Reload</button>
    }>
      <ErrorNotice message={error} />
      {config && (
        <>
          {config.configured ? (
            <p className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={15} /> SMTP is configured.</p>
          ) : (
            <ErrorNotice message={`Not configured yet. Add these in Vercel → Settings → Environment Variables, then redeploy:\n${config.missing.join(', ')}`} />
          )}
          {config.missing?.includes('CRON_SECRET') && config.configured && (
            <ErrorNotice message="CRON_SECRET is missing, so scheduled sending and retries will not run." />
          )}
          <TestModeNotice testMode={config.testMode} />
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {[
              ['From', `${config.from?.name} <${config.from?.address || '—'}>`],
              ['SMTP', config.smtp ? `${config.smtp.host || '—'}:${config.smtp.port} (${config.smtp.encryption})` : '—'],
              ['Test recipient', config.testMode ? (config.testRecipient || '—') : 'Test mode off (live)'],
              ['BCC per message', config.bccChunkSize],
              ['Hourly cap (recipients)', config.maxPerHour],
              ['Delay between emails', `${config.sendDelayMs} ms`],
              ['Retries', `${config.maxAttempts} attempts`],
              ['Monthly report', config.monthly?.enabled ? `Last day of month, ${config.monthly.time} (${config.timezone})` : 'Automatic run disabled'],
              ['Test-mode monthly sample', `${config.testSampleSize} student(s)`],
            ].map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 min-w-0">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</dt>
                <dd className="font-semibold text-slate-700 mt-0.5 break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => run('smtp.test', 'SMTP test')} disabled={!!busy || !config.configured} className="btn-primary-premium px-4 py-2.5 text-xs flex items-center gap-2">
              {busy === 'smtp.test' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Send SMTP test to me
            </button>
            <button onClick={() => run('outbox.process', 'Process queue')} disabled={!!busy || !config.configured} className="btn-outline-premium px-4 py-2.5 text-xs flex items-center gap-2">
              {busy === 'outbox.process' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Process queue now
            </button>
          </div>
          {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
          <ErrorNotice message={err} />
        </>
      )}
    </Card>
  );
}

function MonthlyCard() {
  const [month, setMonth] = useState(zonedNow(DEFAULT_TIMEZONE).date.slice(0, 7));
  const [data, setData] = useState(null);
  const [studentUid, setStudentUid] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [runResult, setRunResult] = useState(null);

  const preview = useCallback(async (uid) => {
    setBusy('preview'); setError('');
    try {
      const res = await callEmailApi('monthly.preview', { month, studentUid: uid || undefined });
      setData(res);
      setStudentUid(res.preview?.uid || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }, [month]);

  const sendTest = async () => {
    setBusy('test'); setError(''); setMsg('');
    try {
      const res = await callEmailApi('monthly.sendTest', { month, studentUid });
      setMsg(`Test copy queued to ${res.to}.`);
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const runNow = async () => {
    const eligible = data?.counts?.eligible ?? 0;
    const note = data?.testMode ? `\n\nTest mode is ON: only ${Math.min(eligible, data.testSampleSize)} sample email(s) go to the test address.` : '';
    if (!window.confirm(`Send the ${data?.monthLabel || month} report to ${eligible} active student(s)?\nStudents who already got it are skipped automatically.${note}`)) return;
    setBusy('run'); setError(''); setMsg('');
    try {
      const res = await callEmailApi('monthly.run', { month });
      setRunResult(res);
      await preview(studentUid);
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  return (
    <Card title="Monthly attendance report" icon={CalendarRange}>
      <p className="text-xs text-slate-500">
        Sent automatically on the last day of each month to every active student with a valid email. Use this to preview any month,
        send yourself a test, or run it manually. Re-running never sends a student the same month twice.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setData(null); setRunResult(null); }} className="input-premium text-sm w-auto" />
        <button onClick={() => preview()} disabled={!!busy || !month} className="btn-outline-premium px-4 py-2.5 text-xs flex items-center gap-2">
          {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
        </button>
        {data && (
          <>
            <button onClick={sendTest} disabled={!!busy || !studentUid} className="btn-outline-premium px-4 py-2.5 text-xs flex items-center gap-2">
              {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Send this one to me
            </button>
            <button onClick={runNow} disabled={!!busy || !data.counts.eligible} className="btn-primary-premium px-4 py-2.5 text-xs flex items-center gap-2">
              {busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run for {data.monthLabel}
            </button>
          </>
        )}
      </div>
      <ErrorNotice message={error} />
      {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
      {runResult && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold space-y-1">
          <p>{runResult.queued} queued · {runResult.alreadyQueued} already sent earlier · {runResult.skipped.length} skipped.</p>
          {runResult.sampleLimited && <p>Test mode: only a sample was queued.</p>}
        </div>
      )}
      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="space-y-3 min-w-0">
            <TestModeNotice testMode={data.testMode} />
            <p className="text-xs font-semibold text-slate-600">
              {data.counts.eligible} will receive it · {data.counts.skipped} skipped · {data.counts.alreadyQueued} already queued/sent
              {data.run?.lastRunAt ? ` · last run ${formatDateTime(data.run.lastRunAt)} (${data.run.lastTrigger})` : ''}
            </p>
            <div className="rounded-xl border border-slate-200 max-h-[460px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="text-left px-3 py-2">Student</th>
                    <th className="text-center px-2 py-2">Held</th>
                    <th className="text-center px-2 py-2">Att.</th>
                    <th className="text-center px-2 py-2">Abs.</th>
                    <th className="text-center px-2 py-2">Leave</th>
                    <th className="text-center px-2 py-2">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.rows.map(r => (
                    <tr key={r.uid} onClick={() => r.totals && preview(r.uid)}
                      className={`${r.totals ? 'cursor-pointer hover:bg-slate-50' : ''} ${studentUid === r.uid ? 'bg-blue-50/60' : ''}`}>
                      <td className="px-3 py-2">
                        <p className="font-bold text-slate-700">{r.name} {r.queued && <span className="text-[10px] text-emerald-600 font-bold">· sent</span>}</p>
                        <p className={`text-[10px] ${r.skip ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>{r.skip ? r.skipLabel : r.email}</p>
                      </td>
                      <td className="text-center px-2">{r.totals?.held ?? '—'}</td>
                      <td className="text-center px-2 text-emerald-600 font-bold">{r.totals?.attended ?? '—'}</td>
                      <td className="text-center px-2 text-rose-500 font-bold">{r.totals?.absent ?? '—'}</td>
                      <td className="text-center px-2 text-amber-600 font-bold">{r.totals?.leave ?? '—'}</td>
                      <td className="text-center px-2 font-black">{r.totals ? `${r.totals.pct}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SkippedRecipients skipped={data.rows.filter(r => r.skip && r.skip !== 'inactive').map(r => ({ ...r, label: r.skipLabel }))} title="Active students who will be skipped" />
          </div>
          <EmailPreviewFrame subject={data.preview?.subject} html={data.preview?.html} loading={busy === 'preview'} meta={data.preview ? `To: ${data.preview.name}` : ''} />
        </div>
      )}
    </Card>
  );
}

function BodyModal({ id, onClose }) {
  const [body, setBody] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getDoc(doc(db, 'email_bodies', id))
      .then(s => (s.exists() ? setBody(s.data()) : setError('Body not found.')))
      .catch(() => setError('Could not load this email.'));
  }, [id]);
  return (
    <ModalPortal>
      <div className="modal-backdrop-premium" onClick={onClose}>
        <div className="modal-container-premium w-full sm:max-w-3xl" onClick={e => e.stopPropagation()}>
          <div className="modal-header-premium">
            <h2 className="text-lg font-bold text-slate-800">Sent email</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="modal-body-premium">
            <ErrorNotice message={error} />
            {body && <EmailPreviewFrame subject={body.subject} html={body.html} height={620} />}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function OutboxCard() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewId, setViewId] = useState(null);
  const [retrying, setRetrying] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'email_outbox'), orderBy('createdAt', 'desc'), limit(150));
    return onSnapshot(q, snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setError(''); },
      err => setError(err.code === 'permission-denied' ? 'Deploy the updated firestore.rules to see the email log (see EMAIL_SETUP.md).' : 'Could not load the email log.'));
  }, []);

  const filtered = useMemo(() => items.filter(m =>
    (typeFilter === 'all' || m.type === typeFilter) && (statusFilter === 'all' || m.status === statusFilter)
  ), [items, typeFilter, statusFilter]);

  const retry = async (id) => {
    setRetrying(id);
    try { await callEmailApi('outbox.retry', { id }); } catch (e) { setError(e.message); } finally { setRetrying(''); }
  };

  const context = (m) => {
    if (m.type === 'class_report' || m.type === 'class_missed') return `${m.batchName || m.batchId} · ${m.sessionDate}${m.chunkCount > 1 ? ` · part ${m.chunkIndex}/${m.chunkCount}` : ''}${m.isResend ? ' · resend' : ''}`;
    if (m.type === 'monthly_report') return `${m.month} · ${m.studentName || ''}`;
    if (m.studentName) return `${m.studentName}${m.batchName ? ` · ${m.batchName}` : ''}`;
    return '';
  };

  return (
    <Card title="Email log" icon={Inbox} action={
      <div className="flex gap-2">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select-premium text-xs py-2 cursor-pointer">
          <option value="all">All types</option>
          {Object.entries(EMAIL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-premium text-xs py-2 cursor-pointer">
          <option value="all">All statuses</option>
          {['queued', 'sending', 'sent', 'failed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    }>
      <ErrorNotice message={error} />
      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No emails yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="text-left px-3 py-2.5">When</th>
                <th className="text-left px-3 py-2.5">Email</th>
                <th className="text-left px-3 py-2.5">Recipients</th>
                <th className="text-left px-3 py-2.5">By</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(m => (
                <tr key={m.id} className="align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                    {formatDateTime(m.createdAt)}
                    {m.sentAt && <span className="block text-[10px] text-emerald-600">sent {formatDateTime(m.sentAt)}</span>}
                  </td>
                  <td className="px-3 py-2.5 max-w-[260px]">
                    <p className="font-bold text-slate-700">{emailTypeLabel(m.type)}{m.purpose === 'test' ? ' (preview)' : ''}</p>
                    <p className="text-slate-500 truncate">{m.subject}</p>
                    <p className="text-[10px] text-slate-400 truncate">{context(m)}</p>
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <p className="font-semibold text-slate-700">{m.recipientCount ? `${m.recipientCount} student(s)` : (m.to || []).join(', ')}</p>
                    {m.bcc?.length ? <p className="text-[10px] text-slate-400">BCC {m.bcc.length}</p> : null}
                    {m.cc?.length ? <p className="text-[10px] text-slate-400 truncate">CC {m.cc.join(', ')}</p> : null}
                    {m.testMode && <p className="text-[10px] text-amber-700 truncate">→ {(m.to || []).join(', ')}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{m.createdBy?.name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 items-center">
                      <EmailStatusBadge status={m.status} />
                      {m.testMode && <TestModeBadge />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{m.attempts || 0} attempt(s)</p>
                    {m.lastError && <p className="text-[10px] text-rose-600 max-w-[200px] break-words">{m.lastError}</p>}
                    {m.deferredReason && m.status === 'queued' && <p className="text-[10px] text-amber-700 max-w-[200px]">{m.deferredReason}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setViewId(m.id)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-[#255A84]" title="View email"><Eye size={13} /></button>
                    {m.status === 'failed' && m.type !== 'smtp_test' && (
                      <button onClick={() => retry(m.id)} disabled={retrying === m.id} className="ml-1 p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600" title="Retry">
                        {retrying === m.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewId && <BodyModal id={viewId} onClose={() => setViewId(null)} />}
    </Card>
  );
}

export default function EmailCenterPage() {
  const { userProfile } = useAuth();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  const loadConfig = useCallback(() => {
    callEmailApi('config.get').then(c => { setConfig(c); setError(''); }).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'admin' && emailFeaturesEnabled()) loadConfig();
  }, [userProfile, loadConfig]);

  if (!emailFeaturesEnabled() || userProfile?.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
        <AlertTriangle size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-bold">{emailFeaturesEnabled() ? 'Only admins can open the Email Center.' : 'The Email Center is available on the website only.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <div className="section-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2"><Mail size={22} className="text-[#255A84]" /> Email Center</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">SMTP status, monthly reports and the log of every email sent</p>
        </div>
      </div>
      <ConfigCard config={config} error={error} onReload={loadConfig} />
      <MonthlyCard />
      <OutboxCard />
    </div>
  );
}
