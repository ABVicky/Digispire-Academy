import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { History } from 'lucide-react';
import { emailTypeLabel, formatDateTime, tsMillis } from '../../utils/emailFormat';
import { EmailStatusBadge, TestModeBadge } from './EmailBits';

/** Every email this student was a recipient of (class reports, monthly, alerts). */
export default function EmailHistoryList({ studentUid }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!studentUid) return undefined;
    const q = query(collection(db, 'email_outbox'), where('recipientUids', 'array-contains', studentUid));
    return onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setError('');
    }, err => setError(err.code === 'permission-denied'
      ? 'Email history needs the updated Firestore rules (see EMAIL_SETUP.md).'
      : 'Could not load email history.'));
  }, [studentUid]);

  const sorted = useMemo(() => [...items].sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)), [items]);
  const visible = showAll ? sorted : sorted.slice(0, 8);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
        <History size={13} /> Email history ({sorted.length})
      </h3>
      {error ? (
        <p className="text-xs text-amber-700 font-semibold">{error}</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-slate-400">No emails sent to this student yet.</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {visible.map(m => (
            <li key={m.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{emailTypeLabel(m.type)}{m.month ? ` · ${m.month}` : ''}{m.sessionDate ? ` · ${m.batchName || ''} ${m.sessionDate}` : ''}</p>
                <p className="text-[11px] text-slate-400 truncate">{m.subject}</p>
                <p className="text-[10px] text-slate-400">
                  {formatDateTime(m.sentAt || m.createdAt)} · by {m.createdBy?.name || '—'}{m.isResend ? ' · resend' : ''}
                </p>
                {m.status === 'failed' && m.lastError && <p className="text-[10px] text-rose-600 truncate">{m.lastError}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <EmailStatusBadge status={m.status} />
                {m.testMode && <TestModeBadge />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > 8 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="text-[11px] font-bold text-[#255A84]">
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
