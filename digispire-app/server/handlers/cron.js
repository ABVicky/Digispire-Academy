/**
 * GET /api/email-cron   Authorization: Bearer <CRON_SECRET>
 *
 * Called by Vercel Cron (vercel.json) and, optionally, a cPanel cron job every
 * few minutes. Each call: start the monthly report if it is due, then send
 * queued emails (retries included) within the hourly cap.
 */
import { getConfig, missingConfig } from '../config.js';
import { maybeRunScheduledMonthly } from '../features/monthlyReport.js';
import { sendError } from '../http.js';
import { kickWorker, runWorker } from '../worker.js';

export default async function emailCronHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const config = getConfig();
  const auth = req.headers?.authorization || '';
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const depth = Math.min(Number(req.query?.depth) || 0, 50);
    if (req.query?.drainOnly) {
      kickWorker(config, { depth });
      res.status(202).json({ ok: true, kicked: true });
      return;
    }
    const monthly = await maybeRunScheduledMonthly();
    const configured = missingConfig(config).filter(n => n !== 'CRON_SECRET').length === 0;
    const queue = configured ? await runWorker(config, { timeBudgetMs: 40_000 }) : { skipped: 'email not configured' };
    res.status(200).json({ ok: true, monthly, queue });
  } catch (err) {
    sendError(res, err);
  }
}
