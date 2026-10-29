import * as store from '../store.js';
import * as plan from '../plan.js';
import * as cloud from '../cloud.js';
import * as records from '../records.js';
import { isCloud } from '../account.js';
import { RecitationSession, MARK_LABEL } from '../session.js';
import { renderWords } from './words.js';
import { speechSupported, recordingSupported } from '../speech.js';
import { TOTAL_PAGES, audioUrl, describePortions } from '../quran.js';
import { esc, fmtDate, fmtTime, band, uid, loading, errorBox, toast } from '../ui.js';
import { icons } from '../icons.js';
import { SITE_URL } from '../config.js';

const DAY = 864e5;

function initials(name) { return esc((name || '?').trim().slice(0, 1).toUpperCase()); }
export function avatar(p, size = 42) {
  return p?.avatar_url || p?.avatar
    ? `<img class="avatar" src="${esc(p.avatar_url || p.avatar)}" alt="" width="${size}" height="${size}" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px">`
    : `<span class="avatar" style="width:${size}px;height:${size}px" aria-hidden="true">${initials(p?.name)}</span>`;
}

function ago(ts) {
  if (!ts) return '';
  const d = Date.now() - new Date(ts).getTime();
  if (d < 3600e3) return `${Math.max(1, Math.round(d / 60e3))} min ago`;
  if (d < DAY) return `${Math.round(d / 3600e3)} h ago`;
  return `${Math.round(d / DAY)} d ago`;
}

function studentSummary(st) {
  const d = st.state?.data;
  if (!d?.plan) return 'No plan yet';
  const pages = Math.floor((d.plan.units || 0) / 2);
  const streak = d.streak?.count || 0;
  return `${pages} ${pages === 1 ? 'page' : 'pages'} · ${streak}-day streak · active ${ago(st.state.updated_at)}`;
}

export function todaysSabaq(st) {
  const p = st?.state?.data?.plan;
  if (!p) return null;
  try { const t = plan.today(p); return t.sabaq[0] || null; } catch { return null; }
}

