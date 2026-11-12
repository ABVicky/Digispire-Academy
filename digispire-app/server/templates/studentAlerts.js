/**
 * Feature 3 — individual emails sent from Attendance Reports.
 * Every template receives: { studentName, snapshot, note, senderName }
 * where snapshot comes from buildStudentSnapshot().
 */
import { formatDateLabel } from '../../src/utils/studentReport.js';
import { bullets, datedList, heading, multiline, muted, paragraph, personalNote, statTiles, textBullets, textSection } from './components.js';
import { renderLayout, renderText } from './layout.js';

const firstName = (name) => String(name || 'there').trim().split(/\s+/)[0];
const pctTone = (pct) => (pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'bad');
const topicLine = (t) => (t.moduleTitle ? `${t.moduleTitle} — ${t.title}` : t.title);
const recentFirst = (dates, max = 10) => [...dates].sort().reverse().slice(0, max);
const signOff = (senderName, academy) => `${senderName ? `${senderName}\n` : ''}${academy}`;

function attendanceTiles(s) {
  return statTiles([
    { label: 'Held', value: s.held },
    { label: 'Attended', value: s.attended, tone: 'good' },
    { label: 'Absent', value: s.absent, tone: s.absent ? 'bad' : 'neutral' },
    { label: 'Leave', value: s.leave, tone: s.leave ? 'warn' : 'neutral' },
    { label: 'Attendance', value: `${s.pct}%`, tone: pctTone(s.pct) },
  ]);
}

const attendanceText = (s) => `Classes held: ${s.held}\nAttended: ${s.attended}\nAbsent: ${s.absent}\nLeave: ${s.leave}\nAttendance: ${s.pct}%`;

function closing(config, senderName) {
  return paragraph(`Regards,<br>${multiline(signOff(senderName, config.academy.name))}`);
}

export function lowAttendanceEmail(config, { studentName, snapshot: s, note, senderName }) {
  const title = 'Your attendance needs attention';
  const subject = `Attendance alert: ${s.pct}% in ${s.batchName}`;
  const recent = recentFirst(s.absenceStats.absentDates);
  const leaveNote = s.leave ? ` (${s.pctExcludingLeave}% if approved leave is not counted)` : '';

  const bodyHtml = [
    paragraph(`Hi ${multiline(firstName(studentName))},`),
    paragraph(`Your attendance in <strong>${multiline(s.batchName)}</strong> is currently <strong>${s.pct}%</strong>${multiline(leaveNote)}. We expect at least ${s.thresholds.lowAttendancePct}% so you don’t fall behind.`),
    attendanceTiles(s),
    recent.length ? heading('Classes you missed recently') : '',
    recent.length ? bullets(recent.map(d => formatDateLabel(d))) : '',
    personalNote(note, senderName),
    paragraph('Please make every effort to attend the upcoming classes. If something is making it hard to attend, reply to this email and let us know — we are happy to help.'),
    closing(config, senderName),
  ].join('');

  const text = renderText({
    config, title,
    body: [
      `\nHi ${firstName(studentName)},\n\nYour attendance in ${s.batchName} is currently ${s.pct}%${leaveNote}. We expect at least ${s.thresholds.lowAttendancePct}% so you don’t fall behind.\n\n${attendanceText(s)}\n`,
      textSection('Classes you missed recently', textBullets(recent.map(d => formatDateLabel(d)))),
      note ? textSection(`A note from ${senderName || 'your faculty'}`, note) : '',
      '\nPlease make every effort to attend the upcoming classes. If something is making it hard to attend, reply to this email and let us know — we are happy to help.\n',
      `\nRegards,\n${signOff(senderName, config.academy.name)}`,
    ].join(''),
  });

  return { subject, html: renderLayout({ config, title, preheader: `Attendance ${s.pct}% in ${s.batchName}`, bodyHtml }), text };
}

