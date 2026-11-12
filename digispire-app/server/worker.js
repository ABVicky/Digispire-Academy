import { waitUntil } from '@vercel/functions';
import { processQueue } from './outbox.js';

const MAX_CHAIN = 12;

function selfBaseUrl() {
  if (process.env.EMAIL_WORKER_BASE_URL) return process.env.EMAIL_WORKER_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return null; // previews/local: the next cron tick picks up the rest
}

/** Ask a fresh function invocation to keep draining (each run is time-boxed). */
async function chainNextRun(config, depth) {
  const base = selfBaseUrl();
  if (!base || !config.cronSecret) return;
  try {
    await fetch(`${base}/api/email-cron?drainOnly=1&depth=${depth}`, {
      headers: { Authorization: `Bearer ${config.cronSecret}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.warn('[email-worker] chain request failed', err?.message || err);
  }
}

export async function runWorker(config, { depth = 0, timeBudgetMs = 45_000 } = {}) {
  const result = await processQueue(config, { timeBudgetMs });
  if (result.more && !result.rateLimited && depth < MAX_CHAIN) await chainNextRun(config, depth + 1);
  return result;
}

/** Start sending in the background after the HTTP response (UI never waits). */
export function kickWorker(config, { depth = 0 } = {}) {
  waitUntil(runWorker(config, { depth }).catch(err => console.error('[email-worker]', err)));
}
