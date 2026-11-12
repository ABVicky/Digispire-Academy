/**
 * POST /api/email  { action, ...payload }
 * Authorization: Bearer <Firebase ID token>
 *
 * Every action requires an admin or educator; some are admin-only.
 */
import { requireStaff } from '../auth.js';
import { HttpError, readJsonBody, sendError } from '../http.js';
import { getPublicConfig, processQueueNow, retryOutboxMessage, sendSmtpTest } from '../features/admin.js';
import { previewClassReport, sendClassReport } from '../features/classReport.js';
import { previewMonthly, runMonthlyAction, sendMonthlyTest } from '../features/monthlyReport.js';
import { previewStudentEmails, sendStudentEmails } from '../features/studentEmails.js';

const ACTIONS = {
  'config.get': { run: getPublicConfig },
  'classReport.preview': { run: previewClassReport },
  'classReport.send': { run: (u, b) => sendClassReport(u, b) },
  'classReport.sendTest': { run: (u, b) => sendClassReport(u, b, { test: true }) },
  'student.preview': { run: previewStudentEmails },
  'student.send': { run: (u, b) => sendStudentEmails(u, b) },
  'student.sendTest': { run: (u, b) => sendStudentEmails(u, b, { test: true }) },
  'monthly.preview': { run: previewMonthly, adminOnly: true },
  'monthly.run': { run: runMonthlyAction, adminOnly: true },
  'monthly.sendTest': { run: sendMonthlyTest, adminOnly: true },
  'smtp.test': { run: sendSmtpTest, adminOnly: true },
  'outbox.retry': { run: retryOutboxMessage, adminOnly: true },
  'outbox.process': { run: processQueueNow, adminOnly: true },
};

export default async function emailApiHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const body = readJsonBody(req);
    const action = ACTIONS[body.action];
    if (!action) throw new HttpError(400, `Unknown action "${body.action}".`);
    const user = await requireStaff(req, { adminOnly: !!action.adminOnly });
    const result = await action.run(user, body);
    res.status(200).json(result);
  } catch (err) {
    sendError(res, err);
  }
}
