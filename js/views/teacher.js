import * as store from '../store.js';
import { RecitationSession, MARK_LABEL } from '../session.js';
import { renderWords } from './words.js';
import { speechSupported, recordingSupported } from '../speech.js';
import { TOTAL_PAGES, audioUrl } from '../quran.js';
import { esc, fmtDate, fmtTime, band, uid, loading, errorBox, toast } from '../ui.js';
import { icons } from '../icons.js';

export function teacherHome(root) {
  const s = store.get();
  const sessions = s.history.filter((h) => h.kind === 'teacher').slice(0, 5);
  const todayCount = s.history.filter((h) => h.kind === 'teacher' && new Date(h.created).toDateString() === new Date().toDateString()).length;

  root.innerHTML = `
    <div class="stack">
      <div class="page-head">
        <span class="chip gold" style="align-self:flex-start">Teacher view</span>
        <h1>As-salamu alaykum, ${esc(s.profile?.name || '')}</h1>
        <div class="small muted">${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>
      <div class="stats">
        <div class="stat"><b>${s.students.length}</b><span>Students</span></div>
        <div class="stat"><b>${todayCount}</b><span>Sessions today</span></div>
        <div class="stat"><b>${s.history.filter((h) => h.kind === 'teacher').length}</b><span>Recorded</span></div>
      </div>
      <a class="btn block" href="#/live">${icons.live} Start a live session</a>
      <div class="card stack-s">
        <div class="spread"><h2>My students</h2></div>
        <div id="studentList">
          ${s.students.length ? s.students.map((st) => `
            <div class="list-item">
              <div class="icon-tile">${esc(st.name.slice(0, 1).toUpperCase())}</div>
              <div class="grow"><h3>${esc(st.name)}</h3><div class="xs muted">${s.history.filter((h) => h.kind === 'teacher' && h.student === st.name).length} sessions recorded</div></div>
              <a class="btn sm" href="#/live?student=${st.id}">Start</a>
              <button class="icon-btn" type="button" data-del="${st.id}" aria-label="Remove ${esc(st.name)}">${icons.trash}</button>
            </div>`).join('') : '<p class="small muted">Add the students you teach.</p>'}
        </div>
        <form class="row" id="addStudent" style="margin-top:6px">
          <label class="sr-only" for="newStudent">Student name</label>
          <input class="input grow" id="newStudent" placeholder="Student name" required maxlength="60">
          <button class="btn sm" type="submit">${icons.plus} Add</button>
        </form>
      </div>
      <div class="card stack-s">
        <div class="spread"><h2>Recent sessions</h2><a class="small" href="#/history?f=teacher">All recordings</a></div>
        ${sessions.length ? sessions.map((h) => `
          <a class="list-item" href="#/history/${h.id}" style="text-decoration:none;color:inherit">
            <div class="icon-tile solid">${icons.users}</div>
            <div class="grow"><h3>${esc(h.student)} · ${esc(h.title.split(' · ')[0])}</h3><div class="xs muted">${esc(fmtDate(h.created))} · ${fmtTime(h.duration)}</div></div>
            ${h.grade ? `<b>${h.grade.total}</b>` : ''}
          </a>`).join('') : '<p class="small muted">No sessions yet.</p>'}
      </div>
      <div class="notice">Live sessions today work <b>in person</b>: the student recites into your phone or tablet while you follow on screen. Online video sessions arrive with accounts, using the same screen.</div>
    </div>`;

  root.querySelector('#addStudent').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = root.querySelector('#newStudent').value.trim();
    if (!name) return;
    store.update((x) => { x.students.push({ id: uid(), name }); });
    teacherHome(root);
  });
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Remove this student from your list? Their recordings stay saved.')) return;
    store.update((x) => { x.students = x.students.filter((st) => st.id !== b.dataset.del); });
    teacherHome(root);
  }));
}

