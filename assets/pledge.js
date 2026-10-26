/* Diabetes Promise (/pledge).
   Flow: who it is for, an optional Indian Diabetes Risk Score, one promise, a name, then a card
   drawn on a canvas in the page (nothing is uploaded), shared through the phone's share sheet or
   WhatsApp. The back end is the pledge-api Supabase function in the Foundation's project. */
(function () {
  'use strict';
  var API = 'https://itqxfypvrvwplzeeldaz.supabase.co/functions/v1/pledge-api';
  var SITE = 'https://caspianfoundation.in';
  var started = Date.now();
  var $ = function (id) { return document.getElementById(id); };
  var form = $('plform');
  if (!form) return;

  /* ---------------- The promises ---------------- */
  // {n} is the person the promise is for. "line" completes "I promise to ...".
  var P = {
    self_dm: [
      ['feet', 'check my feet every day', 'Nerve damage can hide a small cut. A daily look catches it before it becomes an ulcer.'],
      ['hba1c', 'test my HbA1c every three months', 'HbA1c shows your average sugar over about three months. It is the number that guides treatment.'],
      ['eyes', 'get my eyes checked every year', 'Early diabetic eye damage gives no warning. A retina check with dilating drops finds it in time.'],
      ['kidneys', 'get my kidneys tested every year', 'A urine albumin test and a blood creatinine test pick up kidney damage years before symptoms.'],
      ['heart', 'know and control my BP and cholesterol', 'Heart disease is the leading cause of death in diabetes. These numbers matter as much as sugar.'],
      ['medicines', 'take my medicines as advised and never stop them on my own', 'Stopping medicines without the doctor is one of the commonest reasons sugar goes out of control.']
    ],
    loved_one: [
      ['feet', "check {n}'s feet every day", 'Nerve damage can hide a small cut. A daily look by someone who cares catches it early.'],
      ['hba1c', 'make sure {n} gets an HbA1c test every three months', 'HbA1c shows the average sugar over about three months. It is the number the doctor needs.'],
      ['eyes', 'take {n} for an eye check every year', 'Early diabetic eye damage gives no warning. A retina check with dilating drops finds it in time.'],
      ['kidneys', "get {n}'s kidneys tested every year", 'A urine albumin test and a blood creatinine test pick up kidney damage years before symptoms.'],
      ['heart', 'help {n} keep BP and cholesterol in check', 'Heart disease is the leading cause of death in diabetes. These numbers matter as much as sugar.'],
      ['medicines', 'help {n} take every medicine on time', 'Missed or stopped medicines are one of the commonest reasons sugar goes out of control.'],
      ['walk_with', 'walk with {n}, 30 minutes, five days a week', 'Walking together is easier to keep up, and it helps both of you.']
    ],
    self_prevent: [
      ['test', 'get my blood sugar tested this year', 'Many people in India with diabetes do not yet know they have it. One fasting sugar or HbA1c test settles it.'],
      ['walk', 'walk 30 minutes, five days a week', 'Regular walking lowers the chance of developing diabetes in people at risk.'],
      ['drinks', 'give up sugary drinks', 'Sugary drinks, packaged juices included, raise sugar quickly and add calories without filling you.'],
      ['waist', 'bring my waist into the healthy range', 'For Indians, a waist above 90 cm in men or 80 cm in women raises diabetes risk, even at a normal weight.'],
      ['family_test', "get my parents' blood sugar tested", 'If a parent has diabetes, your own risk is higher. Testing them protects the whole family.']
    ]
  };
  function promiseWhy(path, key) {
    var list = P[path] || [];
    for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][2];
    return '';
  }
  function promiseLine(path, key, who) {
    var list = P[path] || [];
    for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1].replace(/\{n\}/g, who || 'them');
    return '';
  }

  /* ---------------- Small helpers ---------------- */
  function post(body) {
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); });
  }
  function clean(s, max) {
    return String(s || '').replace(/[<>]/g, '').replace(/\u2014/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function normalisePhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    else if (d.length === 13 && d.indexOf('091') === 0) d = d.slice(3);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function fmtDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
  function linkFor(code) { return SITE + '/pledge?r=' + code; }
  function track(name, data) { try { if (window.va) window.va('event', { name: name, data: data || {} }); } catch (e) { /* ignore */ } }

  var qs = new URLSearchParams(location.search);
  var ref = (qs.get('r') || '').toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(ref)) ref = '';
  var group = clean(qs.get('g'), 40).toLowerCase().replace(/[^a-z0-9-]/g, '');
  var utm = {
    source: clean(qs.get('utm_source'), 60) || (ref ? 'friend' : ''),
    medium: clean(qs.get('utm_medium'), 60),
    campaign: group ? 'group:' + group : clean(qs.get('utm_campaign'), 60)
  };
  var mine = load('chf_promises', []);

  /* ---------------- Live count (shown only once it is meaningful) ---------------- */
  post({ action: 'stats' }).then(function (j) {
    if (j && j.count) {
      var c = $('plcount');
      c.innerHTML = '<b>' + Number(j.count).toLocaleString('en-IN') + '</b> promises made so far';
      c.hidden = false;
    }
  }).catch(function () { /* the page works without it */ });

  /* ---------------- A shared link: whose promise is it? ---------------- */
  if (ref) {
    post({ action: 'card', code: ref }).then(function (j) {
      if (!j || j._status !== 200) return;
      var own = mine.some(function (m) { return m.code === ref; });
      var line = promiseLine(j.path, j.promise, j.dedicated_to);
      if (own) {
        showMine(j);
      } else {
        var t = $('reftext');
        t.textContent = j.name + ' promised to ' + line + (j.path !== 'loved_one' && j.dedicated_to ? ', for ' + j.dedicated_to : '') + '. Will you make yours?';
        $('refbanner').hidden = false;
      }
    }).catch(function () { /* ignore */ });
  }

  /* ---------------- Steps ---------------- */
  var state = { path: '', risk: null, band: null, promise: '', who: '' };
  var steps = form.querySelectorAll('.pl-step');
  var dots = document.querySelectorAll('.pl-steps li');
  function go(n) {
    steps.forEach(function (s) { s.hidden = s.getAttribute('data-step') !== String(n); });
    dots.forEach(function (d) {
      var k = Number(d.getAttribute('data-s'));
      d.classList.toggle('on', k === n);
      d.classList.toggle('done', k < n);
    });
    var top = $('promise').getBoundingClientRect().top + window.scrollY - 80;
    if (Math.abs(window.scrollY - top) > 200) window.scrollTo({ top: top, behavior: 'smooth' });
    var first = form.querySelector('.pl-step[data-step="' + n + '"] legend');
    if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
  }
  form.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () { go(Number(b.getAttribute('data-back'))); });
  });

  // Step 1
  form.querySelectorAll('input[name="path"]').forEach(function (r) {
    r.addEventListener('change', function () {
      state.path = r.value;
      $('lovedbox').hidden = r.value !== 'loved_one';
      $('riskbox').hidden = r.value !== 'self_prevent';
      if (r.value === 'loved_one') setTimeout(function () { $('dedicated').focus(); }, 50);
    });
  });
  $('chips').addEventListener('click', function (e) {
    if (e.target.tagName === 'BUTTON') { $('dedicated').value = e.target.textContent; clearMsg(); $('dedicated').focus(); }
  });

  /* ---------------- Indian Diabetes Risk Score ----------------
     Age <35: 0, 35-49: 20, 50+: 30. Waist (women <80, 80-89, 90+; men <90, 90-99, 100+): 0/10/20.
     Activity: vigorous 0, moderate 10, mild 20, sedentary 30. Parents: neither 0, one 10, both 20.
     60 or more high, 30 to 50 moderate, under 30 low. */
  var ans = {};
  var WAIST = {
    f: [['0', 'Under 80 cm (about 31 inches)'], ['10', '80 to 89 cm (about 31 to 35 inches)'], ['20', '90 cm or more (35 inches or more)']],
    m: [['0', 'Under 90 cm (about 35 inches)'], ['10', '90 to 99 cm (about 35 to 39 inches)'], ['20', '100 cm or more (39 inches or more)']]
  };
  function seg(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      el.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var q = el.getAttribute('data-q');
      ans[q] = b.getAttribute('data-v');
      if (q === 'sex') {
        delete ans.waist;
        var box = $('waistopts');
        box.innerHTML = '';
        WAIST[ans.sex].forEach(function (w) {
          var x = document.createElement('button');
          x.type = 'button'; x.setAttribute('data-v', w[0]); x.setAttribute('aria-pressed', 'false'); x.textContent = w[1];
          box.appendChild(x);
        });
        $('waistq').hidden = false;
      }
      scoreRisk();
    });
  }
  document.querySelectorAll('.pl-seg').forEach(function (el) {
    el.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    seg(el);
  });
  function scoreRisk() {
    var box = $('riskresult');
    if (ans.age == null || ans.waist == null || ans.act == null || ans.fam == null) { box.hidden = true; state.band = null; return; }
    var s = Number(ans.age) + Number(ans.waist) + Number(ans.act) + Number(ans.fam);
    var band = s >= 60 ? 'high' : s >= 30 ? 'moderate' : 'low';
    state.risk = s; state.band = band;
    var lab = '<a href="https://caspianlabs.in/" rel="noopener">book a blood sugar test at Caspian Diagnostic Centre</a>';
    var msg = {
      low: ['Low risk', 'Your score is ' + s + ' out of 100. Keep the habits that got you here, and check your sugar if anything changes.'],
      moderate: ['Moderate risk', 'Your score is ' + s + ' out of 100. A simple blood test, fasting sugar or HbA1c, is a good idea this year. In Hyderabad you can ' + lab + '.'],
      high: ['High risk', 'Your score is ' + s + ' out of 100. Please get a blood sugar test (fasting sugar or HbA1c) soon. Some people at this score already have diabetes without knowing it. In Hyderabad you can ' + lab + '.']
    }[band];
    box.className = 'pl-risk ' + band;
    box.innerHTML = '<h3>' + msg[0] + '</h3><p>' + msg[1] + '</p><div class="bar" aria-hidden="true"><i style="left:' + s + '%"></i></div><div class="scale" aria-hidden="true"><span>0</span><span>30</span><span>60</span><span>100</span></div>';
    box.hidden = false;
    track('pledge_risk', { band: band });
  }

  $('next1').addEventListener('click', function () {
    if (!state.path) return nudge(form.querySelector('.pl-who'), 'Choose who this promise is for.');
    if (state.path === 'loved_one') {
      state.who = clean($('dedicated').value, 30);
      if (state.who.length < 2) return nudge($('dedicated'), 'Write who it is for. Ammi, Abba, or a name.');
    } else { state.who = ''; }
    renderPromises();
    go(2);
  });

  function renderPromises() {
    var box = $('promises');
    box.innerHTML = '';
    var pre = state.path === 'self_prevent' && (state.band === 'moderate' || state.band === 'high') ? 'test' : '';
    if (state.promise && P[state.path].some(function (p) { return p[0] === state.promise; })) pre = state.promise;
    else state.promise = pre;
    P[state.path].forEach(function (p) {
      var l = document.createElement('label');
      var i = document.createElement('input');
      i.type = 'radio'; i.name = 'promise'; i.value = p[0]; i.checked = p[0] === pre;
      i.addEventListener('change', function () { state.promise = p[0]; });
      var b = document.createElement('b');
      var line = p[1].replace(/\{n\}/g, state.who);
      b.textContent = 'I promise to ' + line;
      var s = document.createElement('span');
      s.textContent = p[2];
      l.appendChild(i); l.appendChild(b); l.appendChild(s);
      box.appendChild(l);
    });
  }

  $('next2').addEventListener('click', function () {
    if (!state.promise) return nudge($('promises'), 'Choose one promise.');
    $('dedself').hidden = state.path === 'loved_one';
    preview();
    go(3);
    setTimeout(function () { $('pname').focus(); }, 60);
  });

  function dedication() {
    if (state.path === 'loved_one') return 'for ' + state.who;
    var d = clean($('dedself_in').value, 30);
    if (!d) return '';
    return /^for\s/i.test(d) ? d.charAt(0).toLowerCase() + d.slice(1) : 'for ' + d;
  }
  function preview() {
    var name = clean($('pname').value, 32) || 'Your name';
    var ded = dedication();
    var el = $('preview');
    el.innerHTML = '';
    var sm = document.createElement('small'); sm.textContent = 'YOUR CARD WILL SAY';
    el.appendChild(sm);
    el.appendChild(document.createTextNode('“I promise to ' + promiseLine(state.path, state.promise, state.who) + '.” '));
    if (ded && state.path !== 'loved_one') { var em = document.createElement('em'); em.textContent = ded + ' '; el.appendChild(em); }
    var nm = document.createElement('b'); nm.textContent = name; el.appendChild(nm);
  }
  $('pname').addEventListener('input', preview);
  $('dedself_in').addEventListener('input', preview);
  $('phone').addEventListener('input', function () {
    if ($('phone').value.trim() && !$('consent').checked) $('consent').checked = true;
  });

  function nudge(el, text) {
    var step = form.querySelector('.pl-step:not([hidden])');
    var m = step && step.querySelector('.msg.err');
    if (m) { m.textContent = text; m.hidden = false; }
    if (el && el.setAttribute) el.setAttribute('aria-invalid', 'true');
    setTimeout(function () { if (el && el.removeAttribute) el.removeAttribute('aria-invalid'); }, 2500);
    if (el && el.focus) el.focus({ preventScroll: true });
    if (m && m.scrollIntoView) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  // Clear the message while the visitor fixes things. Not on 'change' of a text box: that fires on
  // blur, and a message vanishing between mousedown and mouseup moves the button out from under the click.
  function clearMsg() {
    var step = form.querySelector('.pl-step:not([hidden])');
    var m = step && step.querySelector('.msg.err');
    if (m) m.hidden = true;
  }
  form.addEventListener('input', clearMsg);
  form.addEventListener('change', function (e) { if (e.target.type === 'radio' || e.target.type === 'checkbox') clearMsg(); });

  /* ---------------- Submit ---------------- */
  var current = null;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    $('formmsg').hidden = true;
    var name = clean($('pname').value, 32);
    if (name.length < 2) return nudge($('pname'), 'Write your name as you want it on the card.');
    var rawPhone = $('phone').value.trim();
    var phone = '';
    if (rawPhone) {
      phone = normalisePhone(rawPhone);
      if (!phone) return nudge($('phone'), 'That does not look like a 10 digit mobile number. You can also leave it empty.');
      if (!$('consent').checked) return nudge($('consent'), 'Tick the box to get the reminders, or leave the number empty.');
    }
    var ded = dedication();
    var btn = $('submit');
    btn.disabled = true; btn.textContent = 'Saving your promise...';
    post({
      action: 'submit', path: state.path, promise: state.promise, name: name,
      dedicated_to: state.path === 'loved_one' ? state.who : ded.replace(/^for\s+/i, ''),
      risk_band: state.band, phone: phone, consent: !!(phone && $('consent').checked),
      ref: ref, utm: utm, website: form.website.value, ms: Date.now() - started
    }).then(function (j) {
      btn.disabled = false; btn.textContent = 'Make my promise';
      if (!j || j._status !== 200 || !j.code) { $('formmsg').textContent = (j && j.error) || 'Could not save. Please try again.'; $('formmsg').hidden = false; return; }
      current = {
        code: j.code, no: j.pledge_no, name: name, path: state.path, promise: state.promise,
        who: state.who, ded: ded, date: j.created_at
      };
      mine = mine.filter(function (m) { return m.code !== j.code; });
      mine.unshift({ code: j.code, name: name });
      store('chf_promises', mine.slice(0, 20));
      track('pledge_made', { path: state.path, promise: state.promise });
      showDone();
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Make my promise';
      $('formmsg').textContent = 'No connection. Please check your internet and try again.'; $('formmsg').hidden = false;
    });
  });

  /* ---------------- The card ---------------- */
  var logo = new Image();
  var logoReady = new Promise(function (res) { logo.onload = res; logo.onerror = res; });
  logo.src = '/chf-logo.png';
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 80px "Crimson Pro"'),
      document.fonts.load('italic 600 60px "Crimson Pro"'),
      document.fonts.load('700 30px Karla'),
      document.fonts.load('500 30px Karla')
    ]).catch(function () {});
  }
  function wrap(ctx, text, max) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }
  function draw(c, fmt) {
    var W = 1080, H = fmt === 'story' ? 1920 : 1350;
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    var JADE = '#2a7f62', SAND = '#f2cc8f', CREAM = '#fbf1e1', INK = '#23463b', MUTED = '#5a776d', GOLD = '#9a6a24';
    var serif = '"Crimson Pro", Georgia, serif', sans = 'Karla, Arial, sans-serif';
    x.fillStyle = CREAM; x.fillRect(0, 0, W, H);
    // header
    var hh = fmt === 'story' ? 260 : 190;
    x.fillStyle = JADE; x.fillRect(0, 0, W, hh);
    x.fillStyle = SAND; x.fillRect(0, hh, W, 10);
    if (logo.naturalWidth) {
      var lh = 92, lw = logo.naturalWidth * lh / logo.naturalHeight;
      var ly = fmt === 'story' ? 110 : (hh - lh - 24) / 2;
      x.fillStyle = '#fff';
      roundRect(x, 70, ly, lw + 36, lh + 24, 14); x.fill();
      x.drawImage(logo, 88, ly + 12, lw, lh);
    }
    x.textAlign = 'right'; x.fillStyle = SAND; x.font = '700 30px ' + sans;
    var ky = fmt === 'story' ? 160 : hh / 2 - 6;
    x.fillText('WORLD DIABETES DAY', W - 70, ky);
    x.fillStyle = '#ffffff'; x.font = '500 28px ' + sans;
    x.fillText('14 November', W - 70, ky + 40);
    x.textAlign = 'left';

    // body
    var left = 90, maxw = W - 180;
    var y = hh + (fmt === 'story' ? 200 : 110);
    x.fillStyle = JADE; x.font = '700 32px ' + sans;
    spaced(x, 'MY DIABETES PROMISE', left, y, 4);
    y += 40;
    x.fillStyle = SAND; x.fillRect(left, y, 90, 6);
    y += 70;
    var text = 'I promise to ' + promiseLine(current.path, current.promise, current.who) + '.';
    var size = fmt === 'story' ? 96 : 84, lines;
    for (;;) {
      x.font = '700 ' + size + 'px ' + serif;
      lines = wrap(x, text, maxw);
      if (lines.length <= (fmt === 'story' ? 6 : 5) || size <= 54) break;
      size -= 6;
    }
    x.fillStyle = JADE;
    var lh2 = Math.round(size * 1.12);
    lines.forEach(function (l) { x.fillText(l, left, y + size * 0.8); y += lh2; });
    var ded = current.path === 'loved_one' ? '' : current.ded;
    if (ded) {
      y += 18;
      x.font = 'italic 600 58px ' + serif; x.fillStyle = GOLD;
      wrap(x, ded, maxw).slice(0, 2).forEach(function (l) { x.fillText(l, left, y + 46); y += 66; });
    }
    // signature block, pinned above the footer
    var fh = fmt === 'story' ? 230 : 170;
    var sy = H - fh - (fmt === 'story' ? 270 : 200);
    if (sy < y + 40) sy = y + 40;
    // "Why it matters": the line that makes the card teach something to whoever sees the status.
    var why = promiseWhy(current.path, current.promise);
    var room = sy - y - 80;
    if (why && room >= 190) {
      var wsize = fmt === 'story' ? 38 : 32;
      x.font = '500 ' + wsize + 'px ' + sans;
      var wl = wrap(x, why, maxw - 64);
      var ph = 64 + 30 + wl.length * Math.round(wsize * 1.35) + 6;
      if (ph <= room) {
        var py = y + Math.max(46, (room - ph) / 2 + 20);
        x.fillStyle = '#f3e2c2';
        roundRect(x, left, py, maxw, ph, 18); x.fill();
        x.fillStyle = JADE; x.fillRect(left, py, 8, ph);
        x.font = '700 24px ' + sans;
        spaced(x, 'WHY IT MATTERS', left + 36, py + 52, 3);
        x.fillStyle = INK; x.font = '500 ' + wsize + 'px ' + sans;
        var wy = py + 52 + 22 + wsize;
        wl.forEach(function (l) { x.fillText(l, left + 36, wy); wy += Math.round(wsize * 1.35); });
      }
    }
    x.strokeStyle = '#d9c7a6'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(left, sy); x.lineTo(W - 90, sy); x.stroke();
    x.fillStyle = MUTED; x.font = '600 26px ' + sans;
    spaced(x, 'SIGNED', left, sy + 46, 3);
    x.fillStyle = INK; x.font = 'italic 600 64px ' + serif;
    var nm = current.name;
    while (x.measureText(nm).width > maxw && nm.length > 4) nm = nm.slice(0, -1);
    x.fillText(nm, left, sy + 116);
    x.fillStyle = MUTED; x.font = '500 26px ' + sans;
    x.fillText('Promise no. ' + Number(current.no).toLocaleString('en-IN') + '   ·   ' + fmtDate(current.date), left, sy + 160);
    // footer
    x.fillStyle = JADE; x.fillRect(0, H - fh, W, fh);
    x.textAlign = 'center';
    x.fillStyle = SAND; x.font = '700 30px ' + sans;
    x.fillText('Make yours in a minute', W / 2, H - fh + fh * 0.40);
    x.fillStyle = '#ffffff'; x.font = '700 46px ' + sans;
    x.fillText('caspianfoundation.in/pledge', W / 2, H - fh + fh * 0.40 + 58);
    x.textAlign = 'left';
  }
  function spaced(x, t, px, py, sp) {
    for (var i = 0; i < t.length; i++) { x.fillText(t[i], px, py); px += x.measureText(t[i]).width + sp; }
  }
  function roundRect(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }

  var fmt = 'post', canvas = document.createElement('canvas');
  function render(img) {
    return Promise.all([logoReady, fontsReady()]).then(function () {
      draw(canvas, fmt);
      img.width = canvas.width; img.height = canvas.height;
      img.src = canvas.toDataURL('image/jpeg', 0.92);
    });
  }
  function blob() {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, 'image/jpeg', 0.92); });
  }
  function fileName() { return 'diabetes-promise-' + current.code + (fmt === 'story' ? '-status' : '') + '.jpg'; }
  function shareText() {
    var line = promiseLine(current.path, current.promise, current.who);
    var ded = current.path === 'loved_one' ? '' : (current.ded ? ', ' + current.ded : '');
    return 'I just made my Diabetes Promise: I promise to ' + line + ded + '.\n\nWorld Diabetes Day is on 14 November. Make yours, it takes one minute:\n' + linkFor(current.code);
  }
  function download() {
    return blob().then(function (b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  }
  function shareCard() {
    return blob().then(function (b) {
      var file = new File([b], fileName(), { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        track('pledge_share', { via: 'sheet' });
        return navigator.share({ files: [file], text: shareText() }).catch(function () { /* cancelled */ });
      }
      // No file sharing (most desktops): save the card, then open WhatsApp with the text.
      track('pledge_share', { via: 'download' });
      return download().then(function () { openWa(); });
    });
  }
  function openWa() {
    track('pledge_share', { via: 'whatsapp' });
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
  }
  function copyLink() {
    var t = linkFor(current.code);
    var done = function () { $('copymsg').hidden = false; setTimeout(function () { $('copymsg').hidden = true; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { window.prompt('Copy your link', t); });
    else window.prompt('Copy your link', t);
  }

  var TIPS = {
    feet: '<b>To keep it:</b> look at the soles and between the toes every night, use a mirror or ask someone. Show any cut, blister or colour change to a doctor the same week.',
    hba1c: '<b>To keep it:</b> set a phone reminder for three months from today. In Hyderabad, <a href="https://caspianlabs.in/" rel="noopener">Caspian Diagnostic Centre</a> does HbA1c.',
    eyes: '<b>To keep it:</b> ask for a dilated retina check, not only a glasses test. Do not drive yourself home after the drops.',
    kidneys: '<b>To keep it:</b> ask for a urine albumin (ACR) test and a serum creatinine. In Hyderabad, <a href="https://caspianlabs.in/" rel="noopener">Caspian Diagnostic Centre</a> does both.',
    heart: '<b>To keep it:</b> write down your last BP and cholesterol numbers and ask your doctor what yours should be.',
    medicines: '<b>To keep it:</b> keep a weekly pill box, and never stop or change a medicine without asking your doctor first.',
    walk_with: '<b>To keep it:</b> fix a time, after dinner works for many families, and walk together even on busy days.',
    test: '<b>To keep it:</b> a fasting blood sugar or an HbA1c is enough to start. In Hyderabad, <a href="https://caspianlabs.in/" rel="noopener">Caspian Diagnostic Centre</a> does both.',
    walk: '<b>To keep it:</b> fix a time of day and a route. Three walks of ten minutes count too.',
    drinks: '<b>To keep it:</b> remember that packaged juices, colas and sweet tea or coffee count. Water, buttermilk and unsweetened tea do not.',
    waist: '<b>To keep it:</b> measure at the navel once a month. Healthy is below 90 cm for men and below 80 cm for women.',
    family_test: '<b>To keep it:</b> pick a date this month. A fasting sugar or an HbA1c is enough to start. In Hyderabad, <a href="https://caspianlabs.in/" rel="noopener">Caspian Diagnostic Centre</a> does both.'
  };

  function showDone() {
    form.hidden = true;
    dots.forEach(function (d) { d.classList.remove('on'); d.classList.add('done'); });
    $('done').hidden = false;
    $('donetitle').textContent = 'Thank you, ' + current.name.split(' ')[0] + '. Now pass it on.';
    $('tip').innerHTML = '<p>' + (TIPS[current.promise] || '') + '</p>';
    fmt = 'post';
    document.querySelectorAll('.pl-fmt button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-fmt') === fmt ? 'true' : 'false'); });
    render($('cardimg'));
    $('done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('.pl-fmt button').forEach(function (b) {
    b.addEventListener('click', function () {
      fmt = b.getAttribute('data-fmt');
      document.querySelectorAll('.pl-fmt button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render($('cardimg'));
    });
  });
  $('share').addEventListener('click', shareCard);
  $('wa').addEventListener('click', openWa);
  $('dl').addEventListener('click', function () { track('pledge_download', { fmt: fmt }); download(); });
  $('copy').addEventListener('click', copyLink);
  $('again').addEventListener('click', function (e) {
    e.preventDefault();
    form.reset();
    state = { path: '', risk: null, band: null, promise: '', who: '' };
    ans = {};
    document.querySelectorAll('.pl-seg button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    $('riskresult').hidden = true; $('waistq').hidden = true; $('lovedbox').hidden = true; $('riskbox').hidden = true;
    $('done').hidden = true; form.hidden = false; started = Date.now();
    go(1);
  });

  /* ---------------- Returning owner of a shared link ---------------- */
  function showMine(j) {
    current = { code: j.code, no: j.pledge_no, name: j.name, path: j.path, promise: j.promise,
      who: j.path === 'loved_one' ? j.dedicated_to : '', ded: j.path === 'loved_one' ? '' : (j.dedicated_to ? 'for ' + j.dedicated_to : ''), date: j.created_at };
    $('mine').hidden = false;
    $('minetitle').textContent = 'Your promise, ' + j.name.split(' ')[0] + '.';
    $('mineinsp').textContent = j.inspired === 0
      ? 'Nobody has made a promise through your link yet. Send it to two people today.'
      : j.inspired === 1 ? 'One person has made a promise through your link. Thank you.'
        : j.inspired + ' people have made a promise through your link. Thank you.';
    fmt = 'post';
    render($('mineimg'));
    $('mineshare').onclick = shareCard;
    $('minewa').onclick = openWa;
  }

  /* ---------------- Group and clinic links ---------------- */
  function slug(s) { return clean(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  $('gname').addEventListener('input', function () {
    var s = slug($('gname').value);
    $('glinkbox').hidden = !s;
    $('glink').textContent = s ? SITE + '/pledge?g=' + s : '';
  });
  $('gcopy').addEventListener('click', function () {
    var t = $('glink').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('gcopy').textContent = 'Copied'; setTimeout(function () { $('gcopy').textContent = 'Copy link'; }, 2000); });
    else window.prompt('Copy the link', t);
  });
  $('gwa').addEventListener('click', function () {
    var t = 'World Diabetes Day is on 14 November. Let us all make one Diabetes Promise, for ourselves or for someone we love. It takes one minute:\n' + $('glink').textContent;
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
  });
  $('doccopy').addEventListener('click', function () {
    var t = SITE + '/pledge?utm_source=clinic';
    var done = function () { $('docmsg').hidden = false; setTimeout(function () { $('docmsg').hidden = true; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { window.prompt('Copy the link', t); });
    else window.prompt('Copy the link', t);
  });
})();