export function syllabusDueEmail(config, { studentName, snapshot: s, note, senderName }) {
  const missedCount = s.missed.reduce((n, e) => n + e.topics.length, 0);
  const total = missedCount + s.pendingTopics.length;
  const title = 'Topics to catch up on';
  const subject = total ? `Syllabus catch-up: ${total} topic${total === 1 ? '' : 's'} pending` : `Your syllabus progress – ${config.academy.name}`;
  const progress = s.courseProgress;

  const bodyHtml = [
    paragraph(`Hi ${multiline(firstName(studentName))},`),
    paragraph(total
      ? 'Here are the topics you still need to catch up on. Please go through the study material and reach out if anything is unclear.'
      : 'Good news: you have no pending topics right now.'),
    progress?.total ? statTiles([
      { label: 'Topics completed', value: `${progress.completed}/${progress.total}`, tone: 'brand' },
      { label: 'Course progress', value: `${progress.pct}%`, tone: pctTone(progress.pct) },
      { label: 'Topics pending', value: total, tone: total ? 'warn' : 'good' },
    ]) : '',
    s.missed.length ? heading('Missed on days you were away') : '',
    s.missed.length ? datedList(s.missed.map(e => ({
      dateLabel: formatDateLabel(e.date),
      tagText: e.status === 'leave' ? 'On leave' : 'Absent',
      tagTone: e.status === 'leave' ? 'warn' : 'bad',
      items: e.topics.map(topicLine),
      note: e.tasks ? `Task given: ${e.tasks}` : e.topicsNote,
    }))) : '',
    s.pendingTopics.length ? heading('Other topics still pending') : '',
    s.pendingTopics.length ? bullets(s.pendingTopics.map(topicLine)) : '',
    !total ? muted('Keep attending classes to stay on track.') : '',
    personalNote(note, senderName),
    closing(config, senderName),
  ].join('');

  const text = renderText({
    config, title,
    body: [
      `\nHi ${firstName(studentName)},\n\n${total ? 'Here are the topics you still need to catch up on.' : 'Good news: you have no pending topics right now.'}\n`,
      progress?.total ? `\nCourse progress: ${progress.completed}/${progress.total} topics (${progress.pct}%)\n` : '',
      textSection('Missed on days you were away', s.missed.map(e => `${formatDateLabel(e.date)} (${e.status === 'leave' ? 'on leave' : 'absent'}):\n${e.topics.map(t => `  • ${topicLine(t)}`).join('\n')}${e.tasks ? `\n  Task given: ${e.tasks}` : ''}`)),
      textSection('Other topics still pending', textBullets(s.pendingTopics.map(topicLine))),
      note ? textSection(`A note from ${senderName || 'your faculty'}`, note) : '',
      `\nRegards,\n${signOff(senderName, config.academy.name)}`,
    ].join(''),
  });

  return { subject, html: renderLayout({ config, title, preheader: total ? `${total} topics to catch up on` : 'No pending topics', bodyHtml }), text };
}

export function absenteeismEmail(config, { studentName, snapshot: s, note, senderName }) {
  const streak = s.absenceStats.currentConsecutiveAbsences;
  const recentCount = s.absenceStats.recentAbsentDates.length;
  const windowDays = s.absenceStats.windowDays;
  const title = 'We have missed you in class';
  const subject = streak >= 2
    ? `You have missed ${streak} classes in a row – ${s.batchName}`
    : `Frequent absences in ${s.batchName}`;
  const dates = recentFirst(s.absenceStats.recentAbsentDates.length ? s.absenceStats.recentAbsentDates : s.absenceStats.absentDates);

  const lead = streak >= 2
    ? `You have missed the last <strong>${streak}</strong> classes in a row in <strong>${multiline(s.batchName)}</strong>.`
    : `You have been absent <strong>${recentCount}</strong> time${recentCount === 1 ? '' : 's'} in the last ${windowDays} days in <strong>${multiline(s.batchName)}</strong>.`;

  const bodyHtml = [
    paragraph(`Hi ${multiline(firstName(studentName))},`),
    paragraph(`${lead} We want to make sure everything is okay.`),
    statTiles([
      { label: 'Missed in a row', value: streak, tone: streak ? 'bad' : 'neutral' },
      { label: `Absent (last ${windowDays} days)`, value: recentCount, tone: recentCount ? 'warn' : 'neutral' },
      { label: 'Attendance', value: `${s.pct}%`, tone: pctTone(s.pct) },
    ]),
    dates.length ? heading('Dates you were absent') : '',
    dates.length ? bullets(dates.map(d => formatDateLabel(d))) : '',
    s.leave ? muted(`Approved leave days (${s.leave}) are not counted as absences.`) : '',
    personalNote(note, senderName),
    paragraph('Please reply to this email or speak to your faculty so we can help you get back on track.'),
    closing(config, senderName),
  ].join('');

  const text = renderText({
    config, title,
    body: [
      `\nHi ${firstName(studentName)},\n\n${lead.replace(/<\/?strong>/g, '')} We want to make sure everything is okay.\n`,
      `\nMissed in a row: ${streak}\nAbsent in the last ${windowDays} days: ${recentCount}\nAttendance: ${s.pct}%\n`,
      textSection('Dates you were absent', textBullets(dates.map(d => formatDateLabel(d)))),
      s.leave ? `\nApproved leave days (${s.leave}) are not counted as absences.\n` : '',
      note ? textSection(`A note from ${senderName || 'your faculty'}`, note) : '',
      '\nPlease reply to this email or speak to your faculty so we can help you get back on track.\n',
      `\nRegards,\n${signOff(senderName, config.academy.name)}`,
    ].join(''),
  });

  return { subject, html: renderLayout({ config, title, preheader: `${streak} classes missed in a row`, bodyHtml }), text };
}
