// Shared helpers for the Diabesity Changemakers Award functions. The leading underscore keeps
// Vercel from deploying this file as an endpoint.

export const AWARD_API = 'https://itqxfypvrvwplzeeldaz.supabase.co/functions/v1/award-api';
export const SITE = 'https://caspianfoundation.in';
export const FEE_RUPEES = 999;

// Deadlines, 23:59 IST on the day.
export const ENTRIES_CLOSE = Date.parse('2026-10-26T23:59:59+05:30');
export const JURY_CLOSE = Date.parse('2026-10-18T23:59:59+05:30');
export const YOUNG_FROM_YEAR = 2019; // highest qualification in 2019 or later = within 7 years

export const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\r\t]/g, ' ').replace(/\u2014/g, ', ').trim().slice(0, max);
}
export function line(s, max) {
  return clean(s, max).replace(/\n+/g, ' ').replace(/\s+/g, ' ');
}
export function words(s) {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

export function normalisePhone(raw) {
  const s = String(raw || '').trim();
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  if (!s.startsWith('+') || d.startsWith('91')) {
    let local = d;
    if (local.length === 12 && local.startsWith('91')) local = local.slice(2);
    if (local.length === 11 && local.startsWith('0')) local = local.slice(1);
    return /^[6-9]\d{9}$/.test(local) ? '+91' + local : '';
  }
  if (d.length < 8 || d.length > 15) return '';
  return '+' + d;
}

export function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

export function utm(b) {
  const u = b && b.utm && typeof b.utm === 'object' ? b.utm : {};
  const out = {};
  for (const k of ['source', 'medium', 'campaign', 'ref']) if (u[k]) out[k] = line(u[k], 80);
  return Object.keys(out).length ? out : null;
}

export async function callAward(payload) {
  const token = process.env.AWARD_TOKEN;
  if (!token) return { ok: false, status: 500, data: { error: 'The award is not configured yet. Please write to info@caspianfoundation.in.' } };
  try {
    const r = await fetch(AWARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-award-token': token },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 502, data: { error: 'Could not reach the award system. Please try again.' } };
  }
}

// Best-effort alert to the Foundation inbox. Never blocks the applicant.
export async function alert(subject, fields, page) {
  const to = process.env.ALERT_EMAIL;
  if (!to) return;
  try {
    const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: SITE,
        Referer: SITE + (page || '/award'),
        'User-Agent': 'Mozilla/5.0 (compatible; CaspianFoundationSite/1.0; +https://caspianfoundation.in)'
      },
      body: JSON.stringify(Object.assign({ _subject: subject, _template: 'table' }, fields))
    });
    if (!r.ok) console.error('award alert refused: HTTP ' + r.status);
  } catch (e) {
    console.error('award alert failed: ' + (e && e.message));
  }
}

export const CATEGORY_NAMES = {
  outcomes: 'Outcomes Award',
  innovation: 'Practice Innovation Award',
  teaching: 'Clinical Teaching Case Award'
};

// ---------------------------------------------------------------------------
// Email through Resend, from the verified subdomain mail.caspianfoundation.in.
// Switched on by the RESEND_API_KEY environment variable; without it nothing is sent.
// Replies go to the Foundation inbox. Never blocks the caller.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function emailHtml(heading, paragraphs, button) {
  const ps = paragraphs.map((p) => '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3b2230">' + p + '</p>').join('');
  const btn = button ? '<p style="margin:22px 0"><a href="' + esc(button.url) + '" style="background:#6b1e3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">' + esc(button.label) + '</a></p>' : '';
  return '<!doctype html><html><body style="margin:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f9fc;padding:24px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe6f2">' +
    '<tr><td style="background:#6b1e3a;padding:18px 24px;color:#ffffff;font-size:13px;letter-spacing:.06em">CASPIAN HEALTHCARE FOUNDATION<br><span style="font-size:18px;letter-spacing:0;font-weight:bold">Diabesity Changemakers Award 2026</span></td></tr>' +
    '<tr><td style="padding:26px 24px 10px"><h1 style="margin:0 0 16px;font-size:22px;color:#6b1e3a;font-family:Georgia,serif">' + esc(heading) + '</h1>' + ps + btn + '</td></tr>' +
    '<tr><td style="padding:16px 24px 22px;border-top:1px solid #dbe6f2;font-size:12px;line-height:1.6;color:#9e5c76">Caspian Healthcare Foundation, a registered public charitable trust. PAN AADTC2568A.<br>11-3-876/1, New Mallepally, Hyderabad 500001. Questions: reply to this email or call +91 89784 54547.<br><a href="https://caspianfoundation.in/award" style="color:#7e2a4c">caspianfoundation.in/award</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}
export function emailText(heading, paragraphs, button) {
  const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  return [heading, '', ...paragraphs.map(strip), button ? '\n' + button.label + ': ' + button.url : '', '', 'Caspian Healthcare Foundation, Hyderabad. caspianfoundation.in/award. +91 89784 54547'].join('\n');
}

export async function sendEmail(to, subject, heading, paragraphs, button) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to || !EMAIL.test(String(to))) return { sent: false };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        from: 'Diabesity Changemakers Award <award@mail.caspianfoundation.in>',
        reply_to: 'info@caspianfoundation.in',
        to: [String(to)],
        subject,
        html: emailHtml(heading, paragraphs, button),
        text: emailText(heading, paragraphs, button)
      })
    });
    if (!r.ok) { console.error('resend refused: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300)); return { sent: false }; }
    return { sent: true };
  } catch (e) {
    console.error('resend failed: ' + (e && e.message));
    return { sent: false };
  }
}
export { esc as escHtml };
