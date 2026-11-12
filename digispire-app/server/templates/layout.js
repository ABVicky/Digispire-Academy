import { COLORS, esc } from './components.js';

/**
 * Shared shell for every email: academy logo + name header, white card,
 * footer. Mobile-friendly (600px max, fluid below that).
 */
export function renderLayout({ config, title, preheader = '', bodyHtml, footerNote = '' }) {
  const { name, logoUrl, appUrl } = config.academy;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; border-radius: 0 !important; }
    .px { padding-left: 18px !important; padding-right: 18px !important; }
    .stat { display: inline-block !important; width: 33.33% !important; box-sizing: border-box; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;-webkit-text-size-adjust:100%;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;">
  <tr><td align="center" style="padding:24px 10px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
      <tr><td class="px" style="background:${COLORS.navy};padding:18px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;"><img src="${esc(logoUrl)}" width="40" height="40" alt="${esc(name)}" style="display:block;width:40px;height:40px;border-radius:10px;background:#FFFFFF;padding:3px;"></td>
          <td style="font-size:17px;font-weight:800;letter-spacing:.02em;color:#FFFFFF;">${esc(name)}</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:26px 28px 8px;">
        <h1 style="margin:0 0 16px;font-size:21px;line-height:28px;font-weight:800;color:${COLORS.text};">${esc(title)}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td class="px" style="padding:18px 28px 22px;background:${COLORS.soft};border-top:1px solid ${COLORS.border};font-size:12px;line-height:18px;color:${COLORS.muted};">
        ${footerNote ? `${esc(footerNote)}<br>` : ''}
        ${esc(name)} · <a href="${esc(appUrl)}" style="color:${COLORS.brand};text-decoration:none;">${esc(appUrl.replace(/^https?:\/\//, ''))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderText({ config, title, body, footerNote = '' }) {
  return `${config.academy.name}\n${'='.repeat(config.academy.name.length)}\n\n${title}\n${body}\n\n--\n${footerNote ? `${footerNote}\n` : ''}${config.academy.name} · ${config.academy.appUrl}\n`;
}
