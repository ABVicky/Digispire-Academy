import { EMAIL_TYPE_LABELS } from './studentReport';

export const EMAIL_STATUS_STYLES = {
  queued: { label: 'Queued', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  sending: { label: 'Sending', className: 'bg-blue-50 text-[#255A84] border-blue-200' },
  sent: { label: 'Sent', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Partly sent', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const emailTypeLabel = (type) => EMAIL_TYPE_LABELS[type] || type || 'Email';

/** Accepts a Firestore Timestamp, ISO string or Date. */
export function formatDateTime(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const tsMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export function newRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Remember small per-browser preferences (thresholds, toggles). */
export function readPref(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — fine */
  }
}
