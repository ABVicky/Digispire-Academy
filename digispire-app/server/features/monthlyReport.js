/**
 * Feature 2 — monthly individual attendance report.
 *
 * Idempotency: each student's message id is `monthly_<YYYY-MM>_<uid>` (with a
 * `_test` suffix in test mode). Queueing uses create-if-absent, so re-running
 * a month — by the scheduler or an admin — never double-sends.
 */
import { FieldValue } from 'firebase-admin/firestore';
import {
  EMAIL_SKIP_REASONS, addDays, buildCurriculumLookup, buildMonthlyReport, buildSessionBatchMap,
  buildSessionIndex, checkEmail, formatMonthLabel, getStudentUid, isMonthString, isStudentActive,
  monthBounds, previousMonth, resolveAttendanceLogs, zonedNow,
} from '../../src/utils/studentReport.js';
import { actorOf } from '../auth.js';
import { assertMailConfig, getConfig, missingConfig } from '../config.js';
import { loadAttendanceBetween, loadClassSessionsBetween, loadReference, loadStudents } from '../data.js';
import { adminDb } from '../firebaseAdmin.js';
import { HttpError } from '../http.js';
import { OUTBOX, createMessagesIfAbsent, prepareMessages } from '../outbox.js';
import { monthlyReportEmail } from '../templates/index.js';
import { kickWorker } from '../worker.js';
import { SYSTEM_ACTOR, isoOf, staffTestAddress } from './shared.js';

export const monthlyRunId = (month, testMode) => `monthly_${month}${testMode ? '_test' : ''}`;

async function buildEntries(month, config, { onlyUid } = {}) {
  if (!isMonthString(month)) throw new HttpError(400, 'month must be YYYY-MM.');
  const today = zonedNow(config.timezone).date;
  const { start, end } = monthBounds(month);
  if (start > today) throw new HttpError(400, 'That month has not started yet.');

  const [ref, students, sessions, logs] = await Promise.all([
    loadReference(), loadStudents(), loadClassSessionsBetween(start, end), loadAttendanceBetween(start, end),
  ]);
  const resolved = resolveAttendanceLogs(logs, buildSessionBatchMap(sessions));
  const sessionIndex = buildSessionIndex({ classSessions: sessions, logs: resolved });
  const lookup = buildCurriculumLookup(ref);
  const logsByStudent = new Map();
  for (const l of resolved) {
    if (!logsByStudent.has(l.studentId)) logsByStudent.set(l.studentId, []);
    logsByStudent.get(l.studentId).push(l);
  }

  return students
    .filter(s => !onlyUid || getStudentUid(s) === onlyUid)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(student => {
      const base = { uid: getStudentUid(student), name: student.name || 'Student', studentId: student.studentId || '', email: student.email || '' };
      if (!isStudentActive(student)) return { ...base, skip: 'inactive', report: null };
      const report = buildMonthlyReport({
        student, batches: ref.batches, month, logs: logsByStudent.get(student.studentId) || [], sessionIndex,
        holidays: ref.holidays, cancelledClasses: ref.cancelledClasses, lookup, todayStr: today,
      });
      if (!report.hasClasses) return { ...base, skip: 'no_classes', report };
      const check = checkEmail(student.email);
      if (!check.ok) return { ...base, skip: check.reason, report };
      return { ...base, email: check.email, skip: null, report };
    });
}

const rowOf = (e, queuedIds, runId) => ({
  uid: e.uid, name: e.name, studentId: e.studentId, email: e.email,
  skip: e.skip, skipLabel: e.skip ? EMAIL_SKIP_REASONS[e.skip] : null,
  totals: e.report?.hasClasses ? e.report.totals : null,
  batches: e.report?.sections.map(s => s.batchName) || [],
  queued: queuedIds.has(`${runId}_${e.uid}`),
});

async function loadRun(runId) {
  const snap = await adminDb().doc(`email_runs/${runId}`).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return { id: runId, ...d, lastRunAt: isoOf(d.lastRunAt), scheduledRunAt: isoOf(d.scheduledRunAt), createdAt: isoOf(d.createdAt) };
}

export async function previewMonthly(user, body) {
  const config = getConfig();
  const month = body.month;
  const entries = await buildEntries(month, config);
  const runId = monthlyRunId(month, config.testMode);

  const eligible = entries.filter(e => !e.skip);
  const db = adminDb();
  const refs = eligible.map(e => db.collection(OUTBOX).doc(`${runId}_${e.uid}`));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const queuedIds = new Set(snaps.filter(s => s.exists).map(s => s.id));

  const selected = entries.find(e => e.uid === body.studentUid && e.report?.hasClasses) || eligible[0] || entries.find(e => e.report?.hasClasses);
  const content = selected ? monthlyReportEmail(config, { studentName: selected.name, report: selected.report }) : null;

  return {
    month,
    monthLabel: formatMonthLabel(month),
    testMode: config.testMode,
    testSampleSize: config.testSampleSize,
    schedule: { ...config.monthly, timezone: config.timezone },
    run: await loadRun(runId),
    counts: { students: entries.length, eligible: eligible.length, skipped: entries.length - eligible.length, alreadyQueued: queuedIds.size },
    rows: entries.map(e => rowOf(e, queuedIds, runId)),
    preview: selected ? { uid: selected.uid, name: selected.name, subject: content.subject, html: content.html } : null,
  };
}

