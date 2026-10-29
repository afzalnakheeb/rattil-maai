import { SETS, ADHKAR } from '../adhkar.js';
import { getAyahs, audioUrl } from '../quran.js';
import * as store from '../store.js';
import { esc, arNum, todayKey, toast, alive } from '../ui.js';
import { icons } from '../icons.js';

const CIRC = 2 * Math.PI * 60;

export default async function adhkarView(root, params) {
  const defaultSet = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 20 ? 'evening' : 'sleep'; })();
  let advance = null;
  let setId = SETS.some((x) => x.id === params.set) ? params.set : defaultSet;
  let idx = 0;
  let audio = null;
  let playing = false;
  const quranCache = {};

  const key = () => `${todayKey()}:${setId}`;
  const counts = () => store.get().adhkar[key()] || {};
  const list = () => ADHKAR[setId];

  async function quranText(d) {
    const k = `${d.quran.surah}:${d.quran.from}-${d.quran.to}`;
    if (!quranCache[k]) quranCache[k] = await getAyahs(d.quran.surah, d.quran.from, d.quran.to);
    return quranCache[k];
  }

  function stopAudio() {
    playing = false;
    if (audio) { audio.pause(); audio = null; }
    const b = root.querySelector('#play');
    if (b) { b.innerHTML = icons.play; b.setAttribute('aria-label', 'Play recitation'); }
  }

  async function playDhikr(d) {
    if (playing) { stopAudio(); return; }
    if (!d.quran) return;
    const ayahs = await quranText(d);
    let i = 0;
    playing = true;
    const b = root.querySelector('#play');
    if (b) { b.innerHTML = icons.pause; b.setAttribute('aria-label', 'Pause recitation'); }
    const next = () => {
      if (!playing || i >= ayahs.length) { stopAudio(); return; }
      audio = new Audio(audioUrl(store.get().settings.reciter || 'ar.alafasy', ayahs[i].number));
      audio.onended = () => { i++; next(); };
      audio.onerror = () => { toast('Audio could not load.'); stopAudio(); };
      audio.play().catch(() => stopAudio());
    };
    next();
  }

  function render() {
    stopAudio();
    const L = list();
    const c = counts();
    const doneN = L.filter((d) => (c[d.id] || 0) >= d.count).length;
    const d = L[idx];
    const n = Math.min(c[d.id] || 0, d.count);
    const complete = n >= d.count;
    const pct = n / d.count;
    root.innerHTML = `
      <div class="stack">
        <div class="seg full" role="group" aria-label="Adhkar set">
          ${SETS.map((x) => `<button type="button" data-set="${x.id}" aria-pressed="${x.id === setId}">${esc(x.label)}</button>`).join('')}
        </div>
        <div class="stack-s">
          <div class="spread"><span class="small muted">${esc(SETS.find((x) => x.id === setId).note)}</span><span class="small"><b>${doneN} of ${L.length}</b></span></div>
          <div class="bar" aria-hidden="true"><i style="width:${Math.round((doneN / L.length) * 100)}%"></i></div>
        </div>
        <div class="card stack" style="${complete ? 'outline:1.5px solid var(--gold-line)' : ''}">
          <div class="spread">
            <div><h2>${esc(d.title)}</h2><div class="xs muted">Recite ${d.count === 1 ? 'once' : `${d.count} times`} · ${esc(d.source)}</div></div>
            ${d.quran ? `<button class="icon-btn" id="play" type="button" aria-label="Play recitation">${icons.play}</button>` : ''}
          </div>
          <div id="dtext" class="dhikr-text ${d.quran ? '' : 'plain'}" lang="ar">${d.quran ? '<div class="spinner" style="margin:12px auto"></div>' : esc(d.text)}</div>
          <p class="small muted" style="text-align:center">${esc(d.meaning)}</p>
        </div>
        <div class="stack-s" style="align-items:center">
          <button class="counter" id="counter" type="button" aria-label="Count one. ${n} of ${d.count}">
            <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
              <circle class="ring-bg" cx="70" cy="70" r="60" fill="none" stroke-width="9"/>
              <circle class="ring ${complete ? 'done' : ''}" cx="70" cy="70" r="60" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - pct)}" transform="rotate(-90 70 70)"/>
            </svg>
            <span class="num"><b>${n} / ${d.count}</b><span>${complete ? 'Done' : 'Tap after each'}</span></span>
          </button>
          <div class="row-wrap" style="justify-content:center">
            <button class="btn ghost sm" id="prev" type="button" ${idx === 0 ? 'disabled' : ''}>Previous</button>
            <button class="btn ghost sm" id="reset" type="button">Reset</button>
            <button class="btn ghost sm" id="next" type="button" ${idx === L.length - 1 ? 'disabled' : ''}>Next</button>
          </div>
        </div>
        <div class="card dhikr-list" aria-label="All adhkar in this set">
          ${L.map((x, i) => { const cx = Math.min(c[x.id] || 0, x.count); return `<button type="button" data-go="${i}" ${i === idx ? 'aria-current="true"' : ''}><span class="grow" style="${i === idx ? 'font-weight:600' : ''}">${esc(x.title)}</span><span class="small ${cx >= x.count ? '' : 'muted'}" style="${cx >= x.count ? 'color:var(--green);font-weight:600' : ''}">${cx} / ${x.count}${cx >= x.count ? ' ✓' : ''}</span></button>`; }).join('')}
        </div>
        <p class="xs muted" style="text-align:center">Wording and counts from Hisn al-Muslim, pending review by our academic lead. Quran text from the Madinah Mushaf.</p>
      </div>`;

    if (d.quran) {
      quranText(d).then((ayahs) => {
        const el = root.querySelector('#dtext');
        if (!el) return;
        const bas = d.basmala && ayahs[0]?.basmala ? `<div>${esc(ayahs[0].basmala)}</div>` : '';
        el.innerHTML = bas + ayahs.map((a) => `${esc(a.text)} <span class="ayah-end">﴿${arNum(a.ayah)}﴾</span>`).join(' ');
      }).catch(() => { const el = root.querySelector('#dtext'); if (el) el.innerHTML = '<p class="small muted">Could not load the verses. Check your connection.</p>'; });
    }

    root.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => { clearTimeout(advance); setId = b.dataset.set; idx = firstOpen(); render(); }));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { idx = +b.dataset.go; render(); }));
    root.querySelector('#prev').addEventListener('click', () => { idx = Math.max(0, idx - 1); render(); });
    root.querySelector('#next').addEventListener('click', () => { idx = Math.min(list().length - 1, idx + 1); render(); });
    root.querySelector('#reset').addEventListener('click', () => { store.update((s) => { const k = key(); s.adhkar[k] = { ...(s.adhkar[k] || {}), [d.id]: 0 }; }); render(); });
    root.querySelector('#play')?.addEventListener('click', () => playDhikr(d));
    root.querySelector('#counter').addEventListener('click', () => {
      const cur = counts()[d.id] || 0;
      if (cur >= d.count) return;
      store.update((s) => { const k = key(); s.adhkar[k] = { ...(s.adhkar[k] || {}), [d.id]: cur + 1 }; });
      if (navigator.vibrate) navigator.vibrate(cur + 1 >= d.count ? [30, 40, 30] : 15);
      if (cur + 1 >= d.count) {
        store.touchStreak(todayKey());
        const L2 = list();
        const all = L2.every((x) => (counts()[x.id] || 0) >= x.count);
        if (all) toast(`${SETS.find((x) => x.id === setId).label} adhkar complete. Allahumma barik.`);
        else if (idx < L2.length - 1) {
          clearTimeout(advance);
          const fromSet = setId;
          advance = setTimeout(() => { if (!alive(root) || setId !== fromSet) return; idx = nextOpen(idx); render(); }, 450);
        }
      }
      render();
    });
  }

  function firstOpen() {
    const c = counts();
    const i = list().findIndex((x) => (c[x.id] || 0) < x.count);
    return i < 0 ? 0 : i;
  }
  function nextOpen(from) {
    const c = counts();
    const L = list();
    for (let i = from + 1; i < L.length; i++) if ((c[L[i].id] || 0) < L[i].count) return i;
    return Math.min(from + 1, L.length - 1);
  }

  idx = firstOpen();
  render();
  return () => { clearTimeout(advance); stopAudio(); };
}
