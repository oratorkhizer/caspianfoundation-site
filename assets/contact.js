(function () {
  var f = document.getElementById('contact-form');
  if (!f) return;
  var st = document.getElementById('c-status');
  var btn = document.getElementById('c-submit');
  var EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

  // The relay sits behind Cloudflare, which turns away server to server calls from
  // our hosting but lets a real browser through. So the browser posts it, and the
  // serverless route is only the fallback. The address is already printed on this
  // page, so nothing is given away by having it here.
  var TO = 'info@caspianfoundation.in';

  function msg(k, t) { st.innerHTML = t ? '<div class="msg ' + k + '">' + t + '</div>' : ''; }
  function fail(el, text) {
    msg('err', text);
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return false;
  }

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    msg('', '');
    var elName = document.getElementById('c-name');
    var elEmail = document.getElementById('c-email');
    var elMsg = document.getElementById('c-msg');
    [elName, elEmail, elMsg].forEach(function (el) { el.removeAttribute('aria-invalid'); });

    var body = {
      name: elName.value.trim().replace(/\s+/g, ' '),
      email: elEmail.value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      topic: document.getElementById('c-topic').value,
      message: elMsg.value.trim(),
      website: document.getElementById('c-website').value
    };

    if (body.website) { f.reset(); msg('ok', 'Thank you.'); return; }
    if (body.name.length < 2 || /^[\d\s+\-().]+$/.test(body.name)) {
      return fail(elName, 'Please enter your name.');
    }
    if (!EMAIL.test(body.email) || /\.\./.test(body.email)) {
      return fail(elEmail, 'That email address does not look right. We reply to it, so please check it.');
    }
    if (body.message.length < 10) {
      return fail(elMsg, 'Please tell us a little more, so we can reply usefully.');
    }

    btn.disabled = true;
    var o = btn.textContent;
    btn.textContent = 'Sending...';

    function done(ok) {
      btn.disabled = false;
      btn.textContent = o;
      if (ok) {
        f.reset();
        msg('ok', 'Thank you. Your message has reached us and we will reply within two to three working days.');
      } else {
        msg('err', 'That did not send. Please email info@caspianfoundation.in or call +91 89784 54547.');
      }
    }

    fetch('https://formsubmit.co/ajax/' + encodeURIComponent(TO), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Foundation enquiry: ' + (body.topic || 'General'),
        Name: body.name,
        Email: body.email,
        Phone: body.phone || 'not given',
        Topic: body.topic || 'General',
        Message: body.message,
        _template: 'table'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (String(j && j.success) === 'true') { done(true); return; }
        throw new Error('relay refused');
      })
      .catch(function () {
        // Fallback: our own route. It may also be blocked, in which case we say so plainly.
        fetch('/api/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
          .then(function (r) { return r.json(); })
          .then(function (j) { done(!!(j && j.ok)); })
          .catch(function () { done(false); });
      });
  });
})();
