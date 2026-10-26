/* Promise desk (/pledge-desk): every Diabetes Promise, the numbers, and one-tap WhatsApp reminders.
   Same Foundation passcode as the award desk; it is kept for this browser tab only. */
(function () {
  'use strict';
  var API = 'https://itqxfypvrvwplzeeldaz.supabase.co/functions/v1/pledge-api';
  var $ = function (id) { return document.getElementById(id); };
  var pass = '';
  try { pass = sessionStorage.getItem('chf-pledge-desk') || ''; } catch (e) { pass = ''; }
  var rows = [], filter = 'all';

  var LINES = {
    feet: ['check my feet every day', "check {n}'s feet every day"],
    hba1c: ['test my HbA1c every three months', 'make sure {n} gets an HbA1c test every three months'],
    eyes: ['get my eyes checked every year', 'take {n} for an eye check every year'],
    kidneys: ['get my kidneys tested every year', "get {n}'s kidneys tested every year"],
    heart: ['know and control my BP and cholesterol', 'help {n} keep BP and cholesterol in check'],
    medicines: ['take my medicines as advised and never stop them on my own', 'help {n} take every medicine on time'],
    walk_with: ['walk with {n}', 'walk with {n}, 30 minutes, five days a week'],
    test: ['get my blood sugar tested this year'],
    walk: ['walk 30 minutes, five days a week'],
    drinks: ['give up sugary drinks'],
    waist: ['bring my waist into the healthy range'],
    family_test: ["get my parents' blood sugar tested"]
  };
  var LABEL = { feet: 'Feet', hba1c: 'HbA1c', eyes: 'Eyes', kidneys: 'Kidneys', heart: 'BP and cholesterol', medicines: 'Medicines', walk_with: 'Walk together', test: 'Get tested', walk: 'Walk', drinks: 'No sugary drinks', waist: 'Waist', family_test: 'Test parents' };
  var PATH = { self_dm: 'Self, has diabetes', loved_one: 'For a loved one', self_prevent: 'Self, prevention' };
  var STATUS = [['new', 'New'], ['messaged', 'Day 7 sent'], ['tested', 'Day 30 sent'], ['booked', 'Booked a test'], ['no_reply', 'No reply'], ['opted_out', 'Opted out']];

  function line(r) {
    var l = LINES[r.promise] || [''];
    var t = r.path === 'loved_one' && l[1] ? l[1] : l[0];
    return t.replace(/\{n\}/g, r.dedicated_to || 'them');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function days(r) { return (Date.now() - new Date(r.created_at).getTime()) / 864e5; }
  function fmt(iso) { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }); }
  function call(body) {
    body.action = 'admin'; body.passcode = pass;
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); });
  }

  $('gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    pass = $('pass').value;
    open();
  });
  function open() {
    $('gate-btn').disabled = true;
    call({ op: 'list' }).then(function (j) {
      $('gate-btn').disabled = false;
      if (j._status !== 200) {
        try { sessionStorage.removeItem('chf-pledge-desk'); } catch (e) { /* ignore */ }
        $('gate').hidden = false; $('desk').hidden = true;
        $('gate-msg').textContent = j.error || 'Could not open the desk.'; $('gate-msg').hidden = !pass;
        return;
      }
      try { sessionStorage.setItem('chf-pledge-desk', pass); } catch (e) { /* ignore */ }
      rows = j.rows || [];
      $('gate').hidden = true; $('desk').hidden = false;
      summary(); table();
    }).catch(function () { $('gate-btn').disabled = false; $('gate-msg').textContent = 'No connection.'; $('gate-msg').hidden = false; });
  }
  if (pass) open();

  function summary() {
    var now = Date.now(), day = 0, week = 0, loved = 0, high = 0, wa = 0, viaLink = 0, groups = {};
    var byP = {}, bySharer = {};
    rows.forEach(function (r) {
      var d = (now - new Date(r.created_at).getTime()) / 864e5;
      if (d < 1) day++; if (d < 7) week++;
      if (r.path === 'loved_one') loved++;
      if (r.risk_band === 'high') high++;
      if (r.wa_optin) wa++;
      if (r.ref_code) viaLink++;
      var c = r.utm && r.utm.campaign;
      if (c && c.indexOf('group:') === 0) groups[c.slice(6)] = (groups[c.slice(6)] || 0) + 1;
      byP[r.promise] = (byP[r.promise] || 0) + 1;
    });
    var T = [[rows.length, 'promises in all'], [day, 'in the last 24 hours'], [week, 'in the last 7 days'], [loved, 'made for a loved one'], [viaLink, 'came through a shared link'], [wa, 'agreed to WhatsApp reminders'], [high, 'high risk on the score']];
    $('tiles').innerHTML = T.map(function (t) { return '<div><b>' + t[0].toLocaleString('en-IN') + '</b><span>' + t[1] + '</span></div>'; }).join('');
    var max = Math.max.apply(null, Object.keys(byP).map(function (k) { return byP[k]; }).concat([1]));
    $('bypromise').innerHTML = '<div class="pd-bars">' + Object.keys(byP).sort(function (a, b) { return byP[b] - byP[a]; }).map(function (k) {
      return '<div><span>' + esc(LABEL[k] || k) + '<i style="width:' + Math.round(byP[k] / max * 100) + '%"></i></span><b>' + byP[k] + '</b></div>';
    }).join('') + '</div>';
    rows.forEach(function (r) { if (r.inspired) bySharer[r.code] = r; });
    var top = Object.keys(bySharer).map(function (k) { return bySharer[k]; }).sort(function (a, b) { return b.inspired - a.inspired; }).slice(0, 8);
    var g = Object.keys(groups).sort(function (a, b) { return groups[b] - groups[a]; }).slice(0, 8);
    $('sharers').innerHTML = (top.length || g.length)
      ? '<div class="pd-bars">' + top.map(function (r) { return '<div><span>' + esc(r.name) + '</span><b>' + r.inspired + '</b></div>'; }).join('') +
        g.map(function (k) { return '<div><span>Group: ' + esc(k) + '</span><b>' + groups[k] + '</b></div>'; }).join('') + '</div>'
      : '<p class="note">Nobody yet.</p>';
  }

  function due(r, which) {
    if (!r.wa_optin || !r.phone) return false;
    var d = days(r);
    if (which === 'd7') return d >= 7 && r.followup_status === 'new';
    return d >= 30 && (r.followup_status === 'new' || r.followup_status === 'messaged');
  }
  function waLink(r, which) {
    var first = String(r.name).split(' ')[0];
    var msg = which === 'd7'
      ? 'Hello ' + first + ', this is Caspian Healthcare Foundation. A week ago you made a Diabetes Promise: to ' + line(r) + '. How is it going? Keeping it for one more week makes it a habit.\n\nReply STOP if you do not want these reminders.'
      : 'Hello ' + first + ', a month ago you promised to ' + line(r) + '. Have you kept it? If you need a blood or urine test in Hyderabad, Caspian Diagnostic Centre can help: https://caspianlabs.in\n\nReply STOP if you do not want these reminders.';
    return 'https://wa.me/' + r.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
  }

  function table() {
    var q = $('q').value.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (filter === 'd7' && !due(r, 'd7')) return false;
      if (filter === 'd30' && !due(r, 'd30')) return false;
      if (filter === 'wa' && !r.wa_optin) return false;
      if (filter === 'high' && r.risk_band !== 'high') return false;
      if (q) {
        var digits = q.replace(/\D/g, '').replace(/^(0|91)(?=\d{10}$)/, '');
        var hay = (r.name + ' ' + (r.dedicated_to || '')).toLowerCase();
        if (hay.indexOf(q) < 0 && !(digits.length >= 4 && String(r.phone || '').indexOf(digits) >= 0)) return false;
      }
      return true;
    });
    $('count').textContent = list.length + ' of ' + rows.length + ' shown';
    $('rows').innerHTML = list.map(function (r) {
      var wa = r.phone ? esc(r.phone) + (r.wa_optin ? '<div class="pd-wa"><a target="_blank" rel="noopener" href="' + waLink(r, 'd7') + '">Day 7</a><a target="_blank" rel="noopener" href="' + waLink(r, 'd30') + '">Day 30</a></div>' : '<small>no reminders</small>') : '<small>none</small>';
      var st = '<select data-code="' + r.code + '" aria-label="Status">' + STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (r.followup_status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>';
      return '<tr><td>' + fmt(r.created_at) + '<small>No. ' + r.pledge_no + '</small></td>' +
        '<td>' + esc(r.name) + '<small>' + esc(PATH[r.path] || r.path) + (r.dedicated_to ? ', for ' + esc(r.dedicated_to) : '') + '</small></td>' +
        '<td>I promise to ' + esc(line(r)) + '</td>' +
        '<td>' + (r.risk_band ? '<span class="pill ' + r.risk_band + '">' + r.risk_band + '</span>' : '') + '</td>' +
        '<td>' + wa + '</td>' +
        '<td>' + (r.inspired || '') + '</td>' +
        '<td>' + st + '</td></tr>';
    }).join('') || '<tr><td colspan="7">Nothing here.</td></tr>';
  }
  $('rows').addEventListener('change', function (e) {
    var s = e.target.closest('select'); if (!s) return;
    var code = s.getAttribute('data-code');
    s.disabled = true;
    call({ op: 'update', code: code, followup_status: s.value }).then(function (j) {
      s.disabled = false;
      if (j._status !== 200) { window.alert(j.error || 'Could not save.'); return; }
      rows.forEach(function (r) { if (r.code === code) { r.followup_status = s.value; if (s.value === 'opted_out') r.wa_optin = false; } });
      summary(); table();
    });
  });
  document.querySelectorAll('.pd-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-f');
      document.querySelectorAll('.pd-tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      table();
    });
  });
  $('q').addEventListener('input', table);
  $('reload').addEventListener('click', open);
  $('csv').addEventListener('click', function () {
    var head = ['date', 'no', 'name', 'for', 'path', 'promise', 'risk', 'phone', 'whatsapp_reminders', 'status', 'brought', 'came_via_link', 'source', 'campaign', 'notes'];
    var out = [head.join(',')].concat(rows.map(function (r) {
      return [new Date(r.created_at).toISOString(), r.pledge_no, r.name, r.dedicated_to, r.path, 'I promise to ' + line(r), r.risk_band, r.phone, r.wa_optin ? 'yes' : 'no', (STATUS.filter(function (x) { return x[0] === r.followup_status; })[0] || [0, r.followup_status])[1], r.inspired, r.ref_code, r.utm && r.utm.source, r.utm && r.utm.campaign, r.notes]
        .map(function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
    }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.join('\n')], { type: 'text/csv' }));
    a.download = 'diabetes-promises-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
