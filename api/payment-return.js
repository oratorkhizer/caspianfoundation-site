// Razorpay sends the donor back here after a hosted Payment Link is paid.
// Verifies the signature, alerts the Foundation, and redirects to /thanks.
import crypto from 'node:crypto';

const SITE = 'https://caspianfoundation.in';

function safe(v, n) {
  return String(v == null ? '' : v).replace(/[^A-Za-z0-9_\-.]/g, '').slice(0, n || 80);
}
function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}

async function alertFoundation(link, paymentId) {
  const alertTo = process.env.ALERT_EMAIL;
  if (!alertTo) return;
  const n = (link && link.notes) || {};
  const rupees = link && link.amount ? Math.round(link.amount / 100) : '';
  try {
    const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(alertTo), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: SITE,
        Referer: SITE + '/donate',
        'User-Agent': 'Mozilla/5.0 (compatible; CaspianFoundationSite/1.0; +https://caspianfoundation.in)'
      },
      body: JSON.stringify({
        _subject: 'New donation: Rs ' + rupees + ' from ' + (clean(n.donor_name, 120) || 'a donor'),
        Amount: 'Rs ' + rupees,
        Name: clean(n.donor_name, 120),
        Email: clean(n.donor_email, 160),
        Phone: clean(n.donor_phone, 20),
        PAN: clean(n.donor_pan, 10) || 'not given',
        Address: clean(n.donor_address, 240) || 'not given',
        Programme: clean(n.programme, 80) || 'General',
        PaymentId: paymentId,
        PaymentLink: link && link.id ? link.id : '',
        Received: new Date().toISOString(),
        _template: 'table'
      })
    });
    if (!r.ok) console.error('donation alert refused: HTTP ' + r.status);
  } catch (e) {
    console.error('donation alert failed: ' + (e && e.message));
  }
}

export default async function handler(req, res) {
  const q = req.query || {};
  const paymentId = safe(q.razorpay_payment_id, 60);
  const linkId = safe(q.razorpay_payment_link_id, 60);
  const referenceId = safe(q.razorpay_payment_link_reference_id, 60);
  const status = safe(q.razorpay_payment_link_status, 20);
  const signature = safe(q.razorpay_signature, 128);

  if (!paymentId || !linkId || !signature || status !== 'paid') {
    res.writeHead(302, { Location: SITE + '/donate?payment=incomplete' });
    return res.end();
  }

  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const expected = crypto.createHmac('sha256', keySecret)
    .update(linkId + '|' + referenceId + '|' + status + '|' + paymentId)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  const verified = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!verified) {
    res.writeHead(302, { Location: SITE + '/donate?payment=unverified&ref=' + encodeURIComponent(paymentId) });
    return res.end();
  }

  // Donor details live in the link's notes; Razorpay's record remains the source of truth.
  let link = null;
  try {
    const r = await fetch('https://api.razorpay.com/v1/payment_links/' + linkId, {
      headers: { Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64') }
    });
    if (r.ok) link = await r.json();
  } catch (e) {
    console.error('payment-return: link fetch failed ' + (e && e.message));
  }
  await alertFoundation(link, paymentId);

  res.writeHead(302, { Location: SITE + '/thanks?ref=' + encodeURIComponent(paymentId), 'Cache-Control': 'no-store' });
  return res.end();
}
