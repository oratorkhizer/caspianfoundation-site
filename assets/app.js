(function () {
  var b = document.getElementById('burger'), n = document.getElementById('mainnav');
  if (b && n) {
    b.addEventListener('click', function () { var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o ? 'true' : 'false'); });
    n.addEventListener('click', function (e) { if (e.target.tagName === 'A') { n.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); } });
  }
  var y = document.getElementById('yr');
  if (y) { y.textContent = new Date().getFullYear(); }

  // Asset guard: the approval orders are only shown once the PDFs are actually
  // in place, so the transparency page never offers a download that 404s.
  var docs = document.getElementById('docs');
  if (docs) {
    fetch('/docs/CHF-80G-approval-order.pdf', { method: 'HEAD' })
      .then(function (r) { if (r.ok) { docs.hidden = false; } })
      .catch(function () { /* leave hidden */ });
  }
})();