export default async function liveView(root, params) {
  const s = store.get();
  const student = s.students.find((x) => x.id === params.student);
  if (!params.page) return setup(root, student);

  const page = Math.min(TOTAL_PAGES, Math.max(1, parseInt(params.page, 10) || 1));
  const part = params.part || 'all';
  const studentName = params.name || student?.name || 'Student';
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
          <span class="chip gold" style="align-self:flex-start">Teacher view · live session</span>
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
      <div class="session-grid">
        <div class="stack-s">
          <div class="mushaf-frame"><div class="mushaf-inner" id="wordsBox"></div></div>
          <div class="live-text" id="live" lang="ar"></div>
          <div class="legend">
            <span><i style="background:var(--green-hl);border-bottom:2px solid var(--green)"></i>Reciting now</span>
            <span><i style="background:var(--gold-tint);border-bottom:2px dotted #B08A3A"></i>AI suggestion</span>
            <span><i style="background:var(--red-tint);border-bottom:2px solid var(--red)"></i>Teacher mark or confirmed</span>
            <span>Tap a word to mark it · tap an AI suggestion to confirm</span>
          </div>
        </div>
        <aside class="card stack-s session-side" aria-label="Mistake log">
          <div class="spread"><h2>Mistake log</h2><div class="row" style="gap:6px"><span class="chip gold" id="aiCount">AI 0</span><span class="chip red" id="tCount">Teacher 0</span></div></div>
          <div class="log" id="log"></div>
          <p class="xs muted">Each mark is saved with its time in the recording, so the student and parents can replay the exact moment.</p>
        </aside>
      </div>
      <div id="gradeBox"></div>
    </div>`;

  const startBtn = root.querySelector('#startBtn');
  const gradeBtn = root.querySelector('#gradeBtn');

  function paint() {
    if (phase !== 'live') return;
    root.querySelector('#wordsBox').innerHTML = renderWords(session, { hide: false, tappable: true });
    const active = session.activeMarks();
    root.querySelector('#aiCount').textContent = `AI ${active.filter((m) => m.source === 'ai' && m.type !== 'peek').length}`;
    root.querySelector('#tCount').textContent = `Teacher ${active.filter((m) => m.source === 'teacher').length}`;
    root.querySelector('#log').innerHTML = active.length ? active.map((m) => `
      <div class="log-item">
        <div class="spread"><span class="xs muted">${fmtTime(m.t)} · ayah ${m.ayah}</span>${m.source === 'teacher' ? '<span class="chip red">Teacher</span>' : m.status === 'confirmed' ? '<span class="chip red">AI · confirmed</span>' : '<span class="chip gold">AI suggestion</span>'}</div>
        <div class="row" style="gap:10px"><span class="quran" style="font-size:22px" lang="ar">${esc(m.word)}</span><span class="small">${esc(MARK_LABEL[m.type] || m.type)}${m.heard ? ` · heard «${esc(m.heard)}»` : ''}</span></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">${m.status === 'suggested' ? `<button class="btn sm" type="button" data-confirm="${m.id}">Confirm</button><button class="btn ghost sm" type="button" data-dismiss="${m.id}">Not a mistake</button>` : ''}<button class="btn gold sm" type="button" data-hear="${m.index}">${icons.play} Play correct</button></div>
      </div>`).join('') : '<p class="small muted">Mistakes appear here as the student recites.</p>';
    startBtn.innerHTML = session.running ? `${icons.pause} Pause` : session.started ? `${icons.mic} Resume` : `${icons.mic} Start session`;
    gradeBtn.disabled = !session.started;
  }

  root.querySelector('#wordsBox').addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]');
    if (!el) return;
    if (!session.started) { toast('Start the session first, so the mark is saved at the right time.'); return; }
    session.tapWord(+el.dataset.i, 'teacher');
  });
  let hearAudio = null;
  root.querySelector('#log').addEventListener('click', (e) => {
    const h = e.target.closest('[data-hear]');
    if (h) {
      const w = session.words[+h.dataset.hear];
      if (hearAudio) hearAudio.pause();
      const wasRunning = session.pause();
      hearAudio = new Audio(audioUrl(store.get().settings.reciter, w.number));
      const done = () => { hearAudio = null; if (wasRunning) session.resume(); };
      hearAudio.onended = done;
      hearAudio.onerror = () => { toast('Audio could not load.'); done(); };
      hearAudio.play().catch(done);
      return;
    }
    const c = e.target.closest('[data-confirm]');
    const d = e.target.closest('[data-dismiss]');
    if (c) session.setMark(c.dataset.confirm, 'confirmed');
    if (d) session.setMark(d.dataset.dismiss, 'dismissed');
  });

  startBtn.addEventListener('click', async () => {
    if (!session.started) {
      await session.start();
      root.querySelector('#recChip').hidden = !session.recording;
      tick = setInterval(() => { const t = root.querySelector('#timer'); if (t) t.textContent = fmtTime(session.elapsed()); }, 500);
    } else if (session.running) {
      session.pause();
    } else {
      session.resume();
    }
    paint();
  });

  gradeBtn.addEventListener('click', async () => {
    phase = 'grade';
    clearInterval(tick);
    const blob = await session.stop();
    gradeForm(root, session, { studentName, blob });
  });

  paint();
  return () => {
    clearInterval(tick);
    root.closest('.view')?.classList.remove('wide');
    if (session.running) session.stop();
  };
}

function setup(root, student) {
  const s = store.get();
  root.innerHTML = `
    <form class="stack" id="setupForm">
      <div class="page-head"><span class="chip gold" style="align-self:flex-start">Teacher view</span><h1>Start a live session</h1>
        <p class="small muted">The student recites into this device. You see the page, AI suggestions appear as they recite, and you add your own marks. The whole session is recorded.</p></div>
      <div class="card stack-s">
        <div class="field"><label for="stSel">Student</label>
          ${s.students.length ? `<select class="input" id="stSel">${s.students.map((x) => `<option value="${x.id}" ${student && x.id === student.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
            : `<input class="input" id="stName" placeholder="Student name" required maxlength="60">`}
        </div>
        <div class="row-wrap">
          <div class="field" style="flex:1 1 120px"><label for="pg">Page (1–604)</label><input class="input" id="pg" type="number" min="1" max="604" value="${s.settings.lastPage || 1}" required inputmode="numeric"></div>
          <div class="field" style="flex:1 1 160px"><label for="pt">Portion</label><select class="input" id="pt"><option value="all">Whole page</option><option value="1/2">First half</option><option value="2/2">Second half</option></select></div>
        </div>
      </div>
      <button class="btn block" type="submit">Open the page</button>
    </form>`;
  root.querySelector('#setupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let id = root.querySelector('#stSel')?.value;
    const nameInput = root.querySelector('#stName');
    if (nameInput) {
      const name = nameInput.value.trim();
      id = uid();
      store.update((x) => { x.students.push({ id, name }); });
    }
    const q = new URLSearchParams({ student: id, page: root.querySelector('#pg').value, part: root.querySelector('#pt').value });
    location.hash = `#/live?${q.toString()}`;
  });
}

