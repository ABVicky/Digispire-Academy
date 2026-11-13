/**
 * Email queue + log.
 *
 *   email_outbox/{id}  one document per SMTP message (one BCC chunk, or one
 *                      individual email): recipients, type, batch, class,
 *                      month, status, attempts, error, timestamps. This IS the
 *                      email log the UI shows.
 *   email_bodies/{id}  subject/html/text for that message (kept separate so
 *                      history lists stay small).
 *   email_meta/rate    recipients sent in the current clock hour (host cap).
 *
 * A message is "due" when nextAttemptAt <= now. Claiming it sets a 3-minute
 * lease via nextAttemptAt, so a worker that dies mid-send is retried later.
 * Sent/failed messages get nextAttemptAt = null and drop out of the queue.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';
import { closeTransport, deliver, isHostRateLimitError } from './mailer.js';
import { withBanner, textBanner } from './templates/components.js';

export const OUTBOX = 'email_outbox';
export const BODIES = 'email_bodies';
const RATE_DOC = 'email_meta/rate';
const LEASE_MS = 3 * 60 * 1000;
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360];
const ALREADY_EXISTS = 6;

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nextHourMillis = () => Math.ceil((Date.now() + 1) / 3_600_000) * 3_600_000 + 30_000;

/**
 * Turns one logical email into queue messages.
 *
 * delivery.kind:
 *   'bcc'   recipients split into BCC chunks; To is our own from-address,
 *           so no student ever sees another student's address
 *   'to'    a single recipient in To (individual emails)
 *   'staff' a "send test to me" copy for the signed-in staff member
 *
 * `cc` (live sends only) is added to the first message, so a CC'd address
 * gets one copy per email rather than one per BCC chunk.
 */
export function prepareMessages(config, { idBase, type, delivery, content, meta = {}, createdBy, cc = [] }) {
  const purpose = delivery.kind === 'staff' ? 'test' : 'live';
  let groups;
  if (delivery.kind === 'bcc') {
    groups = chunk(delivery.recipients, config.bccChunkSize).map(rs => ({
      recipients: rs, to: [config.from.address], bcc: rs.map(r => r.email),
    }));
  } else if (delivery.kind === 'to') {
    groups = [{ recipients: [delivery.recipient], to: [delivery.recipient.email], bcc: [] }];
  } else {
    groups = [{ recipients: [], to: [delivery.email], bcc: [] }];
  }

  return groups.map((g, i) => {
    const id = groups.length > 1 ? `${idBase}_c${i + 1}` : idBase;
    const { to, bcc } = g;
    const ccList = purpose === 'live' && i === 0 ? cc : [];
    let { subject, html, text } = content;

    if (purpose === 'test') {
      const intended = delivery.intended || [];
      const title = `Preview sent only to you. Real send: ${intended.length} recipient(s).`;
      const lines = intended.slice(0, 25).map(r => `${r.name || 'Student'} <${r.email}>`);
      if (intended.length > 25) lines.push(`…and ${intended.length - 25} more`);
      html = withBanner(html, title, lines);
      text = `${textBanner(title, lines)}${text}`;
      subject = `[Preview] ${subject}`;
    }

    return {
      id,
      outbox: {
        type,
        purpose,
        status: 'queued',
        subject,
        to,
        cc: ccList,
        bcc,
        deliveryCount: to.length + ccList.length + bcc.length,
        recipients: g.recipients.map(r => ({ uid: r.uid || '', name: r.name || '', email: r.email })),
        recipientUids: g.recipients.map(r => r.uid).filter(Boolean),
        recipientCount: g.recipients.length,
        chunkIndex: i + 1,
        chunkCount: groups.length,
        attempts: 0,
        maxAttempts: config.maxAttempts,
        nextAttemptAt: Timestamp.now(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy,
        sentAt: null,
        lastError: null,
        rejected: [],
        ...meta,
      },
      body: { subject, html, text },
    };
  });
}

/** Queue messages inside an existing transaction (atomic with other writes). */
export function addMessagesToTransaction(tx, messages) {
  const db = adminDb();
  for (const m of messages) {
    tx.create(db.collection(OUTBOX).doc(m.id), m.outbox);
    tx.set(db.collection(BODIES).doc(m.id), m.body);
  }
}

/**
 * Queue messages whose ids may already exist. Existing ids are skipped, which
 * is what makes re-runs safe (no double-sending).
 */
export async function createMessagesIfAbsent(messages, { concurrency = 10 } = {}) {
  const db = adminDb();
  const created = [];
  const existing = [];
  for (const group of chunk(messages, concurrency)) {
    await Promise.all(group.map(async (m) => {
      const batch = db.batch();
      batch.create(db.collection(OUTBOX).doc(m.id), m.outbox);
      batch.set(db.collection(BODIES).doc(m.id), m.body);
      try {
        await batch.commit();
        created.push(m.id);
      } catch (err) {
        if (err?.code === ALREADY_EXISTS) existing.push(m.id);
        else throw err;
      }
    }));
  }
  return { created, existing };
}

// ─── Worker ─────────────────────────────────────────────────────────────────

async function claim(db, ref, config) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data();
    if (d.status !== 'queued' && d.status !== 'sending') {
      if (d.nextAttemptAt) tx.update(ref, { nextAttemptAt: null });
      return null;
    }
    if (d.nextAttemptAt && d.nextAttemptAt.toMillis() > Date.now()) return null;
    const max = d.maxAttempts || config.maxAttempts;
    if (d.status === 'sending' && (d.attempts || 0) >= max) {
      tx.update(ref, {
        status: 'failed',
        nextAttemptAt: null,
        failedAt: FieldValue.serverTimestamp(),
        lastError: d.lastError || 'The worker stopped while sending and the retry limit was reached.',
      });
      return { ...d, status: 'failed', finalized: true };
    }
    const attempts = (d.attempts || 0) + 1;
    tx.update(ref, {
      status: 'sending',
      attempts,
      nextAttemptAt: Timestamp.fromMillis(Date.now() + LEASE_MS),
      lastAttemptAt: FieldValue.serverTimestamp(),
    });
    return { ...d, attempts };
  });
}

