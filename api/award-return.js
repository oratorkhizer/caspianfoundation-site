// Razorpay sends the applicant back here after paying the award entry fee by Payment Link.
// Verifies the signature, marks the entry paid, alerts the Foundation, and shows the confirmation.
import crypto from 'node:crypto';
import { SITE, CATEGORY_NAMES, callAward, alert } from './_award-lib.js';

function safe(v, n) {
  return String(v == null ? '' : v).replace(/[^A-Za-z0-9_\-.]/g, '').slice(0, n || 80);
}
function go(res, path) {
  res.writeHead(302, { Location: SITE + path, 'Cache-Control': 'no-store' });
  return res.end();
}

export default async function handler(req, res) {
  const q = req.query || {};
  const paymentId = safe(q.razorpay_payment_id, 60);
  const linkId = safe(q.razorpay_payment_link_id, 60);
  const referenceId = safe(q.razorpay_payment_link_reference_id, 60);
  const status = safe(q.razorpay_payment_link_status, 20);
  const signature = safe(q.razorpay_signature, 128);

  if (!paymentId || !linkId || !signature || status !== 'paid') {
    return go(res, '/award-thanks?type=unpaid' + (referenceId ? '&ref=' + encodeURIComponent(referenceId) : ''));
  }
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const expected = crypto.createHmac('sha256', keySecret)
    .update(linkId + '|' + referenceId + '|' + status + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) {
    return go(res, '/award-thanks?type=unverified&ref=' + encodeURIComponent(referenceId) + '&pay=' + encodeURIComponent(paymentId));
  }

  const r = await callAward({ action: 'mark_paid', link_id: linkId, payment_id: paymentId });
  const e = r.ok && r.data && r.data.entry;
  if (e && !r.data.already) {
    await alert('Award entry ' + e.ref + ' paid: ' + e.name + ' (' + (CATEGORY_NAMES[e.category] || e.category) + ')', {
      Reference: e.ref,
      Category: (CATEGORY_NAMES[e.category] || e.category) + (e.young ? ', also Young Changemaker' : ''),
      Name: e.name, Qualification: e.qualification, Registration: e.reg_no + ' (' + e.council + ')',
      City: e.city, Phone: e.phone, Email: e.email, Title: e.title,
      Amount: 'Rs ' + Math.round((e.amount_paise || 99900) / 100), PaymentId: paymentId
    }, '/award-apply');
  }
  if (!e) console.error('award-return: mark_paid failed for ' + linkId + ' ' + JSON.stringify(r.data));
  return go(res, '/award-thanks?type=entry&ref=' + encodeURIComponent(referenceId) + '&pay=' + encodeURIComponent(paymentId));
}
