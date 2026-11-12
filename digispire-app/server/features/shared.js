import { EMAIL_SKIP_REASONS, checkEmail } from '../../src/utils/studentReport.js';
import { HttpError } from '../http.js';

export const SYSTEM_ACTOR = Object.freeze({ uid: 'system', name: 'Scheduler', role: 'system' });

export const isoOf = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return null;
};

export const skipEntry = (fields, reason) => ({ ...fields, reason, label: EMAIL_SKIP_REASONS[reason] || reason });

/** The signed-in staff member's own address, for "Send test to me". */
export function staffTestAddress(user) {
  const check = checkEmail(user.email);
  if (!check.ok) throw new HttpError(400, 'Your staff profile has no valid email address, so a test cannot be sent to you.');
  return check.email;
}

export function sanitizeThresholds(input = {}) {
  const pick = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
  };
  const out = {
    lowAttendancePct: pick(input.lowAttendancePct, 1, 100),
    consecutiveAbsences: pick(input.consecutiveAbsences, 1, 60),
    frequentAbsences: pick(input.frequentAbsences, 1, 60),
    frequentWindowDays: pick(input.frequentWindowDays, 7, 365),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}
