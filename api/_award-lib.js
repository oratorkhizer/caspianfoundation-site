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
