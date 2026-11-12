import { auth } from '../firebase';

/**
 * Calls the email API (Vercel function at /api/email) as the signed-in user.
 * The server checks the user's role and works out recipients itself.
 */
export async function callEmailApi(action, payload = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again.');
  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, action }),
    });
  } catch {
    throw new Error('Could not reach the email service. Check your internet connection.');
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!data) {
    throw new Error(res.ok
      ? 'The email service is not running here. It runs on the Vercel deployment (locally: `npx vercel dev`).'
      : `Email service error (${res.status}).`);
  }
  if (!res.ok) {
    const err = new Error(data.error || `Email service error (${res.status}).`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