export function teacherHome(root) {
  const s = store.get();
  const cloudOn = isCloud();
  root.innerHTML = `
    <div class="stack">
      <section class="hero">
        <div class="eyebrow">Teacher view</div>
        <h1 style="margin-top:4px">As-salamu alaykum, ${esc(s.profile?.name || '')}</h1>
        <div class="small muted">${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div class="hero-stats" id="heroStats">
          <div><b id="hsStudents">–</b><span>Students</span></div>
          <div><b id="hsToday">–</b><span>Sessions today</span></div>
          <div><b id="hsReview">–</b><span>To review</span></div>
        </div>
      </section>
      ${cloudOn ? `
      <div class="card stack-s">
        <div class="spread"><h2>Your class code</h2><span class="chip gold">Share with students</span></div>
        <div class="code-box"><b id="code">${esc(s.profile?.code || '······')}</b>
          <div class="row" style="gap:6px">
            <button class="icon-btn" type="button" id="copyCode" aria-label="Copy invite link">${icons.copy}</button>
            <button class="icon-btn" type="button" id="shareCode" aria-label="Share invite link">${icons.share}</button>
          </div></div>
        <p class="xs muted">Students sign in with Google, then enter this code or open your link. Their progress and recordings then appear here.</p>
      </div>` : ''}
      <div class="card stack-s">
        <div class="spread"><h2>My students</h2>${cloudOn ? '' : '<span class="chip plain">This device</span>'}</div>
        <div id="students">${cloudOn ? loading('Loading students') : ''}</div>
      </div>
      <div class="card stack-s">
        <div class="spread"><h2>In-person students</h2><span class="xs muted">No account needed</span></div>
        <div id="local"></div>
        <form class="row" id="addStudent" style="margin-top:6px">
          <label class="sr-only" for="newStudent">Student name</label>
          <input class="input grow" id="newStudent" placeholder="Student name" required maxlength="60">
          <button class="btn sm" type="submit">${icons.plus} Add</button>
        </form>
      </div>
      <div class="card stack-s">
        <div class="spread"><h2>Recent sessions</h2><a class="small" href="#/history">All recordings</a></div>
        <div id="recent">${loading('Loading sessions')}</div>
      </div>
    </div>`;

  const link = `${SITE_URL}/#/join/${s.profile?.code || ''}`;
  root.querySelector('#copyCode')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); toast('Invite link copied'); } catch { toast(link); }
  });
  root.querySelector('#shareCode')?.addEventListener('click', async () => {
    const text = `Join my Quran class on Recite With Me. Sign in with Google and use code ${s.profile?.code}: ${link}`;
    try { if (navigator.share) await navigator.share({ title: 'Recite With Me', text }); else { await navigator.clipboard.writeText(text); toast('Invite copied. Paste it in WhatsApp.'); } } catch { /* cancelled */ }
  });

  function paintLocal() {
    const st = store.get();
    root.querySelector('#local').innerHTML = st.students.length ? st.students.map((x) => `
      <div class="list-item">
        ${avatar(x)}
        <div class="grow"><h3>${esc(x.name)}</h3><div class="xs muted">${((n) => `${n} ${n === 1 ? 'session' : 'sessions'} on this device`)(st.history.filter((h) => h.kind === 'teacher' && h.student === x.name).length)}</div></div>
        <a class="btn sm outline" href="#/live?student=l:${x.id}">In person</a>
        <button class="icon-btn" type="button" data-del="${x.id}" aria-label="Remove ${esc(x.name)}">${icons.trash}</button>
      </div>`).join('') : '<p class="small muted">For students in your halaqa who recite on your device.</p>';
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('Remove this student from your list? Their recordings stay saved.')) return;
      store.update((x) => { x.students = x.students.filter((y) => y.id !== b.dataset.del); });
      paintLocal();
    }));
  }
  paintLocal();

  root.querySelector('#addStudent').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = root.querySelector('#newStudent').value.trim();
    if (!name) return;
    store.update((x) => { x.students.push({ id: uid(), name }); });
    root.querySelector('#newStudent').value = '';
    paintLocal();
  });

  (async () => {
    let students = [];
    if (cloudOn) {
      try { students = await cloud.myStudents(); } catch { root.querySelector('#students').innerHTML = errorBox('Could not load your students. Check your connection.'); }
      const box = root.querySelector('#students');
      if (box && students) {
        box.innerHTML = students.length ? students.map((st) => `
          <div class="list-item" style="flex-wrap:wrap">
            ${avatar(st)}
            <div class="grow"><h3>${esc(st.name)}</h3><div class="xs muted">${esc(studentSummary(st))}</div></div>
            <div class="row" style="gap:6px">
              <a class="btn sm" href="#/live?student=u:${st.id}&online=1" aria-label="Video session with ${esc(st.name)}">${icons.video} Video</a>
              <a class="btn sm outline" href="#/live?student=u:${st.id}">In person</a>
              <a class="icon-btn" href="#/history?student=${st.id}" aria-label="Recordings of ${esc(st.name)}">${icons.clock}</a>
            </div>
          </div>`).join('') : '<p class="small muted">No students yet. Share your class code above.</p>';
      }
    } else {
      root.querySelector('#students').innerHTML = '<p class="small muted">Sign in with Google to link students, see their progress and hold video sessions.</p>';
    }
    let list = [];
    try { list = await records.list(); } catch { list = store.get().history; }
    const mine = list.filter((h) => h.kind !== 'practice');
    const today = mine.filter((h) => new Date(h.created).toDateString() === new Date().toDateString()).length;
    const toReview = list.filter((h) => h.kind === 'practice' && h.studentId && h.studentId !== s.profile?.id && !h.review && Date.now() - h.created < 7 * DAY).length;
    const set = (id, v) => { const el = root.querySelector(id); if (el) el.textContent = v; };
    set('#hsStudents', students.length + store.get().students.length);
    set('#hsToday', today);
    set('#hsReview', toReview);
    const recent = root.querySelector('#recent');
    if (!recent) return;
    const top = list.slice(0, 6);
    recent.innerHTML = top.length ? top.map((h) => `
      <a class="list-item" href="#/history/${h.id}" style="text-decoration:none;color:inherit">
        <div class="icon-tile ${h.kind === 'practice' ? 'gold' : 'solid'}">${h.kind === 'online' ? icons.video : h.kind === 'practice' ? icons.mic : icons.users}</div>
        <div class="grow"><h3>${esc(h.student || 'Student')} · ${esc((h.title || '').split(' · ')[0])}</h3><div class="xs muted">${esc(fmtDate(h.created))} · ${fmtTime(h.duration)}${h.kind === 'practice' ? (h.review ? ' · reviewed' : ' · AI practice, needs review') : ''}</div></div>
        ${h.grade ? `<b>${h.grade.total}</b>` : h.review?.grade ? `<b>${h.review.grade.total}</b>` : ''}
      </a>`).join('') : '<p class="small muted">No sessions yet.</p>';
  })();
}

