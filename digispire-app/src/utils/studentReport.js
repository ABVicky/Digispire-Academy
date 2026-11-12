/**
 * Shared report logic for the web app (src/) AND the email API (server/).
 *
 * Keep this module pure: no Firebase, DOM or Node imports. The Vercel API
 * functions import it directly (Vercel bundles whatever the function imports),
 * so there is no copy step — one file, one source of truth.
 */
import { calculateAttendance } from './attendanceEngine.js';

// ─── Configuration defaults ─────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS = Object.freeze({
  lowAttendancePct: 75,     // flag when attendance (leave excluded) is below this
  consecutiveAbsences: 3,   // flag when the current run of absences reaches this
  frequentAbsences: 5,      // flag when absences in the recent window reach this
  frequentWindowDays: 30,
});

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const STUDENT_EMAIL_TYPES = Object.freeze([
  { id: 'low_attendance', label: 'Low attendance warning', description: 'Attendance %, classes missed and recent absent dates.' },
  { id: 'syllabus_due', label: 'Syllabus due', description: 'Topics missed on absent days and topics still pending.' },
  { id: 'absenteeism', label: 'Absenteeism', description: 'Consecutive or frequent absences with the dates.' },
]);

export const EMAIL_TYPE_LABELS = Object.freeze({
  class_report: 'Class report',
  monthly_report: 'Monthly report',
  low_attendance: 'Low attendance warning',
  syllabus_due: 'Syllabus due',
  absenteeism: 'Absenteeism',
  smtp_test: 'SMTP test',
});

// ─── Dates ──────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isDateString = (value) => typeof value === 'string' && DATE_RE.test(value);
export const isMonthString = (value) => typeof value === 'string' && MONTH_RE.test(value);

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}

export function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** Current date ("YYYY-MM-DD") and time ("HH:MM") in a time zone. */
export function zonedNow(timeZone = DEFAULT_TIMEZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function formatDateLabel(dateStr, options = {}) {
  if (!isDateString(dateStr)) return dateStr || '';
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...options,
  });
}

