(function () {
  var stage = document.getElementById('stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var bar = document.querySelector('#bar i');
  var showAll = /[?&]all=1/.test(location.search);
  var current = 0;

  if (showAll) document.documentElement.classList.add('all');
  slides.forEach(function (s) { s.setAttribute('data-total', slides.length); });

  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = 'scale(' + s + ') translate(-50%, -50%)';
  }

  function all(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  // A slide may hold a stack of pictures (one visible at a time) and a set of
  // boxes or columns to light up one after another. Each press of "next" walks
  // through the pictures, then the lights, then moves to the next slide.
  function paneCount(slide) { return slide.querySelectorAll('.pane').length; }
  function spotCount(slide) {
    return all(slide, '[data-spot]').reduce(function (m, el) {
      return Math.max(m, parseInt(el.getAttribute('data-spot'), 10));
    }, 0);
  }

  function setPane(slide, n) {
    slide._pane = n;
    all(slide, '.pane').forEach(function (el, i) {
      el.classList.toggle('top', i === n);
      if (el.tagName !== 'VIDEO') return;
      if (i === n && slide === slides[current]) {
        el.currentTime = 0;
        var p = el.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        el.pause();
      }
    });
    all(slide, '.tab').forEach(function (t, i) { t.classList.toggle('active', i === n); });
  }

  function setSpot(slide, n) {
    slide._spot = n;
    all(slide, '[data-spot]').forEach(function (el) {
      el.classList.toggle('lit', parseInt(el.getAttribute('data-spot'), 10) === n);
    });
  }

  function countUp(slide) {
    all(slide, '[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var suffix = el.getAttribute('data-suffix') || '';
      if (showAll || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = target.toFixed(dec) + suffix;
        return;
      }
      var start = null;
      function frame(t) {
        if (start === null) start = t;
        var p = Math.min(1, (t - start) / 900);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dec) + (p === 1 ? suffix : '');
        if (p < 1 && slides[current] === slide) requestAnimationFrame(frame);
        else el.textContent = target.toFixed(dec) + suffix;
      }
      requestAnimationFrame(frame);
    });
  }

  // fromBehind: true when arriving with the back key, so the slide opens on its last picture
  function show(n, fromBehind) {
    current = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (el, i) {
      el.classList.toggle('on', i === current);
      if (i !== current) all(el, 'video').forEach(function (v) { v.pause(); });
    });
    var slide = slides[current];
    setPane(slide, fromBehind ? Math.max(0, paneCount(slide) - 1) : 0);
    setSpot(slide, 0);
    countUp(slide);
    bar.style.width = ((current + 1) / slides.length * 100) + '%';
    if (location.hash !== '#' + (current + 1)) history.replaceState(null, '', '#' + (current + 1));
  }

  function next() {
    var slide = slides[current];
    if (slide._pane < paneCount(slide) - 1) { setPane(slide, slide._pane + 1); return; }
    if (slide._spot < spotCount(slide)) { setSpot(slide, slide._spot + 1); return; }
    if (current < slides.length - 1) show(current + 1);
  }

  function prev() {
    var slide = slides[current];
    if (slide._spot > 0) { setSpot(slide, slide._spot - 1); return; }
    if (slide._pane > 0) { setPane(slide, slide._pane - 1); return; }
    if (current > 0) show(current - 1, true);
  }

  function fullScreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  // Click a screenshot to see it at full size; any click or key closes it
  var zoom = document.createElement('div');
  zoom.id = 'zoom';
  zoom.hidden = true;
  zoom.appendChild(document.createElement('img'));
  document.body.appendChild(zoom);
  function openZoom(img) {
    zoom.firstChild.src = img.currentSrc || img.src;
    zoom.firstChild.alt = img.alt;
    zoom.hidden = false;
  }
  zoom.addEventListener('click', function () { zoom.hidden = true; });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!zoom.hidden) { zoom.hidden = true; e.preventDefault(); return; }
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); prev(); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1); break;
      case 'f': case 'F': fullScreen(); break;
    }
  });

  // Click the right two thirds to go on, the left third to go back
  stage.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (tab) { setPane(slides[current], parseInt(tab.getAttribute('data-pane'), 10)); return; }
    if (e.target.closest('a, button')) return;
    if (e.target.matches('.shot img')) { openZoom(e.target); return; }
    if (e.clientX < window.innerWidth / 3) prev(); else next();
  });

  var touchX = null;
  document.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
  });

  document.getElementById('next').addEventListener('click', next);
  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('full').addEventListener('click', fullScreen);
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n && n - 1 !== current) show(n - 1);
  });

  // every stack starts on its first picture, also for the printed copy
  slides.forEach(function (s) { s._spot = 0; setPane(s, 0); });
  fit();
  show((parseInt(location.hash.slice(1), 10) || 1) - 1);

  // ?pane=N and ?spot=N open the first slide shown in that state (for checking a layout)
  var q = /[?&]pane=(\d+)/.exec(location.search);
  if (q) setPane(slides[current], parseInt(q[1], 10));
  q = /[?&]spot=(\d+)/.exec(location.search);
  if (q) setSpot(slides[current], parseInt(q[1], 10));
})();
