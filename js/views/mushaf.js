import { getPage, getMeta, pageOf, juzStartPage, RECITERS, TOTAL_PAGES, slicePart } from '../quran.js';
import { Player } from '../player.js';
import * as store from '../store.js';
import { esc, arNum, loading, errorBox, toast, alive, onLeave } from '../ui.js';
import { icons } from '../icons.js';

export function renderPage(ayahs, { dimOutside = null } = {}) {
  let html = '';
  let para = [];
  const flush = () => {
    if (para.length) html += `<p class="mushaf-text" dir="rtl" lang="ar">${para.join(' ')}</p>`;
    para = [];
  };
  ayahs.forEach((a, idx) => {
    if (a.ayah === 1) {
      flush();
      html += `<div class="surah-head" lang="ar" dir="rtl">${esc(a.surahName)}</div>`;
      if (a.basmala) html += `<div class="basmala" lang="ar" dir="rtl">${esc(a.basmala)}</div>`;
    }
    const dim = dimOutside && !dimOutside.has(a.number) ? ' style="opacity:.42"' : '';
    para.push(`<span class="ayah" data-idx="${idx}" data-n="${a.number}" role="button" tabindex="0" aria-label="Play ayah ${a.ayah} of ${esc(a.surahEnglish)}"${dim}>${esc(a.text)} <span class="ayah-end">﴿${arNum(a.ayah)}﴾</span></span>`);
  });
  flush();
  return html;
}