export async function runMonthly(month, { actor, trigger }) {
  const config = assertMailConfig(getConfig());
  const entries = await buildEntries(month, config);
  const runId = monthlyRunId(month, config.testMode);
  let eligible = entries.filter(e => !e.skip);
  const sampleLimited = config.testMode && eligible.length > config.testSampleSize;
  if (sampleLimited) eligible = eligible.slice(0, config.testSampleSize);

  const messages = eligible.flatMap(e => prepareMessages(config, {
    idBase: `${runId}_${e.uid}`,
    type: 'monthly_report',
    delivery: { kind: 'to', recipient: { uid: e.uid, name: e.name, email: e.email } },
    content: monthlyReportEmail(config, { studentName: e.name, report: e.report }),
    meta: { month, runId, studentUid: e.uid, studentName: e.name },
    createdBy: actor,
  }));
  const { created, existing } = await createMessagesIfAbsent(messages);
  const skipped = entries.filter(e => e.skip).map(e => ({ uid: e.uid, name: e.name, reason: e.skip, label: EMAIL_SKIP_REASONS[e.skip] }));

  const runRef = adminDb().doc(`email_runs/${runId}`);
  await runRef.create({ createdAt: FieldValue.serverTimestamp() }).catch(() => {});
  await runRef.set({
    type: 'monthly_report',
    month,
    testMode: config.testMode,
    lastTrigger: trigger,
    lastRunAt: FieldValue.serverTimestamp(),
    lastRunBy: actor,
    runs: FieldValue.increment(1),
    queuedTotal: FieldValue.increment(created.length),
    lastResult: {
      eligible: entries.filter(e => !e.skip).length,
      queued: created.length,
      alreadyQueued: existing.length,
      skipped: skipped.length,
      sampleLimited,
    },
    skipped: skipped.slice(0, 300),
  }, { merge: true });

  if (created.length) kickWorker(config);
  return { runId, queued: created.length, alreadyQueued: existing.length, skipped, sampleLimited, testMode: config.testMode };
}

export async function runMonthlyAction(user, body) {
  return runMonthly(body.month, { actor: actorOf(user), trigger: 'manual' });
}

export async function sendMonthlyTest(user, body) {
  const config = assertMailConfig(getConfig());
  if (!body.studentUid) throw new HttpError(400, 'Choose a student to preview.');
  const [entry] = await buildEntries(body.month, config, { onlyUid: body.studentUid });
  if (!entry?.report?.hasClasses) throw new HttpError(400, 'This student has no classes in that month.');
  const email = staffTestAddress(user);
  const messages = prepareMessages(config, {
    idBase: `test_monthly_${body.month}_${entry.uid}_${Date.now()}`,
    type: 'monthly_report',
    delivery: { kind: 'staff', email, intended: entry.email && !entry.skip ? [{ uid: entry.uid, name: entry.name, email: entry.email }] : [] },
    content: monthlyReportEmail(config, { studentName: entry.name, report: entry.report }),
    meta: { month: body.month, studentUid: entry.uid, studentName: entry.name },
    createdBy: actorOf(user),
  });
  await createMessagesIfAbsent(messages);
  kickWorker(config);
  return { ok: true, test: true, to: email };
}

/**
 * Called by the cron endpoint. Runs month M once it is the last day of M at or
 * after MONTHLY_REPORT_TIME (APP_TIMEZONE); catches up during the following
 * day if that tick was missed.
 */
export async function maybeRunScheduledMonthly(now = new Date()) {
  const config = getConfig();
  if (!config.monthly.enabled) return { ran: false, reason: 'MONTHLY_REPORT_ENABLED is off' };
  if (missingConfig(config).length) return { ran: false, reason: 'email not configured' };

  const { date, time } = zonedNow(config.timezone, now);
  const nowKey = `${date}T${time}`;
  const currentMonth = date.slice(0, 7);

  for (const month of [previousMonth(currentMonth), currentMonth]) {
    const { end } = monthBounds(month);
    if (nowKey < `${end}T${config.monthly.time}` || date > addDays(end, 1)) continue;
    const runId = monthlyRunId(month, config.testMode);
    const runRef = adminDb().doc(`email_runs/${runId}`);
    if ((await runRef.get()).data()?.scheduledRunAt) continue;
    const result = await runMonthly(month, { actor: SYSTEM_ACTOR, trigger: 'schedule' });
    await runRef.set({ scheduledRunAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ran: true, month, queued: result.queued, alreadyQueued: result.alreadyQueued, skipped: result.skipped.length };
  }
  return { ran: false, reason: 'not scheduled now' };
}
