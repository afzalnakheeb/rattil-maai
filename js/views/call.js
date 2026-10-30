// Live video session. Teacher and student each open #/call/<id> on their own device.
// The student's device runs the AI check; the teacher sees it live, confirms or adds marks,
// records the whole call (both voices), grades, and the result appears for the student.

import * as store from '../store.js';
import * as cloud from '../cloud.js';
import { RecitationSession } from '../session.js';
import { CallLink, Mixer, getMedia } from '../call.js';
import { renderWords } from './words.js';
import { markingPanel, paintMarking, wireMarking, gradeForm, avatar } from './teacher.js';
import { speechSupported } from '../speech.js';
import { esc, fmtTime, loading, errorBox, toast, onLeave, alive, todayKey } from '../ui.js';
import { passPlan } from '../passplan.js';
import { icons } from '../icons.js';

const STATE_LABEL = {
  new: 'Starting', joining: 'Joining', waiting: 'Waiting for the other person', connecting: 'Connecting',
  connected: 'Connected', reconnecting: 'Reconnecting', 'room-error': 'Connection problem', ended: 'Call ended',
};

function throttle(fn, ms) {
  let t = null; let last = 0;
  return () => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(); return; }
    clearTimeout(t);
    t = setTimeout(() => { last = Date.now(); fn(); }, ms - (now - last));
  };
}

export default async function callView(root, params) {
  if (!cloud.user()) { root.innerHTML = '<div class="empty card">Sign in with Google to join video sessions.</div>'; return; }
  root.innerHTML = loading('Opening the session');
  let call;
  try { call = await cloud.getCall(params.id); } catch { call = null; }
  if (!alive(root)) return;
  if (!call) { root.innerHTML = errorBox('This session was not found, or it is not yours.'); return; }
  const me = cloud.user().id;
  const role = call.teacher_id === me ? 'teacher' : call.student_id === me ? 'student' : null;
  if (!role) { root.innerHTML = errorBox('This session belongs to another teacher and student.'); return; }
  if (call.status === 'ended') {
    root.innerHTML = `<div class="stack"><div class="empty card stack-s"><h2>This session has ended</h2><p class="small muted">Recordings and grades are in History.</p><div><a class="btn sm" href="#/history">Open History</a></div></div></div>`;
    return;
  }
  const other = role === 'teacher' ? call.student : call.teacher;
  const otherName = other?.name || (role === 'teacher' ? 'Student' : 'Teacher');
  if (!Array.isArray(call.portions) || !call.portions.length) call.portions = [{ page: 1, part: 'all' }];
  const portions = call.portions;

  // ---- Pre-join: a tap is needed for camera, microphone and sound on phones ----
  root.closest('.view')?.classList.add('wide');
  root.innerHTML = `
    <div class="stack" style="max-width:560px;margin:0 auto">
      <div class="call-stage"><div class="overlay">
        ${avatar(other, 72)}
        <h2>${role === 'teacher' ? `Video session with ${esc(otherName)}` : `${esc(otherName)} is ready for your recitation`}</h2>
        <p class="small muted">Portion: page ${portions.map((p) => Number(p.page) || 1).join(', ')}${portions[0].part !== 'all' ? ` (${portions[0].part === '1/2' ? 'first half' : 'second half'})` : ''}</p>
      </div></div>
      <div class="card stack-s">
        <h2>Before you join</h2>
        <p class="small muted">${role === 'student'
          ? 'Your teacher will see and hear you. The AI listens on this phone and shows your teacher what it hears. Headphones help the AI hear only you.'
          : 'The whole call is recorded (both voices) and saved with your marks and grade.'}</p>
        <label class="choice" style="padding:10px 12px"><input type="checkbox" id="camOn" checked><span class="small"><b>Camera on</b><br><span class="muted">Turn off to join with audio only.</span></span></label>
      </div>
      <button class="btn block lg" id="join" type="button">${icons.video} Join the session</button>
      <a class="btn ghost block" href="#/" id="notNow">Not now</a>
    </div>`;

  // A teacher who changes their mind ends the call, so the student stops ringing.
  root.querySelector('#notNow').addEventListener('click', () => { if (role === 'teacher') cloud.updateCall(call.id, { status: 'ended' }).catch(() => {}); });
  // A teacher who leaves before joining (Back, another tab) also ends the ringing call.
  let joinedRoom = false;
  onLeave(root, () => { if (role === 'teacher' && !joinedRoom) cloud.updateCall(call.id, { status: 'ended' }).catch(() => {}); });
  root.querySelector('#join').addEventListener('click', async () => {
      const btn = root.querySelector('#join');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner sm"></span> Starting camera…';
      let stream;
      try { stream = await getMedia({ video: root.querySelector('#camOn').checked }); } catch (e) {
        btn.disabled = false;
        btn.innerHTML = `${icons.video} Try again`;
        toast(e && e.name === 'NotAllowedError' ? 'Allow the camera and microphone for rattilmai.com in your browser settings.' : 'Camera or microphone not available on this device.');
        return;
      }
      // The user may have left while the camera was starting.
      if (!alive(root)) { stream.getTracks().forEach((t) => t.stop()); return; }
      if (stream.noCamera && root.querySelector('#camOn').checked) toast(stream.cameraBlocked ? 'The camera is blocked, so you joined with audio only.' : 'No camera found, so you joined with audio only.');
      joinedRoom = true;
      if (role === 'teacher') await teacherRoom(root, call, stream, otherName);
      else await studentRoom(root, call, stream, otherName);
  });
}

