import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { actorOf } from '../auth.js';
import { assertMailConfig, getConfig, missingConfig } from '../config.js';
import { adminDb } from '../firebaseAdmin.js';
import { HttpError } from '../http.js';
import { closeTransport, deliver } from '../mailer.js';
import { BODIES, OUTBOX, retryMessage } from '../outbox.js';
import { smtpTestEmail } from '../templates/index.js';
import { kickWorker } from '../worker.js';
import { staffTestAddress } from './shared.js';

export async function getPublicConfig(user) {
  const config = getConfig();
  const missing = missingConfig(config);
  return {
    configured: missing.filter(n => n !== 'CRON_SECRET').length === 0,
    missing,
    testMode: config.testMode,
    testRecipient: user.role === 'admin' ? config.testRecipient : undefined,
    testSampleSize: config.testSampleSize,
    from: config.from,
    smtp: user.role === 'admin' ? { host: config.smtp.host, port: config.smtp.port, encryption: config.smtp.encryption, user: config.smtp.user } : undefined,
    bccChunkSize: config.bccChunkSize,
    maxPerHour: config.maxPerHour,
    sendDelayMs: config.sendDelayMs,
    maxAttempts: config.maxAttempts,
    monthly: config.monthly,
    timezone: config.timezone,
    academy: config.academy,
  };
}

/** Sends immediately (not queued) so SMTP problems show up right away. Logged. */
export async function sendSmtpTest(user) {
  const config = assertMailConfig(getConfig());
  const email = staffTestAddress(user);
  const content = smtpTestEmail(config, { requestedBy: `${user.name} <${email}>` });
  const db = adminDb();
  const ref = db.collection(OUTBOX).doc(`smtp_test_${Date.now()}`);
  const base = {
    type: 'smtp_test', purpose: 'test', testMode: false, subject: content.subject, to: [email], bcc: [], deliveryCount: 1,
    recipients: [], recipientUids: [], recipientCount: 0, chunkIndex: 1, chunkCount: 1, attempts: 1, maxAttempts: 1,
    nextAttemptAt: null, createdAt: FieldValue.serverTimestamp(), createdBy: actorOf(user),
  };
  await db.collection(BODIES).doc(ref.id).set(content);
  try {
    const info = await deliver(config, { to: [email], subject: content.subject, html: content.html, text: content.text });
    await ref.set({ ...base, status: 'sent', sentAt: FieldValue.serverTimestamp(), messageId: info.messageId, smtpResponse: info.response, lastError: null });
    return { ok: true, to: email, response: info.response };
  } catch (err) {
    const message = String(err?.response || err?.message || err).slice(0, 500);
    await ref.set({ ...base, status: 'failed', failedAt: FieldValue.serverTimestamp(), lastError: message });
    throw new HttpError(502, `SMTP test failed: ${message}`);
  } finally {
    closeTransport();
  }
}

export async function retryOutboxMessage(user, body) {
  if (!body.id || typeof body.id !== 'string') throw new HttpError(400, 'id is required.');
  const msg = await retryMessage(body.id);
  if (!msg) throw new HttpError(404, 'Message not found.');
  if (msg.skipped) throw new HttpError(400, 'Only failed messages can be retried.');
  kickWorker(getConfig());
  return { ok: true };
}

export async function processQueueNow() {
  const config = assertMailConfig(getConfig());
  kickWorker(config);
  const due = await adminDb().collection(OUTBOX).where('nextAttemptAt', '<=', Timestamp.now()).limit(50).get();
  return { ok: true, due: due.size };
}
