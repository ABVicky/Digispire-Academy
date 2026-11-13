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

/**
 * CC list for a send: MAIL_CC_ADDRESS (unless "cc" is unticked) and the
 * educator's email (unless "ccEducator" is unticked).
 */
export function ccListFor(body, config, { educatorEmail = '' } = {}) {
  const list = [];
  if (body.cc !== false) list.push(config.ccAddress);
  if (body.ccEducator !== false && educatorEmail) list.push(educatorEmail);
  const seen = new Set();
  return list
    .map(e => checkEmail(e))
    .filter(c => c.ok && !seen.has(c.email.toLowerCase()) && seen.add(c.email.toLowerCase()))
    .map(c => c.email);
}

export const publicCcAddress = (config) => (checkEmail(config.ccAddress).ok ? config.ccAddress : '');
export const validEmailOrEmpty = (email) => (checkEmail(email).ok ? String(email).trim() : '');

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
