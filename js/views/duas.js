import { CATEGORIES, findCategory, searchDuas, reviewed, REVIEW_NOTE, RUQYAH_NOTE } from '../duas.js';
import { getAyahs, audioUrl } from '../quran.js';
import * as store from '../store.js';
import { esc, arNum, todayKey, toast } from '../ui.js';
import { icons } from '../icons.js';

// Routes: #/duas · #/duas?c=<categoryId> · #/duas?c=<categoryId>&i=<index>
const CIRC = 2 * Math.PI * 60;

const STYLE = `<style>
.duas-search { background: var(--card); color: var(--ink); border-color: var(--line); }
.duas-ruq-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.duas-ruq { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: var(--radius); background: var(--gold-tint); border: 1px solid var(--line); color: var(--ink); text-decoration: none; min-width: 0; }
.duas-ruq:hover { color: var(--ink); border-color: var(--gold); }
.duas-ruq .duas-ar-title { font-family: var(--ar); color: var(--gold-ink); font-weight: 600; font-size: 15px; }
.duas-list a.list-item { color: var(--ink); text-decoration: none; border-top-color: var(--line); }
.duas-list a.list-item:first-child { border-top: 0; }
.duas-list .chev { color: var(--muted); display: inline-flex; flex: none; }
.duas-list .chev svg { width: 18px; height: 18px; }
.duas-num { width: 30px; height: 30px; border-radius: 15px; flex: none; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 600; background: var(--green-tint); color: var(--green); }
.duas-num.done { background: var(--green); color: var(--card); }
.duas-sub-ar { font-family: var(--ar); color: var(--green); font-size: 14px; }
.duas-back { display: inline-flex; align-items: center; gap: 4px; color: var(--green); text-decoration: none; font-size: 14px; font-weight: 600; }
.duas-back svg { width: 18px; height: 18px; }
.duas-text { direction: rtl; color: var(--ink); overflow-wrap: anywhere; }
.duas-text.quran { font-size: 25px; line-height: 2.2; text-align: justify; text-align-last: center; }
.duas-text.ar { font-size: 21px; line-height: 2; font-weight: 500; text-align: center; }
.duas-text .duas-basmala { text-align: center; text-align-last: center; }
.duas-text .ayah-end { color: var(--gold-ink); }
.duas-ayah { border-radius: 8px; -webkit-box-decoration-break: clone; box-decoration-break: clone; transition: background 0.3s; }
.duas-ayah.playing { background: var(--green-tint); }
.duas-ref { display: flex; flex-wrap: wrap; gap: 6px; }
.duas-counter.counter { background: var(--card); }
.duas-counter .ring-bg { stroke: var(--line); }
.duas-counter .ring-fg { stroke: var(--gold); transition: stroke-dashoffset 0.25s; }
.duas-counter.done .ring-fg { stroke: var(--green); }
.duas-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
.duas-nav .btn { background: var(--card); color: var(--ink); border-color: var(--line); }
.duas-nav .btn svg { width: 16px; height: 16px; }
.duas-nav > :last-child { justify-self: end; }
.duas-nav > :first-child { justify-self: start; }
.duas-panel { border: 1px solid var(--line); }
.duas-ruq-note { background: var(--gold-tint); border: 1px solid var(--line); color: var(--ink); }
</style>`;

const catHref = (c) => `#/duas?c=${encodeURIComponent(c)}`;
const itemHref = (c, i) => `#/duas?c=${encodeURIComponent(c)}&i=${i}`;
const quranRef = (q) => `${q.surah}:${q.from}${q.to > q.from ? `–${q.to}` : ''}`;
const timesLabel = (n) => (n === 1 ? 'Recite once' : `Recite ${n} times`);
const reviewLine = () => (reviewed ? '' : `<p class="xs muted" style="text-align:center">${esc(REVIEW_NOTE)} Quran text from the Madinah Mushaf.</p>`);

