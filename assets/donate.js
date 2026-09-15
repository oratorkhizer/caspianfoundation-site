(function () {
  var form = document.getElementById('donate-form');
  if (!form) return;
  var amounts = document.getElementById('amounts');
  var customWrap = document.getElementById('custom-wrap');
  var customAmt = document.getElementById('custom-amt');
  var submit = document.getElementById('d-submit');
  var msgBox = document.getElementById('d-msg');
  var selected = 1000;

  function fmt(n) { return 'Rs ' + Number(n).toLocaleString('en-IN'); }
  function label() {
    var v = current();
    submit.textContent = v ? 'Donate ' + fmt(v) : 'Donate';
  }
  function current() {
    if (selected === 'custom') { var v = parseInt(customAmt.value, 10); return v > 0 ? v : 0; }
    return selected;
  }
  function msg(kind, text) {
    msgBox.innerHTML = text ? '<div class="msg ' + kind + '">' + text + '</div>' : '';
  }

  amounts.addEventListener('click', function (e) {
    var b = e.target.closest('.amt');
    if (!b) return;
    [].forEach.call(amounts.querySelectorAll('.amt'), function (x) { x.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', 'true');
    var v = b.getAttribute('data-amt');
    selected = v === 'custom' ? 'custom' : parseInt(v, 10);
    customWrap.hidden = selected !== 'custom';
    if (selected === 'custom') { customAmt.focus(); }
    label();
  });
  customAmt.addEventListener('input', label);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg('', '');
    var amount = current();
    var donor = {
      name: document.getElementById('d-name').value.trim(),
      email: document.getElementById('d-email').value.trim(),
      phone: document.getElementById('d-phone').value.trim(),
      pan: document.getElementById('d-pan').value.trim().toUpperCase(),
      address: document.getElementById('d-address').value.trim(),
      programme: document.getElementById('d-programme').value,
      website: document.getElementById('d-website').value
    };
    if (!amount || amount < 100) { msg('err', 'Please enter an amount of Rs 100 or more.'); return; }
    if (!donor.name || !donor.email || !donor.phone) { msg('err', 'Please fill in your name, email and mobile number.'); return; }
    if (!document.getElementById('d-consent').checked) { msg('err', 'Please tick the consent box so we can send your receipt.'); return; }
    if (donor.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(donor.pan)) { msg('err', 'That PAN does not look right. Leave it blank if you are not sure.'); return; }

    submit.disabled = true;
    var original = submit.textContent;
    submit.textContent = 'Please wait...';

    fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, donor: donor })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.orderId) { throw new Error(res.j.error || 'Could not start the payment.'); }
        var d = res.j;
        var rzp = new window.Razorpay({
          key: d.keyId,
          order_id: d.orderId,
          amount: d.amount,
          currency: 'INR',
          name: 'Caspian Healthcare Foundation',
          description: 'Donation' + (donor.programme ? ' for ' + donor.programme : ''),
          image: 'https://caspianfoundation.in/chf-logo.png',
          prefill: { name: donor.name, email: donor.email, contact: donor.phone },
          notes: { programme: donor.programme || 'General', pan: donor.pan || '' },
          theme: { color: '#0e2643' },
          modal: {
            ondismiss: function () {
              submit.disabled = false; submit.textContent = original;
              msg('err', 'Payment was not completed. Nothing has been charged.');
            }
          },
          handler: function (resp) {
            submit.textContent = 'Confirming...';
            fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                donor: donor,
                amount: amount
              })
            }).then(function (r) { return r.json(); }).then(function (v) {
              if (v.verified) {
                window.location.href = '/thanks?ref=' + encodeURIComponent(resp.razorpay_payment_id);
              } else {
                submit.disabled = false; submit.textContent = original;
                msg('err', 'We could not confirm that payment automatically. Please email info@caspianfoundation.in with payment reference ' + resp.razorpay_payment_id + ' and we will sort it out.');
              }
            }).catch(function () {
              window.location.href = '/thanks?ref=' + encodeURIComponent(resp.razorpay_payment_id);
            });
          }
        });
        rzp.on('payment.failed', function () {
          submit.disabled = false; submit.textContent = original;
          msg('err', 'That payment did not go through. You can try again, or use another method.');
        });
        rzp.open();
      })
      .catch(function (err) {
        submit.disabled = false; submit.textContent = original;
        msg('err', err.message || 'Something went wrong. Please try again, or write to info@caspianfoundation.in.');
      });
  });

  label();
})();