export default async function mushafView(root, params) {
  const s = store.get();
  let page = Math.min(TOTAL_PAGES, Math.max(1, parseInt(params.page, 10) || s.settings.lastPage || 1));
  const part = params.part || 'all';
  let loops = parseInt(params.loops, 10) || 1;
  let ayahs = [];
  let playList = [];
  let meta = null;

  const player = new Player({
    onAyah: (i) => {
      root.querySelectorAll('.ayah.playing').forEach((el) => el.classList.remove('playing'));
      if (i < 0) return;
      const n = playList[i] && playList[i].number;
      const el = root.querySelector(`.ayah[data-n="${n}"]`);
      if (el) { el.classList.add('playing'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      const st = root.querySelector('#plStatus');
      if (st && playList[i]) st.textContent = `Ayah ${playList[i].ayah} of ${playList[i].surahEnglish}${player.loops > 1 ? ` · listening ${player.loop + 1} of ${player.loops}` : ''}`;
    },
    onState: (on) => {
      const b = root.querySelector('#plToggle');
      if (b) { b.innerHTML = on ? icons.pause : icons.play; b.setAttribute('aria-label', on ? 'Pause' : 'Play'); }
    },
    onError: () => toast('Audio could not load. Check your connection.'),
  });
  player.reciter = s.settings.reciter;
  player.setSpeed(s.settings.speed || 1);
  player.loops = loops;
  player.onEnd = () => {
    if (loops > 1) toast(`Listened ${loops} times. Ready to recite.`);
  };

  root.innerHTML = `
    <div class="stack">
      <div class="spread">
        <button class="icon-btn" id="nextPage" type="button" aria-label="Next page">${icons.prev}</button>
        <div style="text-align:center">
          <h1 id="pgTitle" style="font-size:18px">Page ${page}</h1>
          <div class="xs muted" id="pgSub">Madinah Mushaf · Hafs</div>
        </div>
        <button class="icon-btn" id="prevPage" type="button" aria-label="Previous page">${icons.next}</button>
      </div>
      <div class="row-wrap">
        <label class="sr-only" for="surahSel">Go to surah</label>
        <select class="input grow" id="surahSel" style="flex:1 1 180px"><option>Surahs…</option></select>
        <label class="sr-only" for="juzSel">Go to juz</label>
        <select class="input" id="juzSel" style="flex:0 1 110px"><option value="">Juz…</option>${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Juz ${i + 1}</option>`).join('')}</select>
        <label class="sr-only" for="pageInp">Page number</label>
        <input class="input" id="pageInp" type="number" min="1" max="${TOTAL_PAGES}" value="${page}" style="flex:0 1 90px" inputmode="numeric">
      </div>
      <div class="mushaf-frame"><div class="mushaf-inner" id="pageBody">${loading('Loading page')}</div></div>
      <div class="card stack-s" id="playerCard">
        <div class="row">
          <div class="icon-tile">${icons.book}</div>
          <div class="grow">
            <label class="sr-only" for="recSel">Reciter</label>
            <select class="input" id="recSel">${RECITERS.map((r) => `<option value="${r.id}" ${r.id === s.settings.reciter ? 'selected' : ''}>${esc(r.name)} · ${esc(r.note)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="small muted" id="plStatus">Tap play, or tap any ayah to start from it.</div>
        <div class="row" style="justify-content:center;gap:14px">
          <button class="icon-btn" id="plNext" type="button" aria-label="Next ayah">${icons.prev}</button>
          <button class="icon-btn big" id="plToggle" type="button" aria-label="Play">${icons.play}</button>
          <button class="icon-btn" id="plPrev" type="button" aria-label="Previous ayah">${icons.next}</button>
        </div>
        <div class="spread" style="flex-wrap:wrap;gap:10px">
          <div class="row" style="gap:8px"><span class="xs muted">Listen</span>
            <div class="seg" role="group" aria-label="Times to listen">
              ${[1, 3, 5].map((n) => `<button type="button" data-loops="${n}" aria-pressed="${n === loops}">${n}×</button>`).join('')}
            </div></div>
          <div class="row" style="gap:8px"><span class="xs muted">Speed</span>
            <div class="seg" role="group" aria-label="Speed">
              ${[0.75, 1, 1.25].map((v) => `<button type="button" data-speed="${v}" aria-pressed="${v === (s.settings.speed || 1)}">${v}×</button>`).join('')}
            </div></div>
        </div>
      </div>
      <p class="footer-note">Text: Tanzil (Madinah Mushaf, Hafs). Audio: Islamic Network.</p>
    </div>`;

  const body = root.querySelector('#pageBody');

  let loadToken = 0;
  async function load(p) {
    const mine = ++loadToken;
    page = Math.min(TOTAL_PAGES, Math.max(1, p));
    store.update((st) => { st.settings.lastPage = page; });
    root.querySelector('#pgTitle').textContent = `Page ${page}`;
    root.querySelector('#pageInp').value = page;
    body.innerHTML = loading('Loading page');
    player.stop();
    const st = root.querySelector('#plStatus');
    if (st) st.textContent = 'Tap play, or tap any ayah to start from it.';
    try {
      const got = await getPage(page);
      if (mine !== loadToken || !alive(root)) return; // a newer page was asked for
      ayahs = got;
      const partAyahs = slicePart(ayahs, page === parseInt(params.page, 10) ? part : 'all');
      playList = partAyahs;
      const dim = partAyahs.length !== ayahs.length ? new Set(partAyahs.map((a) => a.number)) : null;
      body.innerHTML = renderPage(ayahs, { dimOutside: dim }) + `<div class="page-foot">${arNum(page)}</div>`;
      const first = ayahs[0];
      root.querySelector('#pgSub').textContent = `${first.surahEnglish} · Juz ${first.juz}${dim ? ` · ${part === '1/2' ? 'first' : 'second'} half` : ''}`;
      player.load(playList);
      if (meta) root.querySelector('#surahSel').value = String(first.surah);
      const jz = root.querySelector('#juzSel');
      if (jz) jz.value = String(first.juz);
    } catch {
      if (mine !== loadToken || !alive(root)) return;
      body.innerHTML = errorBox('This page could not load. Check your internet connection.', 'retryPage');
      root.querySelector('#retryPage')?.addEventListener('click', () => load(page));
    }
  }

  body.addEventListener('click', (e) => {
    const el = e.target.closest('.ayah');
    if (!el) return;
    const n = +el.dataset.n;
    let i = playList.findIndex((a) => a.number === n);
    if (i < 0) { playList = ayahs; player.load(playList); i = playList.findIndex((a) => a.number === n); }
    player.playFrom(i);
  });
  body.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ayah')) { e.preventDefault(); e.target.click(); }
  });

  // Right-to-left Mushaf: "next" page sits on the left.
  root.querySelector('#nextPage').addEventListener('click', () => load(page + 1));
  root.querySelector('#prevPage').addEventListener('click', () => load(page - 1));
  root.querySelector('#pageInp').addEventListener('change', (e) => load(parseInt(e.target.value, 10) || 1));
  root.querySelector('#plToggle').addEventListener('click', () => player.toggle());
  root.querySelector('#plNext').addEventListener('click', () => player.next());
  root.querySelector('#plPrev').addEventListener('click', () => player.prev());
  root.querySelector('#recSel').addEventListener('change', (e) => {
    player.reciter = e.target.value;
    store.update((st) => { st.settings.reciter = e.target.value; });
    if (player.playing) player.playFrom(player.i);
  });
  root.querySelectorAll('[data-loops]').forEach((b) => b.addEventListener('click', () => {
    loops = +b.dataset.loops;
    player.loops = loops;
    root.querySelectorAll('[data-loops]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  root.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    const v = +b.dataset.speed;
    player.setSpeed(v);
    store.update((st) => { st.settings.speed = v; });
    root.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));

  getMeta().then((m) => {
    meta = m;
    const sel = root.querySelector('#surahSel');
    if (!sel) return;
    sel.innerHTML = m.surahs.map((x) => `<option value="${x.number}">${x.number}. ${esc(x.english)} · ${esc(x.name)}</option>`).join('');
    if (ayahs[0]) sel.value = String(ayahs[0].surah);
    sel.addEventListener('change', () => load(pageOf(m, +sel.value, 1)));
    root.querySelector('#juzSel').addEventListener('change', (e) => { if (e.target.value) load(juzStartPage(m, +e.target.value)); });
  }).catch(() => {});

  // Swipe and arrow keys turn pages (right-to-left: swipe right or ArrowLeft = next page).
  let sx = null, sy = 0;
  body.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) load(page + (dx > 0 ? 1 : -1));
  }, { passive: true });
  const onKey = (e) => {
    if (!alive(root)) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); load(page + 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); load(page - 1); }
  };
  document.addEventListener('keydown', onKey);
  onLeave(root, () => { player.stop(); document.removeEventListener('keydown', onKey); });

  await load(page);
}
