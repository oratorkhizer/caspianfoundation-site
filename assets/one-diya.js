/* "One diya, then many". Scroll position (p, 0 to 1) drives everything, so it
   also runs backwards. With reduced motion the section stays as a plain list. */
(function () {
  var el = document.getElementById('od');
  if (!el) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var stage = el.querySelector('.od-stage');
  var big = el.querySelector('.od-big');
  var items = el.querySelectorAll('.od-items > li');
  var lamps = el.querySelectorAll('.od-lamps > li');
  var end = el.querySelector('.od-end');
  var hdr = document.querySelector('.site-head');
  var N = lamps.length;

  el.classList.add('od-live');

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // The story, as fractions of the pinned section.
  var INTRO_OUT = [.06, .1];
  var FIRST = .1, STEP = .095;            // item i owns [FIRST + i*STEP, FIRST + (i+1)*STEP]
  var DAWN = [.8, .93];                   // the warm light floods the stage
  var END_IN = [.85, .9];

  function hdrH() { return hdr ? hdr.offsetHeight : 0; }
  var hdrNow = -1;
  function setHdr() { var h = hdrH(); if (h !== hdrNow) { hdrNow = h; el.style.setProperty('--hdr', h + 'px'); } }
  setHdr();
  if (window.ResizeObserver && hdr) { new ResizeObserver(function () { setHdr(); last = -1; onScroll(); }).observe(hdr); }
  window.addEventListener('load', function () { setHdr(); last = -1; onScroll(); });

  var ticking = false, last = -1;
  function frame() {
    ticking = false;
    setHdr();
    var h = hdrNow;
    var total = el.offsetHeight - stage.offsetHeight;
    var p = total > 0 ? clamp(-(el.getBoundingClientRect().top - h) / total, 0, 1) : 0;
    if (Math.abs(p - last) < .0004) return;
    last = p;

    // Intro, then one programme at a time.
    items[0].style.setProperty('--o', (1 - seg(p, INTRO_OUT[0], INTRO_OUT[1])).toFixed(3));
    for (var i = 0; i < N; i++) {
      var a = FIRST + i * STEP, b = a + STEP;
      var o = Math.min(seg(p, a + .005, a + .03), 1 - seg(p, b - .025, b));
      if (i === N - 1) o = Math.min(seg(p, a + .005, a + .03), 1 - seg(p, DAWN[0] - .005, DAWN[0] + .02));
      items[i + 1].style.setProperty('--o', o.toFixed(3));
      var l = ease(seg(p, a, a + .035));
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
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function onResize() { setHdr(); last = -1; onScroll(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  frame();
})();
