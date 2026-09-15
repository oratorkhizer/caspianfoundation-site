(function () {
  var f = document.getElementById('contact-form');
  if (!f) return;
  var st = document.getElementById('c-status');
  var btn = document.getElementById('c-submit');
  function msg(k, t) { st.innerHTML = t ? '<div class="msg ' + k + '">' + t + '</div>' : ''; }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      name: document.getElementById('c-name').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      topic: document.getElementById('c-topic').value,
      message: document.getElementById('c-msg').value.trim(),
      website: document.getElementById('c-website').value
    };
    if (!body.name || !body.email || !body.message) { msg('err', 'Please fill in your name, email and message.'); return; }
    btn.disabled = true; var o = btn.textContent; btn.textContent = 'Sending...';
    fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.ok) { f.reset(); msg('ok', 'Thank you. Your message has reached us and we will reply within two to three working days.'); }
        else { throw new Error(j.error || 'send failed'); }
        btn.disabled = false; btn.textContent = o;
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = o;
        msg('err', 'That did not send. Please email info@caspianfoundation.in or call +91 89784 54547.');
      });
  });
})();
