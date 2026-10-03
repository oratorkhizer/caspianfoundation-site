(function () {
  var q = new URLSearchParams(location.search);
  var type = q.get('type') || '';
  var ref = (q.get('ref') || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20);
  var pay = (q.get('pay') || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
  function set(id, text) { var e = document.getElementById(id); if (e) e.textContent = text; }
  var T = {
    entry: ['Your entry is in.', 'Payment received. Your entry is with the secretariat. Razorpay has emailed your payment receipt.',
      'The secretariat checks your registration and eligibility, then assigns two jurors who have no conflict with you. Scoring runs from 27 October to 5 November. Finalists are told by 6 November.'],
    nomination: ['Thank you for nominating your doctor.', 'Your story has reached us. It costs you nothing, and it may mean a great deal to the doctor.',
      'If the nomination is shortlisted, someone from the Foundation will call you to hear the story in your own words. Please keep your phone with you after 26 October.'],
    juror: ['Thank you for offering your time.', 'Your application to the jury has been received.',
      'The convenor and the trustees approve the jury by 22 October. We will write to you either way. If you are selected, you receive the scoring guide and your entries on 27 October.'],
    unpaid: ['The payment did not go through.', 'Your entry is saved, but it is not complete until the fee is paid.',
      'Please write to info@caspianfoundation.in or call +91 89784 54547 with your reference and we will send you a fresh payment link. If money left your account, it will be refunded or matched to your entry.'],
    unverified: ['We could not confirm the payment.', 'Your payment could not be verified automatically. Please do not pay again.',
      'Write to info@caspianfoundation.in with your reference and the payment ID shown below. We will check with Razorpay and confirm within one working day.']
  };
  var t = T[type];
  if (!t) return;
  set('t-title', t[0]); set('t-lede', t[1]); set('t-next', t[2]);
  if (ref) {
    set('t-ref', ref + (pay ? '  (payment ' + pay + ')' : ''));
    document.getElementById('t-refwrap').hidden = false;
  }
  document.title = t[0] + ' | Diabesity Changemakers Award 2026';
})();
