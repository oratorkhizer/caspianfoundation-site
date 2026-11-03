// Scroll-moment analytics: sends to Caspian's own event log, and to GA4 / Vercel if the page has them.
(function(){
  if (window.sigTrack) return;
  var URL_ = "https://gjpbiiqkvzysmdpioexk.supabase.co/functions/v1/moment-event";
  var sent = {};
  function vid(){ try{ var v=localStorage.getItem("sig-vid"); if(!v){ v=Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem("sig-vid",v);} return v; }catch(e){ return "anon"; } }
  window.sigTrack = function(site, ev, meta, repeat){
    if (!repeat) { if (sent[site+ev]) return; sent[site+ev]=1; }
    var body = JSON.stringify({ site:site, event:ev, path:location.pathname, visitor:vid(),
      device: innerWidth<=760 ? "phone":"desk", meta: meta||null });
    try { if (!(navigator.sendBeacon && navigator.sendBeacon(URL_, body))) fetch(URL_, {method:"POST", body:body, keepalive:true}); } catch(e){}
    try { if (window.gtag) gtag("event", "moment_"+ev, Object.assign({ site:site }, meta||{})); } catch(e){}
    try { if (window.va) va("event", { name:"moment_"+ev, data:Object.assign({ site:site }, meta||{}) }); } catch(e){}
  };
})();

/* "One diya, then many". The first frame is the hero (the page's h1 and its
   two actions). Scroll position (p, 0 to 1) then drives the story, so it also
   runs backwards. With reduced motion the section stays as a plain list.
   A returning visitor sees the end state as one ordinary screen, with Replay. */
