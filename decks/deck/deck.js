import { SCENES, paintScene } from './scenes.js';
import { STARTS, CAPTIONS, LEAD, DURATION } from './timeline.js';

const film = new URLSearchParams(location.search).get('mode') === 'film';
const LIST = film ? SCENES.filter((s) => !s.deckOnly) : SCENES;
const host = document.getElementById('scenes');
host.innerHTML = LIST.map((s) => `<section class="scene" data-id="${s.id}" aria-label="${s.id}">${s.html}</section>`).join('');
const els = [...host.children];
const stage = document.getElementById('stage');
const pattern = document.getElementById('pattern');
const caption = document.getElementById('caption');

function fit() {
  if (film) { stage.style.transform = 'none'; return; }
  const bar = document.getElementById('deckbar').offsetHeight || 0;
  const s = Math.min(innerWidth / 1920, (innerHeight - bar) / 1080);
  stage.style.position = 'absolute'; stage.style.left = '50%'; stage.style.top = '50%';
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  document.getElementById('viewport').style.bottom = `${bar}px`;
}
addEventListener('resize', fit);

function ambient(t) { pattern.style.transform = `translate(${(t * 6) % 120}px, ${(t * 3) % 120}px)`; }

if (film) {
  // Film: a pure function of time, for frame-by-frame rendering.
  document.body.style.overflow = 'hidden';
  const order = LIST.map((s) => s.id);
  const starts = order.map((id) => (id === 'title' ? 0 : LEAD + STARTS[id]));
  window.__film = {
    duration: DURATION,
    seek(t) {
      ambient(t);
      els.forEach((el, i) => {
        const a = starts[i], b = i + 1 < starts.length ? starts[i + 1] : DURATION + 1;
        const fadeIn = i === 0 ? 1 : Math.min(1, Math.max(0, (t - (a - 0.3)) / 0.5));
        const fadeOut = Math.min(1, Math.max(0, ((b + 0.2) - t) / 0.5));
        const o = Math.min(fadeIn, fadeOut);
        el.style.opacity = String(o);
        el.style.visibility = o > 0 ? 'visible' : 'hidden';
        if (o > 0) paintScene(el, order[i], Math.max(0, t - a));
      });
      const vt = t - LEAD;
      const c = CAPTIONS.find(([s, e]) => vt >= s - 0.05 && vt <= e + 0.25);
      caption.textContent = c ? c[2] : '';
      return document.fonts.ready;
    },
  };
  fit();
  window.__film.seek(0);
} else {
  // Deck: one slide at a time; each slide plays its build, then rests.
  document.getElementById('deckbar').hidden = false;
  caption.remove();
  const dots = document.getElementById('dots');
  dots.innerHTML = els.map(() => '<i></i>').join('');
  let i = 0; let t0 = performance.now();
  try { const h = location.hash.match(/^#s(\d+)$/); if (h) i = Math.min(els.length - 1, Math.max(0, +h[1] - 1)); } catch { /* ignore */ }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(n) {
    i = (n + els.length) % els.length; t0 = performance.now();
    els.forEach((el, k) => { el.classList.toggle('show', k === i); el.style.opacity = k === i ? '1' : '0'; el.style.visibility = k === i ? 'visible' : 'hidden'; });
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    document.getElementById('count').textContent = `${i + 1} / ${els.length}`;
    try { history.replaceState(null, '', `#s${i + 1}`); } catch { /* ignore */ }
  }
  function frame(now) {
    const t = reduce ? 60 : (now - t0) / 1000;
    paintScene(els[i], LIST[i].id, t);
    ambient(now / 1000);
    requestAnimationFrame(frame);
  }
  document.getElementById('next').onclick = () => show(i + 1);
  document.getElementById('prev').onclick = () => show(i - 1);
  document.getElementById('replay').onclick = () => show(i);
  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(i + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(i - 1); }
  });
  stage.addEventListener('click', (e) => { const r = stage.getBoundingClientRect(); show(e.clientX < r.left + r.width / 3 ? i - 1 : i + 1); });
  let sx = null;
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1); sx = null; });
  fit(); show(i); requestAnimationFrame(frame);
}
