import { RecitationSession, MARK_LABEL } from '../session.js';
import { renderWords } from './words.js';
import { speechSupported } from '../speech.js';
import * as store from '../store.js';
import * as plan from '../plan.js';
import { TOTAL_PAGES, audioUrl, wordAudioUrl } from '../quran.js';
import { esc, loading, errorBox, toast, todayKey, fmtTime } from '../ui.js';
import { icons } from '../icons.js';

function portionsFromParams(params) {
  const s = store.get();
  if (params.plan && s.plan) {
    const t = plan.today(s.plan);
    const list = t[params.plan] || [];
    return { portions: list, planItem: params.plan };
  }
  const page = Math.min(TOTAL_PAGES, Math.max(1, parseInt(params.page, 10) || 0));
  if (!page) return null;
  return { portions: [{ page, part: params.part || 'all' }], planItem: '' };
}

export default async function reciteView(root, params) {
  const pick = portionsFromParams(params);
  if (!pick || !pick.portions.length) return chooser(root);

  const s = store.get();
  let hide = s.settings.hideText !== false;
  const supported = speechSupported();
  let finished = false;
  const PLAN_LABEL = { sabaq: 'New lesson · Sabaq', sabqi: 'Recent revision · Sabqi', manzil: 'Old revision · Manzil' };

  root.innerHTML = loading('Preparing');
  const session = new RecitationSession({
    portions: pick.portions,
    mode: 'practice',
    onUpdate: () => paint(),
    onInterim: (t) => { const el = root.querySelector('#live'); if (el) el.textContent = t; },
    onNotice: (m) => toast(m),
    onMistake: (m) => showFix(m),
  });
  let fixAudio = null;
  let fixMark = null;
  try {
    await session.load();
  } catch {
    root.innerHTML = errorBox('The verses could not load. Check your internet connection.', 'retry');
    root.querySelector('#retry')?.addEventListener('click', () => reciteView(root, params));
    return;
  }

  const listenHref = `#/mushaf?page=${pick.portions[0].page}&part=${pick.portions[0].part}&loops=5`;
  root.innerHTML = `
    <div class="stack">
      <div class="spread">
        <div class="page-head">
          <div class="eyebrow">${esc(PLAN_LABEL[pick.planItem] || 'Recite from memory')}</div>
          <h1 style="font-size:19px">${esc(session.title)}</h1>
        </div>
        <span class="chip" id="score" aria-live="polite">0%</span>
      </div>
      ${supported ? '' : `<div class="notice">This browser has no speech engine for the AI check. Use Chrome, Edge or Safari for the AI check. You can still record yourself and tap any word you got wrong.</div>`}
      <div class="row-wrap">
        <a class="btn gold sm" href="${listenHref}">${icons.book} Listen 5 times first</a>
        <button class="btn ghost sm" id="toggleText" type="button" aria-pressed="${!hide}">${icons.eye} <span>${hide ? 'Show text' : 'Hide text'}</span></button>
      </div>
      <div class="card" id="wordsCard"></div>
      <div class="legend">
        <span><i style="background:var(--green-hl);border-bottom:2px solid var(--green)"></i>Reciting now</span>
        <span><i style="background:var(--red-tint);border-bottom:2px solid var(--red)"></i>Mistake</span>
        <span><i style="background:#F1ECE0"></i>Peeked</span>
      </div>
      <div id="result"></div>
      <div class="dock" id="dock">
        <div class="fix" id="fix" hidden></div>
        <div class="live-text" id="live" lang="ar"></div>
        <div class="row" style="gap:24px">
          <button class="btn gold sm" id="peek" type="button">Peek</button>
          <button class="icon-btn mic" id="mic" type="button" aria-label="Start reciting">${icons.mic}</button>
          <button class="btn outline sm" id="finish" type="button">Finish</button>
        </div>
        <div class="xs muted" id="status">Tap the microphone and recite from memory.</div>
      </div>
      <p class="xs muted" style="text-align:center">When the AI catches a mistake, tap play to hear the correct recitation with tajweed. The AI checks words, not tajweed yet; your teacher confirms every portion.</p>
    </div>`;

  const wordsCard = root.querySelector('#wordsCard');
  const mic = root.querySelector('#mic');

  function paint() {
    wordsCard.innerHTML = renderWords(session, { hide: hide && !finished, tappable: !supported && !finished });
    const { reached, total } = session.progress();
    root.querySelector('#score').textContent = `${session.aiScore()}%`;
    mic.classList.toggle('live', session.running);
    mic.setAttribute('aria-label', session.running ? 'Pause' : 'Start reciting');
    mic.innerHTML = session.running ? icons.pause : icons.mic;
    const st = root.querySelector('#status');
    if (st && !finished) {
      st.innerHTML = session.running
        ? `<span class="row" style="gap:6px;justify-content:center"><span class="dot"></span>${session.recording ? 'Recording · ' : ''}${reached} of ${total} words</span>`
        : reached ? `Paused · ${reached} of ${total} words` : 'Tap the microphone and recite from memory.';
    }
    if (session.matcher.done && session.running && !finished) finish();
  }

  wordsCard.addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]');
    if (!el || supported || finished) return;
    session.tapWord(+el.dataset.i, 'self');
  });

  mic.addEventListener('click', async () => {
    if (finished) return;
    stopFix(false);
    if (session.running) {
      session.pause();
    } else if (session.started) {
      session.resume();
    } else {
      await session.start();
    }
  });

  function showFix(m) {
    const box = root.querySelector('#fix');
    if (!box || finished) return;
    fixMark = m;
    const w = session.words[m.index];
    box.hidden = false;
    box.innerHTML = `
      <div class="spread"><span class="chip red">${esc(MARK_LABEL[m.type] || 'Mistake')} · ayah ${w.ayah}</span>
        <button class="icon-btn" id="fixClose" type="button" aria-label="Close correction" style="width:34px;height:34px">×</button></div>
      <div class="row" style="gap:12px;justify-content:center">
        <span class="quran" style="font-size:28px" lang="ar">${esc(w.display)}</span>
      </div>
      <div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn sm" type="button" data-fix="ayah">${icons.play} Hear the ayah</button>
        <button class="btn outline sm" type="button" data-fix="word">${icons.play} Hear the word</button>
      </div>
      <div class="xs muted" style="text-align:center">Listening pauses while it plays, then continues.</div>`;
    box.querySelector('#fixClose').addEventListener('click', () => { stopFix(false); box.hidden = true; });
    box.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', () => playFix(b.dataset.fix, m, b)));
    if (navigator.vibrate) navigator.vibrate(40);
  }

  function stopFix(resume) {
    if (fixAudio) { fixAudio.onended = null; fixAudio.onerror = null; fixAudio.pause(); fixAudio = null; }
    root.querySelectorAll('[data-fix]').forEach((b) => b.classList.remove('playing'));
    if (resume && !finished) session.resume();
  }

  function playFix(kind, m, btn) {
    stopFix(false);
    const w = session.words[m.index];
    const wasRunning = session.pause();
    const url = kind === 'word' ? wordAudioUrl(w.surah, w.ayah, w.pos) : audioUrl(store.get().settings.reciter, w.number);
    fixAudio = new Audio(url);
    if (btn) btn.classList.add('playing');
    const done = () => {
      stopFix(wasRunning);
      if (wasRunning) toast('Listening again. Continue where you stopped.');
    };
    fixAudio.onended = done;
    fixAudio.onerror = () => {
      if (kind === 'word') { toast('Word audio unavailable. Playing the ayah.'); playFix('ayah', m, btn); return; }
      toast('Audio could not load. Check your connection.');
      done();
    };
    fixAudio.play().catch(() => done());
  }

  root.querySelector('#peek').addEventListener('click', () => {
    const i = session.peek();
    if (i < 0) return;
    if (hide) toast(`Peek: ${session.words[i].display}`);
  });

  root.querySelector('#toggleText').addEventListener('click', (e) => {
    hide = !hide;
    store.update((st) => { st.settings.hideText = hide; });
    const b = e.currentTarget;
    b.setAttribute('aria-pressed', String(!hide));
    b.querySelector('span').textContent = hide ? 'Show text' : 'Hide text';
    paint();
  });

  root.querySelector('#finish').addEventListener('click', () => finish());

  async function finish() {
    if (finished) return;
    finished = true;
    stopFix(false);
    const blob = await session.stop();
    const st = store.get();
    const saved = await session.save({ kind: 'practice', student: st.profile?.name, planItem: pick.planItem, blob });
    const score = session.aiScore();
    let planMsg = '';
    if (pick.planItem && st.plan) {
      const day = todayKey();
      const passed = !supported || score >= 90;
      if (passed) {
        store.update((x) => {
          x.daily[day] = x.daily[day] || {};
          if (!x.daily[day][pick.planItem]) {
            x.daily[day][pick.planItem] = true;
            if (pick.planItem === 'sabaq') plan.completeSabaq(x.plan);
            if (pick.planItem === 'manzil') plan.completeManzil(x.plan);
          }
        });
        store.touchStreak(day);
        planMsg = 'Marked done in today\'s plan.';
      } else {
        planMsg = 'Reach 90% to tick this off today. Listen again and retry.';
      }
    }
    root.querySelector('#dock').remove();
    const marks = session.activeMarks();
    root.querySelector('#result').innerHTML = `
      <div class="card stack">
        <div class="spread">
          <div><div class="eyebrow">Result</div><h2>${supported ? `${score}% correct` : 'Self-check saved'}</h2></div>
          <span class="chip ${score >= 90 ? '' : score >= 70 ? 'gold' : 'red'}">${fmtTime(saved.duration)}</span>
        </div>
        ${planMsg ? `<p class="small">${esc(planMsg)}</p>` : ''}
        ${marks.length ? `<div class="stack-s">${marks.map((m) => `
          <div class="row"><button class="icon-btn" type="button" data-play="${m.index}" aria-label="Hear the correct recitation of ayah ${m.ayah}">${icons.play}</button>
          <span class="quran" style="font-size:21px" lang="ar">${esc(m.word)}</span>
          <span class="grow small">${esc(MARK_LABEL[m.type] || m.type)} · ayah ${m.ayah}${m.heard ? ` · heard «${esc(m.heard)}»` : ''}</span>
          <span class="xs muted">${fmtTime(m.t)}</span></div>`).join('')}<p class="xs muted">Tap play to hear each ayah recited correctly.</p></div>` : '<p class="small muted">No mistakes found. MashaAllah.</p>'}
        <div class="row-wrap">
          <a class="btn" href="#/recite?${new URLSearchParams(params).toString()}" id="again">Recite again</a>
          <a class="btn outline" href="#/history/${saved.id}">Replay recording</a>
          <a class="btn ghost" href="#/">Back to Today</a>
        </div>
      </div>`;
    root.querySelector('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    root.querySelector('#again').addEventListener('click', (e) => { e.preventDefault(); stopFix(false); reciteView(root, params); });
    root.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      const m = marks.find((x) => x.index === +b.dataset.play);
      if (m) playFix('ayah', m, b);
    }));
    paint();
  }

  paint();
  return () => { stopFix(false); if (!finished && session.running) session.stop(); };
}

