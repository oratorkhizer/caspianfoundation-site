// Relays a contact form enquiry to the Foundation inbox without exposing the address in the page.
function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  if (clean(body.website, 60)) { return res.status(200).json({ ok: true }); }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const message = String(body.message == null ? '' : body.message).trim().slice(0, 4000);
  if (!name || !email || !message) { return res.status(400).json({ ok: false, error: 'Missing fields' }); }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { return res.status(400).json({ ok: false, error: 'Bad email' }); }

  const to = process.env.ALERT_EMAIL;
  if (!to) { return res.status(500).json({ ok: false, error: 'Not configured' }); }

  try {
    const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Foundation enquiry: ' + (clean(body.topic, 80) || 'General'),
        Name: name,
        Email: email,
        Phone: clean(body.phone, 20) || 'not given',
        Topic: clean(body.topic, 80) || 'General',
        Message: message,
        _template: 'table'
      })
    });
    if (!r.ok) { throw new Error('relay failed'); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'Could not send' });
  }
}