function stageHtml(otherName, role) {
  return `
    <div class="call-stage" id="stage">
      <video class="remote" id="remoteVid" autoplay playsinline></video>
      <div class="overlay" id="waitOverlay"><span class="avatar" style="width:72px;height:72px;font-size:26px">${esc((otherName || '?').slice(0, 1).toUpperCase())}</span><h2 id="waitText">Waiting for ${esc(otherName)} to join…</h2><p class="small" id="waitSub">${role === 'teacher' ? 'They will get a call notification in the app.' : 'Your teacher will connect in a moment.'}</p></div>
      <div class="self"><video id="selfVid" autoplay playsinline muted></video></div>
      <span class="status" id="callStatus"><span class="dot gold"></span><span id="statusText">Joining</span></span>
    </div>
    <div class="call-controls">
      <button class="icon-btn" id="micBtn" type="button" aria-label="Mute microphone" aria-pressed="false">${icons.mic}</button>
      <button class="icon-btn" id="camBtn" type="button" aria-label="Turn camera off" aria-pressed="false">${icons.video}</button>
      <button class="icon-btn" id="shareBtn" type="button" aria-label="Share session link">${icons.link}</button>
      <button class="btn solid-red" id="endBtn" type="button">${icons.hangup} Leave</button>
    </div>`;
}