function chooser(root) {
  const s = store.get();
  const last = s.settings.lastPage || 1;
  root.innerHTML = `
    <div class="stack">
      <div class="page-head"><h1>Recite</h1><p class="muted small">Recite from memory. The AI follows you word by word and marks skipped or wrong words.</p></div>
      ${s.plan ? `<div class="card stack-s">
        <h2>From today's plan</h2>
        <a class="btn block" href="#/recite?plan=sabaq">New lesson · Sabaq</a>
        <a class="btn outline block" href="#/recite?plan=sabqi">Recent revision · Sabqi</a>
        <a class="btn outline block" href="#/recite?plan=manzil">Old revision · Manzil</a>
      </div>` : ''}
      <form class="card stack-s" id="pickForm">
        <h2>Any page</h2>
        <div class="row-wrap">
          <div class="field" style="flex:1 1 120px"><label for="pg">Page (1–604)</label><input class="input" id="pg" type="number" min="1" max="604" value="${last}" inputmode="numeric" required></div>
          <div class="field" style="flex:1 1 160px"><label for="pt">Portion</label>
            <select class="input" id="pt"><option value="all">Whole page</option><option value="1/2">First half</option><option value="2/2">Second half</option></select></div>
        </div>
        <button class="btn" type="submit">Start</button>
      </form>
    </div>`;
  root.querySelector('#pickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = `#/recite?page=${root.querySelector('#pg').value}&part=${encodeURIComponent(root.querySelector('#pt').value)}`;
  });
}
