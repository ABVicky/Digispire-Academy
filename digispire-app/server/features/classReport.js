/**
 * Feature 1 — class report emails (one send per batch per date), two kinds:
 *   attended  → active students marked PRESENT (or makeup)       type: class_report
 *   missed    → active students of the batch who were absent/leave type: class_missed
 * Both go in BCC; To = our own from-address. Optional CC to MAIL_CC_ADDRESS.
 */
import { FieldValue } from 'firebase-admin/firestore';
import {
  EMAIL_SKIP_REASONS, buildCurriculumLookup, buildSessionBatchMap, buildSessionIndex, checkEmail,
  classSessionDocId, describeTopics, formatDateLabel, getSessionAttendance, getSessionTime,
  getStudentUid, isDateString, mergeClassSessionDocs, resolveAttendanceLogs,
} from '../../src/utils/studentReport.js';
import { actorOf } from '../auth.js';
import { assertMailConfig, getConfig } from '../config.js';
import { loadAttendanceOn, loadClassSessionsOn, loadReference, loadStaff, loadStudents } from '../data.js';
import { adminDb } from '../firebaseAdmin.js';
import { HttpError, requireString } from '../http.js';
import { addMessagesToTransaction, createMessagesIfAbsent, prepareMessages } from '../outbox.js';
import { classMissedEmail, classReportEmail } from '../templates/index.js';
import { kickWorker } from '../worker.js';
import { ccListFor, isoOf, publicCcAddress, staffTestAddress } from './shared.js';

const MAX_TOPICS = 100;
const AUDIENCES = {
  attended: { type: 'class_report', idPrefix: 'class', template: classReportEmail },
  missed: { type: 'class_missed', idPrefix: 'classmissed', template: classMissedEmail },
};

async function loadContext(body) {
  const { batchId, date } = body;
  if (!batchId || typeof batchId !== 'string') throw new HttpError(400, 'batchId is required.');
  if (!isDateString(date)) throw new HttpError(400, 'date must be YYYY-MM-DD.');

  const [ref, students, staff, daySessions, dayLogs] = await Promise.all([
    loadReference(), loadStudents(), loadStaff(), loadClassSessionsOn(date), loadAttendanceOn(date),
  ]);
  const batch = ref.batches.find(b => b.id === batchId);
  if (!batch) throw new HttpError(404, `Batch "${batchId}" was not found.`);

  const logs = resolveAttendanceLogs(dayLogs, buildSessionBatchMap(daySessions));
  const session = mergeClassSessionDocs(daySessions.filter(s => s.batchId === batchId));
  const sessionInfo = buildSessionIndex({ classSessions: daySessions, logs }).get(classSessionDocId(batchId, date)) || null;
  const attendance = getSessionAttendance({ batchId, date, students, logs });
  const lookup = buildCurriculumLookup(ref);

  const byName = (name) => name && staff.find(s => (s.name || '').trim().toLowerCase() === String(name).trim().toLowerCase());
  const defaults = {
    topicIds: (sessionInfo?.coveredTopics || []).filter(id => lookup.topic.has(id)),
    topicsNote: sessionInfo?.topicsNote || '',
    tasks: sessionInfo?.tasks || '',
    takenByUid: sessionInfo?.takenBy?.uid || byName(batch.educator)?.id || '',
  };

  return { batch, date, docId: classSessionDocId(batchId, date), staff, session, sessionInfo, attendance, lookup, defaults, time: getSessionTime(batch, date) };
}

function normalizeForm(body, ctx, user) {
  const topicIds = Array.isArray(body.topicIds)
    ? [...new Set(body.topicIds.filter(id => typeof id === 'string' && ctx.lookup.topic.has(id)))].slice(0, MAX_TOPICS)
    : ctx.defaults.topicIds;
  const topicsNote = body.topicsNote !== undefined ? requireString(body.topicsNote, 'Topics note', { max: 3000, required: false }) : ctx.defaults.topicsNote;
  const tasks = body.tasks !== undefined ? requireString(body.tasks, 'Tasks', { max: 5000, required: false }) : ctx.defaults.tasks;
  const takenByUid = typeof body.takenByUid === 'string' ? body.takenByUid : ctx.defaults.takenByUid;
  const member = ctx.staff.find(s => s.id === takenByUid);
  const takenBy = member
    ? { uid: member.id, name: member.name || member.email || 'Faculty' }
    : ctx.batch.educator ? { uid: '', name: ctx.batch.educator } : { uid: user.uid, name: user.name };
  return { topicIds, topicsNote, tasks, takenBy };
}