// ---------- Session setup (video or in person) ----------
async function setup(root, params) {
  const s = store.get();
  let linked = [];
  if (isCloud()) { root.innerHTML = loading(); try { linked = await cloud.myStudents(); } catch { /* offline */ } }
  const pre = params.student || '';
  const options = [
    ...linked.map((x) => ({ v: `u:${x.id}`, name: x.name, st: x })),
    ...s.students.map((x) => ({ v: `l:${x.id}`, name: x.name })),
  ];
  const selected = options.find((o) => o.v === pre) || options[0];
  const sab = selected?.st ? todaysSabaq(selected.st) : null;
  const online = params.online === '1' && selected?.v.startsWith('u:');

  root.innerHTML = `
    <form class="stack" id="setupForm">
      <div class="page-head"><span class="chip gold" style="align-self:flex-start">Teacher view</span><h1>Start a session</h1>
        <p class="small muted">Choose the student and portion. In a video session the student recites from their own phone: the AI listens there, you see the marks here, and the whole call is recorded.</p></div>
      <div class="card stack-s">
        <div class="field"><label for="stSel">Student</label>
          ${options.length ? `<select class="input" id="stSel">${options.map((o) => `<option value="${o.v}" ${selected && o.v === selected.v ? 'selected' : ''}>${esc(o.name)}${o.v.startsWith('l:') ? ' (in person)' : ''}</option>`).join('')}</select>`
            : `<input class="input" id="stName" placeholder="Student name" required maxlength="60">`}
        </div>
        <div class="field"><span class="label">Session type</span>
          <div class="seg" role="group" aria-label="Session type">
            <button type="button" data-mode="online" aria-pressed="${online}" ${selected?.v.startsWith('u:') ? '' : 'disabled'}>${icons.video.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px;margin-right:4px"')}Video call</button>
            <button type="button" data-mode="person" aria-pressed="${!online}">In person</button>
          </div>
          <p class="xs muted" id="modeNote">${selected?.v.startsWith('u:') ? '' : 'Video calls are for students who have joined with your class code.'}</p>
        </div>
        <div class="row-wrap">
          <div class="field" style="flex:1 1 120px"><label for="pg">Page (1–604)</label><input class="input" id="pg" type="number" min="1" max="604" value="${sab?.page || s.settings.lastPage || 1}" required inputmode="numeric"></div>
          <div class="field" style="flex:1 1 160px"><label for="pt">Portion</label><select class="input" id="pt">
            ${[['all', 'Whole page'], ['1/2', 'First half'], ['2/2', 'Second half']].map(([v, l]) => `<option value="${v}" ${sab?.part === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        ${sab ? `<p class="xs muted">Prefilled with today's new lesson from the student's plan: ${esc(describePortions([sab]))}.</p>` : ''}
      </div>
      <button class="btn block lg" type="submit" id="go">${online ? `${icons.video} Call the student` : 'Open the page'}</button>
    </form>`;

  let mode = online ? 'online' : 'person';
  const goBtn = root.querySelector('#go');
  const paintMode = () => {
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    goBtn.innerHTML = mode === 'online' ? `${icons.video} Call the student` : 'Open the page';
  };
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) { mode = b.dataset.mode; paintMode(); } }));
  root.querySelector('#stSel')?.addEventListener('change', (e) => {
    const q = new URLSearchParams({ student: e.target.value, online: mode === 'online' ? '1' : '0' });
    location.hash = `#/live?${q}`;
  });

  root.querySelector('#setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let id = root.querySelector('#stSel')?.value;
    const nameInput = root.querySelector('#stName');
    if (nameInput) {
      const name = nameInput.value.trim();
      const lid = uid();
      store.update((x) => { x.students.push({ id: lid, name }); });
      id = `l:${lid}`;
    }
    const page = Math.min(TOTAL_PAGES, Math.max(1, parseInt(root.querySelector('#pg').value, 10) || 1));
    const part = root.querySelector('#pt').value;
    if (mode === 'online' && id.startsWith('u:')) {
      goBtn.disabled = true;
      goBtn.innerHTML = '<span class="spinner sm"></span> Calling…';
      try {
        const call = await cloud.startCall(id.slice(2), [{ page, part }]);
        location.hash = `#/call/${call.id}`;
      } catch (err) {
        console.error(err);
        toast('Could not start the call. Check your connection and try again.');
        goBtn.disabled = false; paintMode();
      }
      return;
    }
    const opt = options.find((o) => o.v === id);
    const q = new URLSearchParams({ student: id, page, part, name: opt?.name || nameInput?.value.trim() || 'Student' });
    location.hash = `#/live?${q.toString()}`;
  });
}