function gradeForm(root, session, { studentName, blob }) {
  const s = store.get();
  const active = session.activeMarks().filter((m) => m.type !== 'peek');
  const hifzDefault = Math.max(0, 40 - active.filter((m) => ['wrong', 'skipped', 'teacher', 'extra'].includes(m.type)).length * 2);
  const vals = { hifz: hifzDefault, tajweed: 30, makharij: 20, waqf: 10 };
  const ROWS = [['hifz', 'Hifz accuracy', 40], ['tajweed', 'Tajweed', 30], ['makharij', 'Makharij', 20], ['waqf', 'Waqf and fluency', 10]];
  root.closest('.view')?.classList.remove('wide');

  root.innerHTML = `
    <form class="stack" id="gradeForm">
      <div class="page-head"><span class="chip gold" style="align-self:flex-start">Teacher view</span><h1>Grade and submit</h1><p class="small muted">${esc(studentName)} · ${esc(session.title)}</p></div>
      <div class="card row">
        <div class="icon-tile" style="background:var(--red-tint)"><span class="dot" style="width:12px;height:12px;border-radius:6px"></span></div>
        <div class="grow"><h3>Session recorded · ${fmtTime(session.elapsed())}</h3><div class="xs muted">${blob ? 'Audio' : 'No audio'} and ${active.length} ${active.length === 1 ? 'mark' : 'marks'} will be saved together</div></div>
      </div>
      <div class="card stack-s">
        <h2>Mistakes in this session</h2>
        ${active.length ? active.map((m) => `<div class="row"><span class="quran" style="font-size:20px;padding:0 8px;border-radius:8px;background:var(--red-tint);border-bottom:2px solid var(--red)" lang="ar">${esc(m.word)}</span><span class="grow small">Ayah ${m.ayah} · ${esc(MARK_LABEL[m.type] || m.type)}</span><span class="chip ${m.source === 'teacher' ? 'red' : m.status === 'confirmed' ? 'red' : 'gold'}">${m.source === 'teacher' ? 'Teacher' : m.status === 'confirmed' ? 'AI · confirmed' : 'AI suggestion'}</span></div>`).join('') : '<p class="small muted">No mistakes marked.</p>'}
      </div>
      <div class="card stack-s">
        <h2>Grade</h2>
        ${ROWS.map(([k, l, max]) => `<div class="rubric-row"><label class="small" for="r-${k}">${l}</label><input type="range" id="r-${k}" min="0" max="${max}" value="${vals[k]}" data-k="${k}"><span class="small" style="text-align:right"><b id="v-${k}">${vals[k]}</b>/${max}</span></div>`).join('')}
        <div class="spread" style="border-top:1px solid #EFE9DD;padding-top:10px"><span class="small muted">Total</span><span class="row" style="gap:8px"><b style="font-size:20px" id="total">0</b><span class="chip" id="bandChip"></span></span></div>
        <p class="xs muted">Hifz starts at 40 minus 2 for each mistake marked. Adjust any score.</p>
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
  root.querySelectorAll('[data-decision]').forEach((b) => b.addEventListener('click', () => { decision = b.dataset.decision; }));
  root.querySelector('#gradeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter && e.submitter.dataset.decision) decision = e.submitter.dataset.decision;
    const total = sum();
    const saved = await session.save({
      kind: 'teacher', student: studentName, teacher: s.profile?.name,
      grade: { ...vals, total }, comment: root.querySelector('#comment').value.trim(), decision, blob,
    });
    toast('Session saved with its recording and marks.');
    location.hash = `#/history/${saved.id}`;
  });
}
