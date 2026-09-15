// Creates a Razorpay order for a donation to Caspian Healthcare Foundation.
// Amount is decided here, on the server, from a validated rupee value.

const MIN_RUPEES = 100;
const MAX_RUPEES = 1000000;

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}

// Accepts +<country code><number>. A value with no leading +, or an Indian one,
// must be a real 10 digit Indian mobile. Anything else is checked for length only.
function normalisePhone(raw) {
  const s = String(raw || '').trim();
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  if (!s.startsWith('+') || d.startsWith('91')) {
    let local = d;
    if (local.length === 12 && local.startsWith('91')) { local = local.slice(2); }
    if (local.length === 11 && local.startsWith('0')) { local = local.slice(1); }
    return /^[6-9]\d{9}$/.test(local) ? '+91' + local : '';
  }
  if (d.length < 8 || d.length > 15) return '';
  return '+' + d;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: 'Donations are not configured yet. Please write to info@caspianfoundation.in.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const donor = (body && body.donor) || {};

  if (clean(donor.website, 60)) { return res.status(400).json({ error: 'Rejected.' }); }

  const rupees = Math.floor(Number(body && body.amount));
  if (!Number.isFinite(rupees) || rupees < MIN_RUPEES || rupees > MAX_RUPEES) {
    return res.status(400).json({ error: 'Please enter an amount between Rs ' + MIN_RUPEES + ' and Rs ' + MAX_RUPEES + '.' });
  }
  const name = clean(donor.name, 120).replace(/\s+/g, ' ');
  const email = clean(donor.email, 160);
  const phone = normalisePhone(clean(donor.phone, 20));
  const pan = clean(donor.pan, 10).toUpperCase();
  const address = clean(donor.address, 240);

  if (name.length < 2) { return res.status(400).json({ error: 'Please enter your full name.' }); }
  if (!EMAIL.test(email) || email.includes('..')) {
    return res.status(400).json({ error: 'That email address does not look right. The receipt is sent there.' });
  }
  if (!phone) { return res.status(400).json({ error: 'That mobile number does not look right. Indian numbers are 10 digits; for other countries include the country code.' }); }
  if (pan && !PAN.test(pan)) { return res.status(400).json({ error: 'That PAN does not look right. Leave it blank if you are not sure.' }); }
  if (pan && address.length < 8) { return res.status(400).json({ error: 'A PAN needs an address with it, because both appear on the 80G receipt.' }); }

  const receipt = 'CHF' + Date.now().toString(36).toUpperCase();

  try {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64')
      },
      body: JSON.stringify({
        amount: rupees * 100,
        currency: 'INR',
        receipt,
        notes: {
          donor_name: name,
          donor_email: email,
          donor_phone: phone,
          donor_pan: pan,
          donor_address: address,
          programme: clean(donor.programme, 80) || 'General',
          purpose: 'Donation to Caspian Healthcare Foundation'
        }
      })
    });
    const order = await r.json();
    if (!r.ok || !order.id) {
      return res.status(502).json({ error: (order && order.error && order.error.description) || 'Payment gateway did not accept the request.' });
    }
    return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, receipt });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the payment gateway. Please try again.' });
  }
}