// ---------- In-person live session ----------
export default async function liveView(root, params) {
  if (!params.page) return setup(root, params);
  const s = store.get();
  const page = Math.min(TOTAL_PAGES, Math.max(1, parseInt(params.page, 10) || 1));
  const part = params.part || 'all';
  const sid = params.student || '';
  const local = sid.startsWith('l:') ? s.students.find((x) => x.id === sid.slice(2)) : null;
  const studentName = params.name || local?.name || 'Student';
  const studentId = sid.startsWith('u:') ? sid.slice(2) : null;
  const supported = speechSupported();
  let tick = null;
  let phase = 'live';

  root.closest('.view')?.classList.add('wide');
  root.innerHTML = loading('Preparing session');
  const session = new RecitationSession({
    portions: [{ page, part }],
    mode: 'teacher',
    onUpdate: () => paint(),
    onInterim: (t) => { const el = root.querySelector('#live'); if (el) el.textContent = t; },
    onNotice: (m) => toast(m),
  });
  try { await session.load(); } catch {
    root.innerHTML = errorBox('The page could not load. Check your internet connection.', 'retry');
    root.querySelector('#retry')?.addEventListener('click', () => liveView(root, params));
    return;
  }

  root.innerHTML = `
    <div class="stack">
      <div class="spread" style="flex-wrap:wrap">
        <div class="page-head">
          <span class="chip gold" style="align-self:flex-start">Teacher view · in person</span>
          <h1 style="font-size:19px">${esc(studentName)} · ${esc(session.title)}</h1>
        </div>
        <div class="row-wrap">
          <span class="chip red" id="recChip" hidden><span class="dot"></span><span id="timer">0:00</span></span>
          <button class="btn" id="startBtn" type="button">${icons.mic} Start session</button>
          <button class="btn outline" id="gradeBtn" type="button" disabled>Finish and grade</button>
        </div>
      </div>
      ${!supported ? '<div class="notice">This browser has no speech engine, so there are no AI suggestions. Tap words to mark mistakes; the session is still recorded.</div>' : ''}
      ${!recordingSupported() ? '<div class="notice red">This browser cannot record audio. Marks are saved, but there will be no recording.</div>' : ''}
      ${markingPanel()}
      <div id="gradeBox"></div>
    </div>`;

  const startBtn = root.querySelector('#startBtn');
  const gradeBtn = root.querySelector('#gradeBtn');

  function paint() {
    if (phase !== 'live') return;
    paintMarking(root, session);
    startBtn.innerHTML = session.running ? `${icons.pause} Pause` : session.started ? `${icons.mic} Resume` : `${icons.mic} Start session`;
    gradeBtn.disabled = !session.started;
  }

  wireMarking(root, session, { canMark: () => session.started, onBlocked: () => toast('Start the session first, so the mark is saved at the right time.') });

  startBtn.addEventListener('click', async () => {
    if (!session.started) {
      await session.start();
      root.querySelector('#recChip').hidden = !session.recording;
      tick = setInterval(() => { const t = root.querySelector('#timer'); if (t) t.textContent = fmtTime(session.elapsed()); }, 500);
    } else if (session.running) session.pause();
    else session.resume();
    paint();
  });

  gradeBtn.addEventListener('click', async () => {
    phase = 'grade';
    clearInterval(tick);
    const blob = await session.stop();
    root.closest('.view')?.classList.remove('wide');
    gradeForm(root, session, {
      studentName, blob,
      onSubmit: async ({ grade, comment, decision }) => {
        const saved = await session.save({
          kind: 'teacher', student: studentName, teacher: s.profile?.name, studentId, teacherId: isCloud() ? s.profile?.id : null,
          grade, comment, decision, blob,
        });
        toast('Session saved with its recording and marks.');
        location.hash = `#/history/${saved.id}`;
      },
    });
  });

  paint();
  return () => {
    clearInterval(tick);
    root.closest('.view')?.classList.remove('wide');
    if (session.running) session.stop();
  };
}

