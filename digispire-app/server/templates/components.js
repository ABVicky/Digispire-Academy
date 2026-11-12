/**
 * Building blocks for email HTML. Inline styles + tables only, because email
 * clients (Gmail, Outlook, Apple Mail) ignore most modern CSS.
 */

export const COLORS = {
  brand: '#255A84',
  navy: '#1E3A5F',
  accent: '#F48B1F',
  text: '#1E293B',
  body: '#334155',
  muted: '#64748B',
  border: '#E2E8F0',
  soft: '#F8FAFC',
  green: '#047857',
  amber: '#B45309',
  red: '#B91C1C',
};

const TONES = {
  neutral: { fg: COLORS.text, bg: COLORS.soft, border: COLORS.border },
  brand: { fg: COLORS.brand, bg: '#EFF6FF', border: '#BFDBFE' },
  good: { fg: COLORS.green, bg: '#ECFDF5', border: '#A7F3D0' },
  warn: { fg: COLORS.amber, bg: '#FFFBEB', border: '#FDE68A' },
  bad: { fg: COLORS.red, bg: '#FEF2F2', border: '#FECACA' },
};

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const multiline = (value) => esc(value).replace(/\r?\n/g, '<br>');

export const heading = (text) =>
  `<h2 style="margin:28px 0 10px;font-size:15px;line-height:22px;font-weight:700;color:${COLORS.navy};">${esc(text)}</h2>`;

export const paragraph = (html) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.body};">${html}</p>`;

export const muted = (html) =>
  `<p style="margin:0 0 12px;font-size:13px;line-height:20px;color:${COLORS.muted};">${html}</p>`;

/** A row of number tiles; stacks on small screens. */
export function statTiles(items) {
  const width = Math.floor(100 / items.length);
  const cells = items.map(({ label, value, tone = 'neutral' }) => {
    const t = TONES[tone] || TONES.neutral;
    return `<td class="stat" width="${width}%" valign="top" style="padding:4px;">
      <div style="background:${t.bg};border:1px solid ${t.border};border-radius:12px;padding:12px 8px;text-align:center;">
        <div style="font-size:22px;line-height:28px;font-weight:800;color:${t.fg};">${esc(value)}</div>
        <div style="font-size:11px;line-height:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLORS.muted};">${esc(label)}</div>
      </div></td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;"><tr>${cells}</tr></table>`;
}

/** Two-column label/value table. Values are escaped. */
export function infoRows(rows) {
  const tr = rows.filter(Boolean).map(([label, value]) => `<tr>
    <td valign="top" style="padding:7px 12px 7px 0;font-size:13px;line-height:20px;color:${COLORS.muted};white-space:nowrap;">${esc(label)}</td>
    <td valign="top" style="padding:7px 0;font-size:14px;line-height:20px;font-weight:600;color:${COLORS.text};">${esc(value)}</td>
  </tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;border-collapse:collapse;">${tr}</table>`;
}

export function bullets(items) {
  if (!items.length) return '';
  const li = items.map(i => `<li style="margin:0 0 6px;">${esc(i)}</li>`).join('');
  return `<ul style="margin:4px 0 12px;padding-left:20px;font-size:14px;line-height:22px;color:${COLORS.body};">${li}</ul>`;
}

export function box(innerHtml, tone = 'neutral') {
  const t = TONES[tone] || TONES.neutral;
  return `<div style="margin:8px 0 14px;padding:14px 16px;background:${t.bg};border:1px solid ${t.border};border-radius:12px;font-size:14px;line-height:22px;color:${COLORS.body};">${innerHtml}</div>`;
}

export const tag = (text, tone = 'neutral') => {
  const t = TONES[tone] || TONES.neutral;
  return `<span style="display:inline-block;padding:1px 8px;margin-left:6px;border-radius:999px;background:${t.bg};border:1px solid ${t.border};color:${t.fg};font-size:11px;font-weight:700;">${esc(text)}</span>`;
};

/**
 * entries: [{ dateLabel, tagText?, tagTone?, items: [string], note?, extraHtml? }]
 */
export function datedList(entries) {
  return entries.map(e => `<div style="margin:0 0 10px;padding:10px 14px;border:1px solid ${COLORS.border};border-radius:10px;">
    <div style="font-size:13px;font-weight:700;color:${COLORS.navy};">${esc(e.dateLabel)}${e.tagText ? tag(e.tagText, e.tagTone) : ''}</div>
    ${e.items?.length ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:14px;line-height:21px;color:${COLORS.body};">${e.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${e.note ? `<div style="margin-top:6px;font-size:13px;line-height:20px;color:${COLORS.muted};">${multiline(e.note)}</div>` : ''}
    ${e.extraHtml || ''}
  </div>`).join('');
}

export function personalNote(note, senderName) {
  if (!note) return '';
  return `<div style="margin:18px 0;padding:14px 16px;border-left:4px solid ${COLORS.accent};background:#FFF7ED;border-radius:0 12px 12px 0;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLORS.amber};margin-bottom:6px;">A note from ${esc(senderName || 'your faculty')}</div>
    <div style="font-size:15px;line-height:24px;color:${COLORS.text};">${multiline(note)}</div>
  </div>`;
}

export const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr><td style="border-radius:10px;background:${COLORS.brand};">
    <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${esc(label)}</a>
  </td></tr></table>`;

/** Inserts a highlighted notice at the very top of an email (test mode / previews). */
export function withBanner(html, title, lines = []) {
  const banner = `<div style="background:#FEF3C7;border-bottom:2px solid #F59E0B;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#78350F;">
    <strong>${esc(title)}</strong>${lines.length ? `<br>${lines.map(esc).join('<br>')}` : ''}</div>`;
  return /<body[^>]*>/i.test(html) ? html.replace(/<body([^>]*)>/i, (m) => `${m}${banner}`) : banner + html;
}

export const textBanner = (title, lines = []) =>
  `*** ${title} ***\n${lines.map(l => `  ${l}`).join('\n')}${lines.length ? '\n' : ''}\n`;

// Plain-text helpers
export const textSection = (title, lines) => {
  const body = (Array.isArray(lines) ? lines : [lines]).filter(l => l !== null && l !== undefined && l !== '').join('\n');
  return body ? `\n${title.toUpperCase()}\n${'-'.repeat(Math.min(title.length, 40))}\n${body}\n` : '';
};
export const textBullets = (items) => items.map(i => `  • ${i}`);
