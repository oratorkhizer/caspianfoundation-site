/* Certificate check, caspianfoundation.in/verify (added 3 November 2026).
   Calls the cert-verify edge function in the caspian-cme Supabase project,
   which needs BOTH the certificate number and the private 8-character code
   printed on the paper. Nothing on this page can list certificates. */
(function () {
  var FN = 'https://gjpbiiqkvzysmdpioexk.supabase.co/functions/v1/cert-verify';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var BANG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 6v8M12 18.5v.5"/></svg>';
  var KIND = { internship: 'Certificate of Internship', attendance: 'Certificate of Attendance', completion: 'Certificate of Completion' };

  function longDate(s) {
    if (!s) return '';
    var d = new Date(s + 'T00:00:00+05:30');
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
  function cleanNo(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ''); }
  function cleanKey(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function prettyKey(k) { return k.length === 8 ? k.slice(0, 4) + '-' + k.slice(4) : k; }

  function show(cls, icon, title, sub, body) {
    var r = $('vres');
    r.innerHTML = '<div class="vr ' + cls + '"><div class="vh"><span class="vi">' + icon + '</span><div><h2>' + esc(title) + '</h2>' +
      (sub ? '<p class="vs">' + esc(sub) + '</p>' : '') + '</div></div>' + (body || '') + '</div>';
    if (r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function details(c) {
    var signers = String(c.signatories || '').split(';').map(function (s) { return esc(s.trim()); }).filter(Boolean).join('<br>');
    return '<div class="vc">' +
      '<p class="vk">' + esc(KIND[c.kind] || 'Certificate') + '</p>' +
      '<p class="vn">' + esc(c.holder_name) + '</p>' +
      '<dl>' +
      '<dt>Programme</dt><dd>' + esc(c.programme) + '</dd>' +
      (c.period ? '<dt>Dates</dt><dd>' + esc(c.period) + '</dd>' : '') +
      '<dt>Certificate number</dt><dd>' + esc(c.cert_no) + '</dd>' +
      '<dt>Issued on</dt><dd>' + esc(longDate(c.issued_on)) + '</dd>' +
      '<dt>Issued by</dt><dd>' + esc(c.issued_by) + '</dd>' +
      (signers ? '<dt>Signed by</dt><dd>' + signers + '</dd>' : '') +
      '</dl>' +
      '<p class="vsum">' + esc(c.summary) + '</p>' +
      '</div>';
  }

  function busy(on) { $('vgo').disabled = on; $('vgo').textContent = on ? 'Checking…' : 'Verify'; }

  function verify(no, key) {
    busy(true);
    fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c: no, k: key }) })
      .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }, function () { return { s: r.status, d: {} }; }); })
      .then(function (x) {
        var d = x.d || {};
        if (d.ok && d.cert) {
          var c = d.cert;
          if (c.status === 'revoked') {
            show('bad', CROSS, 'This certificate has been withdrawn', 'It was issued by the Foundation but is no longer valid.',
              details(c) + (c.status_note ? '<p class="note" style="margin:14px 0 0">Reason: ' + esc(c.status_note) + '</p>' : ''));
          } else {
            var now = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            show('ok', TICK, 'Genuine certificate', 'Issued by Caspian Healthcare Foundation and valid. Check that the details below match the paper.',
              details(c) + '<p class="note" style="margin:14px 0 0">Checked on ' + esc(now) + ' IST.</p>');
          }
        } else if (x.s === 429) {
          show('warn', BANG, 'Too many attempts', 'Please wait an hour and try again, or scan the QR code on the certificate.');
        } else if (x.s === 404) {
          show('warn', BANG, 'No certificate matches', 'Check the number and the code against the paper and try again. If it still does not match, the Foundation cannot confirm this certificate.');
        } else {
          show('warn', BANG, 'We could not check right now', 'Please try again in a few minutes.');
        }
      }, function () {
        show('warn', BANG, 'We could not check right now', 'Your connection or our server had a problem. Please try again in a few minutes.');
      })
      .then(function () { busy(false); });
  }

  $('vf').addEventListener('submit', function (e) {
    e.preventDefault();
    var no = cleanNo($('vc').value), key = cleanKey($('vk').value);
    if (!no || key.length !== 8) {
      show('warn', BANG, 'Enter both', 'Type the certificate number and the 8-character verification code from the certificate.');
      return;
    }
    verify(no, key);
  });

  // The QR code opens /verify?c=NUMBER&k=CODE: fill the boxes, check at once,
  // then take the code out of the address bar so it does not stay in history.
  var q = new URLSearchParams(location.search);
  var qc = cleanNo(q.get('c')), qk = cleanKey(q.get('k'));
  if (qc) $('vc').value = qc;
  if (qk) $('vk').value = prettyKey(qk);
  if (qc && qk.length === 8) {
    verify(qc, qk);
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
})();