export function formatMonthLabel(month) {
  if (!isMonthString(month)) return month || '';
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

export function formatTime12(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const tsMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
};

// ─── Students ───────────────────────────────────────────────────────────────

export const getStudentUid = (student) => student?.uid || student?.id || '';

export function getStudentBatchIds(student) {
  if (Array.isArray(student?.batchIds) && student.batchIds.length > 0) return student.batchIds;
  return student?.batchId ? [student.batchId] : [];
}

export function isStudentEnrolledInBatch(student, batchId) {
  if (batchId === 'internship') return !!student?.isIntern;
  return getStudentBatchIds(student).includes(batchId);
}

/** Students without a status field are active (no backfill needed). */
export const isStudentActive = (student) => (student?.status || 'active') !== 'inactive';

/** Mirrors attendanceEngine's joining-date fallback. */
export function getStudentJoinDate(student) {
  if (student?.joiningDate) return student.joiningDate;
  const seconds = student?.createdAt?.seconds ?? student?.createdAt?._seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString().slice(0, 10);
  return '2026-05-01';
}

/** Which batch a student's row is computed against on the Attendance Reports page. */
export function getReportBatchId(student, track, selectedBatchId = 'all') {
  if (track === 'internship') return 'internship';
  if (selectedBatchId && selectedBatchId !== 'all') return selectedBatchId;
  return student?.batchId || student?.batchIds?.[0] || 'morning';
}

// ─── Email addresses ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@,;<>()[\]]+@[^\s@,;<>()[\]]+\.[A-Za-z]{2,}$/;
// Student logins use a fake "<phone>@digispire.in" address — never email it.
const PLACEHOLDER_RE = /^\+?\d+@digispire\.in$/i;

export const EMAIL_SKIP_REASONS = Object.freeze({
  missing: 'No email address on file',
  invalid: 'Email address looks invalid',
  placeholder: 'Only the phone-login placeholder address is on file',
  inactive: 'Student is marked inactive',
  no_classes: 'No classes held for this student in the period',
  not_found: 'Student record not found',
});

export function checkEmail(raw) {
  const email = String(raw || '').trim();
  if (!email) return { ok: false, reason: 'missing', email: '' };
  if (PLACEHOLDER_RE.test(email)) return { ok: false, reason: 'placeholder', email };
  if (!EMAIL_RE.test(email)) return { ok: false, reason: 'invalid', email };
  return { ok: true, reason: null, email };
}

// ─── Class sessions ─────────────────────────────────────────────────────────
// One class session = one batch on one date. New writes use the fixed doc id
// below; older data may have several docs per batch/day (one per QR), which
// mergeClassSessionDocs() folds together.

export const classSessionDocId = (batchId, date) => `${batchId}_${date}`;

export function mergeClassSessionDocs(docs = []) {
  const valid = docs.filter(d => d && d.batchId && d.date);
  if (valid.length === 0) return null;
  const isCanonical = (d) => d.id === classSessionDocId(d.batchId, d.date);
  // Oldest first, canonical last, so newer data and the canonical doc win.
  const sorted = [...valid].sort((a, b) => {
    if (isCanonical(a) !== isCanonical(b)) return isCanonical(a) ? 1 : -1;
    return tsMillis(a.timestamp) - tsMillis(b.timestamp);
  });
  const merged = Object.assign({}, ...sorted);
  merged.sessionIds = [...new Set(valid.flatMap(d => [d.sessionId, ...(d.sessionIds || [])]).filter(Boolean))];
  merged.sourceIds = valid.map(d => d.id).filter(Boolean);
  merged.hasCanonical = valid.some(isCanonical);
  merged.id = classSessionDocId(merged.batchId, merged.date);
  return merged;
}

/** sessionId → { batchId, date }, used to repair attendance batch attribution. */
export function buildSessionBatchMap(classSessions = []) {
  const map = new Map();
  for (const s of classSessions) {
    if (!s?.batchId) continue;
    for (const id of [s.sessionId, ...(s.sessionIds || [])]) {
      if (id) map.set(id, { batchId: s.batchId, date: s.date });
    }
  }
  return map;
}

/**
 * Older check-ins stored the student's primary batch instead of the batch of
 * the QR session they scanned. If the log carries a sessionId we know, trust
 * the session's batch.
 */
export function resolveLogBatchId(log, sessionBatchMap) {
  const hit = log?.sessionId ? sessionBatchMap?.get(log.sessionId) : null;
  if (hit && (!hit.date || !log.date || hit.date === log.date)) return hit.batchId;
  return log?.batchId;
}

export function resolveAttendanceLogs(logs = [], sessionBatchMap) {
  return logs.map(log => {
    const batchId = resolveLogBatchId(log, sessionBatchMap);
    return batchId === log.batchId ? log : { ...log, batchId, originalBatchId: log.batchId };
  });
}

/**
 * Map of "batchId_date" → merged class session. When no class_sessions doc
 * exists, curriculum is inferred from attendance logs (same as the dashboard's
 * WhatsApp report).
 */
export function buildSessionIndex({ classSessions = [], logs = [] } = {}) {
  const groups = new Map();
  for (const s of classSessions) {
    if (!s?.batchId || !s?.date) continue;
    const key = classSessionDocId(s.batchId, s.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const index = new Map();
  for (const [key, docs] of groups) index.set(key, { ...mergeClassSessionDocs(docs), source: 'class_session' });

  for (const log of logs) {
    const batchId = log.type === 'internship' ? 'internship' : log.batchId;
    if (!batchId || !log.date) continue;
    const key = classSessionDocId(batchId, log.date);
    if (index.has(key)) continue;
    if (log.coveredCourse || log.coveredTopics?.length) {
      index.set(key, {
        id: key, batchId, date: log.date,
        coveredCourse: log.coveredCourse || '',
        coveredModule: log.coveredModule || '',
        coveredTopics: log.coveredTopics || [],
        source: 'attendance',
      });
    }
  }
  return index;
}

export function getSessionTime(batch, date) {
  const makeup = batch?.makeupClasses?.find(m => m.date === date);
  const temp = batch?.temporarySchedules?.find(t => t.date === date);
  const src = makeup || temp || batch || {};
  const startTime = src.startTime || batch?.startTime || '';
  const endTime = src.endTime || batch?.endTime || '';
  const label = startTime
    ? `${formatTime12(startTime)}${endTime ? ` – ${formatTime12(endTime)}` : ''}`
    : 'Time not set';
  return { startTime, endTime, label, kind: makeup ? 'makeup' : temp ? 'rescheduled' : 'regular' };
}

// ─── Attendance for one session ─────────────────────────────────────────────

export const isPresentStatus = (status) => {
  const s = status || 'present';
  return s === 'present' || s === 'makeup';
};

export function logMatchesBatch(log, batchId) {
  if (batchId === 'internship') return log.type === 'internship';
  return (log.type || 'academic') !== 'internship' && log.batchId === batchId;
}

/**
 * Who attended one class session. `logs` must already be resolved with
 * resolveAttendanceLogs(). Inactive students are left out entirely.
 *
 * - enrolled: active students of the batch who had joined by that date
 * - present / leave / absent: split of `enrolled` (leave is NOT present)
 * - guests: present students from other batches (e.g. makeup attendees)
 * - attendees: present + guests (the class report recipients)
 * - presentUids: every present student incl. inactive (for topic completion)
 */
export function getSessionAttendance({ batchId, date, students = [], logs = [] }) {
  const dayLogs = logs.filter(l => l.date === date && logMatchesBatch(l, batchId));
  const logByStudentId = new Map();
  for (const l of dayLogs) {
    if (!l.studentId) continue;
    const prev = logByStudentId.get(l.studentId);
    if (!prev || (isPresentStatus(l.status) && !isPresentStatus(prev.status))) logByStudentId.set(l.studentId, l);
  }
  const studentsById = new Map(students.filter(s => s.studentId).map(s => [s.studentId, s]));

  const enrolled = students.filter(s =>
    isStudentActive(s) && isStudentEnrolledInBatch(s, batchId) && getStudentJoinDate(s) <= date
  );
  const enrolledIds = new Set(enrolled.map(s => s.studentId));

  const present = [];
  const leave = [];
  const absent = [];
  for (const student of enrolled) {
    const log = logByStudentId.get(student.studentId) || null;
    const status = log ? (log.status || 'present') : 'absent';
    const entry = { student, log, status };
    if (log && isPresentStatus(log.status)) present.push(entry);
    else if (status === 'leave') leave.push(entry);
    else absent.push(entry);
  }

  const guests = [];
  const presentUids = new Set();
  for (const [sid, log] of logByStudentId) {
    if (!isPresentStatus(log.status)) continue;
    const student = studentsById.get(sid) || null;
    const uid = log.uid || getStudentUid(student);
    if (uid) presentUids.add(uid);
    if (enrolledIds.has(sid)) continue;
    if (student && !isStudentActive(student)) continue;
    guests.push({ student, log, status: log.status || 'present' });
  }

  return { enrolled, present, leave, absent, guests, attendees: [...present, ...guests], presentUids: [...presentUids] };
}

// ─── Curriculum ─────────────────────────────────────────────────────────────

export function buildCurriculumLookup({ courses = [], modules = [], topics = [] } = {}) {
  return {
    course: new Map(courses.map(c => [c.id, c])),
    module: new Map(modules.map(m => [m.id, m])),
    topic: new Map(topics.map(t => [t.id, t])),
    modules,
    topics,
  };
}

export function describeTopics(topicIds = [], lookup) {
  return topicIds
    .map(id => {
      const topic = lookup.topic.get(id);
      if (!topic) return null;
      const mod = lookup.module.get(topic.moduleId);
      return { id, title: topic.title || 'Untitled topic', moduleId: topic.moduleId || '', moduleTitle: mod?.title || '', courseId: mod?.courseId || '' };
    })
    .filter(Boolean);
}

export function completedTopicIdsFor(student, topics = []) {
  const uid = getStudentUid(student);
  return new Set(topics.filter(t => uid && t.completedStudents?.includes(uid)).map(t => t.id));
}

// ─── Absence statistics & thresholds ────────────────────────────────────────

const CLASS_DAY_STATUSES = new Set(['present', 'makeup', 'leave', 'absent']);

/**
 * Leave days are excused: they neither count toward a run of absences nor
 * break it. A present/makeup day ends the run.
 */
export function computeAbsenceStats(dailyStatus = {}, { endDateStr, windowDays = DEFAULT_THRESHOLDS.frequentWindowDays } = {}) {
  const classDates = Object.keys(dailyStatus).filter(d => CLASS_DAY_STATUSES.has(dailyStatus[d])).sort();
  const absentDates = classDates.filter(d => dailyStatus[d] === 'absent');
  const leaveDates = classDates.filter(d => dailyStatus[d] === 'leave');

  let run = 0;
  let maxRun = 0;
  for (const d of classDates) {
    const s = dailyStatus[d];
    if (s === 'absent') { run += 1; maxRun = Math.max(maxRun, run); }
    else if (s !== 'leave') run = 0;
  }

  const end = endDateStr || classDates[classDates.length - 1];
  const windowStart = end ? addDays(end, -(windowDays - 1)) : null;
  const recentAbsentDates = windowStart ? absentDates.filter(d => d >= windowStart && d <= end) : absentDates;

  return { classDates, absentDates, leaveDates, currentConsecutiveAbsences: run, maxConsecutiveAbsences: maxRun, recentAbsentDates, windowDays };
}

/** Attendance % with leave days removed from the classes held. */
export function attendancePctExcludingLeave({ eligibleClasses = 0, presentClasses = 0, leaveClasses = 0 }) {
  const denom = eligibleClasses - leaveClasses;
  return denom > 0 ? Math.round((presentClasses / denom) * 100) : 100;
}

export function evaluateFlags({ eligibleClasses = 0, leaveClasses = 0, pctExcludingLeave = 100, absenceStats }, thresholds = DEFAULT_THRESHOLDS) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const stats = absenceStats || { currentConsecutiveAbsences: 0, recentAbsentDates: [] };
  const lowAttendance = eligibleClasses - leaveClasses > 0 && pctExcludingLeave < t.lowAttendancePct;
  const consecutive = stats.currentConsecutiveAbsences >= t.consecutiveAbsences;
  const frequent = stats.recentAbsentDates.length >= t.frequentAbsences;
  return { lowAttendance, consecutive, frequent, absenteeism: consecutive || frequent, any: lowAttendance || consecutive || frequent };
}

// ─── Per-student report data ────────────────────────────────────────────────

function logsForTrack(logs, student, batchId, track) {
  return logs.filter(l =>
    l.studentId === student.studentId &&
    (l.type || 'academic') === track &&
    (track === 'internship' || l.batchId === batchId)
  );
}

/**
 * Everything the Attendance Reports emails need for one student, computed the
 * same way as the Attendance Reports page (since joining date).
 */
export function buildStudentSnapshot({
  student, batch, track = 'academic', logs = [], holidays = [], cancelledClasses = [],
  sessionIndex = new Map(), lookup, endDateStr, thresholds = DEFAULT_THRESHOLDS,
}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const batchId = batch?.id || (track === 'internship' ? 'internship' : '');
  const calc = calculateAttendance({
    student, attendanceLogs: logsForTrack(logs, student, batchId, track), batchSchedule: batch,
    holidays, cancelledClasses, endDateStr,
  });
  const absenceStats = computeAbsenceStats(calc.dailyStatus, { endDateStr, windowDays: t.frequentWindowDays });
  const pctExcludingLeave = attendancePctExcludingLeave(calc);
  const completed = completedTopicIdsFor(student, lookup.topics);

  const missed = [];
  const missedIds = new Set();
  for (const date of [...absenceStats.absentDates, ...absenceStats.leaveDates].sort()) {
    const session = sessionIndex.get(classSessionDocId(batchId, date));
    if (!session) continue;
    const pendingIds = (session.coveredTopics || []).filter(id => !completed.has(id) && lookup.topic.has(id));
    pendingIds.forEach(id => missedIds.add(id));
    if (pendingIds.length || session.tasks || session.topicsNote) {
      missed.push({
        date, status: calc.dailyStatus[date],
        topics: describeTopics(pendingIds, lookup),
        topicsNote: session.topicsNote || '',
        tasks: session.tasks || '',
      });
    }
  }

  const taught = new Set();
  for (const s of sessionIndex.values()) {
    if (s.batchId === batchId && (!endDateStr || s.date <= endDateStr)) (s.coveredTopics || []).forEach(id => taught.add(id));
  }
  const pendingTopics = describeTopics([...taught].filter(id => !completed.has(id) && !missedIds.has(id)), lookup);

  let courseProgress = null;
  if (student.courseId) {
    const moduleIds = new Set(lookup.modules.filter(m => m.courseId === student.courseId).map(m => m.id));
    const courseTopics = lookup.topics.filter(tp => moduleIds.has(tp.moduleId));
    const done = courseTopics.filter(tp => completed.has(tp.id)).length;
    courseProgress = {
      courseName: lookup.course.get(student.courseId)?.name || student.course || '',
      completed: done, total: courseTopics.length,
      pct: courseTopics.length ? Math.round((done / courseTopics.length) * 100) : 0,
    };
  }

  const absent = Math.max(0, calc.eligibleClasses - calc.presentClasses - calc.leaveClasses);
  return {
    batchId,
    batchName: batch?.name || batchId,
    track,
    held: calc.eligibleClasses,
    attended: calc.presentClasses,
    leave: calc.leaveClasses,
    absent,
    pct: calc.attendancePercentage,
    pctExcludingLeave,
    absenceStats,
    missed,
    pendingTopics,
    courseProgress,
    flags: evaluateFlags({ ...calc, pctExcludingLeave, absenceStats }, t),
    thresholds: t,
  };
}

/** Student targets for the monthly report: each academic batch, plus internship. */
function monthlyTargets(student) {
  const ids = [...new Set(getStudentBatchIds(student))];
  const targets = ids.map(id => ({ id, track: id === 'internship' ? 'internship' : 'academic' }));
  if (student.isIntern && !ids.includes('internship')) targets.push({ id: 'internship', track: 'internship' });
  return targets;
}

/**
 * Monthly attendance report for one student. `logs` must be resolved.
 * Leave is reported separately from absence; topics on leave days count as missed.
 */
export function buildMonthlyReport({
  student, batches = [], month, logs = [], sessionIndex = new Map(),
  holidays = [], cancelledClasses = [], lookup, todayStr,
}) {
  const { start, end } = monthBounds(month);
  const endDateStr = todayStr && todayStr < end ? todayStr : end;
  const completedIds = completedTopicIdsFor(student, lookup.topics);

  const sections = monthlyTargets(student).map(({ id, track }) => {
    const batch = batches.find(b => b.id === id);
    if (!batch) return null;
    const calc = calculateAttendance({
      student, attendanceLogs: logsForTrack(logs, student, id, track), batchSchedule: batch,
      holidays, cancelledClasses, startDateStr: start, endDateStr,
    });
    if (calc.eligibleClasses === 0) return null;

    const dates = Object.keys(calc.dailyStatus).sort();
    const completed = [];
    const missed = [];
    const absentTasks = [];
    for (const date of dates) {
      const status = calc.dailyStatus[date];
      if (!CLASS_DAY_STATUSES.has(status)) continue;
      const session = sessionIndex.get(classSessionDocId(id, date));
      const topicIds = session?.coveredTopics || [];
      if (status === 'present' || status === 'makeup') {
        const topics = describeTopics(topicIds, lookup);
        if (topics.length || session?.topicsNote) completed.push({ date, topics, topicsNote: session?.topicsNote || '' });
      } else {
        const topics = describeTopics(topicIds.filter(tid => !completedIds.has(tid)), lookup);
        if (topics.length || session?.topicsNote) missed.push({ date, status, topics, topicsNote: session?.topicsNote || '' });
        if (session?.tasks) absentTasks.push({ date, status, tasks: session.tasks });
      }
    }

    return {
      batchId: id,
      batchName: batch.name || id,
      track,
      held: calc.eligibleClasses,
      attended: calc.presentClasses,
      leave: calc.leaveClasses,
      absent: Math.max(0, calc.eligibleClasses - calc.presentClasses - calc.leaveClasses),
      pct: calc.attendancePercentage,
      completed, missed, absentTasks,
    };
  }).filter(Boolean);

  const totals = sections.reduce((acc, s) => ({
    held: acc.held + s.held, attended: acc.attended + s.attended, leave: acc.leave + s.leave, absent: acc.absent + s.absent,
  }), { held: 0, attended: 0, leave: 0, absent: 0 });
  totals.pct = totals.held > 0 ? Math.round((totals.attended / totals.held) * 100) : 100;

  const joinDate = getStudentJoinDate(student);
  return {
    month,
    monthLabel: formatMonthLabel(month),
    periodStart: joinDate > start ? joinDate : start,
    periodEnd: endDateStr,
    sections,
    totals,
    hasClasses: sections.length > 0,
  };
}
