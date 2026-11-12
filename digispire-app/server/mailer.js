import nodemailer from 'nodemailer';

let transporter = null;
let transporterKey = '';

function getTransport(config) {
  const { host, port, encryption, user, pass } = config.smtp;
  const key = JSON.stringify([host, port, encryption, user, pass]);
  if (!transporter || key !== transporterKey) {
    closeTransport();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: encryption === 'ssl',
      requireTLS: encryption === 'starttls',
      ignoreTLS: encryption === 'none',
      auth: { user, pass },
      pool: true,          // reuse one connection for a worker run
      maxConnections: 1,   // shared hosts dislike parallel SMTP sessions
      maxMessages: 50,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
    transporterKey = key;
  }
  return transporter;
}

export function closeTransport() {
  if (transporter) {
    try { transporter.close(); } catch { /* ignore */ }
  }
  transporter = null;
  transporterKey = '';
}

/** Sends one message over the cPanel SMTP account. Throws on failure. */
export async function deliver(config, { to = [], cc = [], bcc = [], subject, html, text }) {
  const info = await getTransport(config).sendMail({
    from: { name: config.from.name, address: config.from.address },
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    replyTo: config.replyTo || undefined,
    subject,
    html,
    text,
  });
  return {
    messageId: info.messageId || '',
    accepted: (info.accepted || []).map(String),
    rejected: (info.rejected || []).map(String),
    response: String(info.response || '').slice(0, 300),
  };
}

/** cPanel/Exim reply when the hourly cap is hit (usually a 5xx, but temporary). */
export function isHostRateLimitError(err) {
  const text = `${err?.response || ''} ${err?.message || ''}`;
  return /(max(imum)?\s+(emails|messages|defers|failures).*per\s+hour|exceeded.*(per hour|limit)|rate.?limit|too many (messages|emails|recipients))/i.test(text);
}
