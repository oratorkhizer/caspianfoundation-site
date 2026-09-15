// Creates a Razorpay order for a donation to Caspian Healthcare Foundation.
// Amount is decided here, on the server, from a validated rupee value.

const MIN_RUPEES = 100;
const MAX_RUPEES = 1000000;

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
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
  const name = clean(donor.name, 120);
  const email = clean(donor.email, 160);
  const phone = clean(donor.phone, 20);
  if (!name || !email || !phone) { return res.status(400).json({ error: 'Name, email and mobile number are required.' }); }

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
          donor_pan: clean(donor.pan, 10).toUpperCase(),
          donor_address: clean(donor.address, 240),
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
