/* Award desk, Scoring tab: assign jurors, send scoring links, watch progress, rank, pick finalists
   and record results. Loaded by award-desk.js, which passes in its api() and helpers. */
(function () {
  var CAT = { outcomes: 'Outcomes Award', innovation: 'Practice Innovation Award', teaching: 'Clinical Teaching Case Award' };
  var RESULTS = ['', 'winner', 'commendation', 'finalist', 'participant'];
  var S = null, api = null, box = null, el = null, flash = null;

  function avg(xs) { return xs.length ? Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length * 10) / 10 : null; }
  function jurorName(id) { var j = S.jurors.filter(function (x) { return x.id === id; })[0]; return j ? j.name : 'Removed juror'; }

  function stats(subject, id) {
    var mine = S.assignments.filter(function (a) { return a.subject === subject && a.subject_id === id; });
    var r1 = mine.filter(function (a) { return a.round === 1 && a.status === 'scored'; }).map(function (a) { return a.total; });
    var r2 = mine.filter(function (a) { return a.round === 2 && a.status === 'scored'; }).map(function (a) { return a.total; });
    var a1 = avg(r1), a2 = avg(r2);
    var spread = r1.length >= 2 ? Math.max.apply(null, r1) - Math.min.apply(null, r1) : null;
    var final = a1 == null ? null : (a2 == null ? a1 : Math.round((a1 * 0.6 + a2 * 0.4) * 10) / 10);
    return { mine: mine, r1: a1, r2: a2, n1: r1.length, spread: spread, final: final };
  }

  function load() {
    box.innerHTML = '';
    box.appendChild(el('p', { class: 'note' }, 'Loading scoring...'));
    api({ op: 'scoring' }).then(function (j) { S = j; draw(); }).catch(function (e) { box.innerHTML = ''; box.appendChild(el('div', { class: 'msg err' }, e.message)); });
  }

  function act(body, okText) {
    return api(body).then(function (j) { if (okText) flash(typeof okText === 'function' ? okText(j) : okText); load(); return j; })
      .catch(function (e) { flash(e.message, true); });
  }

  function draw() {
    box.innerHTML = '';
    var approved = S.jurors.filter(function (x) { return x.status === 'approved'; });

    /* controls */
    var c = el('div', { class: 'card', style: 'box-shadow:none;margin-bottom:18px' });
    c.appendChild(el('h3', null, 'Run the scoring'));
    c.appendChild(el('p', { class: 'note' }, 'Step 1: mark entries Eligible (Doctor entries tab) and patient stories Shortlisted after the call. Step 2: approve jurors (Jury applications tab). Step 3: assign and send each juror their link. Round 1 closes 5 November, round 2 on 9 November.'));
    var row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' });
    var b1 = el('button', { type: 'button', class: 'btn btn-navy btn-sm' }, 'Assign round 1 (2 jurors each)');
    b1.addEventListener('click', function () { act({ op: 'auto-assign', round: 1 }, function (j) { return j.added + ' assignment(s) added.'; }); });
    var b2 = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Assign round 2 (finalists to all jurors)');
    b2.addEventListener('click', function () { act({ op: 'auto-assign', round: 2 }, function (j) { return j.added + ' assignment(s) added.'; }); });
    var lock = el('label', { class: 'check', style: 'margin:0 0 0 auto' });
    var lk = el('input', { type: 'checkbox' }); lk.checked = !!S.unlocked;
    lk.addEventListener('change', function () { act({ op: 'set-lock', unlocked: lk.checked }, lk.checked ? 'Late scoring allowed.' : 'Deadlines enforced again.'); });
    lock.appendChild(lk); lock.appendChild(el('span', null, 'Allow scoring after the deadline'));
    row.appendChild(b1); row.appendChild(b2); row.appendChild(lock); c.appendChild(row);
    box.appendChild(c);

    /* jurors */
    var jc = el('div', { class: 'card', style: 'box-shadow:none;margin-bottom:18px' });
    jc.appendChild(el('h3', null, 'Jurors and their scoring links'));
    if (!S.jurors.length) jc.appendChild(el('p', { class: 'note' }, 'No approved or shortlisted jurors yet.'));
    else {
      var tw = el('div', { class: 'table-wrap' }); var t = el('table');
      var h = el('tr'); ['Juror', 'Status', 'Assigned', 'Scored', 'Conflicts', 'Link'].forEach(function (x) { h.appendChild(el('th', null, x)); }); t.appendChild(h);
      S.jurors.forEach(function (j) {
        var mine = S.assignments.filter(function (a) { return a.juror_id === j.id; });
        var tr = el('tr');
        tr.appendChild(el('td', null, j.name + (j.designation ? ', ' + j.designation : '')));
        tr.appendChild(el('td', null, j.status));
        tr.appendChild(el('td', null, String(mine.filter(function (a) { return a.status !== 'conflict'; }).length)));
        tr.appendChild(el('td', null, String(mine.filter(function (a) { return a.status === 'scored'; }).length)));
        tr.appendChild(el('td', null, String(mine.filter(function (a) { return a.status === 'conflict'; }).length)));
        var td = el('td');
        if (j.status === 'approved') {
          var lb = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, j.token_issued_at ? 'New link' : 'Create link');
          lb.addEventListener('click', function () {
            if (j.token_issued_at && !lb.dataset.sure) { lb.dataset.sure = '1'; lb.textContent = 'Old link stops working. Click again'; return; }
            api({ op: 'issue-token', juror_id: j.id }).then(function (r) {
              var url = location.origin + '/award-score#t=' + r.token;
              td.innerHTML = '';
              var inp = el('input', { value: url, readonly: '', style: 'font-size:.8rem;padding:6px 8px;min-width:240px' });
              td.appendChild(inp); inp.select();
              var cp = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: 'margin-top:6px' }, 'Copy');
              cp.addEventListener('click', function () { try { navigator.clipboard.writeText(url); cp.textContent = 'Copied'; } catch (e) { inp.select(); } });
              td.appendChild(cp);
              var ph = String(r.juror.phone || '').replace(/[^\d]/g, '');
              var msg = 'Dear ' + r.juror.name + ', thank you for serving on the jury of the Diabesity Changemakers Award 2026. Your personal scoring page is below. Please do not share it.\n\n' + url + '\n\nRound 1 closes on 5 November. Caspian Healthcare Foundation';
              var wa = el('a', { class: 'btn btn-gold btn-sm', style: 'margin:6px 0 0 6px', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg) }, 'Send on WhatsApp');
              td.appendChild(wa);
              td.appendChild(el('p', { class: 'note', style: 'margin:6px 0 0' }, 'Shown once. Creating a new link cancels this one.'));
            }).catch(function (e) { flash(e.message, true); });
          });
          td.appendChild(lb);
          if (j.token_issued_at) td.appendChild(el('div', { class: 'note' }, 'Link sent ' + new Date(j.token_issued_at).toLocaleDateString('en-IN')));
        } else td.textContent = 'Approve first';
        tr.appendChild(td); t.appendChild(tr);
      });
      tw.appendChild(t); jc.appendChild(tw);
    }
    box.appendChild(jc);

    /* categories */
    var groups = [
      ['outcomes', 'entry'], ['innovation', 'entry'], ['teaching', 'entry'], ['young', 'entry'], ['patients', 'nomination']
    ];
    groups.forEach(function (g) {
      var items, title;
      if (g[1] === 'nomination') { items = S.nominations; title = 'Patients’ Choice Award'; }
      else if (g[0] === 'young') { items = S.entries.filter(function (e) { return e.young; }); title = 'Young Changemaker Award (ranked from the entries above)'; }
      else { items = S.entries.filter(function (e) { return e.category === g[0]; }); title = CAT[g[0]]; }
      var sec = el('div', { style: 'margin:26px 0' });
      sec.appendChild(el('h3', null, title + '  (' + items.length + ')'));
      if (!items.length) { sec.appendChild(el('p', { class: 'note' }, g[1] === 'nomination' ? 'No shortlisted patient nominations yet.' : 'No paid entries yet.')); box.appendChild(sec); return; }
      var ranked = items.map(function (it) { return { it: it, s: stats(g[1], it.id) }; })
        .sort(function (a, b) { return (b.s.final == null ? -1 : b.s.final) - (a.s.final == null ? -1 : a.s.final); });
      var tw = el('div', { class: 'table-wrap' }); var t = el('table', { style: 'min-width:860px' });
      var hd = el('tr');
      ['#', 'Ref', g[1] === 'nomination' ? 'Doctor' : 'Doctor and title', 'Jurors and scores', 'R1 avg', 'Spread', 'R2 avg', 'Final', g[1] === 'entry' ? 'Finalist' : '', 'Result'].forEach(function (x) { hd.appendChild(el('th', null, x)); });
      t.appendChild(hd);
      ranked.forEach(function (row, i) {
        var it = row.it, s = row.s, tr = el('tr');
        tr.appendChild(el('td', null, String(i + 1)));
        tr.appendChild(el('td', null, it.ref));
        var who = el('td');
        if (g[1] === 'nomination') { who.appendChild(el('b', null, it.doctor_name)); who.appendChild(el('div', { class: 'note' }, (it.doctor_place || '') + ', ' + (it.doctor_city || ''))); }
        else {
          who.appendChild(el('b', null, it.name)); who.appendChild(el('div', { class: 'note' }, it.title || ''));
          if (it.screening !== 'eligible') who.appendChild(el('span', { class: 'pill warn' }, 'screening: ' + it.screening));
        }
        tr.appendChild(who);
        var jt = el('td');
        s.mine.forEach(function (a) {
          var chip = el('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:.84rem' });
          var label = 'R' + a.round + ' ' + jurorName(a.juror_id) + ': ' + (a.status === 'scored' ? a.total : a.status === 'conflict' ? 'conflict' : (a.saved_at ? 'draft' : 'pending'));
          chip.appendChild(el('span', { class: 'pill ' + (a.status === 'scored' ? 'ok' : a.status === 'conflict' ? 'bad' : 'warn'), title: a.conflict_note || a.feedback || '' }, label));
          var x = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: 'padding:2px 8px', title: 'Remove this juror' }, '×');
          x.addEventListener('click', function () {
            if (a.status === 'scored' && !x.dataset.sure) { x.dataset.sure = '1'; x.textContent = 'Remove score?'; return; }
            act({ op: 'unassign', id: a.id, force: a.status === 'scored' }, 'Removed.');
          });
          chip.appendChild(x); jt.appendChild(chip);
        });
        var add = el('select', { style: 'width:auto;padding:4px 8px;font-size:.82rem', 'aria-label': 'Add a juror' });
        add.appendChild(el('option', { value: '' }, '+ juror'));
        S.jurors.filter(function (j) { return j.status === 'approved'; }).forEach(function (j) { add.appendChild(el('option', { value: j.id }, j.name)); });
        add.addEventListener('change', function () {
          if (!add.value) return;
          act({ op: 'assign', round: it.finalist ? 2 : 1, subject: g[1], subject_id: it.id, juror_id: add.value }, 'Juror added.');
        });
        jt.appendChild(add);
        tr.appendChild(jt);
        tr.appendChild(el('td', null, s.r1 == null ? '' : String(s.r1)));
        var sp = el('td');
        if (s.spread != null) { sp.appendChild(el('span', { class: 'pill ' + (s.spread > 20 ? 'bad' : '') }, String(s.spread))); if (s.spread > 20) sp.appendChild(el('div', { class: 'note' }, 'add a 3rd juror')); }
        tr.appendChild(sp);
        tr.appendChild(el('td', null, s.r2 == null ? '' : String(s.r2)));
        tr.appendChild(el('td', null, s.final == null ? '' : String(s.final)));
        var ft = el('td');
        if (g[1] === 'entry') {
          var fc = el('input', { type: 'checkbox', 'aria-label': 'Finalist' }); fc.checked = !!it.finalist;
          fc.addEventListener('change', function () { act({ op: 'set-result', table: 'award_entries', id: it.id, finalist: fc.checked }, fc.checked ? it.ref + ' marked finalist.' : 'Finalist removed.'); });
          ft.appendChild(fc);
        }
        tr.appendChild(ft);
        var rt = el('td'); var rs = el('select', { style: 'width:auto;padding:4px 8px;font-size:.82rem', 'aria-label': 'Result' });
        RESULTS.forEach(function (r) { var o = el('option', { value: r }, r || '-'); if ((it.result || '') === r) o.selected = true; rs.appendChild(o); });
        rs.addEventListener('change', function () { act({ op: 'set-result', table: g[1] === 'entry' ? 'award_entries' : 'award_nominations', id: it.id, result: rs.value }, 'Result saved.'); });
        rt.appendChild(rs); tr.appendChild(rt);
        t.appendChild(tr);
      });
      tw.appendChild(t); sec.appendChild(tw);
      box.appendChild(sec);
    });
    box.appendChild(el('p', { class: 'note' }, 'Final = 60 per cent of the round 1 average + 40 per cent of the finalist (round 2) average. Hover a score to read that juror’s feedback. A spread above 20 points means a third juror should score it. Ties go to the jury chair.'));

    var dl = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Download results and feedback (CSV)');
    dl.addEventListener('click', csv);
    box.appendChild(dl);
  }

  function csv() {
    var rows = [['ref', 'type', 'category', 'young', 'name', 'title', 'round', 'juror', 'status', 'total', 'scores', 'feedback', 'conflict_note', 'finalist', 'result']];
    function push(subject, it, cat) {
      var mine = S.assignments.filter(function (a) { return a.subject === subject && a.subject_id === it.id; });
      if (!mine.length) rows.push([it.ref, subject, cat, it.young ? 'yes' : '', it.name || it.doctor_name, it.title || '', '', '', '', '', '', '', '', it.finalist ? 'yes' : '', it.result || '']);
      mine.forEach(function (a) { rows.push([it.ref, subject, cat, it.young ? 'yes' : '', it.name || it.doctor_name, it.title || '', a.round, jurorName(a.juror_id), a.status, a.total == null ? '' : a.total, JSON.stringify(a.scores || {}), a.feedback || '', a.conflict_note || '', it.finalist ? 'yes' : '', it.result || '']); });
    }
    S.entries.forEach(function (e) { push('entry', e, e.category); });
    S.nominations.forEach(function (n) { push('nomination', n, 'patients'); });
    var esc = function (v) { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var text = rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n');
    var a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })), download: 'award-scoring-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  window.AwardScoring = {
    show: function (container, apiFn, elFn, flashFn) { box = container; api = apiFn; el = elFn; flash = flashFn; load(); }
  };
})();