async function reserveRate(db, config, cost) {
  const ref = db.doc(RATE_DOC);
  const windowKey = new Date().toISOString().slice(0, 13); // UTC clock hour
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const sameWindow = d.windowKey === windowKey;
    const used = sameWindow ? (d.count || 0) : 0;
    if ((sameWindow && d.blocked) || used + cost > config.maxPerHour) return { ok: false };
    tx.set(ref, { windowKey, count: used + cost, blocked: false, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  });
}

async function blockRateWindow(db) {
  await db.doc(RATE_DOC).set({ windowKey: new Date().toISOString().slice(0, 13), blocked: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function deferToNextHour(ref, reason) {
  await ref.update({
    status: 'queued',
    attempts: FieldValue.increment(-1), // not a real attempt
    nextAttemptAt: Timestamp.fromMillis(nextHourMillis()),
    deferredReason: reason,
  });
}

/** Keeps class_sessions/{id}.emailReport.lastStatus in step with its messages. */
export async function refreshClassReportStatus(classSessionId, sendNo) {
  if (!classSessionId || !sendNo) return;
  const db = adminDb();
  const sessionRef = db.doc(`class_sessions/${classSessionId}`);
  const [sessionSnap, msgs] = await Promise.all([
    sessionRef.get(),
    db.collection(OUTBOX).where('classSessionId', '==', classSessionId).get(),
  ]);
  if ((sessionSnap.data()?.emailReport?.sendCount || 0) !== sendNo) return; // a newer resend owns the status
  const statuses = msgs.docs.map(d => d.data()).filter(d => d.purpose === 'live' && d.sendNo === sendNo).map(d => d.status);
  if (!statuses.length) return;
  const done = statuses.every(s => s === 'sent' || s === 'failed');
  let status = 'sending';
  if (done) {
    const sent = statuses.filter(s => s === 'sent').length;
    status = sent === statuses.length ? 'sent' : sent === 0 ? 'failed' : 'partial';
  }
  await sessionRef.set({
    emailReport: { lastStatus: status, lastDeliveredAt: done ? FieldValue.serverTimestamp() : null },
  }, { merge: true });
}

async function afterFinal(msg) {
  if ((msg.type === 'class_report' || msg.type === 'class_missed') && msg.purpose === 'live') {
    try { await refreshClassReportStatus(msg.classSessionId, msg.sendNo); } catch (err) { console.error('[email] status refresh failed', err); }
  }
}

async function sendOne(db, config, ref, msg) {
  const bodySnap = await db.collection(BODIES).doc(ref.id).get();
  if (!bodySnap.exists) {
    await ref.update({ status: 'failed', nextAttemptAt: null, lastError: 'Email body is missing.', failedAt: FieldValue.serverTimestamp() });
    await afterFinal(msg);
    return 'failed';
  }
  const body = bodySnap.data();
  try {
    const info = await deliver(config, { to: msg.to, cc: msg.cc || [], bcc: msg.bcc || [], subject: body.subject, html: body.html, text: body.text });
    await ref.update({
      status: 'sent', nextAttemptAt: null, sentAt: FieldValue.serverTimestamp(),
      messageId: info.messageId, rejected: info.rejected, smtpResponse: info.response, lastError: null,
    });
    await afterFinal(msg);
    return 'sent';
  } catch (err) {
    const message = String(err?.response || err?.message || err).slice(0, 500);
    if (isHostRateLimitError(err)) {
      await blockRateWindow(db);
      await deferToNextHour(ref, `Mail host hourly limit: ${message}`);
      return 'rateLimited';
    }
    const max = msg.maxAttempts || config.maxAttempts;
    if (msg.attempts >= max) {
      await ref.update({ status: 'failed', nextAttemptAt: null, lastError: message, failedAt: FieldValue.serverTimestamp() });
      await afterFinal(msg);
      return 'failed';
    }
    const delayMin = BACKOFF_MINUTES[Math.min(msg.attempts - 1, BACKOFF_MINUTES.length - 1)];
    await ref.update({ status: 'queued', nextAttemptAt: Timestamp.fromMillis(Date.now() + delayMin * 60_000), lastError: message });
    return 'retried';
  }
}

const dueQuery = (db, limit) =>
  db.collection(OUTBOX).where('nextAttemptAt', '<=', Timestamp.now()).orderBy('nextAttemptAt').limit(limit);

/**
 * Sends due messages until the time budget, the hourly cap, or the queue runs
 * out. Messages go one at a time with MAIL_SEND_DELAY_MS between them.
 */
export async function processQueue(config, { timeBudgetMs = 45_000 } = {}) {
  const db = adminDb();
  const deadline = Date.now() + timeBudgetMs;
  const summary = { sent: 0, failed: 0, retried: 0, rateLimited: false, more: false };
  const timeLeft = () => deadline - Date.now() > 5_000;

  try {
    outer: while (timeLeft()) {
      const due = await dueQuery(db, 20).get();
      if (due.empty) break;
      let progressed = false;
      for (const snap of due.docs) {
        if (!timeLeft()) break outer;
        const msg = await claim(db, snap.ref, config);
        if (!msg) continue;
        progressed = true;
        if (msg.finalized) { summary.failed += 1; await afterFinal(msg); continue; }

        const reserved = await reserveRate(db, config, msg.deliveryCount || 1);
        if (!reserved.ok) {
          await deferToNextHour(snap.ref, 'Hourly sending limit (MAIL_MAX_PER_HOUR) reached');
          summary.rateLimited = true;
          break outer;
        }

        const outcome = await sendOne(db, config, snap.ref, msg);
        if (outcome === 'rateLimited') { summary.rateLimited = true; break outer; }
        summary[outcome] += 1;
        if (config.sendDelayMs && timeLeft()) await sleep(config.sendDelayMs);
      }
      if (!progressed) break;
    }
    if (!summary.rateLimited) summary.more = !(await dueQuery(db, 1).get()).empty;
  } finally {
    closeTransport();
  }
  return summary;
}

/** Admin action: put a failed message back in the queue. */
export async function retryMessage(id) {
  const db = adminDb();
  const ref = db.collection(OUTBOX).doc(id);
  const msg = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data();
    if (d.status !== 'failed') return { ...d, skipped: true };
    tx.update(ref, { status: 'queued', attempts: 0, nextAttemptAt: Timestamp.now(), previousError: d.lastError || null, lastError: null });
    return d;
  });
  if (msg && !msg.skipped && (msg.type === 'class_report' || msg.type === 'class_missed')) {
    await db.doc(`class_sessions/${msg.classSessionId}`).set({ emailReport: { lastStatus: 'sending' } }, { merge: true });
  }
  return msg;
}
