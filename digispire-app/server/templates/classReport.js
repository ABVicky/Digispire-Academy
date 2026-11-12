import { box, bullets, heading, infoRows, multiline, muted, paragraph, textBullets, textSection } from './components.js';
import { renderLayout, renderText } from './layout.js';

/**
 * Feature 1 — group email after a class (sent to present students via BCC).
 * data: { batchName, dateLabel, timeLabel, facultyName, presentCount, totalCount,
 *         guestCount, courseName, topics: [{ title, moduleTitle }], topicsNote, tasks }
 */
export function classReportEmail(config, d) {
  const title = `Class report: ${d.batchName}`;
  const subject = `Class report – ${d.batchName}, ${d.dateLabel}`;
  const topicLines = d.topics.map(t => (t.moduleTitle ? `${t.moduleTitle} — ${t.title}` : t.title));
  const attendance = `${d.presentCount} of ${d.totalCount} present${d.guestCount ? ` (+${d.guestCount} from other batches)` : ''}`;
  const footerNote = 'You are receiving this because you attended this class.';

  const bodyHtml = [
    paragraph('Hi everyone,'),
    paragraph('Thank you for attending today’s class. Here is a summary of what we covered and what to work on next.'),
    infoRows([
      ['Date', d.dateLabel],
      ['Batch', d.batchName],
      ['Time', d.timeLabel],
      ['Faculty', d.facultyName],
      ['Attendance', attendance],
    ]),
    heading('What we covered'),
    d.courseName ? muted(`Course: ${multiline(d.courseName)}`) : '',
    topicLines.length ? bullets(topicLines) : '',
    d.topicsNote ? box(multiline(d.topicsNote)) : '',
    !topicLines.length && !d.topicsNote ? muted('No topics were recorded for this class.') : '',
    heading('Tasks for you'),
    box(multiline(d.tasks), 'brand'),
    paragraph('If you have questions, reply to this email or ask in the next class.'),
  ].join('');

  const text = renderText({
    config, title, footerNote,
    body: [
      '\nHi everyone,\n\nThank you for attending today’s class. Here is a summary of what we covered and what to work on next.\n',
      `Date: ${d.dateLabel}\nBatch: ${d.batchName}\nTime: ${d.timeLabel}\nFaculty: ${d.facultyName}\nAttendance: ${attendance}\n`,
      textSection('What we covered', [d.courseName ? `Course: ${d.courseName}` : '', ...textBullets(topicLines), d.topicsNote || '', !topicLines.length && !d.topicsNote ? 'No topics were recorded for this class.' : '']),
      textSection('Tasks for you', d.tasks),
      '\nIf you have questions, reply to this email or ask in the next class.',
    ].join(''),
  });

  return { subject, html: renderLayout({ config, title, preheader: `Topics covered and tasks for ${d.dateLabel}`, bodyHtml, footerNote }), text };
}
