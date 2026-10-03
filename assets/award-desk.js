/* Award desk: the secretariat view of the Diabesity Changemakers Award.
   Every call goes to /api/award?op=desk with the passcode; nothing is cached in the page beyond
   the session. Files open through ten-minute signed links. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var pass = '';
  try { pass = sessionStorage.getItem('chf-award-desk') || ''; } catch (e) { pass = ''; }
  var data = { entries: [], nominations: [], jurors: [], stories: [] };
  var tab = 'entries';
  var current = null;

  var CAT = { outcomes: 'Outcomes', innovation: 'Innovation', teaching: 'Teaching case' };
  var STATUS = {
    entries: { field: 'screening', label: 'Screening', options: ['new', 'eligible', 'ineligible', 'flagged'] },
    nominations: { field: 'status', label: 'Status', options: ['new', 'called_verified', 'called_failed', 'shortlisted', 'not_shortlisted'] },
    jurors: { field: 'status', label: 'Status', options: ['applied', 'shortlisted', 'approved', 'declined', 'withdrawn'] },
    stories: { field: 'status', label: 'Status', options: ['new', 'contacted', 'shortlisted', 'accepted', 'done', 'declined'] }
  };
  var NOTES = {
    entries: 'Entries marked "awaiting payment" were saved but the Rs 999 was not completed. Call them if the details look genuine. Mark an entry Eligible once the registration is checked; only eligible entries go to the jury.',
    nominations: 'Patients\u2019 Choice nominations from this site. Call the nominator, then mark it called and verified, and Shortlisted if the story should go to the jury.',
    stories: 'Story nominations made on diabesityexpo.com/get-involved (patients, caregivers and doctors). They stay in the expo\u2019s own records; changes here are saved there.',
    jurors: 'Approve the jurors you want. Approved jurors appear in the Scoring tab, where you send each one a personal scoring link.'
  };
  function flash(t, bad) { var f = $('flash'); f.innerHTML = ''; if (!t) return; f.appendChild(el('div', { class: 'msg ' + (bad ? 'err' : 'ok') }, t)); clearTimeout(flash.t); flash.t = setTimeout(function () { f.innerHTML = ''; }, 5000); }
  var TABLE = { entries: 'award_entries', nominations: 'award_nominations', jurors: 'award_jurors' };
  var nice = function (s) { return String(s || '').replace(/_/g, ' '); };

  function api(body) {
    body.passcode = pass;
    return fetch('/api/award?op=desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; } return j; }); });
  }
  function gateMsg(t, ok) { $('gate-msg').innerHTML = t ? '<div class="msg ' + (ok ? 'ok' : 'err') + '"></div>' : ''; if (t) $('gate-msg').firstChild.textContent = t; }
  function fmt(d) { if (!d) return ''; var x = new Date(d); return x.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }

  /* gate */
  var setupMode = false;
  api({ op: 'status' }).then(function (j) {
    if (!j.configured) {
      setupMode = true;
      $('gate-title').textContent = 'Set the desk passcode';
      $('gate-note').textContent = 'First visit. Choose a passcode of at least 8 characters. Keep it safe: it cannot be recovered, only changed.';
      $('pass2-wrap').hidden = false;
      $('gate-btn').textContent = 'Set passcode and open';
    } else if (pass) { load(); }
  }).catch(function () { gateMsg('The desk could not reach the award system.'); });

  $('gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('pass').value;
    if (setupMode) {
      if (p.length < 8) return gateMsg('Use at least 8 characters.');
      if (p !== $('pass2').value) return gateMsg('The two passcodes do not match.');
      pass = p;
      api({ op: 'setup' }).then(function () { setupMode = false; remember(); load(); }).catch(function (er) { gateMsg(er.message); });
    } else {
      pass = p; load(true);
    }
  });
  function remember() { try { sessionStorage.setItem('chf-award-desk', pass); } catch (e) { /* ignore */ } }

  function load(fromGate) {
    api({ op: 'list' }).then(function (j) {
      data = j; data.stories = (j.stories || []).map(function (r) { var d = r.details || {}; return Object.assign({ ref: 'EXPO-' + r.id.slice(0, 6).toUpperCase(), role: d.role, nominating: d.nominating, nominee_name: d.nominee_name, nominee_phone: d.nominee_phone, has_permission: d.has_permission, story: d.story }, r, { details: undefined }); });
      if (j.storiesError) flash(j.storiesError, true);
      remember();
      $('gate').hidden = true; $('desk').hidden = false;
      tiles(); filters(); render();
    }).catch(function (er) {
      if (er.status === 401) { try { sessionStorage.removeItem('chf-award-desk'); } catch (e) { /* ignore */ } $('gate').hidden = false; $('desk').hidden = true; }
      if (fromGate || er.status !== 401) gateMsg(er.message);
    });
  }

  function tiles() {
    var paid = data.entries.filter(function (e) { return e.status === 'paid'; });
    var t = [
      [paid.length, 'Paid entries'],
      [data.entries.length - paid.length, 'Awaiting payment'],
      [paid.filter(function (e) { return e.category === 'outcomes'; }).length, 'Outcomes'],
      [paid.filter(function (e) { return e.category === 'innovation'; }).length, 'Innovation'],
      [paid.filter(function (e) { return e.category === 'teaching'; }).length, 'Teaching cases'],
      [paid.filter(function (e) { return e.young; }).length, 'Young Changemaker'],
      [data.nominations.length, 'Patient nominations'],
      [data.stories.length, 'Expo story nominations'],
      [data.jurors.length, 'Jury applications'],
      ['Rs ' + (paid.length * 999).toLocaleString('en-IN'), 'Fees received']
    ];
    var box = $('tiles'); box.innerHTML = '';
    t.forEach(function (x) { var d = el('div', { class: 'tile' }); d.appendChild(el('b', null, String(x[0]))); d.appendChild(el('span', null, x[1])); box.appendChild(d); });
  }

  function filters() {
    var s = $('f-status'); s.innerHTML = '';
    var opts = tab === 'entries'
      ? [['paid', 'Paid entries'], ['pending_payment', 'Awaiting payment'], ['all', 'All entries'], ['outcomes', 'Paid: Outcomes'], ['innovation', 'Paid: Innovation'], ['teaching', 'Paid: Teaching'], ['young', 'Paid: Young Changemaker']]
      : [['all', 'All']].concat(STATUS[tab].options.map(function (o) { return [o, nice(o)]; }));
    opts.forEach(function (o) { var op = el('option', { value: o[0] }, o[1]); s.appendChild(op); });
  }

  function rows() {
    var f = $('f-status').value, q = $('f-search').value.trim().toLowerCase();
    return data[tab].filter(function (r) {
      if (tab === 'entries') {
        if (f === 'paid' && r.status !== 'paid') return false;
        if (f === 'pending_payment' && r.status !== 'pending_payment') return false;
        if (CAT[f] && (r.status !== 'paid' || r.category !== f)) return false;
        if (f === 'young' && (r.status !== 'paid' || !r.young)) return false;
      } else if (f !== 'all' && r[STATUS[tab].field] !== f) return false;
      if (!q) return true;
      return JSON.stringify([r.ref, r.name, r.city, r.doctor_name, r.doctor_city, r.nominator_name, r.title, r.institution]).toLowerCase().indexOf(q) >= 0;
    });
  }

  var COLS = {
    entries: [['ref', 'Ref'], ['created_at', 'Received', fmt], ['name', 'Doctor'], ['category', 'Category', function (v, r) { return CAT[v] + (r.young ? ' + Young' : ''); }], ['city', 'City'], ['title', 'Title'], ['status', 'Payment', null, true], ['screening', 'Screening', null, true]],
    nominations: [['ref', 'Ref'], ['created_at', 'Received', fmt], ['doctor_name', 'Doctor'], ['doctor_city', 'Doctor city'], ['nominator_name', 'Nominated by'], ['nominator_phone', 'Phone'], ['status', 'Status', null, true]],
    jurors: [['ref', 'Ref'], ['created_at', 'Received', fmt], ['name', 'Name'], ['designation', 'Designation'], ['institution', 'Institution'], ['pg_year', 'PG year'], ['city', 'City'], ['status', 'Status', null, true]],
    stories: [['created_at', 'Received', fmt], ['role', 'Whose story'], ['name', 'Sent by'], ['phone', 'Phone'], ['nominee_name', 'Nominee', function (v, r) { return r.nominating === 'self' ? 'themselves' : (v || ''); }], ['story', 'Story', function (v) { v = v || ''; return v.length > 90 ? v.slice(0, 90) + '...' : v; }], ['status', 'Status', null, true]]
  };
  function pill(v) {
    var cls = /^(paid|eligible|approved|called_verified|shortlisted)$/.test(v) ? 'ok' : /^(pending_payment|flagged|applied|new)$/.test(v) ? 'warn' : /^(ineligible|declined|called_failed|not_shortlisted|withdrawn)$/.test(v) ? 'bad' : '';
    return el('span', { class: 'pill ' + cls }, v === 'pending_payment' ? 'awaiting payment' : nice(v));
  }

  function render() {
    var tbl = $('table'); tbl.innerHTML = '';
    var cols = COLS[tab];
    var head = el('tr'); cols.forEach(function (c) { head.appendChild(el('th', null, c[1])); }); tbl.appendChild(head);
    var list = rows();
    $('count').textContent = list.length + ' shown';
    if (!list.length) { var tr = el('tr'); var td = el('td', { colspan: cols.length }, 'Nothing here yet.'); tr.appendChild(td); tbl.appendChild(tr); return; }
    list.forEach(function (r) {
      var tr = el('tr', { tabindex: '0' });
      cols.forEach(function (c) {
        var td = el('td');
        var v = r[c[0]];
        if (c[3]) td.appendChild(pill(v)); else td.textContent = c[2] ? c[2](v, r) : (v == null ? '' : String(v));
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () { open(r); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(r); });
      tbl.appendChild(tr);
    });
  }

  var LABELS = {
    ref: 'Reference', created_at: 'Received', category: 'Category', young: 'Young Changemaker', qual_year: 'Year of highest qualification',
    name: 'Name', qualification: 'Qualifications', speciality: 'Speciality', reg_no: 'Registration no.', council: 'Council',
    institution: 'Institution', city: 'City', state: 'State', phone: 'Phone', email: 'Email', title: 'Title',
    problem: 'The problem', method: 'What was done', results: 'Results', learning: 'What others can learn', team: 'Team',
    amount_paise: 'Amount', rzp_payment_id: 'Razorpay payment', rzp_link_id: 'Razorpay link', paid_at: 'Paid at',
    nominator_name: 'Nominated by', nominator_phone: 'Phone', nominator_email: 'Email', relation: 'Relation',
    doctor_name: 'Doctor', doctor_place: 'Hospital or clinic', doctor_city: 'Doctor city', since_year: 'Treating since', story: 'Story',
    designation: 'Designation', pg_year: 'Postgraduation year', expertise: 'Expertise', roles: 'Roles', conflicts: 'Declared conflicts',
    linkedin: 'Profile', declarations: 'Declarations', utm: 'Came from', consent: 'Consent to call',
    role: 'Whose story', nominating: 'Nominating', nominee_name: 'Nominee', nominee_phone: 'Nominee phone', has_permission: 'Nominee knows',
    consent_contact: 'May contact', consent_publish: 'May publish', area: 'Area', language: 'Language', kind: 'Type', utm_source: 'Source', utm_medium: 'Medium', utm_campaign: 'Campaign', referrer: 'Referrer'
  };
  var SKIP = { id: 1, status: 1, screening: 1, notes: 1, pdf_path: 1, photo_path: 1, cv_path: 1 };

  function open(r) {
    current = r;
    $('d-title').textContent = r.ref + '  ' + (r.name || r.doctor_name || '');
    var files = $('d-files'); files.innerHTML = '';
    [['pdf_path', 'Open supporting PDF'], ['photo_path', 'Open photograph'], ['cv_path', 'Open CV']].forEach(function (f) {
      if (!r[f[0]]) return;
      var b = el('button', { type: 'button', class: 'btn btn-gold btn-sm' }, f[1]);
      b.addEventListener('click', function () {
        var w = window.open('', '_blank');
        api({ op: 'file', path: r[f[0]] }).then(function (j) { if (w) w.location = j.url; else location.href = j.url; })
          .catch(function (er) { if (w) w.close(); $('d-msg').textContent = er.message; });
      });
      files.appendChild(b);
    });
    if (r.phone || r.nominator_phone) {
      var ph = (r.phone || r.nominator_phone).replace(/[^\d]/g, '');
      var a = el('a', { class: 'btn btn-ghost btn-sm', href: 'https://wa.me/' + ph, target: '_blank', rel: 'noopener' }, 'WhatsApp');
      files.appendChild(a);
    }
    var st = STATUS[tab];
    $('d-status-label').textContent = st.label;
    var sel = $('d-status'); sel.innerHTML = '';
    st.options.forEach(function (o) { var op = el('option', { value: o }, nice(o)); if (r[st.field] === o) op.selected = true; sel.appendChild(op); });
    $('d-pay-wrap').hidden = tab !== 'entries';
    if (tab === 'entries') { var p = $('d-pay'); p.innerHTML = ''; p.appendChild(pill(r.status)); }
    $('d-notes').value = r.notes || '';
    $('d-msg').textContent = '';
    var dl = $('d-fields'); dl.innerHTML = '';
    Object.keys(r).forEach(function (k) {
      if (SKIP[k]) return;
      var v = r[k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      if (k === 'created_at' || k === 'paid_at') v = new Date(v).toLocaleString('en-IN');
      else if (k === 'category') v = CAT[v];
      else if (k === 'amount_paise') v = 'Rs ' + Math.round(v / 100);
      else if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
      else if (Array.isArray(v)) v = v.join(', ');
      else if (typeof v === 'object') v = Object.keys(v).map(function (x) { return x + ': ' + v[x]; }).join('\n');
      dl.appendChild(el('dt', null, LABELS[k] || nice(k)));
      dl.appendChild(el('dd', null, String(v)));
    });
    $('detail').hidden = false;
    $('d-close').focus();
  }
  function close() { $('detail').hidden = true; current = null; }
  $('d-close').addEventListener('click', close);
  $('detail').addEventListener('click', function (e) { if (e.target === $('detail')) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('detail').hidden) close(); });

  $('d-save').addEventListener('click', function () {
    if (!current) return;
    var fields = { notes: $('d-notes').value };
    fields[STATUS[tab].field] = $('d-status').value;
    $('d-msg').textContent = 'Saving...';
    var req = tab === 'stories' ? { op: 'story-update', id: current.id, fields: fields } : { op: 'update', table: TABLE[tab], id: current.id, fields: fields };
    api(req).then(function () {
      Object.assign(current, fields);
      $('d-msg').textContent = 'Saved.';
      tiles(); render();
    }).catch(function (er) { $('d-msg').textContent = er.message; });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.desk-tabs button'), function (b) {
    b.addEventListener('click', function () {
      tab = b.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.desk-tabs button'), function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      $('f-search').value = '';
      var sc = tab === 'scoring';
      $('listview').hidden = sc; $('scoring').hidden = !sc;
      if (sc) { window.AwardScoring.show($('scoring'), api, el, flash); return; }
      $('tabnote').textContent = NOTES[tab] || '';
      filters(); render();
    });
  });
  $('f-status').addEventListener('change', render);
  $('f-search').addEventListener('input', render);
  $('refresh').addEventListener('click', function () { load(); });
  $('tabnote').textContent = NOTES.entries;
  $('testmail').addEventListener('click', function () {
    var box = document.getElementById('tm-box');
    if (box) { box.remove(); return; }
    box = el('div', { id: 'tm-box', class: 'card', style: 'max-width:460px;margin:0 0 14px' });
    box.innerHTML = '<div class="field"><label for="tm-to">Send a test award email to</label><input id="tm-to" type="email" value="info@caspianfoundation.in"></div><button class="btn btn-navy btn-sm" type="button" id="tm-send">Send test</button> <span class="note" id="tm-msg"></span>';
    $('table').parentNode.parentNode.insertBefore(box, $('table').parentNode);
    $('tm-send').addEventListener('click', function () {
      $('tm-msg').textContent = 'Sending...';
      api({ op: 'test-email', to: $('tm-to').value }).then(function () { $('tm-msg').textContent = 'Sent. Check the inbox (and spam, the first time).'; })
        .catch(function (er) { $('tm-msg').textContent = er.message; });
    });
  });
  $('chpass').addEventListener('click', function () {
    var box = document.getElementById('chpass-box');
    if (box) { box.remove(); return; }
    box = el('div', { id: 'chpass-box', class: 'card', style: 'max-width:460px;margin:0 0 14px' });
    box.innerHTML = '<div class="field"><label for="np1">New passcode, at least 8 characters</label><input id="np1" type="password" autocomplete="new-password"></div><div class="field"><label for="np2">Type it again</label><input id="np2" type="password" autocomplete="new-password"></div><button class="btn btn-navy btn-sm" type="button" id="np-save">Change passcode</button> <span class="note" id="np-msg"></span>';
    $('table').parentNode.parentNode.insertBefore(box, $('table').parentNode);
    $('np-save').addEventListener('click', function () {
      var a = $('np1').value, b = $('np2').value;
      if (a.length < 8) { $('np-msg').textContent = 'Use at least 8 characters.'; return; }
      if (a !== b) { $('np-msg').textContent = 'The two do not match.'; return; }
      api({ op: 'change-passcode', next: a }).then(function () { pass = a; remember(); $('np-msg').textContent = 'Changed. Use the new passcode from now on.'; })
        .catch(function (er) { $('np-msg').textContent = er.message; });
    });
  });

  $('csv').addEventListener('click', function () {
    var list = rows();
    if (!list.length) return;
    var keys = Object.keys(list[0]).filter(function (k) { return k !== 'id'; });
    var esc = function (v) {
      if (v == null) return '';
      if (typeof v === 'object') v = JSON.stringify(v);
      v = String(v);
      if (/^[=+\-@]/.test(v)) v = "'" + v;
      return '"' + v.replace(/"/g, '""') + '"';
    };
    var csv = [keys.join(',')].concat(list.map(function (r) { return keys.map(function (k) { return esc(r[k]); }).join(','); })).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'award-' + tab + '-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
