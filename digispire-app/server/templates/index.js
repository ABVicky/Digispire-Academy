/**
 * All email templates live in this folder — edit wording here.
 *
 *   layout.js         shared header (logo + academy name), card, footer
 *   components.js     reusable blocks (tiles, lists, notes, banners)
 *   classReport.js    Feature 1: class report (attended) + "you missed" email (BCC)
 *   monthlyReport.js  Feature 2: monthly individual attendance report
 *   studentAlerts.js  Feature 3: low attendance / syllabus due / absenteeism
 *
 * Each template returns { subject, html, text } (text = plain-text fallback).
 * Academy name, logo and site URL come from ACADEMY_NAME, ACADEMY_LOGO_URL
 * and APP_BASE_URL.
 */
import { paragraph, infoRows } from './components.js';
import { renderLayout, renderText } from './layout.js';

export { classReportEmail, classMissedEmail } from './classReport.js';
export { monthlyReportEmail } from './monthlyReport.js';
export { lowAttendanceEmail, syllabusDueEmail, absenteeismEmail } from './studentAlerts.js';

export function smtpTestEmail(config, { requestedBy }) {
  const title = 'SMTP test email';
  const rows = [
    ['SMTP host', `${config.smtp.host}:${config.smtp.port} (${config.smtp.encryption})`],
    ['From', `${config.from.name} <${config.from.address}>`],
    ['BCC chunk size', String(config.bccChunkSize)],
    ['Hourly cap', `${config.maxPerHour} recipients`],
    ['Test mode', config.testMode ? `ON → ${config.testRecipient}` : 'OFF (live)'],
    ['Requested by', requestedBy],
  ];
  return {
    subject: `${config.academy.name}: SMTP test`,
    html: renderLayout({ config, title, bodyHtml: paragraph('If you can read this, email sending from the academy app works.') + infoRows(rows) }),
    text: renderText({ config, title, body: `\nIf you can read this, email sending from the academy app works.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}` }),
  };
}
