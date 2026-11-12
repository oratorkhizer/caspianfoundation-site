// Daily Diabetes Promise reminder emails (12 Nov 2026). Vercel cron calls this once a day (vercel.json).
// It asks pledge-api for reminders that are due (schedule per promise, see pledge-api SCHEDULE), sends each one
// through Resend from mail.caspianfoundation.in, and marks it sent. Server-to-server calls use the
// same AWARD_TOKEN as the award functions. Every email has a one-click stop link.
// LIVE: all wording approved by Dr Khizer on 12 Nov 2026. Set to false to pause all sending.
const LIVE = true;

const API = 'https://itqxfypvrvwplzeeldaz.supabase.co/functions/v1/pledge-api';
const SITE = 'https://caspianfoundation.in';

// "I promise to ..." lines, same as the card ({n} is the person the promise is for).
const LINES = {
  self_dm: {
    feet: 'check my feet every day',
    hba1c: 'test my HbA1c every three months',
    eyes: 'get my eyes checked every year',
    kidneys: 'get my kidneys tested every year',
    heart: 'know and control my BP and cholesterol',
    medicines: 'take my medicines as advised and never stop them on my own'
  },
  loved_one: {
    feet: "check {n}'s feet every day",
    hba1c: 'make sure {n} gets an HbA1c test every three months',
    eyes: 'take {n} for an eye check every year',
    kidneys: "get {n}'s kidneys tested every year",
    heart: 'help {n} keep BP and cholesterol in check',
    medicines: 'help {n} take every medicine on time',
    walk_with: 'walk with {n}, 30 minutes, five days a week'
  },
  self_prevent: {
    test: 'get my blood sugar tested this year',
    walk: 'walk 30 minutes, five days a week',
    drinks: 'give up sugary drinks',
    waist: 'bring my waist into the healthy range',
    family_test: "get my parents' blood sugar tested"
  }
};
// One practical step per promise, same advice as the page.
const TIPS = {
  feet: 'Look at the soles and between the toes every night, use a mirror or ask someone. Show any cut, blister or colour change to a doctor the same week.',
  hba1c: 'Set a phone reminder for three months from the day of your last test. In Hyderabad, Caspian Diagnostic Centre does HbA1c.',
  eyes: 'Ask for a dilated retina check, not only a glasses test. Do not drive yourself home after the drops.',
  kidneys: 'Ask for a urine albumin (ACR) test and a serum creatinine. In Hyderabad, Caspian Diagnostic Centre does both.',
  heart: 'Write down your last BP and cholesterol numbers and ask your doctor what yours should be.',
  medicines: 'Keep a weekly pill box, and never stop or change a medicine without asking your doctor first.',
  walk_with: 'Fix a time, after dinner works for many families, and walk together even on busy days.',
  test: 'A fasting blood sugar or an HbA1c is enough to start. In Hyderabad, Caspian Diagnostic Centre does both.',
  walk: 'Fix a time of day and a route. Three walks of ten minutes count too.',
  drinks: 'Packaged juices, colas and sweet tea or coffee count. Water, buttermilk and unsweetened tea do not.',
  waist: 'Measure at the navel once a month. Healthy is below 90 cm for men and below 80 cm for women.',
  family_test: 'Pick a date this month. A fasting sugar or an HbA1c is enough to start. In Hyderabad, Caspian Diagnostic Centre does both.'
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Email wording by kind (approved 12 Nov 2026). Yearly checks: book, done, yearly. HbA1c: book, then due3m.
// One-off tests: book, done_once. Daily habits: habit7, habit30.
const COPY = {
  habit7: ['Your Diabetes Promise: one week', 'You made your Diabetes Promise one week ago. This is a small reminder.', 'Keep going. Please send your card to one more person.'],
  habit30: ['Your Diabetes Promise: one month', 'You made your Diabetes Promise one month ago. This is our last reminder.', 'Keep going. Please send your card to one more person.'],
  book: ['Your Diabetes Promise: book your check', 'You made your Diabetes Promise one week ago. Please book your check this week.', 'Already done? Very good. Please send your card to one more person.'],
  done: ['Your Diabetes Promise: is your check done?', 'You made your Diabetes Promise one month ago. Is your check done? If not, please book it this week.', 'Already done? Very good. We will remind you when next year\'s check is due.'],
  done_once: ['Your Diabetes Promise: is your test done?', 'You made your Diabetes Promise one month ago. Is your test done? If not, please book it this week.', 'Already done? Very good. Show the report to your doctor. This is our last reminder.'],
  yearly: ['Your Diabetes Promise: your yearly check is due', 'You made your Diabetes Promise almost one year ago. Your yearly check is due now. Please book it.', 'This is our last reminder. You can make a new promise at caspianfoundation.in/pledge.'],
  due3m: ['Your Diabetes Promise: your HbA1c test is due', 'Your next HbA1c test is due in one or two weeks. Please book it.', 'Show the report to your doctor.']
};

function compose(r) {
  const first = String(r.name || '').split(' ')[0] || 'there';
  const line = ((LINES[r.path] || {})[r.promise] || 'keep your promise').replace(/\{n\}/g, r.dedicated_to || 'them');
  const tip = TIPS[r.promise] || '';
  const stop = SITE + '/pledge?stop=' + r.unsub_token;
  const card = SITE + '/pledge?r=' + r.code;
  const c = COPY[r.kind] || COPY.habit7;
  const subject = c[0];
  let closer = c[2];
  if (r.kind === 'due3m' && r.last) closer += ' This is our last reminder.';
  const ps = [
    'Dear ' + first + ',',
    c[1],
    'Your promise: <b>I promise to ' + esc(line) + '.</b>',
    tip ? 'To keep it: ' + esc(tip) : '',
    closer
  ].filter(Boolean);
  const html = '<!doctype html><html><body style="margin:0;background:#fbf1e1;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf1e1;padding:24px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8d9bd">' +
    '<tr><td style="background:#2a7f62;padding:18px 24px;color:#ffffff;font-size:13px;letter-spacing:.06em">CASPIAN HEALTHCARE FOUNDATION<br><span style="font-size:18px;letter-spacing:0;font-weight:bold">My Diabetes Promise</span></td></tr>' +
    '<tr><td style="padding:24px 24px 8px">' + ps.map((p) => '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#23463b">' + p + '</p>').join('') +
    '<p style="margin:20px 0"><a href="' + esc(card) + '" style="background:#2a7f62;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Open my card</a></p></td></tr>' +
    '<tr><td style="padding:14px 24px 20px;border-top:1px solid #e8d9bd;font-size:12px;line-height:1.6;color:#5a776d">You get this because you asked for reminders when you made your promise. ' +
    '<a href="' + esc(stop) + '" style="color:#2a7f62">Stop these reminders</a>.<br>Caspian Healthcare Foundation, a registered public charitable trust, Hyderabad. This email is general health information, not medical advice. Please talk to your doctor about your own care.</td></tr>' +
    '</table></td></tr></table></body></html>';
  const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const text = ps.map(strip).join('\n\n') + '\n\nOpen my card: ' + card + '\n\nStop these reminders: ' + stop + '\n\nCaspian Healthcare Foundation, Hyderabad. General health information, not medical advice.';
  return { subject, html, text, stop };
}

async function api(payload) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-award-token': process.env.AWARD_TOKEN || '' },
    body: JSON.stringify(payload)
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const ua = String(req.headers['user-agent'] || '');
  if (secret ? auth !== 'Bearer ' + secret : !ua.startsWith('vercel-cron')) return res.status(401).json({ error: 'unauthorized' });

  const due = await api({ action: 'reminders_due' });
  if (!due.ok) return res.status(502).json({ error: 'could not read reminders', detail: due.data });
  const rows = due.data.rows || [];
  if (!LIVE) return res.status(200).json({ live: false, would_send: rows.length, sample: rows.slice(0, 3).map((r) => ({ code: r.code, kind: r.kind })) });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  let sent = 0, failed = 0;
  for (const r of rows) {
    const m = compose(r);
    try {
      const s = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'Idempotency-Key': 'pledge-' + r.code + '-' + r.stage },
        body: JSON.stringify({
          from: 'Caspian Healthcare Foundation <promise@mail.caspianfoundation.in>',
          reply_to: 'info@caspianfoundation.in',
          to: [r.email],
          subject: m.subject,
          html: m.html,
          text: m.text,
          headers: { 'List-Unsubscribe': '<' + m.stop + '>' }
        })
      });
      if (!s.ok) { failed++; console.error('resend ' + s.status + ' ' + (await s.text()).slice(0, 200)); continue; }
      await api({ action: 'reminder_sent', code: r.code, stage: r.stage });
      sent++;
    } catch (e) {
      failed++;
      console.error('reminder failed ' + r.code + ': ' + (e && e.message));
    }
  }
  return res.status(200).json({ live: true, due: rows.length, sent, failed });
}

export { compose };