function wireStage(root, link, stream, { otherName, onEnd }) {
  root.querySelector('#selfVid').srcObject = stream;
  if (!stream.getVideoTracks().length) root.querySelector('.self').hidden = true;
  const remoteVid = root.querySelector('#remoteVid');
  const overlay = root.querySelector('#waitOverlay');
  link.onRemote = (rs) => {
    if (remoteVid.srcObject !== rs) remoteVid.srcObject = rs;
    remoteVid.play().catch(() => {
      // Autoplay with sound was blocked: one tap starts it.
      if (root.querySelector('#tapSound')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'tapSound'; b.className = 'btn sm tap-sound'; b.textContent = 'Tap for sound';
      b.addEventListener('click', () => { remoteVid.play().then(() => b.remove()).catch(() => {}); });
      root.querySelector('#stage')?.appendChild(b);
    });
    overlay.hidden = rs.getVideoTracks().length > 0;
    if (!overlay.hidden) { root.querySelector('#waitText').textContent = `${otherName} joined with audio only`; root.querySelector('#waitSub').textContent = ''; }
    link._emit('remote-stream', rs);
  };
  link.onState = (s) => {
    const el = root.querySelector('#statusText');
    if (el) el.textContent = STATE_LABEL[s] || s;
    const dot = root.querySelector('#callStatus .dot');
    if (dot) dot.className = `dot ${s === 'connected' ? 'green' : s === 'reconnecting' || s === 'room-error' ? '' : 'gold'}`;
    if (s === 'room-error') toast('The session room could not connect. Check your internet connection.');
  };
  let micOff = false; let camOff = false;
  root.querySelector('#micBtn').addEventListener('click', (e) => {
    micOff = !micOff; link.setMuted('audio', micOff);
    e.currentTarget.innerHTML = micOff ? icons.micOff : icons.mic;
    e.currentTarget.classList.toggle('off', micOff);
    e.currentTarget.setAttribute('aria-pressed', String(micOff));
  });
  root.querySelector('#camBtn').addEventListener('click', (e) => {
    camOff = !camOff; link.setMuted('video', camOff);
    e.currentTarget.innerHTML = camOff ? icons.videoOff : icons.video;
    e.currentTarget.classList.toggle('off', camOff);
    e.currentTarget.setAttribute('aria-pressed', String(camOff));
  });
  root.querySelector('#shareBtn').addEventListener('click', async () => {
    const url = `${location.origin}/#/call/${link.callId}`;
    const text = `Join our Quran session on Recite With Me: ${url}`;
    try { if (navigator.share) await navigator.share({ title: 'Recite With Me', text }); else { await navigator.clipboard.writeText(url); toast('Session link copied'); } } catch { /* cancelled */ }
  });
  root.querySelector('#endBtn').addEventListener('click', () => onEnd());
  link.on('bye', () => {
    const wt = root.querySelector('#waitText');
    if (!wt) return;
    overlay.hidden = false;
    wt.textContent = `${otherName} left the session`;
    root.querySelector('#waitSub').textContent = 'They can rejoin from the same link.';
  });
}

// ===================== Teacher =====================
async function teacherRoom(root, call, stream, studentName) {
  const s = store.get();
  const mixer = new Mixer();
  let tick = null;
  let phase = 'live';
  let ended = false;
  let studentInfo = { speech: null };
  let link = null;
  let session = null;
  // Leaving the page at any moment (even while still joining) stops camera, microphone and room.
  const dispose = () => {
    if (ended) return;
    ended = true;
    clearInterval(tick);
    if (session && (session.running || session.recorder?.mr)) { try { session.stop(); } catch { /* ignore */ } }
    if (link) link.close();
    stream.getTracks().forEach((t) => t.stop());
    mixer.close();
  };
  // Moving to another page of the app ends the session for both; a reload can rejoin.
  onLeave(root, () => { if (!ended) cloud.updateCall(call.id, { status: 'ended' }).catch(() => {}); dispose(); });
  await mixer.resume();
  if (ended) return;
  mixer.add('me', stream);

  root.innerHTML = `
    <div class="call-layout">
      <aside class="stack-s call-side">${stageHtml(studentName, 'teacher')}</aside>
      <div class="stack call-main">
        <div class="spread" style="flex-wrap:wrap">
          <div class="page-head"><span class="chip gold" style="align-self:flex-start">Teacher view · video session</span><h1 style="font-size:18px" id="sTitle">${esc(studentName)}</h1></div>
          <div class="row-wrap">
            <span class="chip red" id="recChip" hidden><span class="dot"></span><span id="timer">0:00</span></span>
            <button class="btn" id="startBtn" type="button" disabled>${icons.mic} Start recitation</button>
            <button class="btn outline" id="gradeBtn" type="button" disabled>Finish and grade</button>
          </div>
        </div>
        <div id="studentNote"></div>
        <div id="work">${loading('Loading the page')}</div>
      </div>
    </div>`;

  link = new CallLink({ callId: call.id, role: 'teacher' });
  session = new RecitationSession({
    portions: call.portions, mode: 'teacher', listen: false, record: true, recordStream: mixer.stream,
    onUpdate: () => paint(), onNotice: (m) => toast(m),
  });
  const sendMarks = throttle(() => link.send('marks', { list: session.marksPacket() }), 250);
  const work = root.querySelector('#work');

  try { await session.load(); } catch {
    work.innerHTML = errorBox('The page could not load. Check your internet connection.');
  }
  if (ended) return;
  root.querySelector('#sTitle').textContent = `${studentName} · ${session.title}`;
  work.innerHTML = markingPanel({ hint: 'Tap a word to mark it · confirm or dismiss AI suggestions' });
  wireMarking(work, session, {
    canMark: () => session.started,
    onBlocked: () => toast('Press Start recitation first, so the mark is saved at the right time in the recording.'),
    onChange: () => sendMarks(),
  });

  const startBtn = root.querySelector('#startBtn');
  const gradeBtn = root.querySelector('#gradeBtn');
  function paint() {
    if (phase !== 'live') return;
    paintMarking(work, session);
    startBtn.innerHTML = session.running ? `${icons.pause} Pause` : session.started ? `${icons.mic} Resume` : `${icons.mic} Start recitation`;
    gradeBtn.disabled = !session.started;
  }
  function paintNote() {
    const el = root.querySelector('#studentNote');
    if (!el) return;
    el.innerHTML = studentInfo.speech === false
      ? `<div class="notice">${esc(studentName)}'s browser has no speech engine, so there are no AI suggestions. Tap words to mark mistakes.</div>`
      : studentInfo.notice ? `<div class="notice">${esc(studentName)}'s phone: ${esc(studentInfo.notice)}</div>` : '';
  }

  link.on('progress', (p) => session.applyProgress(p));
  link.on('ai', (m) => { if (session.running) { session.addRemoteMark(m); sendMarks(); } });
  link.on('state', (d) => { studentInfo = { ...studentInfo, ...d }; paintNote(); });
  link.on('peer-hello', () => {
    // Includes the progress so far, so a student who reloads continues where they were.
    link.send('sync', { running: session.running, started: !!session.started, marks: session.marksPacket(), phase, progress: session.started ? session.progressPacket() : null });
  });
  link.on('remote-stream', (rs) => mixer.add('student', rs));
  link.onState = link.onState || (() => {});
  wireStage(root, link, stream, { otherName: studentName, onEnd: () => leave() });
  const baseState = link.onState;
  link.onState = (st) => {
    baseState(st);
    startBtn.disabled = !(st === 'connected' || session.started);
    if (st === 'connected') cloud.updateCall(call.id, { status: 'active' }).catch(() => {});
  };

  startBtn.addEventListener('click', async () => {
    await mixer.resume();
    if (!session.started) {
      await session.start();
      root.querySelector('#recChip').hidden = !session.recording;
      tick = setInterval(() => { const t = root.querySelector('#timer'); if (t) t.textContent = fmtTime(session.elapsed()); }, 500);
      link.send('cmd', { a: 'start' });
    } else if (session.running) { session.pause(); link.send('cmd', { a: 'pause' }); }
    else { session.resume(); link.send('cmd', { a: 'resume' }); }
    paint();
  });

  gradeBtn.addEventListener('click', async () => {
    phase = 'grade';
    clearInterval(tick);
    link.send('cmd', { a: 'finish' });
    const blob = await session.stop();
    startBtn.hidden = true; gradeBtn.hidden = true;
    root.querySelector('#recChip').hidden = true;
    gradeForm(work, session, {
      studentName, blob, title: 'Grade the recitation',
      onSubmit: async ({ grade, comment, decision }) => {
        const saved = await session.save({
          kind: 'online', student: studentName, teacher: s.profile?.name,
          studentId: call.student_id, teacherId: call.teacher_id, callId: call.id,
          grade, comment, decision, blob,
        });
        link.send('graded', { id: saved.id, total: Number(grade.total) || 0, decision, comment });
        work.innerHTML = `
          <div class="card stack-s">
            <div class="spread"><h2>Saved · ${grade.total}/100</h2><span class="chip ${decision === 'pass' ? '' : 'red'}">${decision === 'pass' ? 'Pass' : 'Repeat'}</span></div>
            <p class="small muted">${esc(studentName)} can see the grade, the marks and the recording now.</p>
            <div class="row-wrap"><a class="btn sm outline" href="#/history/${encodeURIComponent(saved.id)}">Open the recording</a><button class="btn sm" id="again" type="button">Another portion</button></div>
          </div>`;
        work.querySelector('#again').addEventListener('click', () => { leave(true).then(() => { location.hash = `#/live?student=u:${call.student_id}&online=1`; }); });
      },
    });
  });

  async function leave(silent = false) {
    if (ended) return;
    if (!silent && phase === 'live' && session.started && !confirm('Leave without grading? The recording of this session will not be saved.')) return;
    // Only the Leave button ends the call. A reload or a closed tab can rejoin the same session.
    cloud.updateCall(call.id, { status: 'ended' }).catch(() => {});
    dispose();
    if (!silent) location.hash = '#/';
  }

  paint();
  try { await link.start(stream); } catch (e) {
    if (ended) return;
    console.error(e);
    toast('Could not open the session room. Check your connection and try again.');
  }
}

// ===================== Student =====================
async function studentRoom(root, call, stream, teacherName) {
  let hide = store.get().settings.hideText !== false;
  let phase = 'waiting';
  let ended = false;
  let link = null;
  let session = null;
  let unwatch = () => {};
  const dispose = () => {
    if (ended) return;
    ended = true;
    unwatch();
    if (session && session.started) { try { session.stop(); } catch { /* ignore */ } }
    if (link) link.close();
    stream.getTracks().forEach((t) => t.stop());
  };
  onLeave(root, dispose);
  root.innerHTML = `
    <div class="call-layout">
      <aside class="stack-s call-side">${stageHtml(teacherName, 'student')}</aside>
      <div class="stack call-main">
        <div class="spread" style="flex-wrap:wrap">
          <div class="page-head"><span class="chip" style="align-self:flex-start">Video session</span><h1 style="font-size:18px" id="sTitle">With ${esc(teacherName)}</h1></div>
          <button class="btn ghost sm" id="toggleText" type="button" aria-pressed="${!hide}">${icons.eye} <span>${hide ? 'Show text' : 'Hide text'}</span></button>
        </div>
        <div class="notice green" id="phaseNote">Your teacher will start the recitation. Recite from memory when you see “Recite now”.</div>
        <div class="card" id="wordsCard">${loading('Loading the page')}</div>
        <div class="live-text" id="live" lang="ar"></div>
        <div id="result"></div>
      </div>
    </div>`;

  link = new CallLink({ callId: call.id, role: 'student' });
  session = new RecitationSession({
    portions: call.portions, mode: 'practice', listen: true, record: false,
    onUpdate: () => paintWords(),
    onInterim: (t) => { const el = root.querySelector('#live'); if (el) el.textContent = t; },
    onNotice: (m) => { toast(m); link.send('state', { notice: m }); },
    onProgress: () => sendProgress(),
  });
  const sendProgress = throttle(() => link.send('progress', session.progressPacket()), 200);
  try { await session.load(); } catch { root.querySelector('#wordsCard').innerHTML = errorBox('The page could not load. Check your internet connection.'); }
  if (ended) return;
  root.querySelector('#sTitle').textContent = `With ${teacherName} · ${session.title}`;
  // Every AI mark goes to the teacher as a suggestion.
  const aiMark = session._aiMark.bind(session);
  session._aiMark = (m) => { aiMark(m); link.send('ai', { index: m.index, type: m.type, heard: m.heard || '' }); };

  function paintWords() {
    const card = root.querySelector('#wordsCard');
    if (card && session.words.length) card.innerHTML = renderWords(session, { hide: hide && phase !== 'graded' });
  }
  function setPhase(p, text) {
    phase = p;
    const n = root.querySelector('#phaseNote');
    if (n) { n.textContent = text; n.className = `notice ${p === 'reciting' ? 'green' : ''}`; }
    paintWords();
  }

  root.querySelector('#toggleText').addEventListener('click', (e) => {
    hide = !hide;
    store.update((st) => { st.settings.hideText = hide; });
    e.currentTarget.setAttribute('aria-pressed', String(!hide));
    e.currentTarget.querySelector('span').textContent = hide ? 'Show text' : 'Hide text';
    paintWords();
  });

  async function startListening() {
    if (!session.started) await session.start();
    else session.resume();
    sendProgress();
  }

  link.on('cmd', async ({ a }) => {
    if (a === 'start') { await startListening(); setPhase('reciting', speechSupported() ? 'Recite now. Your teacher is listening and the AI is following.' : 'Recite now. Your teacher is listening.'); }
    if (a === 'pause') { session.pause(); sendProgress(); setPhase('paused', 'Paused by your teacher.'); }
    if (a === 'resume') { await startListening(); setPhase('reciting', 'Recite now. Continue where you stopped.'); }
    if (a === 'finish') { if (session.running) await session.stop(); sendProgress(); setPhase('grading', `${teacherName} is grading your recitation…`); }
  });
  link.on('marks', ({ list }) => session.applyMarks(list));
  link.on('sync', async (d) => {
    if (d.progress && !session.started) session.applyProgress({ ...d.progress, run: false });
    // The teacher's page restarted (reload) and lost its state: pause here too and wait for Start,
    // keeping this phone's progress so the teacher sees where the student was.
    if (!d.started && session.started && d.phase !== 'grade') {
      if (session.running) session.pause();
      setPhase('paused', `${teacherName} reconnected. They will start the recitation again.`);
      link.send('state', { speech: speechSupported() });
      sendProgress();
      return;
    }
    session.applyMarks(d.marks || []);
    if (d.phase === 'grade') setPhase('grading', `${teacherName} is grading your recitation…`);
    else if (d.running) { await startListening(); setPhase('reciting', 'Recite now. Continue where you stopped.'); }
    else if (d.started) setPhase('paused', 'Paused by your teacher.');
    link.send('state', { speech: speechSupported() });
    sendProgress();
  });
  link.on('graded', ({ id, total, decision, comment }) => {
    setPhase('graded', 'Your teacher has graded this recitation.');
    if (decision === 'pass') passPlan(call.portions);
    root.querySelector('#result').innerHTML = `
      <div class="card stack-s" style="border:1.5px solid var(--gold-line)">
        <div class="spread"><h2>${Number(total) || 0}/100</h2><span class="chip ${decision === 'pass' ? '' : 'red'}">${decision === 'pass' ? 'Pass · next portion opens' : 'Repeat this portion'}</span></div>
        ${comment ? `<p class="small"><b>${esc(teacherName)}:</b> ${esc(comment)}</p>` : ''}
        <div><a class="btn sm outline" href="#/history/${encodeURIComponent(String(id || ''))}">See marks and recording</a></div>
      </div>`;
  });

  wireStage(root, link, stream, { otherName: teacherName, onEnd: () => leave() });
  async function leave() {
    if (ended) return;
    dispose();
    location.hash = '#/';
  }
  // When the teacher ends the session, close it here too (instead of reconnecting forever).
  unwatch = cloud.onCalls((c, ev) => {
    if (ended || !c || c.id !== call.id || c.status !== 'ended') return;
    dispose();
    const res = root.querySelector('#result');
    const n = root.querySelector('#phaseNote');
    if (n) { n.className = 'notice'; n.textContent = `${teacherName} ended the session.`; }
    if (res && !res.innerHTML.trim()) res.innerHTML = '<div class="card stack-s"><h2>Session ended</h2><p class="small muted">Recordings and grades are in History.</p><div class="row-wrap"><a class="btn sm" href="#/history">Open History</a><a class="btn sm ghost" href="#/">Home</a></div></div>';
  });
  paintWords();
  try { await link.start(stream); if (!ended) link.send('state', { speech: speechSupported() }); } catch (e) {
    if (ended) return;
    console.error(e);
    toast('Could not open the session room. Check your connection and try again.');
  }
}
