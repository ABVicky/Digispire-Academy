import { formatDateLabel } from '../../src/utils/studentReport.js';
import { datedList, heading, multiline, muted, paragraph, statTiles, textSection } from './components.js';
import { renderLayout, renderText } from './layout.js';

const pctTone = (pct) => (pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'bad');
const firstName = (name) => String(name || 'there').trim().split(/\s+/)[0];
const topicLine = (t) => (t.moduleTitle ? `${t.moduleTitle} — ${t.title}` : t.title);
const statusTag = (status) => (status === 'leave' ? { tagText: 'On leave', tagTone: 'warn' } : { tagText: 'Absent', tagTone: 'bad' });

function sectionHtml(s, showHeading) {
  const parts = [];
  if (showHeading) {
    parts.push(heading(s.batchName));
    parts.push(statTiles([
      { label: 'Held', value: s.held },
      { label: 'Attended', value: s.attended, tone: 'good' },
      { label: 'Absent', value: s.absent, tone: s.absent ? 'bad' : 'neutral' },
      { label: 'Leave', value: s.leave, tone: s.leave ? 'warn' : 'neutral' },
      { label: 'Attendance', value: `${s.pct}%`, tone: pctTone(s.pct) },
    ]));
  }
  const prefix = showHeading ? `${s.batchName}: ` : '';

  parts.push(heading(`${prefix}Topics you completed`));
  parts.push(s.completed.length
    ? datedList(s.completed.map(e => ({ dateLabel: formatDateLabel(e.date), items: e.topics.map(topicLine), note: e.topicsNote })))
    : muted('No topics were recorded for the classes you attended.'));

  parts.push(heading(`${prefix}Topics to catch up on`));
  parts.push(s.missed.length
    ? datedList(s.missed.map(e => ({ dateLabel: formatDateLabel(e.date), ...statusTag(e.status), items: e.topics.map(topicLine), note: e.topicsNote })))
    : muted(s.absent + s.leave > 0 ? 'Nothing pending from the classes you missed. Well done catching up!' : 'You did not miss any classes this month. Great work!'));

  if (s.absentTasks.length) {
    parts.push(heading(`${prefix}Tasks given on days you missed`));
    parts.push(datedList(s.absentTasks.map(e => ({ dateLabel: formatDateLabel(e.date), ...statusTag(e.status), note: e.tasks }))));
  }
  return parts.join('');
}

function sectionText(s, showHeading) {
  const prefix = showHeading ? `${s.batchName}: ` : '';
  const out = [];
  if (showHeading) out.push(textSection(s.batchName, `Held: ${s.held} · Attended: ${s.attended} · Absent: ${s.absent} · Leave: ${s.leave} · Attendance: ${s.pct}%`));
  out.push(textSection(`${prefix}Topics you completed`, s.completed.length
    ? s.completed.map(e => `${formatDateLabel(e.date)}:\n${e.topics.map(t => `  • ${topicLine(t)}`).join('\n')}${e.topicsNote ? `\n  ${e.topicsNote}` : ''}`)
    : ['No topics were recorded for the classes you attended.']));
  out.push(textSection(`${prefix}Topics to catch up on`, s.missed.length
    ? s.missed.map(e => `${formatDateLabel(e.date)} (${e.status === 'leave' ? 'on leave' : 'absent'}):\n${e.topics.map(t => `  • ${topicLine(t)}`).join('\n')}${e.topicsNote ? `\n  ${e.topicsNote}` : ''}`)
    : ['Nothing pending from the classes you missed.']));
  if (s.absentTasks.length) {
    out.push(textSection(`${prefix}Tasks given on days you missed`, s.absentTasks.map(e => `${formatDateLabel(e.date)} (${e.status === 'leave' ? 'on leave' : 'absent'}):\n${e.tasks}`)));
  }
  return out.join('');
}

/**
 * Feature 2 — individual monthly attendance report.
 * data: { studentName, report } where report comes from buildMonthlyReport().
 */
export function monthlyReportEmail(config, { studentName, report }) {
  const title = `Your attendance report for ${report.monthLabel}`;
  const subject = `Your ${report.monthLabel} attendance report – ${config.academy.name}`;
  const t = report.totals;
  const multi = report.sections.length > 1;
  const period = `${formatDateLabel(report.periodStart, { weekday: undefined })} – ${formatDateLabel(report.periodEnd, { weekday: undefined })}`;

  const bodyHtml = [
    paragraph(`Hi ${multiline(firstName(studentName))},`),
    paragraph(`Here is your attendance summary for ${multiline(report.monthLabel)}.`),
    statTiles([
      { label: 'Classes held', value: t.held },
      { label: 'Attended', value: t.attended, tone: 'good' },
      { label: 'Absent', value: t.absent, tone: t.absent ? 'bad' : 'neutral' },
      { label: 'Leave', value: t.leave, tone: t.leave ? 'warn' : 'neutral' },
      { label: 'Attendance', value: `${t.pct}%`, tone: pctTone(t.pct) },
    ]),
    muted(`Period: ${multiline(period)}${multi ? '' : ` · ${multiline(report.sections[0]?.batchName || '')}`}`),
    ...report.sections.map(s => sectionHtml(s, multi)),
    paragraph('Keep it up, and reach out to your faculty if you need help catching up.'),
  ].join('');

  const text = renderText({
    config, title,
    body: [
      `\nHi ${firstName(studentName)},\n\nHere is your attendance summary for ${report.monthLabel}.\n`,
      `\nClasses held: ${t.held}\nAttended: ${t.attended}\nAbsent: ${t.absent}\nLeave: ${t.leave}\nAttendance: ${t.pct}%\nPeriod: ${period}\n`,
      ...report.sections.map(s => sectionText(s, multi)),
      '\nKeep it up, and reach out to your faculty if you need help catching up.',
    ].join(''),
  });

  return { subject, html: renderLayout({ config, title, preheader: `Attendance ${t.pct}% · ${t.attended} of ${t.held} classes`, bodyHtml }), text };
}