export default async function duasView(root, params = {}) {
  let audio = null;
  let playing = false;
  let advanceTimer = null;
  let alive = true;
  const quranCache = {};

  const cat = params.c ? findCategory(params.c) : null;
  const hasIdx = cat && params.i !== undefined && params.i !== '';
  const idx = hasIdx ? Math.min(cat.items.length - 1, Math.max(0, parseInt(params.i, 10) || 0)) : -1;

  const countKey = (c) => `${todayKey()}:duas-${c.id}`;
  const counts = (c) => store.get().adhkar?.[countKey(c)] || {};

  async function quranText(item) {
    const q = item.quran;
    const k = `${q.surah}:${q.from}-${q.to}`;
    if (!quranCache[k]) quranCache[k] = getAyahs(q.surah, q.from, q.to).catch((e) => { delete quranCache[k]; throw e; });
    return quranCache[k];
  }

  function setPlayBtn(on) {
    const b = root.querySelector('#duasPlay');
    if (!b) return;
    b.innerHTML = `${on ? icons.stop : icons.play}<span>${on ? 'Stop' : 'Listen'}</span>`;
    b.setAttribute('aria-pressed', String(on));
  }

  function stopAudio() {
    playing = false;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio = null; }
    root.querySelectorAll('.duas-text .duas-ayah.playing').forEach((el) => el.classList.remove('playing'));
    setPlayBtn(false);
  }

  async function play(item) {
    if (playing) { stopAudio(); return; }
    let ayahs;
    try { ayahs = await quranText(item); } catch { toast('Could not load the verses. Check your connection.'); return; }
    if (!alive) return;
    const reciterId = store.get().settings?.reciter || 'ar.husary';
    let i = 0;
    playing = true;
    setPlayBtn(true);
    const step = () => {
      root.querySelectorAll('.duas-text .duas-ayah.playing').forEach((el) => el.classList.remove('playing'));
      if (!playing || !alive || i >= ayahs.length) { stopAudio(); return; }
      root.querySelector(`.duas-text .duas-ayah[data-n="${ayahs[i].number}"]`)?.classList.add('playing');
      audio = new Audio(audioUrl(reciterId, ayahs[i].number));
      audio.onended = () => { i++; step(); };
      audio.onerror = () => { toast('Audio could not load.'); stopAudio(); };
      audio.play().catch(() => stopAudio());
    };
    step();
  }

  // ---------- landing ----------
  function renderLanding() {
    const ruq = CATEGORIES.filter((c) => c.kind === 'ruqyah');
    const duas = CATEGORIES.filter((c) => c.kind !== 'ruqyah');
    root.innerHTML = `${STYLE}
      <div class="stack">
        <div class="page-head">
          <span class="eyebrow">Hisn al-Muslim</span>
          <div class="spread"><h1>Duas &amp; Ruqyah</h1><span class="duas-sub-ar" lang="ar" dir="rtl">الأدعية والرقية</span></div>
        </div>
        <div>
          <label class="sr-only" for="duasQ">Search duas</label>
          <input class="input duas-search" id="duasQ" type="search" placeholder="Search: travel, anxiety, parents…" autocomplete="off" enterkeyhint="search">
        </div>
        <div id="duasResults" class="stack" hidden></div>
        <div id="duasBrowse" class="stack">
          <div class="stack-s">
            <span class="eyebrow">Ruqyah</span>
            <div class="duas-ruq-grid">
              ${ruq.map((c) => `
                <a class="duas-ruq" href="${catHref(c.id)}">
                  <span class="icon-tile gold" style="background:var(--card)">${icons.book}</span>
                  <b>${esc(c.title)}</b>
                  <span class="duas-ar-title" lang="ar" dir="rtl">${esc(c.ar)}</span>
                  <span class="xs muted">${c.items.length} items</span>
                </a>`).join('')}
            </div>
            <p class="xs muted">${esc(RUQYAH_NOTE)}</p>
          </div>
          <div class="stack-s">
            <span class="eyebrow">Duas</span>
            <div class="card duas-list">
              ${duas.map((c) => `
                <a class="list-item" href="${catHref(c.id)}">
                  <span class="icon-tile">${icons.beads}</span>
                  <span class="grow"><b style="display:block">${esc(c.title)}</b>
                    <span class="spread" style="gap:8px"><span class="xs muted">${c.items.length} ${c.items.length === 1 ? 'dua' : 'duas'}</span><span class="duas-sub-ar" lang="ar" dir="rtl">${esc(c.ar)}</span></span></span>
                  <span class="chev">${icons.next}</span>
                </a>`).join('')}
            </div>
          </div>
        </div>
        ${reviewLine()}
      </div>`;

    const q = root.querySelector('#duasQ');
    const results = root.querySelector('#duasResults');
    const browse = root.querySelector('#duasBrowse');
    q.addEventListener('input', () => {
      const term = q.value.trim();
      if (!term) { results.hidden = true; browse.hidden = false; results.innerHTML = ''; return; }
      const found = searchDuas(term);
      browse.hidden = true;
      results.hidden = false;
      results.innerHTML = found.length
        ? `<div class="small muted">${found.length} ${found.length === 1 ? 'result' : 'results'}</div>
           <div class="card duas-list">${found.map(({ category, item, index }) => `
             <a class="list-item" href="${itemHref(category.id, index)}">
               <span class="grow"><b style="display:block">${esc(item.title)}</b>
                 <span class="xs muted">${esc(category.title)} · ${esc(item.quran ? `Quran ${quranRef(item.quran)}` : item.source)}</span></span>
               <span class="chev">${icons.next}</span>
             </a>`).join('')}</div>`
        : '<div class="empty card">No duas match that search.</div>';
    });
  }

  // ---------- category ----------
  function renderCategory(c) {
    const cn = counts(c);
    root.innerHTML = `${STYLE}
      <div class="stack">
        <a class="duas-back" href="#/duas">${icons.prev}<span>All duas</span></a>
        <div class="page-head">
          <span class="eyebrow">${c.kind === 'ruqyah' ? 'Ruqyah' : 'Duas'}</span>
          <div class="spread" style="align-items:baseline"><h1>${esc(c.title)}</h1><span class="duas-sub-ar" lang="ar" dir="rtl">${esc(c.ar)}</span></div>
          ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ''}
        </div>
        ${c.kind === 'ruqyah' ? `<div class="notice duas-ruq-note">${esc(RUQYAH_NOTE)}</div>
          <div><a class="btn" href="${itemHref(c.id, 0)}">${icons.play}<span>Start from the beginning</span></a></div>` : ''}
        <div class="card duas-list">
          ${c.items.map((it, i) => {
            const n = Math.min(cn[it.id] || 0, it.count);
            const done = it.count > 1 && n >= it.count;
            return `
            <a class="list-item" href="${itemHref(c.id, i)}">
              <span class="duas-num ${done ? 'done' : ''}" aria-hidden="true">${done ? '✓' : i + 1}</span>
              <span class="grow"><b style="display:block">${esc(it.title)}</b>
                <span class="xs muted">${esc(it.quran ? `Quran ${quranRef(it.quran)}` : it.source)}</span></span>
              ${it.count > 1 ? `<span class="chip ${done ? '' : 'gold'}">${it.count > 1 && n ? `${n}/` : '×'}${it.count}</span>` : ''}
              <span class="chev">${icons.next}</span>
            </a>`;
          }).join('')}
        </div>
        ${reviewLine()}
      </div>`;
  }

  // ---------- reader ----------
  function renderReader(c, i) {
    stopAudio();
    const it = c.items[i];
    const n = Math.min(counts(c)[it.id] || 0, it.count);
    const complete = n >= it.count;
    const last = i === c.items.length - 1;
    root.innerHTML = `${STYLE}
      <div class="stack">
        <div class="spread">
          <a class="duas-back" href="${catHref(c.id)}">${icons.prev}<span>${esc(c.title)}</span></a>
          <span class="small muted">${i + 1} of ${c.items.length}</span>
        </div>
        ${c.kind === 'ruqyah' && i === 0 ? `<div class="notice duas-ruq-note">${esc(RUQYAH_NOTE)}</div>` : ''}
        <div class="card stack duas-panel" style="${it.count > 1 && complete ? 'border-color:var(--green)' : ''}">
          <div class="spread" style="align-items:flex-start">
            <div class="grow"><h2>${esc(it.title)}</h2>
              <div class="xs muted">${timesLabel(it.count)}</div></div>
            ${it.quran ? `<button class="btn sm gold" id="duasPlay" type="button" aria-pressed="false" aria-label="Listen to the recitation">${icons.play}<span>Listen</span></button>` : ''}
          </div>
          <div id="duasText" class="duas-text ${it.quran ? 'quran' : 'ar'}" dir="rtl" lang="ar">${it.quran ? '<div class="spinner" style="margin:12px auto"></div>' : esc(it.arabic)}</div>
          <p class="small" style="color:var(--ink)">${esc(it.meaning)}</p>
          ${it.note ? `<p class="xs muted">${esc(it.note)}</p>` : ''}
          <div class="duas-ref"><span class="chip">${esc(it.source)}</span>${it.count > 1 ? `<span class="chip gold">×${it.count}</span>` : ''}</div>
        </div>
        ${it.count > 1 ? `
        <div class="stack-s" style="align-items:center">
          <button class="counter duas-counter ${complete ? 'done' : ''}" id="duasCounter" type="button" aria-label="Count one. ${n} of ${it.count}">
            <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
              <circle class="ring-bg" cx="70" cy="70" r="60" fill="none" stroke-width="9"/>
              <circle class="ring-fg" cx="70" cy="70" r="60" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - n / it.count)}" transform="rotate(-90 70 70)"/>
            </svg>
            <span class="num"><b>${n} / ${it.count}</b><span>${complete ? 'Done' : 'Tap after each'}</span></span>
          </button>
          <button class="btn ghost sm" id="duasReset" type="button" style="color:var(--ink);border-color:var(--line)">Reset</button>
        </div>` : ''}
        <div class="duas-nav">
          ${i > 0 ? `<a class="btn ghost sm" href="${itemHref(c.id, i - 1)}" aria-label="Previous dua">${icons.prev}<span>Previous</span></a>` : '<span></span>'}
          <button class="btn ghost sm" id="duasShare" type="button">${icons.share}<span>Share</span></button>
          ${!last ? `<a class="btn ${complete && it.count > 1 ? '' : 'ghost'} sm" ${complete && it.count > 1 ? 'style="background:var(--green);color:var(--card);border-color:var(--green)"' : ''} href="${itemHref(c.id, i + 1)}" aria-label="Next dua"><span>Next</span>${icons.next}</a>` : '<span></span>'}
        </div>
        ${reviewLine()}
      </div>`;

    if (it.quran) {
      quranText(it).then((ayahs) => {
        const el = root.querySelector('#duasText');
        if (!el || !alive) return;
        const bas = it.quran.from === 1 && ayahs[0]?.basmala ? `<div class="duas-basmala">${esc(ayahs[0].basmala)}</div>` : '';
        el.innerHTML = bas + ayahs.map((a) => `<span class="duas-ayah" data-n="${a.number}">${esc(a.text)} <span class="ayah-end">﴿${arNum(a.ayah)}﴾</span></span>`).join(' ');
      }).catch(() => {
        const el = root.querySelector('#duasText');
        if (el) el.innerHTML = '<p class="small muted" style="text-align:center">Could not load the verses. Check your connection.</p>';
      });
      root.querySelector('#duasPlay')?.addEventListener('click', () => play(it));
    }

    root.querySelector('#duasCounter')?.addEventListener('click', () => {
      const cur = counts(c)[it.id] || 0;
      if (cur >= it.count) return;
      store.update((s) => { s.adhkar = s.adhkar || {}; const k = countKey(c); s.adhkar[k] = { ...(s.adhkar[k] || {}), [it.id]: cur + 1 }; });
      if (navigator.vibrate) navigator.vibrate(cur + 1 >= it.count ? [30, 40, 30] : 15);
      const nowDone = cur + 1 >= it.count;
      renderReader(c, i);
      if (nowDone && c.kind === 'ruqyah' && !last) {
        advanceTimer = setTimeout(() => { if (alive) location.hash = itemHref(c.id, i + 1); }, 600);
      }
    });
    root.querySelector('#duasReset')?.addEventListener('click', () => {
      store.update((s) => { s.adhkar = s.adhkar || {}; const k = countKey(c); s.adhkar[k] = { ...(s.adhkar[k] || {}), [it.id]: 0 }; });
      renderReader(c, i);
    });
    root.querySelector('#duasShare').addEventListener('click', () => share(c, it));
  }

  async function share(c, it) {
    let arabic = it.arabic || '';
    if (it.quran) {
      try {
        const ayahs = await quranText(it);
        arabic = ayahs.map((a) => `${a.text} ﴿${arNum(a.ayah)}﴾`).join(' ');
      } catch { arabic = ''; }
    }
    const lines = [it.title, arabic, it.meaning, `${it.source}${it.count > 1 ? ` · ×${it.count}` : ''}`, '— Recite With Me'].filter(Boolean);
    const text = lines.join('\n\n');
    try {
      if (navigator.share) { await navigator.share({ title: it.title, text }); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard.');
    } catch {
      toast('Sharing is not available on this device.');
    }
  }

  if (cat && hasIdx) renderReader(cat, idx);
  else if (cat) renderCategory(cat);
  else renderLanding();

  return () => {
    alive = false;
    clearTimeout(advanceTimer);
    stopAudio();
  };
}
