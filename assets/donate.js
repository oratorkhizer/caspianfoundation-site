(function () {
  var form = document.getElementById('donate-form');
  if (!form) return;
  var amounts = document.getElementById('amounts');
  var customWrap = document.getElementById('custom-wrap');
  var customAmt = document.getElementById('custom-amt');
  var submit = document.getElementById('d-submit');
  var msgBox = document.getElementById('d-msg');
  var elName = document.getElementById('d-name');
  var elEmail = document.getElementById('d-email');
  var elCc = document.getElementById('d-cc');
  var elPhone = document.getElementById('d-phone');
  var elPan = document.getElementById('d-pan');
  var elAddress = document.getElementById('d-address');
  var elConsent = document.getElementById('d-consent');
  var selected = 1000;

  var MIN = 100;
  var MAX = 1000000;
  var EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  var PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

  function fmt(n) { return 'Rs ' + Number(n).toLocaleString('en-IN'); }
  function current() {
    if (selected === 'custom') { var v = parseInt(customAmt.value, 10); return v > 0 ? v : 0; }
    return selected;
  }
  function label() {
    var v = current();
    submit.textContent = v ? 'Donate ' + fmt(v) : 'Donate';
  }
  function msg(kind, text) {
    msgBox.innerHTML = text ? '<div class="msg ' + kind + '">' + text + '</div>' : '';
  }
  function clearFlags() {
    [elName, elEmail, elCc, elPhone, elPan, elAddress, customAmt].forEach(function (el) {
      if (el) el.removeAttribute('aria-invalid');
    });
  }
  function fail(el, text) {
    msg('err', text);
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return false;
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }

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

  elPan.addEventListener('input', function () {
    var p = this.selectionStart;
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    try { this.setSelectionRange(p, p); } catch (e) { /* older browsers */ }
  });
  elCc.addEventListener('blur', function () {
    var d = digits(this.value);
    this.value = d ? '+' + d : '+91';
  });
  [elName, elEmail, elPhone, elCc, elPan, elAddress].forEach(function (el) {
    el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg('', '');
    clearFlags();

    var amount = current();
    if (!amount || amount < MIN || amount > MAX) {
      return fail(selected === 'custom' ? customAmt : null,
        'Please choose an amount between ' + fmt(MIN) + ' and ' + fmt(MAX) + '.');
    }

    var name = elName.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || /^[\d\s+\-().]+$/.test(name)) {
      return fail(elName, 'Please enter your full name, the one the receipt should carry.');
    }
    if (/[@\/]|https?:/i.test(name)) {
      return fail(elName, 'Please enter your name here, not an email address or a link.');
    }

    var email = elEmail.value.trim();
    if (!email) { return fail(elEmail, 'Please enter your email address. The receipt is sent there.'); }
    if (email.length > 160 || !EMAIL.test(email) || /\.\./.test(email)) {
      return fail(elEmail, 'That email address does not look right. Please check it, the receipt is sent there.');
    }

    var cc = digits(elCc.value) || '91';
    if (cc.length < 1 || cc.length > 4) {
      return fail(elCc, 'Please enter a country code, for example +91 for India.');
    }
    var local = digits(elPhone.value);
    if (cc === '91') {
      if (local.length === 11 && local.charAt(0) === '0') { local = local.slice(1); }
      if (local.length === 12 && local.slice(0, 2) === '91') { local = local.slice(2); }
      if (!/^[6-9]\d{9}$/.test(local)) {
        return fail(elPhone, 'Please enter a 10 digit Indian mobile number, without the country code.');
      }
    } else if (local.length < 6 || local.length > 14) {
      return fail(elPhone, 'Please enter your mobile number, digits only, without the country code.');
    }
    var phone = '+' + cc + local;

    var pan = elPan.value.trim().toUpperCase();
    if (pan && !PAN.test(pan)) {
      return fail(elPan, 'That PAN does not look right. It is five letters, four digits and one letter. Leave it blank if you are not sure.');
    }
    var address = elAddress.value.trim();
    if (pan && address.length < 8) {
      return fail(elAddress, 'You have given a PAN, so please add your address as well. Both have to appear on the 80G receipt.');
    }

    if (!elConsent.checked) {
      elConsent.focus();
      msg('err', 'Please tick the consent box so we can send you the receipt.');
      return false;
    }

    var donor = {
      name: name,
      email: email,
      phone: phone,
      pan: pan,
      address: address,
      programme: document.getElementById('d-programme').value,
      website: document.getElementById('d-website').value
    };

    submit.disabled = true;
    var original = submit.textContent;
    submit.textContent = 'Please wait...';

    fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, donor: donor })
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = JSON.parse(t); } catch (e) { /* gateway or network returned something else */ }
        return { ok: r.ok, j: j };
      });
    })
      .then(function (res) {
        if (!res.ok || !res.j.url) {
          var e = new Error(res.j.error || 'We could not start the payment just now. Please try again in a moment.');
          e.friendly = true;
          throw e;
        }
        // Razorpay's hosted payment page opens next; it brings the donor back to /thanks when paid.
        submit.textContent = 'Taking you to Razorpay...';
        window.location.href = res.j.url;
      })
      .catch(function (err) {
        submit.disabled = false; submit.textContent = original;
        msg('err', (err && err.friendly && err.message) ||
          'We could not reach the payment gateway. Please check your connection and try again, or write to info@caspianfoundation.in.');
      });
  });

  // Back from Razorpay's hosted page without a completed payment.
  try {
    var st = new URLSearchParams(location.search).get('payment');
    if (st === 'incomplete') { msg('info', 'The payment was not completed, so nothing has been charged. You can choose an amount and try again.'); }
    if (st === 'unverified') { msg('err', 'We could not confirm that payment automatically. Please email info@caspianfoundation.in with payment reference ' + (new URLSearchParams(location.search).get('ref') || '') + ' and we will sort it out.'); }
    if (st && form.scrollIntoView) form.scrollIntoView({ block: 'start' });
  } catch (e) { /* older browsers */ }

  label();
})();