// ---------- Shared marking panel (in person, video call, review) ----------
export function markingPanel({ hint = 'Tap a word to mark it · tap an AI suggestion to confirm' } = {}) {
  return `
      <div class="session-grid">
        <div class="stack-s">
          <div class="mushaf-frame"><div class="mushaf-inner" id="wordsBox"></div></div>
          <div class="live-text" id="live" lang="ar"></div>
          <div class="legend">
            <span><i class="lg-now"></i>Reciting now</span>
            <span><i class="lg-ai"></i>AI suggestion</span>
            <span><i class="lg-bad"></i>Teacher mark or confirmed</span>
            <span>${esc(hint)}</span>
          </div>
        </div>
        <aside class="card stack-s session-side" aria-label="Mistake log">
          <div class="spread"><h2>Mistake log</h2><div class="row" style="gap:6px"><span class="chip gold" id="aiCount">AI 0</span><span class="chip red" id="tCount">Teacher 0</span></div></div>
          <div class="log" id="log"></div>
          <p class="xs muted">Each mark is saved with its time in the recording, so the student and parents can replay the exact moment.</p>
        </aside>
      </div>`;
}

export function paintMarking(root, session) {
  const box = root.querySelector('#wordsBox');
  if (!box) return;
  box.innerHTML = renderWords(session, { hide: false, tappable: true });
  const active = session.activeMarks();
  root.querySelector('#aiCount').textContent = `AI ${active.filter((m) => m.source === 'ai' && m.type !== 'peek').length}`;
  root.querySelector('#tCount').textContent = `Teacher ${active.filter((m) => m.source === 'teacher').length}`;
  root.querySelector('#log').innerHTML = active.length ? active.map((m) => `
      <div class="log-item">
        <div class="spread"><span class="xs muted">${fmtTime(m.t)} · ayah ${m.ayah}</span>${m.source === 'teacher' ? '<span class="chip red">Teacher</span>' : m.status === 'confirmed' ? '<span class="chip red">AI · confirmed</span>' : '<span class="chip gold">AI suggestion</span>'}</div>
        <div class="row" style="gap:10px"><span class="quran" style="font-size:22px" lang="ar">${esc(m.word)}</span><span class="small">${esc(MARK_LABEL[m.type] || m.type)}${m.heard ? ` · heard «${esc(m.heard)}»` : ''}</span></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">${m.status === 'suggested' ? `<button class="btn sm" type="button" data-confirm="${m.id}">Confirm</button><button class="btn ghost sm" type="button" data-dismiss="${m.id}">Not a mistake</button>` : ''}<button class="btn gold sm" type="button" data-hear="${m.index}">${icons.play} Play correct</button></div>
      </div>`).join('') : '<p class="small muted">Mistakes appear here as the student recites.</p>';
}

export function wireMarking(root, session, { canMark = () => true, onBlocked = () => {}, onChange = () => {}, timeNow = null } = {}) {
  root.querySelector('#wordsBox').addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]');
    if (!el) return;
    if (!canMark()) { onBlocked(); return; }
    const t0 = session.started;
    if (timeNow) session.started = Date.now() - timeNow(); // review: time from the audio position
    session.tapWord(+el.dataset.i, 'teacher');
    if (timeNow) session.started = t0;
    onChange();
  });
  let hearAudio = null;
  root.querySelector('#log').addEventListener('click', (e) => {
    const h = e.target.closest('[data-hear]');
    if (h) {
      const w = session.words[+h.dataset.hear];
      if (hearAudio) hearAudio.pause();
      const wasRunning = session.listen ? session.pause() : false;
      hearAudio = new Audio(audioUrl(store.get().settings.reciter, w.number));
      const done = () => { hearAudio = null; if (wasRunning) session.resume(); };
      hearAudio.onended = done;
      hearAudio.onerror = () => { toast('Audio could not load.'); done(); };
      hearAudio.play().catch(done);
      return;
    }
    const c = e.target.closest('[data-confirm]');
    const d = e.target.closest('[data-dismiss]');
    if (c) { session.setMark(c.dataset.confirm, 'confirmed'); onChange(); }
    if (d) { session.setMark(d.dataset.dismiss, 'dismissed'); onChange(); }
  });
}

