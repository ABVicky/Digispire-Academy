/**
 * Feature 3 — individual emails from Attendance Reports. Never a group mail:
 * one message per student, To = that student only.
 */
import {
  DEFAULT_THRESHOLDS, EMAIL_SKIP_REASONS, STUDENT_EMAIL_TYPES, buildCurriculumLookup, buildSessionBatchMap,
  buildSessionIndex, buildStudentSnapshot, checkEmail, getReportBatchId, getStudentUid, isStudentActive,
  resolveAttendanceLogs, zonedNow,
} from '../../src/utils/studentReport.js';
import { actorOf } from '../auth.js';
import { assertMailConfig, getConfig } from '../config.js';
import { loadAllClassSessions, loadAttendanceForStudentIds, loadReference, loadStudents } from '../data.js';
import { HttpError, requireString } from '../http.js';
import { createMessagesIfAbsent, prepareMessages } from '../outbox.js';
import { absenteeismEmail, lowAttendanceEmail, syllabusDueEmail } from '../templates/index.js';
import { kickWorker } from '../worker.js';
import { ccListFor, publicCcAddress, sanitizeThresholds, staffTestAddress } from './shared.js';

const TEMPLATES = { low_attendance: lowAttendanceEmail, syllabus_due: syllabusDueEmail, absenteeism: absenteeismEmail };
const MAX_STUDENTS = 200;

function parseRequest(body) {
  const type = body.type;
  if (!TEMPLATES[type]) throw new HttpError(400, `type must be one of: ${STUDENT_EMAIL_TYPES.map(t => t.id).join(', ')}`);
  const uids = Array.isArray(body.studentUids) ? [...new Set(body.studentUids.filter(u => typeof u === 'string' && u))] : [];
  if (!uids.length) throw new HttpError(400, 'Select at least one student.');
  if (uids.length > MAX_STUDENTS) throw new HttpError(400, `You can email at most ${MAX_STUDENTS} students at once.`);
  const track = body.track === 'internship' ? 'internship' : 'academic';
  const batchId = typeof body.batchId === 'string' && body.batchId ? body.batchId : 'all';
  const note = requireString(body.note ?? '', 'Note', { max: 3000, required: false });
  const thresholds = { ...DEFAULT_THRESHOLDS, ...sanitizeThresholds(body.thresholds) };
  return { type, uids, track, batchId, note, thresholds };
}

async function buildRows(req, config) {
  const today = zonedNow(config.timezone).date;
  const [ref, students, sessions] = await Promise.all([loadReference(), loadStudents(), loadAllClassSessions()]);
  const chosen = req.uids.map(uid => ({ uid, student: students.find(s => getStudentUid(s) === uid || s.id === uid) || null }));
  const logs = await loadAttendanceForStudentIds(chosen.map(c => c.student?.studentId));
  const resolved = resolveAttendanceLogs(logs, buildSessionBatchMap(sessions));
  const sessionIndex = buildSessionIndex({ classSessions: sessions, logs: resolved });
  const lookup = buildCurriculumLookup(ref);

  return chosen.map(({ uid, student }) => {
    if (!student) return { uid, name: 'Unknown student', skip: 'not_found' };
    const base = { uid, name: student.name || 'Student', studentId: student.studentId || '', email: student.email || '' };
    if (!isStudentActive(student)) return { ...base, skip: 'inactive' };
    const batch = ref.batches.find(b => b.id === getReportBatchId(student, req.track, req.batchId));
    if (!batch) return { ...base, skip: 'no_classes' };
    const snapshot = buildStudentSnapshot({
      student, batch, track: req.track, logs: resolved, holidays: ref.holidays, cancelledClasses: ref.cancelledClasses,
      sessionIndex, lookup, endDateStr: today, thresholds: req.thresholds,
    });
    const check = checkEmail(student.email);
    return { ...base, email: check.email, skip: check.ok ? null : check.reason, snapshot };
  });
}

const summaryOf = (s) => s && ({
  batchName: s.batchName, held: s.held, attended: s.attended, absent: s.absent, leave: s.leave,
  pct: s.pct, pctExcludingLeave: s.pctExcludingLeave,
  streak: s.absenceStats.currentConsecutiveAbsences,
  recentAbsences: s.absenceStats.recentAbsentDates.length,
  missedTopics: s.missed.reduce((n, e) => n + e.topics.length, 0),
  pendingTopics: s.pendingTopics.length,
  flags: s.flags,
});

const renderFor = (config, req, row, user) =>
  TEMPLATES[req.type](config, { studentName: row.name, snapshot: row.snapshot, note: req.note, senderName: user.name });

export async function previewStudentEmails(user, body) {
  const config = getConfig();
  const req = parseRequest(body);
  const rows = await buildRows(req, config);
  const selected = rows.find(r => r.uid === body.previewUid && r.snapshot) || rows.find(r => !r.skip) || rows.find(r => r.snapshot);
  const content = selected ? renderFor(config, req, selected, user) : null;
  return {
    type: req.type,
    ccAddress: publicCcAddress(config),
    rows: rows.map(r => ({
      uid: r.uid, name: r.name, studentId: r.studentId, email: r.email,
      skip: r.skip, skipLabel: r.skip ? EMAIL_SKIP_REASONS[r.skip] : null,
      summary: summaryOf(r.snapshot),
    })),
    preview: selected ? { uid: selected.uid, name: selected.name, subject: content.subject, html: content.html } : null,
  };
}

export async function sendStudentEmails(user, body, { test = false } = {}) {
  const config = assertMailConfig(getConfig());
  const req = parseRequest(body);
  const rows = await buildRows(req, config);
  const meta = (r) => ({ studentUid: r.uid, studentName: r.name, batchId: r.snapshot?.batchId || '', batchName: r.snapshot?.batchName || '', track: req.track, hasNote: !!req.note });

  if (test) {
    const row = rows.find(r => r.uid === body.previewUid && r.snapshot) || rows.find(r => r.snapshot);
    if (!row) throw new HttpError(400, 'None of the selected students can be previewed.');
    const email = staffTestAddress(user);
    const messages = prepareMessages(config, {
      idBase: `test_${req.type}_${row.uid}_${Date.now()}`, type: req.type, content: renderFor(config, req, row, user),
      delivery: { kind: 'staff', email, intended: row.skip ? [] : [{ uid: row.uid, name: row.name, email: row.email }] },
      meta: meta(row), createdBy: actorOf(user),
    });
    await createMessagesIfAbsent(messages);
    kickWorker(config);
    return { ok: true, test: true, to: email };
  }

  const requestId = String(body.requestId || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw new HttpError(400, 'requestId is missing or invalid.');

  const sendable = rows.filter(r => !r.skip);
  const cc = ccListFor(body, config);
  const messages = sendable.flatMap(r => prepareMessages(config, {
    idBase: `ind_${req.type}_${requestId}_${r.uid}`, type: req.type, content: renderFor(config, req, r, user),
    delivery: { kind: 'to', recipient: { uid: r.uid, name: r.name, email: r.email } },
    meta: { ...meta(r), requestId }, createdBy: actorOf(user), cc,
  }));
  const { created, existing } = await createMessagesIfAbsent(messages);
  if (created.length) kickWorker(config);

  return {
    ok: true,
    queued: created.length,
    alreadyQueued: existing.length,
    skipped: rows.filter(r => r.skip).map(r => ({ uid: r.uid, name: r.name, reason: r.skip, label: EMAIL_SKIP_REASONS[r.skip] })),
  };
}