(function () {
  var SITE = 'foundation', KEY = 'sig-seen-' + SITE;
  var el = document.getElementById('od');
  if (!el) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var stage = el.querySelector('.od-stage');
  var big = el.querySelector('.od-big');
  var hero = el.querySelector('.od-hero');
  var items = el.querySelectorAll('.od-items > li');
  var lamps = el.querySelectorAll('.od-lamps > li');
  var end = el.querySelector('.od-end');
  var skip = el.querySelector('.od-skip');
  var replay = el.querySelector('.od-replay');
  var hdr = document.querySelector('.site-head');
  var N = lamps.length;

  var skipped = false;
  function track(ev, meta, rep) { try { window.sigTrack(SITE, ev, meta, rep); } catch (e) {} }
  function getSeen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function setSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
  function clearSeen() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // The story, as fractions of the pinned section. Every beat hands over to
  // the next with only a sliver of empty text between them.
  // Exactly one text block owns each point of progress; the swap itself is a
  // short CSS fade in time, so wherever the visitor stops the text is readable.
  var HERO_OUT = .076;                    // hero hands over to the intro here
  var FIRST = .17, STEP = .085;           // item i owns [FIRST + i*STEP, FIRST + (i+1)*STEP]
  var END_AT = FIRST + 7 * STEP;          // .765: the last item hands over to the end text
  // The warm light floods the stage in time (not in scroll) once the end is
  // reached, and the end text appears only on the light, so no frame mixes
  // dark text on dark or light text on light.
  var DAWN_MS = 650;
  var own = -1, lit = 0, dawnT = 0, dawnTo = 0, dawnRAF = 0, dawnLast = 0;
  function dawnStep(t) {
    dawnRAF = 0;
    if (!dawnLast) dawnLast = t;
    var dt = Math.min(64, t - dawnLast); dawnLast = t;
    var step = dt / DAWN_MS;
    dawnT = dawnTo > dawnT ? Math.min(dawnTo, dawnT + step) : Math.max(dawnTo, dawnT - step);
    paint();
    if (dawnT !== dawnTo) dawnRAF = requestAnimationFrame(dawnStep);
  }
  function paint() {
    var dawn = ease(dawnT);
    for (var k = 0; k <= N; k++) items[k].classList.toggle('on', own === k && dawnT < .04);
    big.style.setProperty('--gs', (.45 + .9 * lit + 1.2 * dawn).toFixed(3));
    var bo = 1 - clamp(dawnT * 3, 0, 1);
    big.style.setProperty('--bo', bo.toFixed(3));
    el.classList.toggle('od-nophoto', bo < .5);
    big.style.setProperty('--bs', (1 - .12 * dawn).toFixed(3));
    var sr = stage.getBoundingClientRect(), br = big.getBoundingClientRect();
    var fx = br.left - sr.left + br.width / 2, fy = br.top - sr.top + br.height * .42;
    var far = Math.hypot(Math.max(fx, sr.width - fx), Math.max(fy, sr.height - fy));
    var r = dawn * (far + 40) - (1 - dawn) * 160;
    stage.style.setProperty('--fx', fx + 'px');
    stage.style.setProperty('--fy', fy + 'px');
    stage.style.setProperty('--r', r + 'px');
    el.classList.toggle('od-day', dawn > .45);
    // the end text shows once the solid light covers its whole box
    var er = end.getBoundingClientRect();
    var ex = Math.max(Math.abs(er.left - sr.left - fx), Math.abs(er.right - sr.left - fx));
    var ey = Math.max(Math.abs(er.top - sr.top - fy), Math.abs(er.bottom - sr.top - fy));
    end.classList.toggle('on', own === N + 1 && r >= Math.hypot(ex, ey));
  }

  function hdrH() { return hdr ? hdr.offsetHeight : 0; }
  var hdrNow = -1;
  function setHdr() { var h = hdrH(); if (h !== hdrNow) { hdrNow = h; el.style.setProperty('--hdr', h + 'px'); } }
  setHdr();

  // Analytics: clicks on any action inside the moment.
  el.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('a,button') : null;
    if (!t || t === skip || t === replay) return;
    var href = (t.getAttribute('href') || '').split('?')[0];
    track('cta', { label: (t.textContent || '').trim().slice(0, 40), href: href }, true);
  });
  if (skip) skip.addEventListener('click', function (e) {
    skipped = true; setSeen(); track('skip');
    var after = document.getElementById('od-after');
    if (after) {
      e.preventDefault();
      after.scrollIntoView({ behavior: 'instant', block: 'start' });
      try { history.replaceState(null, '', location.pathname + location.search); } catch (x) {}
    }
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (x) { return x.isIntersecting; })) { track('view'); io.disconnect(); }
    });
    io.observe(el);
  } else { track('view'); }

  var live = false, ticking = false, last = -1;

  function frame() {
    ticking = false;
    if (!live) return;
    setHdr();
    var h = hdrNow;
    var total = el.offsetHeight - stage.offsetHeight;
    var p = total > 0 ? clamp(-(el.getBoundingClientRect().top - h) / total, 0, 1) : 0;
    if (Math.abs(p - last) < .0004) return;
    last = p;

    if (!skipped) {
      if (p > .03) track('start');
      if (p >= .5) track('half');
      if (p >= .97) { setSeen(); track('complete'); }
    }

    // Hero first, then the intro, then one programme at a time.
    // which block owns this point: -1 hero, 0 intro, 1..N items, N+1 end
    own = p < HERO_OUT ? -1 : p < FIRST ? 0 : p < END_AT ? 1 + Math.floor((p - FIRST) / STEP) : N + 1;
    lit = seg(p, FIRST, FIRST + N * STEP);
    hero.classList.toggle('off', own !== -1);
    for (var i = 0; i < N; i++) {
      var a = FIRST + i * STEP;
      var l = ease(seg(p, a, a + .03));
      lamps[i].style.setProperty('--l', l.toFixed(3));
      lamps[i].classList.toggle('on', l > .5);
    }
    var want = own === N + 1 ? 1 : 0;
    if (want !== dawnTo) { dawnTo = want; dawnLast = 0; if (!dawnRAF) dawnRAF = requestAnimationFrame(dawnStep); }
    paint();
    stage.style.setProperty('--hint', (1 - seg(p, .02, .07)).toFixed(3));
  }
  function onScroll() { if (live && !ticking) { ticking = true; requestAnimationFrame(frame); } }
  function onResize() { setHdr(); last = -1; onScroll(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver && hdr) { new ResizeObserver(function () { setHdr(); last = -1; onScroll(); }).observe(hdr); }
  window.addEventListener('load', function () { setHdr(); last = -1; onScroll(); });

  function startLive() {
    live = true; last = -1;
    el.classList.remove('od-seen', 'od-day');
    el.classList.add('od-live');
    frame();
  }

  function showSeen() {
    live = false;
    el.classList.add('od-live', 'od-seen', 'od-day');
    hero.style.setProperty('--ho', '1');
    hero.classList.remove('off');
    for (var i = 0; i < N; i++) { lamps[i].style.setProperty('--l', '1'); lamps[i].classList.add('on'); }
    track('seen_return');
  }

  if (replay) replay.addEventListener('click', function () {
    clearSeen();
    track('replay');
    startLive();
    setHdr();
    var y = el.getBoundingClientRect().top + window.pageYOffset - hdrNow;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    last = -1; frame();
    var first = hero.querySelector('a');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
  });

  var wantReplay = /[?&]replay=1(&|$)/.test(location.search);
  if (getSeen() && !wantReplay) showSeen(); else startLive();
})();
