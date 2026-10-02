/* Diabesity Changemakers Award forms: entry (apply), patient nomination (nominate), jury (juror).
   Files go straight from the browser to private storage through a one-time signed upload URL,
   so they never pass through our server. The form is saved as a draft on this device. */
(function () {
  var form = document.getElementById('award-form');
  if (!form) return;
  var kind = form.getAttribute('data-kind');
  var msg = document.getElementById('form-msg');
  var btn = document.getElementById('submit');
  var DRAFT = 'chf-award-draft-' + kind;
  var LIMITS = { 'entry-pdf': 5, 'entry-photo': 2, 'juror-cv': 5 };

  function $(id) { return document.getElementById(id); }
  function say(text, type) {
    msg.innerHTML = '';
    if (!text) return;
    var d = document.createElement('div');
    d.className = 'msg ' + (type || 'err');
    d.textContent = text;
    msg.appendChild(d);
    if (type !== 'info') d.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* councils */
  var COUNCILS = ['National Medical Commission (Indian Medical Register)', 'Andhra Pradesh Medical Council', 'Arunachal Pradesh Medical Council', 'Assam Medical Council', 'Bihar Medical Council', 'Chhattisgarh Medical Council', 'Delhi Medical Council', 'Goa Medical Council', 'Gujarat Medical Council', 'Haryana Medical Council', 'Himachal Pradesh Medical Council', 'Jammu and Kashmir Medical Council', 'Jharkhand Medical Council', 'Karnataka Medical Council', 'Travancore Cochin Medical Council (Kerala)', 'Madhya Pradesh Medical Council', 'Maharashtra Medical Council', 'Manipur Medical Council', 'Meghalaya Medical Council', 'Mizoram Medical Council', 'Nagaland Medical Council', 'Odisha Council of Medical Registration', 'Punjab Medical Council', 'Rajasthan Medical Council', 'Sikkim Medical Council', 'Tamil Nadu Medical Council', 'Telangana State Medical Council', 'Tripura State Medical Council', 'Uttar Pradesh Medical Council', 'Uttarakhand Medical Council', 'West Bengal Medical Council', 'Other'];
  Array.prototype.forEach.call(form.querySelectorAll('[data-councils]'), function (sel) {
    var first = document.createElement('option');
    first.value = ''; first.textContent = sel.hasAttribute('data-optional') ? 'Not applicable' : 'Choose your council';
    sel.appendChild(first);
    COUNCILS.forEach(function (c) { var o = document.createElement('option'); o.textContent = c; sel.appendChild(o); });
  });

  /* utm, kept for the session */
  var utm = {};
  try {
    var q = new URLSearchParams(location.search);
    ['source', 'medium', 'campaign', 'ref'].forEach(function (k) { var v = q.get(k === 'ref' ? 'ref' : 'utm_' + k); if (v) utm[k] = v.slice(0, 80); });
    if (Object.keys(utm).length) sessionStorage.setItem('chf-award-utm', JSON.stringify(utm));
    else utm = JSON.parse(sessionStorage.getItem('chf-award-utm') || '{}');
  } catch (e) { utm = {}; }

  /* young changemaker toggle */
  var young = $('young');
  function syncYoung() { if (young) { $('qual-year-wrap').hidden = !young.checked; } }
  if (young) young.addEventListener('change', syncYoung);

  /* word counter */
  var wordFields = form.querySelectorAll('[data-words]');
  function countWords(s) { s = (s || '').trim(); return s ? s.split(/\s+/).length : 0; }
  function totalWords() { var t = 0; Array.prototype.forEach.call(wordFields, function (f) { t += countWords(f.value); }); return t; }
  function syncCount() {
    var c = $('wordcount'); if (!c) return;
    var t = totalWords();
    c.textContent = t + ' of 500 words';
    c.classList.toggle('over', t > 500);
  }
  Array.prototype.forEach.call(wordFields, function (f) { f.addEventListener('input', syncCount); });

  /* draft */
  function saveDraft() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name && !el.id) return;
      if (el.type === 'file' || el.classList.contains('hp')) return;
      var key = el.id || el.name;
      if (el.type === 'radio') { if (el.checked) d['radio:' + el.name] = el.value; }
      else if (el.type === 'checkbox') d[key] = el.checked;
      else d[key] = el.value;
    });
    try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) { /* storage off */ }
  }
  function loadDraft() {
    var d;
    try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { d = null; }
    if (!d) return;
    Object.keys(d).forEach(function (k) {
      if (k.indexOf('radio:') === 0) {
        var r = form.querySelector('input[type=radio][name="' + k.slice(6) + '"][value="' + d[k] + '"]');
        if (r) r.checked = true;
        return;
      }
      var el = $(k) || form.elements[k];
      if (!el || el.type === 'file') return;
      if (el.type === 'checkbox') el.checked = !!d[k]; else el.value = d[k];
    });
  }
  loadDraft(); syncYoung(); syncCount();
  var t;
  form.addEventListener('input', function () { clearTimeout(t); t = setTimeout(saveDraft, 400); });
  form.addEventListener('change', saveDraft);

  /* files */
  function setState(box, text, ok) {
    var s = box.querySelector('.fstate');
    s.textContent = text; s.classList.toggle('ok', !!ok);
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[type=file][data-file]'), function (input) {
    input.addEventListener('change', function () {
      var box = input.closest('.filebox');
      input.removeAttribute('data-path');
      var f = input.files && input.files[0];
      if (!f) { setState(box, ''); return; }
      var fk = input.getAttribute('data-file');
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      var okExt = fk === 'entry-photo' ? ['jpg', 'jpeg', 'png', 'webp'] : ['pdf'];
      if (okExt.indexOf(ext) < 0) { setState(box, 'Please choose a ' + okExt.join(' or ').toUpperCase() + ' file.'); input.value = ''; return; }
      if (f.size > LIMITS[fk] * 1048576) { setState(box, 'This file is ' + (f.size / 1048576).toFixed(1) + ' MB. The limit is ' + LIMITS[fk] + ' MB.'); input.value = ''; return; }
      setState(box, 'Uploading ' + f.name + '...');
      input.setAttribute('data-uploading', '1');
      fetch('/api/award?op=upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: fk, ext: ext, size: f.size }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Upload could not start.'); return j; }); })
        .then(function (j) {
          return fetch(j.url, { method: 'PUT', headers: { 'Content-Type': f.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'), 'x-upsert': 'false' }, body: f })
            .then(function (r) { if (!r.ok) throw new Error('The upload did not finish. Please try again.'); return j.path; });
        })
        .then(function (path) {
          input.setAttribute('data-path', path);
          setState(box, 'Uploaded: ' + f.name, true);
        })
        .catch(function (e) { setState(box, e.message || 'Upload failed. Please try again.'); input.value = ''; })
        .then(function () { input.removeAttribute('data-uploading'); });
    });
  });

  /* helpers */
  function val(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function phone(id) {
    var cc = (val('cc') || '+91').replace(/[^\d+]/g, '');
    var n = val(id).replace(/[^\d]/g, '');
    if (!n) return '';
    return cc === '+91' || cc === '91' ? n : (cc.charAt(0) === '+' ? cc : '+' + cc) + n;
  }
  function mark(el, bad) { if (el) el.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
  function decls() {
    var d = {};
    Array.prototype.forEach.call(form.querySelectorAll('[data-decl]'), function (c) { d[c.getAttribute('data-decl')] = c.checked; });
    return d;
  }
  function requiredMissing() {
    var first = null;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      if (el.type === 'file') return;
      var bad;
      if (el.type === 'radio') bad = !form.querySelector('input[name="' + el.name + '"]:checked');
      else if (el.type === 'checkbox') bad = !el.checked;
      else bad = !el.value.trim();
      if (el.type !== 'radio') mark(el, bad);
      if (bad && !first) first = el;
    });
    return first;
  }

  /* submit */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    say('');
    if (form.querySelector('[data-uploading]')) { say('Please wait for the file to finish uploading.', 'info'); return; }
    var miss = requiredMissing();
    if (miss) {
      say(miss.type === 'radio' ? 'Please choose a category.' : miss.type === 'checkbox' ? 'Please tick every declaration.' : 'Please fill in the fields marked with a star.');
      if (miss.focus) miss.focus();
      return;
    }
    var payload, op = kind, hp = (form.elements.website && form.elements.website.value) || '';
    if (kind === 'apply') {
      if (totalWords() > 500) { say('The summary is ' + totalWords() + ' words. Please keep it within 500.'); return; }
      if (young && young.checked && !(Number(val('qual_year')) >= 2019)) { say('Please give the year of your highest qualification, 2019 or later.'); $('qual_year').focus(); return; }
      var pdf = $('pdf').getAttribute('data-path');
      if (!pdf) { say('Please upload your supporting PDF.'); $('pdf').focus(); return; }
      var cat = form.querySelector('input[name=category]:checked');
      payload = { entry: {
        category: cat ? cat.value : '', young: !!(young && young.checked), qual_year: val('qual_year'),
        name: val('name'), qualification: val('qualification'), speciality: val('speciality'),
        reg_no: val('reg_no'), council: val('council'), institution: val('institution'),
        city: val('city'), state: val('state'), phone: phone('phone'), email: val('email'),
        title: val('title'), problem: val('problem'), method: val('method'), results: val('results'),
        learning: val('learning'), team: val('team'), pdf_path: pdf,
        photo_path: $('photo').getAttribute('data-path') || '', declarations: decls(), website: hp
      } };
    } else if (kind === 'nominate') {
      if (countWords(val('story')) < 30) { say('Please tell us a little more, at least 30 words, about how the doctor helped.'); $('story').focus(); return; }
      payload = { nomination: {
        nominator_name: val('nominator_name'), relation: val('relation'), nominator_phone: phone('nominator_phone'),
        nominator_email: val('nominator_email'), city: val('ncity'), doctor_name: val('doctor_name'),
        doctor_place: val('doctor_place'), doctor_city: val('doctor_city'), since_year: val('since_year'),
        story: val('story'), consent: $('consent').checked, website: hp
      } };
    } else {
      var exp = Array.prototype.map.call(form.querySelectorAll('#expertise input:checked'), function (c) { return c.value; });
      if (!exp.length) { say('Please choose at least one area of expertise.'); return; }
      var cv = $('cv').getAttribute('data-path');
      if (!cv) { say('Please upload your CV as a PDF.'); $('cv').focus(); return; }
      payload = { juror: {
        name: val('name'), qualification: val('qualification'), speciality: val('speciality'), pg_year: val('pg_year'),
        reg_no: val('reg_no'), council: val('council'), designation: val('designation'), institution: val('institution'),
        city: val('city'), state: val('state'), phone: phone('phone'), email: val('email'), expertise: exp,
        roles: val('roles'), conflicts: val('conflicts'), linkedin: val('linkedin'), cv_path: cv,
        declarations: decls(), website: hp
      } };
    }
    payload.utm = utm;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = kind === 'apply' ? 'Saving your entry...' : 'Sending...';
    fetch('/api/award?op=' + op, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; }); })
      .then(function (j) {
        try { localStorage.removeItem(DRAFT); } catch (e) { /* ignore */ }
        if (kind === 'apply') {
          say('Entry ' + j.ref + ' saved. Taking you to Razorpay to pay Rs 999...', 'info');
          location.href = j.url;
        } else {
          location.href = '/award-thanks?type=' + (kind === 'nominate' ? 'nomination' : 'juror') + '&ref=' + encodeURIComponent(j.ref);
        }
      })
      .catch(function (e) {
        say(e.message);
        btn.disabled = false;
        btn.textContent = label;
      });
  });
})();
