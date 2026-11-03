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
  var HERO_OUT = [.05, .085];
  var INTRO = [.09, .17];                 // "It starts with one light."
  var FIRST = .17, STEP = .085;           // item i owns [FIRST + i*STEP, FIRST + (i+1)*STEP]
  var DAWN = [.74, .86];                  // the warm light floods the stage
  var END_IN = [.77, .815];

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
  if (skip) skip.addEventListener('click', function () { skipped = true; setSeen(); track('skip'); });

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
    var ho = 1 - seg(p, HERO_OUT[0], HERO_OUT[1]);
    hero.style.setProperty('--ho', ho.toFixed(3));
    hero.classList.toggle('off', ho < .05);
    items[0].style.setProperty('--o', Math.min(seg(p, INTRO[0], INTRO[0] + .015), 1 - seg(p, INTRO[1] - .012, INTRO[1] - .002)).toFixed(3));
    for (var i = 0; i < N; i++) {
      var a = FIRST + i * STEP, b = a + STEP;
      var o = Math.min(seg(p, a + .004, a + .016), 1 - seg(p, b - .012, b - .002));
      items[i + 1].style.setProperty('--o', o.toFixed(3));
      var l = ease(seg(p, a, a + .03));
      lamps[i].style.setProperty('--l', l.toFixed(3));
      lamps[i].classList.toggle('on', l > .5);
    }

    // The glow of the first diya grows as each lamp lights, then the light floods in.
    var lit = seg(p, FIRST, FIRST + N * STEP);
    var dawn = ease(seg(p, DAWN[0], DAWN[1]));
    big.style.setProperty('--gs', (.45 + .9 * lit + 1.2 * dawn).toFixed(3));
    big.style.setProperty('--bo', (1 - seg(p, DAWN[0], DAWN[0] + .035)).toFixed(3));
    big.style.setProperty('--bs', (1 - .12 * dawn).toFixed(3));

    var sr = stage.getBoundingClientRect(), br = big.getBoundingClientRect();
    var fx = br.left - sr.left + br.width / 2, fy = br.top - sr.top + br.height * .42;
    var far = Math.hypot(Math.max(fx, sr.width - fx), Math.max(fy, sr.height - fy));
    stage.style.setProperty('--fx', fx + 'px');
    stage.style.setProperty('--fy', fy + 'px');
    stage.style.setProperty('--r', (dawn * (far + 40) - (1 - dawn) * 160) + 'px');
    el.classList.toggle('od-day', dawn > .45);

    var eo = ease(seg(p, END_IN[0], END_IN[1]));
    end.style.setProperty('--eo', eo.toFixed(3));
    end.classList.toggle('on', eo > .05);
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
