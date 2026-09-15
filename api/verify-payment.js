// Verifies the Razorpay signature for a donation and sends an alert to the Foundation.
import crypto from 'node:crypto';

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) { return res.status(500).json({ verified: false, error: 'Not configured' }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  const orderId = clean(body.razorpay_order_id, 64);
  const paymentId = clean(body.razorpay_payment_id, 64);
  const signature = clean(body.razorpay_signature, 128);
  if (!orderId || !paymentId || !signature) { return res.status(400).json({ verified: false }); }

  const expected = crypto.createHmac('sha256', keySecret).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  const verified = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!verified) { return res.status(400).json({ verified: false }); }

  // Alert the Foundation. Never block the donor on this.
  const alertTo = process.env.ALERT_EMAIL;
  if (alertTo) {
    const d = (body && body.donor) || {};
    try {
      const r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(alertTo), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: 'https://caspianfoundation.in',
          Referer: 'https://caspianfoundation.in/donate',
          'User-Agent': 'Mozilla/5.0 (compatible; CaspianFoundationSite/1.0; +https://caspianfoundation.in)'
        },
        body: JSON.stringify({
          _subject: 'New donation: Rs ' + clean(body.amount, 12) + ' from ' + (clean(d.name, 120) || 'a donor'),
          Amount: 'Rs ' + clean(body.amount, 12),
          Name: clean(d.name, 120),
          Email: clean(d.email, 160),
          Phone: clean(d.phone, 20),
          PAN: clean(d.pan, 10).toUpperCase() || 'not given',
          Address: clean(d.address, 240) || 'not given',
          Programme: clean(d.programme, 80) || 'General',
          PaymentId: paymentId,
          OrderId: orderId,
          Received: new Date().toISOString(),
          _template: 'table'
        })
      });
      if (!r.ok) {
        console.error('donation alert refused: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
      }
    } catch (e) {
      console.error('donation alert failed: ' + (e && e.message));
    }
  }

  return res.status(200).json({ verified: true, paymentId });
}
