/**
 * Email configuration — read ONLY from environment variables (Vercel →
 * Project → Settings → Environment Variables). Nothing secret is hardcoded.
 * See EMAIL_SETUP.md for what each value means.
 */
import { DEFAULT_TIMEZONE } from '../src/utils/studentReport.js';

const env = (name, fallback = '') => {
  const v = process.env[name];
  return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim();
};

const num = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number(env(name, ''));
  if (!Number.isFinite(n) || env(name, '') === '') return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

const bool = (name, fallback) => {
  const v = env(name, '').toLowerCase();
  if (!v) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v);
};

export class ConfigError extends Error {
  constructor(message, missing = []) {
    super(message);
    this.name = 'ConfigError';
    this.status = 500;
    this.missing = missing;
  }
}

export function getConfig() {
  const encryption = env('SMTP_ENCRYPTION', 'ssl').toLowerCase();
  const maxPerHour = num('MAIL_MAX_PER_HOUR', 100, { min: 1 });
  const appUrl = env('APP_BASE_URL', 'https://digispire.vercel.app').replace(/\/+$/, '');

  return {
    smtp: {
      host: env('SMTP_HOST'),
      port: num('SMTP_PORT', encryption === 'ssl' ? 465 : 587, { min: 1, max: 65535 }),
      encryption: ['ssl', 'starttls', 'none'].includes(encryption) ? encryption : 'ssl',
      user: env('SMTP_USER'),
      pass: process.env.SMTP_PASS || '',
    },
    from: {
      name: env('MAIL_FROM_NAME', 'DIGISPIRE'),
      address: env('MAIL_FROM_ADDRESS'),
    },
    replyTo: env('MAIL_REPLY_TO'),
    // Copied (CC) on emails sent from the app when "CC" is ticked.
    ccAddress: env('MAIL_CC_ADDRESS', 'digispireacademy@gmail.com'),
    // A BCC message can never be bigger than the hourly cap, or it would never send.
    bccChunkSize: Math.min(num('MAIL_BCC_CHUNK_SIZE', 50, { min: 1, max: 500 }), Math.max(1, maxPerHour - 1)),
    maxPerHour,
    sendDelayMs: num('MAIL_SEND_DELAY_MS', 1000, { max: 60000 }),
    maxAttempts: num('MAIL_MAX_ATTEMPTS', 5, { min: 1, max: 20 }),
    monthly: {
      enabled: bool('MONTHLY_REPORT_ENABLED', true),
      time: /^\d{2}:\d{2}$/.test(env('MONTHLY_REPORT_TIME')) ? env('MONTHLY_REPORT_TIME') : '20:00',
    },
    timezone: env('APP_TIMEZONE', DEFAULT_TIMEZONE),
    academy: {
      name: env('ACADEMY_NAME', 'DIGISPIRE'),
      logoUrl: env('ACADEMY_LOGO_URL', `${appUrl}/logo.png`),
      appUrl,
    },
    cronSecret: env('CRON_SECRET'),
  };
}

/** Names of required variables that are not set. */
export function missingConfig(config = getConfig()) {
  const missing = [];
  if (!env('FIREBASE_SERVICE_ACCOUNT')) missing.push('FIREBASE_SERVICE_ACCOUNT');
  if (!config.smtp.host) missing.push('SMTP_HOST');
  if (!config.smtp.user) missing.push('SMTP_USER');
  if (!config.smtp.pass) missing.push('SMTP_PASS');
  if (!config.from.address) missing.push('MAIL_FROM_ADDRESS');
  if (!config.cronSecret) missing.push('CRON_SECRET');
  return missing;
}

export function assertMailConfig(config = getConfig()) {
  const missing = missingConfig(config).filter(n => n !== 'CRON_SECRET');
  if (missing.length) {
    throw new ConfigError(`Email is not configured yet. Missing environment variables: ${missing.join(', ')}`, missing);
  }
  return config;
}
