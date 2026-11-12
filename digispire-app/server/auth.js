import { adminAuth, adminDb } from './firebaseAdmin.js';
import { HttpError } from './http.js';

const STAFF_ROLES = ['admin', 'educator'];

/**
 * Verifies the Firebase ID token sent by the web app and loads the caller's
 * role from users/{uid}. Only admins and educators may use the email API;
 * `adminOnly` actions additionally require the admin role.
 */
export async function requireStaff(req, { adminOnly = false } = {}) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'Please sign in again.');

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(match[1]);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  const snap = await adminDb().doc(`users/${decoded.uid}`).get();
  const profile = snap.exists ? snap.data() : null;
  const role = profile?.role;
  if (!STAFF_ROLES.includes(role)) throw new HttpError(403, 'Only faculty and admins can send emails.');
  if (adminOnly && role !== 'admin') throw new HttpError(403, 'Only admins can do this.');

  return {
    uid: decoded.uid,
    role,
    name: profile.name || decoded.email || 'Staff',
    email: (profile.email || decoded.email || '').trim(),
  };
}

export const actorOf = (user) => ({ uid: user.uid, name: user.name, role: user.role });
