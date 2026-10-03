/* Juror scoring page. The juror's personal token arrives in the link's #fragment (never sent
   to any server log), is kept for this browser session and removed from the address bar. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var token = '';
  var m = location.hash.match(/t=([A-Za-z0-9_-]{20,})/);
  try {
    if (m) { token = m[1]; sessionStorage.setItem('chf-award-juror', token); history.replaceState(null, '', location.pathname); }
    else token = sessionStorage.getItem('chf-award-juror') || '';
  } catch (e) { token = m ? m[1] : ''; }

  var state = null;
  var CAT = { outcomes: 'Outcomes Award', innovation: 'Practice Innovation Award', teaching: 'Clinical Teaching Case Award' };

  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }
  function say(t, type) { var b = $('msg'); b.innerHTML = ''; if (!t) return; var d = el('div', { class: 'msg ' + (type || 'err') }, t); b.appendChild(d); }
  function api(body) {
    body.token = token;
    return fetch('/api/award?op=score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; }); });
  }
  function rubricOf(a) { return a.subject === 'nomination' ? state.rubric.patients : state.rubric[a.item && a.item.category]; }
  function pillFor(a) {
    if (a.status === 'scored') return el('span', { class: 'pill ok' }, 'Submitted, ' + a.total + '/100');
    if (a.status === 'conflict') return el('span', { class: 'pill bad' }, 'Conflict declared');
    if (a.scores && Object.keys(a.scores).length) return el('span', { class: 'pill warn' }, 'Draft saved');
    return el('span', { class: 'pill' }, 'To score');
  }

  function load() {
    if (!token) { say('Open this page from the personal link the secretariat sent you.'); return; }
    api({ action: 'juror_home' }).then(function (j) { state = j; home(); })
      .catch(function (e) { say(e.message); });
  }

  function home() {
    $('item').hidden = true; $('home').hidden = false; say('');
    var list = state.assignments;
    var done = list.filter(function (a) { return a.status !== 'assigned'; }).length;
    $('hello').textContent = 'Welcome, ' + state.juror.name + '. ' + (list.length ? 'You have ' + list.length + ' item' + (list.length > 1 ? 's' : '') + ' to score; ' + done + ' done.' : 'Nothing has been assigned to you yet. The secretariat will tell you when entries are ready.');
    $('prog-bar').style.width = (list.length ? Math.round(done * 100 / list.length) : 0) + '%';
    var box = $('rounds'); box.innerHTML = '';
    [1, 2].forEach(function (r) {
      var mine = list.filter(function (a) { return a.round === r; });
      if (!mine.length) return;
      box.appendChild(el('h2', { style: 'font-size:1.4rem;margin-top:10px' }, r === 1 ? 'Round 1' : 'Finalists (round 2)'));
      if (!state.open[r]) box.appendChild(el('p', { class: 'note' }, 'This round has closed. Scores are now read only.'));
      var wrap = el('div', { class: 'sc-list' });
      mine.forEach(function (a) {
        var it = a.item || {};
        var b = el('button', { type: 'button', class: 'sc-item' });
        var left = el('div');
        left.appendChild(el('h3', null, a.subject === 'nomination' ? 'Patients’ Choice: Dr ' + String(it.doctor_name || '').replace(/^dr\.?\s*/i, '') : (it.title || 'Entry')));
        left.appendChild(el('p', null, (it.ref || '') + '  ·  ' + (a.subject === 'nomination' ? (it.doctor_place || '') + ', ' + (it.doctor_city || '') : (CAT[it.category] || '') + (it.young ? ', Young Changemaker' : ''))));
        b.appendChild(left); b.appendChild(pillFor(a));
        b.addEventListener('click', function () { open(a); });
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    });
  }

  function section(parent, title, text) {
    if (!text) return;
    var d = el('div', { class: 'sec' }); d.appendChild(el('h4', null, title)); d.appendChild(el('p', null, text)); parent.appendChild(d);
  }

  function open(a) {
    say(''); $('home').hidden = true; $('item').hidden = false; window.scrollTo(0, 0);
    var it = a.item || {}, body = $('item-body'); body.innerHTML = '';
    var editable = state.open[a.round] && a.status !== 'conflict';
    var head = el('div', { class: 'card', style: 'box-shadow:none' });
    if (a.subject === 'nomination') {
      head.appendChild(el('p', { class: 'kicker' }, 'Patients’ Choice Award  ·  ' + it.ref));
      head.appendChild(el('h2', { style: 'font-size:1.5rem' }, 'Dr ' + String(it.doctor_name || '').replace(/^dr\.?\s*/i, '')));
      head.appendChild(el('p', { class: 'note' }, (it.doctor_place || '') + ', ' + (it.doctor_city || '') + (it.since_year ? '  ·  treating since ' + it.since_year : '') + '  ·  nominated by ' + (it.relation || 'a patient').toLowerCase()));
      section(head, 'The story, in the nominator’s words', it.story);
      head.appendChild(el('p', { class: 'note' }, 'The secretariat has called the nominator and verified this story.'));
    } else {
      head.appendChild(el('p', { class: 'kicker' }, (CAT[it.category] || '') + (it.young ? ' and Young Changemaker' : '') + '  ·  ' + it.ref + (a.round === 2 ? '  ·  finalist' : '')));
      head.appendChild(el('h2', { style: 'font-size:1.5rem' }, it.title || ''));
      head.appendChild(el('p', { class: 'note' }, [it.name, it.qualification, it.speciality, it.institution, [it.city, it.state].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ')));
      if (it.team) head.appendChild(el('p', { class: 'note' }, 'Team: ' + it.team));
      section(head, 'The problem', it.problem);
      section(head, 'What was done', it.method);
      section(head, 'Results', it.results);
      section(head, 'What other doctors can learn', it.learning);
      var files = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:14px' });
      [['pdf', 'Open supporting PDF', it.has_pdf], ['photo', 'Open photograph', it.has_photo]].forEach(function (f) {
        if (!f[2]) return;
        var b = el('button', { type: 'button', class: 'btn btn-gold btn-sm' }, f[1]);
        b.addEventListener('click', function () {
          var w = window.open('', '_blank');
          api({ action: 'juror_file', assignment_id: a.id, which: f[0] }).then(function (j) { if (w) w.location = j.url; else location.href = j.url; })
            .catch(function (e) { if (w) w.close(); say(e.message); });
        });
        files.appendChild(b);
      });
      head.appendChild(files);
    }
    body.appendChild(head);

    if (a.status === 'conflict') {
      body.appendChild(el('div', { class: 'msg info', style: 'margin-top:18px' }, 'You declared a conflict for this item: "' + (a.conflict_note || '') + '". The secretariat will reassign it. Thank you.'));
      return;
    }

    var rub = rubricOf(a) || [];
    var form = el('form', { class: 'card', style: 'box-shadow:none;margin-top:18px', novalidate: '' });
    form.appendChild(el('h3', null, a.round === 2 ? 'Score the finalist presentation' : 'Your score'));
    var inputs = {};
    rub.forEach(function (c) {
      var row = el('div', { class: 'crit' });
      var lab = el('label', { for: 'c-' + c.key }, c.label); lab.appendChild(el('small', null, 'out of ' + c.max));
      var inp = el('input', { id: 'c-' + c.key, type: 'number', min: '0', max: String(c.max), step: '1', inputmode: 'numeric' });
      if (a.scores && a.scores[c.key] != null) inp.value = a.scores[c.key];
      if (!editable) inp.disabled = true;
      inp.addEventListener('input', sum);
      inputs[c.key] = inp; row.appendChild(lab); row.appendChild(inp); form.appendChild(row);
    });
    var bar = el('div', { class: 'totalbar' });
    bar.appendChild(el('span', null, 'Total'));
    var tot = el('b', null, '0 / 100'); bar.appendChild(tot); form.appendChild(bar);
    var fb = el('div', { class: 'field' });
    fb.appendChild(el('label', { for: 'feedback' }, 'Feedback for the applicant (three to five lines)'));
    var ta = el('textarea', { id: 'feedback', rows: '5' }); ta.value = a.feedback || ''; if (!editable) ta.disabled = true;
    fb.appendChild(ta); form.appendChild(fb);
    var fmsg = el('div', { role: 'status', 'aria-live': 'polite' }); form.appendChild(fmsg);
    function sum() {
      var t = 0, bad = false;
      rub.forEach(function (c) { var v = inputs[c.key].value; if (v === '') return; var n = Number(v); if (n < 0 || n > c.max) { bad = true; inputs[c.key].setAttribute('aria-invalid', 'true'); } else { inputs[c.key].setAttribute('aria-invalid', 'false'); t += n; } });
      tot.textContent = t + ' / 100'; return !bad;
    }
    sum();
    if (editable) {
      var row = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' });
      var save = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Save draft');
      var sub = el('button', { type: 'submit', class: 'btn btn-navy' }, a.status === 'scored' ? 'Update submitted score' : 'Submit score');
      var conf = el('button', { type: 'button', class: 'btn btn-ghost', style: 'margin-left:auto' }, 'I have a conflict');
      row.appendChild(save); row.appendChild(sub); row.appendChild(conf); form.appendChild(row);
      var send = function (submit) {
        if (!sum()) { fmsg.innerHTML = ''; fmsg.appendChild(el('div', { class: 'msg err' }, 'One of the scores is above its maximum.')); return; }
        var scores = {}; rub.forEach(function (c) { if (inputs[c.key].value !== '') scores[c.key] = Number(inputs[c.key].value); });
        fmsg.innerHTML = ''; fmsg.appendChild(el('div', { class: 'msg info' }, 'Saving...'));
        api({ action: 'juror_score', assignment_id: a.id, scores: scores, feedback: ta.value, submit: submit }).then(function (j) {
          a.scores = scores; a.feedback = ta.value; a.total = j.total;
          if (submit) { a.status = 'scored'; a.submitted_at = new Date().toISOString(); }
          fmsg.innerHTML = ''; fmsg.appendChild(el('div', { class: 'msg ok' }, submit ? 'Submitted. Thank you.' : 'Draft saved.'));
          if (submit) setTimeout(home, 900);
        }).catch(function (e) { fmsg.innerHTML = ''; fmsg.appendChild(el('div', { class: 'msg err' }, e.message)); });
      };
      save.addEventListener('click', function () { send(false); });
      form.addEventListener('submit', function (e) { e.preventDefault(); send(true); });
      conf.addEventListener('click', function () {
        var box = form.querySelector('.conf-box');
        if (box) { box.remove(); return; }
        box = el('div', { class: 'conf-box field', style: 'margin-top:14px' });
        box.appendChild(el('label', { for: 'cnote' }, 'How do you know the applicant? (one line, seen only by the secretariat)'));
        var cn = el('input', { id: 'cnote', maxlength: '300' }); box.appendChild(cn);
        var cb = el('button', { type: 'button', class: 'btn btn-navy btn-sm', style: 'margin-top:10px' }, 'Declare conflict and step out');
        cb.addEventListener('click', function () {
          api({ action: 'juror_conflict', assignment_id: a.id, note: cn.value }).then(function () { a.status = 'conflict'; a.conflict_note = cn.value; home(); say('Conflict recorded. The secretariat will reassign that item.', 'ok'); })
            .catch(function (e) { fmsg.innerHTML = ''; fmsg.appendChild(el('div', { class: 'msg err' }, e.message)); });
        });
        box.appendChild(cb); form.appendChild(box); cn.focus();
      });
    } else {
      form.appendChild(el('p', { class: 'note' }, 'This round has closed. Write to info@caspianfoundation.in if a score needs correcting.'));
    }
    body.appendChild(form);
  }

  $('back').addEventListener('click', function () { home(); });
  load();
})();