/** Valid, de-duplicated recipients for a list of attendance entries; the rest are reported as skipped. */
function splitRecipients(entries, enrolled) {
  const recipients = [];
  const skipped = [];
  const seen = new Set();
  for (const entry of entries) {
    const s = entry.student;
    const name = s?.name || entry.log?.name || 'Student';
    if (!s) {
      skipped.push({ uid: entry.log?.uid || '', name, studentId: entry.log?.studentId || '', reason: 'not_found', label: EMAIL_SKIP_REASONS.not_found });
      continue;
    }
    const check = checkEmail(s.email);
    if (!check.ok) {
      skipped.push({ uid: getStudentUid(s), name, studentId: s.studentId || '', reason: check.reason, label: EMAIL_SKIP_REASONS[check.reason] });
      continue;
    }
    const key = check.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ uid: getStudentUid(s), name, email: check.email, studentId: s.studentId || '', guest: !enrolled.includes(s), status: entry.status });
  }
  return { recipients, skipped };
}

const audienceEntries = (attendance) => ({
  attended: attendance.attendees,
  missed: [...attendance.absent, ...attendance.leave],
});

function render(config, ctx, form, audience, { placeholderTasks = false } = {}) {
  const topics = describeTopics(form.topicIds, ctx.lookup);
  const courseIds = [...new Set(topics.map(t => t.courseId).filter(Boolean))];
  if (!courseIds.length && ctx.sessionInfo?.coveredCourse) courseIds.push(ctx.sessionInfo.coveredCourse);
  return AUDIENCES[audience].template(config, {
    batchName: ctx.batch.name || ctx.batch.id,
    dateLabel: formatDateLabel(ctx.date),
    timeLabel: ctx.time.label,
    facultyName: form.takenBy.name,
    presentCount: ctx.attendance.present.length,
    totalCount: ctx.attendance.enrolled.length,
    guestCount: ctx.attendance.guests.length,
    courseName: courseIds.map(id => ctx.lookup.course.get(id)?.name).filter(Boolean).join(', '),
    topics,
    topicsNote: form.topicsNote,
    tasks: form.tasks || (placeholderTasks ? '(The tasks you enter will appear here.)' : ''),
  });
}

export function emailStatusOf(session) {
  const r = session?.emailReport;
  if (!r?.sendCount) return { sendCount: 0 };
  return {
    sendCount: r.sendCount,
    lastSentAt: isoOf(r.lastSentAt),
    lastSentBy: r.lastSentBy || null,
    lastStatus: r.lastStatus || 'queued',
    lastRecipientCount: r.lastRecipientCount || 0,
    lastMissedCount: r.lastMissedCount || 0,
    lastDeliveredAt: isoOf(r.lastDeliveredAt),
    testMode: !!r.testMode,
  };
}

export async function previewClassReport(user, body) {
  const config = getConfig();
  const ctx = await loadContext(body);
  const form = normalizeForm(body, ctx, user);
  const entries = audienceEntries(ctx.attendance);
  const audiences = {};
  for (const key of Object.keys(AUDIENCES)) {
    const { recipients, skipped } = splitRecipients(entries[key], ctx.attendance.enrolled);
    const content = render(config, ctx, form, key, { placeholderTasks: true });
    audiences[key] = {
      recipients,
      skipped,
      chunks: Math.ceil(recipients.length / config.bccChunkSize),
      content: { subject: content.subject, html: content.html },
    };
  }
  return {
    batch: { id: ctx.batch.id, name: ctx.batch.name || ctx.batch.id },
    date: ctx.date,
    dateLabel: formatDateLabel(ctx.date),
    time: ctx.time,
    attendance: {
      present: ctx.attendance.present.length,
      enrolled: ctx.attendance.enrolled.length,
      guests: ctx.attendance.guests.length,
      leave: ctx.attendance.leave.length,
      absent: ctx.attendance.absent.length,
    },
    defaults: ctx.defaults,
    form: { topicIds: form.topicIds, topicsNote: form.topicsNote, tasks: form.tasks, takenByUid: form.takenBy.uid },
    audiences,
    ccAddress: publicCcAddress(config),
    bccChunkSize: config.bccChunkSize,
    status: emailStatusOf(ctx.session),
    curriculumSource: ctx.sessionInfo?.source || null,
    testMode: config.testMode,
  };
}

async function markTopicsComplete(topicIds, uids) {
  if (!topicIds.length || !uids.length) return;
  const db = adminDb();
  await Promise.all(topicIds.map(id =>
    db.doc(`topics/${id}`).update({ completedStudents: FieldValue.arrayUnion(...uids) })
      .catch(err => console.warn(`[class-report] could not mark topic ${id} complete:`, err.message))
  ));
}

