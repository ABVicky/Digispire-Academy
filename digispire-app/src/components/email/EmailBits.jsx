import { createPortal } from 'react-dom';
import { AlertTriangle, FlaskConical, MailWarning } from 'lucide-react';
import { EMAIL_STATUS_STYLES } from '../../utils/emailFormat';

/**
 * Renders wide modals on <body>, outside the admin <main> stacking context,
 * so the sidebar can't cover them.
 */
export function ModalPortal({ children }) {
  return createPortal(children, document.body);
}

export function EmailStatusBadge({ status, className = '' }) {
  const style = EMAIL_STATUS_STYLES[status] || EMAIL_STATUS_STYLES.queued;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${style.className} ${className}`}>
      {style.label}
    </span>
  );
}

export function TestModeBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
      <FlaskConical size={10} /> Test
    </span>
  );
}

export function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold">
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <p className="whitespace-pre-line">{message}</p>
    </div>
  );
}

/** Students who were skipped (no/invalid email, inactive…) — shown, never fatal. */
export function SkippedRecipients({ skipped = [], title = 'Will be skipped' }) {
  if (!skipped.length) return null;
  return (
    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-700">
        <MailWarning size={13} /> {title} ({skipped.length})
      </p>
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {skipped.map((s, i) => (
          <li key={`${s.uid || s.name}-${i}`} className="text-xs text-amber-900">
            <span className="font-bold">{s.name}</span>
            {s.studentId ? <span className="font-mono text-amber-700/80"> · {s.studentId}</span> : null}
            <span className="text-amber-700"> — {s.label || s.skipLabel || s.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmailPreviewFrame({ subject, html, meta, loading = false, height = 560 }) {
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-0.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email preview</p>
        <p className="text-sm font-bold text-slate-800 break-words">{subject || '—'}</p>
        {meta ? <p className="text-[11px] text-slate-500 font-medium break-words">{meta}</p> : null}
      </div>
      <div className="relative bg-slate-100">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <div className="animate-spin h-7 w-7 border-4 border-[#255A84] border-t-transparent rounded-full" />
          </div>
        )}
        {html ? (
          <iframe title="Email preview" sandbox="" srcDoc={html} className="w-full block bg-white" style={{ height }} />
        ) : (
          <div className="flex items-center justify-center text-xs text-slate-400 font-semibold" style={{ height: 160 }}>No preview yet</div>
        )}
      </div>
    </div>
  );
}
