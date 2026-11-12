import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { ConfigError } from './config.js';

/**
 * FIREBASE_SERVICE_ACCOUNT holds the service-account JSON from
 * Firebase Console → Project settings → Service accounts → Generate new private key.
 * Paste the whole JSON, or its base64 encoding.
 */
function loadServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) throw new ConfigError('FIREBASE_SERVICE_ACCOUNT is not set.', ['FIREBASE_SERVICE_ACCOUNT']);
  try {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const json = JSON.parse(text);
    if (typeof json.private_key === 'string') json.private_key = json.private_key.replace(/\\n/g, '\n');
    return json;
  } catch {
    throw new ConfigError('FIREBASE_SERVICE_ACCOUNT is not valid service-account JSON.', ['FIREBASE_SERVICE_ACCOUNT']);
  }
}

let app;
function getAdminApp() {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const serviceAccount = loadServiceAccount();
  app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  return app;
}

export const adminDb = () => getFirestore(getAdminApp());
export const adminAuth = () => getAuth(getAdminApp());