export async function sendClassReport(user, body, { test = false } = {}) {
  const config = assertMailConfig(getConfig());
  const ctx = await loadContext(body);
  const form = normalizeForm(body, ctx, user);
  if (!form.tasks) throw new HttpError(400, 'Please enter the tasks given today before sending.');

  const entries = audienceEntries(ctx.attendance);
  const groups = Object.keys(AUDIENCES).map(key => ({
    key,
    ...AUDIENCES[key],
    ...splitRecipients(entries[key], ctx.attendance.enrolled),
    content: render(config, ctx, form, key),
  }));
  const meta = { batchId: ctx.batch.id, batchName: ctx.batch.name || ctx.batch.id, classSessionId: ctx.docId, sessionDate: ctx.date };

  if (test) {
    const email = staffTestAddress(user);
    const stamp = Date.now();
    const messages = groups.flatMap(g => prepareMessages(config, {
      idBase: `test_${g.idPrefix}_${ctx.docId}_${stamp}`, type: g.type, content: g.content, meta, createdBy: actorOf(user),
      delivery: { kind: 'staff', email, intended: g.recipients },
    }));
    await createMessagesIfAbsent(messages);
    kickWorker(config);
    return { ok: true, test: true, to: email, emails: messages.length };
  }

  const sendable = groups.filter(g => g.recipients.length);
  if (!sendable.length) {
    throw new HttpError(400, 'No student in this batch has a valid email address, so there is nobody to send to.', { skipped: groups.flatMap(g => g.skipped) });
  }

  const db = adminDb();
  const ref = db.doc(`class_sessions/${ctx.docId}`);
  const resend = body.resend === true;
  const expected = Number.isInteger(body.expectedSendCount) ? body.expectedSendCount : null;
  const topics = describeTopics(form.topicIds, ctx.lookup);
  const cc = ccListFor(body, config);
  const attended = groups.find(g => g.key === 'attended');
  const missed = groups.find(g => g.key === 'missed');

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? snap.data() : null;
    const sendCount = existing?.emailReport?.sendCount || 0;
    if (sendCount > 0 && !resend) {
      throw new HttpError(409, 'This class report was already sent. Use Resend if you really want to send it again.', { status: emailStatusOf(existing) });
    }
    if (expected !== null && expected !== sendCount) {
      throw new HttpError(409, 'Someone else just sent this report. Close and reopen it to see the latest status.', { status: emailStatusOf(existing) });
    }
    const sendNo = sendCount + 1;
    const messages = sendable.flatMap(g => prepareMessages(config, {
      idBase: `${g.idPrefix}_${ctx.docId}_s${sendNo}`, type: g.type, content: g.content, createdBy: actorOf(user),
      meta: { ...meta, sendNo, isResend: sendNo > 1, audience: g.key },
      delivery: { kind: 'bcc', recipients: g.recipients },
      cc,
    }));

    const legacy = ctx.session || {};
    tx.set(ref, {
      batchId: ctx.batch.id,
      date: ctx.date,
      type: ctx.batch.id === 'internship' ? 'internship' : 'academic',
      ...(snap.exists ? {} : { timestamp: legacy.timestamp || FieldValue.serverTimestamp(), sessionId: legacy.sessionId || '' }),
      ...(legacy.sessionIds?.length ? { sessionIds: FieldValue.arrayUnion(...legacy.sessionIds) } : {}),
      coveredCourse: topics[0]?.courseId || existing?.coveredCourse || ctx.sessionInfo?.coveredCourse || '',
      coveredModule: topics[0]?.moduleId || existing?.coveredModule || ctx.sessionInfo?.coveredModule || '',
      coveredTopics: form.topicIds,
      topicsNote: form.topicsNote,
      tasks: form.tasks,
      takenBy: form.takenBy,
      reportUpdatedAt: FieldValue.serverTimestamp(),
      reportUpdatedBy: actorOf(user),
      emailReport: {
        sendCount: sendNo,
        lastSentAt: FieldValue.serverTimestamp(),
        lastSentBy: { uid: user.uid, name: user.name },
        lastStatus: 'queued',
        lastRecipientCount: attended.recipients.length,
        lastMissedCount: missed.recipients.length,
        lastSkippedCount: attended.skipped.length + missed.skipped.length,
        lastCc: cc,
        lastMessageIds: messages.map(m => m.id),
        lastDeliveredAt: null,
        testMode: config.testMode,
      },
    }, { merge: true });
    addMessagesToTransaction(tx, messages);
    return { sendNo, messageCount: messages.length };
  });

  // Topics on the final report count as completed for everyone present (add only).
  await markTopicsComplete(form.topicIds, ctx.attendance.presentUids);
  kickWorker(config);

  return {
    ok: true,
    sendNo: result.sendNo,
    recipients: attended.recipients.length,
    missedRecipients: missed.recipients.length,
    messages: result.messageCount,
    cc,
    skipped: [...attended.skipped, ...missed.skipped],
    testMode: config.testMode,
  };
}