// ---------- Grade form ----------
export function gradeForm(root, session, { studentName, blob, onSubmit, title = 'Grade and submit', note = '' }) {
  const active = session.activeMarks().filter((m) => m.type !== 'peek' && m.status !== 'suggested');
  const hifzDefault = Math.max(0, 40 - active.filter((m) => ['wrong', 'skipped', 'teacher', 'extra'].includes(m.type)).length * 2);
  const vals = { hifz: hifzDefault, tajweed: 30, makharij: 20, waqf: 10 };
  const ROWS = [['hifz', 'Hifz accuracy', 40], ['tajweed', 'Tajweed', 30], ['makharij', 'Makharij', 20], ['waqf', 'Waqf and fluency', 10]];

  root.innerHTML = `
    <form class="stack" id="gradeForm">
      <div class="page-head"><span class="chip gold" style="align-self:flex-start">Teacher view</span><h1>${esc(title)}</h1><p class="small muted">${esc(studentName)} · ${esc(session.title)}</p></div>
      <div class="card row">
        <div class="icon-tile red"><span class="dot" style="width:12px;height:12px;border-radius:6px"></span></div>
        <div class="grow"><h3>${note ? esc(note) : `Session recorded · ${fmtTime(session.elapsed())}`}</h3><div class="xs muted">${blob ? 'Audio' : 'No new audio'} and ${active.length} ${active.length === 1 ? 'mark' : 'marks'} will be saved together</div></div>
      </div>
      <div class="card stack-s">
        <h2>Mistakes in this session</h2>
        ${active.length ? active.map((m) => `<div class="row"><span class="quran" style="font-size:20px;padding:0 8px;border-radius:8px;background:var(--red-tint);border-bottom:2px solid var(--red)" lang="ar">${esc(m.word)}</span><span class="grow small">Ayah ${m.ayah} · ${esc(MARK_LABEL[m.type] || m.type)}</span><span class="chip red">${m.source === 'teacher' ? 'Teacher' : 'AI · confirmed'}</span></div>`).join('') : '<p class="small muted">No mistakes marked.</p>'}
        <p class="xs muted">Unconfirmed AI suggestions are not counted.</p>
      </div>
      <div class="card stack-s">
        <h2>Grade</h2>
        ${ROWS.map(([k, l, max]) => `<div class="rubric-row"><label class="small" for="r-${k}">${l}</label><input type="range" id="r-${k}" min="0" max="${max}" value="${vals[k]}" data-k="${k}"><span class="small" style="text-align:right"><b id="v-${k}">${vals[k]}</b>/${max}</span></div>`).join('')}
        <div class="spread divider"><span class="small muted">Total</span><span class="row" style="gap:8px"><b style="font-size:20px" id="total">0</b><span class="chip" id="bandChip"></span></span></div>
        <p class="xs muted">Hifz starts at 40 minus 2 for each confirmed mistake. Adjust any score.</p>
      </div>
      <div class="card stack-s">
        <label class="label" for="comment">Comment for ${esc(studentName)} and parents</label>
        <textarea class="input" id="comment" maxlength="600" placeholder="What went well, what to practise"></textarea>
      </div>
      <div class="row-wrap">
        <button class="btn danger grow" type="submit" data-decision="repeat">Repeat portion</button>
        <button class="btn grow" type="submit" data-decision="pass">Pass · open next</button>
      </div>
    </form>`;

  const sum = () => {
    const total = ROWS.reduce((a, [k]) => a + vals[k], 0);
    root.querySelector('#total').textContent = total;
    const b = band(total);
    const chip = root.querySelector('#bandChip');
    chip.textContent = b.label;
    chip.className = `chip ${b.cls}`;
    return total;
  };
  root.querySelectorAll('input[type="range"]').forEach((r) => r.addEventListener('input', () => {
    vals[r.dataset.k] = +r.value;
    root.querySelector(`#v-${r.dataset.k}`).textContent = r.value;
    sum();
  }));
  sum();

  let decision = 'pass';
  let busy = false;
  root.querySelectorAll('[data-decision]').forEach((b) => b.addEventListener('click', () => { decision = b.dataset.decision; }));
  root.querySelector('#gradeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    if (e.submitter && e.submitter.dataset.decision) decision = e.submitter.dataset.decision;
    const total = sum();
    root.querySelectorAll('[data-decision]').forEach((b) => { b.disabled = true; });
    try {
      await onSubmit({ grade: { ...vals, total }, comment: root.querySelector('#comment').value.trim(), decision });
    } catch (err) {
      console.error(err);
      toast('Could not save. Check your connection and try again.');
      busy = false;
      root.querySelectorAll('[data-decision]').forEach((b) => { b.disabled = false; });
    }
  });
}
