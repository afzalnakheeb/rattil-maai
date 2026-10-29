// Teach with us (teacher application) and Find me a teacher (student request).
// Both need Google sign-in; the admin panel reviews them.

import * as cloud from '../cloud.js';
import * as store from '../store.js';
import { isCloud } from '../account.js';
import { esc, loading, errorBox, toast, alive, onLeave, fmtTime } from '../ui.js';
import { Recorder, recordingSupported } from '../speech.js';
import { getMeta } from '../quran.js';
import { icons } from '../icons.js';
import { LANGUAGES, TEACHES, langName } from '../clean.js';

const MAX_LANGS = 8;

export function langPicker(name, selected = [], { max = MAX_LANGS, compact = false } = {}) {
  return `<div class="${compact ? 'pill-picks' : 'pick-grid'}" role="group" data-max="${max}">${LANGUAGES.map(([c, en, native]) => `
    <label class="${compact ? 'pill' : 'pick'}"><input type="checkbox" name="${name}" value="${c}" ${selected.includes(c) ? 'checked' : ''}><span>${esc(en)}${!compact && native !== en ? ` <span class="muted" lang="${c}">${esc(native)}</span>` : ''}</span></label>`).join('')}</div>`;
}

// "Which language do you speak best?" — one main language (mother tongue), big buttons for the common ones.
const MAIN = ['ar', 'en', 'ur', 'ms', 'id', 'fr'];
export function mainLanguagePicker(name, selected = '', { who = 'you' } = {}) {
  const other = selected && !MAIN.includes(selected) ? selected : '';
  return `<div class="main-lang" role="radiogroup" aria-label="Main language">
    ${MAIN.map((c) => { const [, en, native] = LANGUAGES.find((l) => l[0] === c); return `
      <label class="pick big"><input type="radio" name="${name}" value="${c}" ${selected === c ? 'checked' : ''} required><span><b>${esc(en)}</b>${native !== en ? `<span class="muted" lang="${c}">${esc(native)}</span>` : ''}</span></label>`; }).join('')}
    <label class="pick big"><input type="radio" name="${name}" value="other" ${other ? 'checked' : ''}><span><b>Other</b><select class="input" name="${name}-other" aria-label="Other main language" style="margin-top:6px;min-height:38px">
      <option value="">Choose…</option>${LANGUAGES.filter(([c]) => !MAIN.includes(c)).map(([c, en, native]) => `<option value="${c}" ${other === c ? 'selected' : ''}>${esc(en)} · ${esc(native)}</option>`).join('')}</select></span></label>
  </div>`;
}
function readMain(form, name) {
  const v = form.querySelector(`input[name="${name}"]:checked`)?.value || '';
  if (v === 'other') return form.querySelector(`select[name="${name}-other"]`).value || '';
  return v;
}
function wireMain(form, name, onChange = () => {}) {
  const sel = form.querySelector(`select[name="${name}-other"]`);
  sel?.addEventListener('change', () => { if (sel.value) form.querySelector(`input[name="${name}"][value="other"]`).checked = true; onChange(); });
  form.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener('change', onChange));
}

const checked = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);

function limitPicks(root) {
  root.querySelectorAll('.pick-grid[data-max]').forEach((g) => g.addEventListener('change', (e) => {
    const max = +g.dataset.max;
    if (g.querySelectorAll('input:checked').length > max) { e.target.checked = false; toast(`Choose up to ${max}.`); }
  }));
}

// A teacher's public card (students, parents and the admin see this).
export function teacherCard(t, { extra = '' } = {}) {
  const years = t.years_experience;
  return `
    <div class="card stack-s teacher-card">
      <div class="row">
        <span class="avatar" style="width:52px;height:52px;font-size:20px">${esc((t.name || '?').slice(0, 1).toUpperCase())}</span>
        <div class="grow"><h3>${esc(t.name)}</h3>
          <div class="xs muted">${t.gender === 'female' ? 'Female teacher' : 'Male teacher'}${t.country ? ` · ${esc(t.country)}` : ''} · ${years} ${years === 1 ? 'year' : 'years'} teaching</div></div>
        <span class="chip">${icons.check.replace('<svg', '<svg width="13" height="13"')} Verified</span>
      </div>
      <div class="row-wrap">${t.languages.map((l, i) => `<span class="chip ${i === 0 ? '' : 'plain'}">${esc(langName(l))}${i === 0 ? ' · mother tongue' : ''}</span>`).join('')}</div>
      ${t.ijazah ? `<p class="small"><b>Ijazah:</b> ${esc(t.ijazah)}</p>` : ''}
      ${t.teaches.length ? `<p class="xs muted">Teaches: ${t.teaches.map((k) => esc((TEACHES.find((x) => x[0] === k) || [k, k])[1])).join(' · ')}</p>` : ''}
      ${t.bio ? `<p class="small">${esc(t.bio)}</p>` : ''}
      ${t.availability ? `<p class="xs muted">Available: ${esc(t.availability)}</p>` : ''}
      ${extra}
    </div>`;
}

const STATUS_NOTE = {
  pending: ['gold', 'Under review', 'We review every application. You will see the result here.'],
  approved: ['', 'Approved', 'You are a verified teacher. Students who speak your languages will be assigned to you, and they appear on your Home screen.'],
  declined: ['red', 'Not approved', ''],
};

// ===================== Teach with us =====================
export async function applyView(root) {
  if (!isCloud()) {
    root.innerHTML = `<div class="stack"><div class="page-head"><h1>Teach the Quran with us</h1></div>
      <div class="card stack-s"><p class="small">Teachers from every country can apply. Sign in with Google first so your application and your students stay with your account.</p>
      <a class="btn" href="#/signin">Sign in with Google</a></div></div>`;
    return;
  }
  root.innerHTML = loading('Loading');
  let app = null;
  try { app = await cloud.myApplication(); } catch { /* offline */ }
  if (!alive(root)) return;
  const s = store.get();
  const a = app || { name: s.profile?.name || '', languages: [], teaches: ['hifz', 'tajweed'], gender: '', years_experience: '', country: '', hours_per_week: 5 };
  const locked = app && app.status !== 'pending';
  const st = app ? STATUS_NOTE[app.status] : null;

  root.innerHTML = `
    <div class="stack">
      <div class="page-head"><p class="eyebrow">Teach with Recite With Me</p><h1>Apply to teach the Quran</h1>
        <p class="small muted">Teach students from around the world, live on video, with the AI following every word. Students are matched to you by language.</p></div>
      ${app ? `<div class="card stack-s"><div class="spread"><h2>Your application</h2><span class="chip ${st[0]}">${st[1]}</span></div>
        <p class="small muted">${esc(st[2])}</p>${app.admin_note ? `<p class="small"><b>Note from the academy:</b> ${esc(app.admin_note)}</p>` : ''}
        ${app.status === 'approved' ? '<a class="btn sm" href="#/" style="align-self:flex-start">Open your teacher home</a>' : ''}</div>` : ''}
      <form class="card stack" id="appForm" ${locked ? 'inert' : ''}>
        <div class="field"><label for="aName">Full name</label><input class="input" id="aName" name="fullname" value="${esc(a.name)}" minlength="2" maxlength="80" required autocomplete="name"></div>
        <div class="row-wrap">
          <div class="field" style="flex:1 1 160px"><span class="label">I am</span>
            <div class="seg" role="radiogroup" aria-label="Gender">
              <label class="seg-radio"><input type="radio" name="gender" value="male" ${a.gender === 'male' ? 'checked' : ''} required><span>Male teacher</span></label>
              <label class="seg-radio"><input type="radio" name="gender" value="female" ${a.gender === 'female' ? 'checked' : ''}><span>Female teacher</span></label>
            </div></div>
          <div class="field" style="flex:1 1 140px"><label for="aYears">Years teaching Quran</label><input class="input" id="aYears" name="years" type="number" min="0" max="70" inputmode="numeric" value="${esc(a.years_experience)}" required></div>
          <div class="field" style="flex:1 1 160px"><label for="aCountry">Country</label><input class="input" id="aCountry" name="country" value="${esc(a.country)}" maxlength="60" autocomplete="country-name"></div>
        </div>
        <div class="field"><span class="label">Your mother tongue (the language you speak best)</span>${mainLanguagePicker('main', a.languages[0] || '')}</div>
        <div class="field"><span class="label">Other languages you can also teach in</span><p class="xs muted" style="margin:0">Tap all that apply. Students who speak any of them can be matched with you.</p>${langPicker('lang', a.languages.slice(1), { compact: true })}</div>
        <div class="field"><span class="label">What you teach</span>
          <div class="pick-grid">${TEACHES.map(([k, l]) => `<label class="pick"><input type="checkbox" name="teaches" value="${k}" ${a.teaches.includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>
        <div class="field"><label for="aIjazah">Ijazah and sanad (if any)</label><input class="input" id="aIjazah" name="ijazah" value="${esc(a.ijazah || '')}" maxlength="400" placeholder="For example: Ijazah in Hafs ʿan ʿĀṣim from Sheikh … (Madinah)"></div>
        <div class="field"><label for="aQual">Studies and qualifications</label><textarea class="input" id="aQual" name="qual" maxlength="600" placeholder="Where you studied, certificates, where you have taught">${esc(a.qualifications || '')}</textarea></div>
        <div class="field"><label for="aBio">About you, for students and parents</label><textarea class="input" id="aBio" name="bio" maxlength="1200" placeholder="A few lines about how you teach">${esc(a.bio || '')}</textarea></div>
        <div class="row-wrap">
          <div class="field" style="flex:2 1 220px"><label for="aAvail">When you are free (with your time zone)</label><input class="input" id="aAvail" name="avail" value="${esc(a.availability || '')}" maxlength="400" placeholder="Weekdays after Asr, Sat–Sun mornings (GMT+4)"></div>
          <div class="field" style="flex:1 1 120px"><label for="aHours">Hours per week</label><input class="input" id="aHours" name="hours" type="number" min="1" max="80" inputmode="numeric" value="${esc(a.hours_per_week || 5)}"></div>
        </div>
        <section class="recite-test stack-s" id="reciteTest">
          <h2>Your recitation test</h2>
          <p class="small">Every teacher is approved only after the academy listens to their recitation and checks tajweed.</p>
          <ol class="small test-steps">
            <li>Choose <b>one surah</b> you know by heart, at least 10 ayahs long. Good choices: Al-Mulk (67), Al-Insan (76), An-Naba (78), Al-Aʿla (87) or Al-Fajr (89).</li>
            <li>Find a <b>quiet room</b>. No music, TV or other voices. Hold the phone about 20–30 cm from your mouth.</li>
            <li>Begin with the <b>istiʿādhah and basmalah</b>, then recite <b>from memory</b> in a clear murattal style, at the pace you would teach.</li>
            <li>Apply <b>full tajweed</b>: makharij, madd, ghunnah, idgham and ikhfa, and proper waqf. We check accuracy and tajweed, not the voice.</li>
            <li>Take <b>2 to 10 minutes</b>. Listen back, and record again if you are not happy.</li>
          </ol>
          <div class="field"><label for="rcSurah">Surah you will recite</label><select class="input" id="rcSurah" name="rcSurah"><option value="">Choose a surah…</option></select></div>
          <div class="rec-box" id="recBox"></div>
        </section>
        <div class="field"><label for="aPhone">WhatsApp number (only the academy sees it)</label><input class="input" id="aPhone" name="phone" type="tel" value="${esc(a.phone || '')}" maxlength="30" autocomplete="tel" placeholder="+971 …"></div>
        ${locked ? '' : `<button class="btn block" type="submit">${app ? 'Update my application' : 'Send my application'}</button>
        <p class="xs muted">Your name, languages, experience, ijazah, bio and availability appear on your teacher card once you are approved. Your phone number is never shown to students.</p>`}
      </form>
    </div>`;

  limitPicks(root);
  const form = root.querySelector('#appForm');
  wireMain(form, 'main');

  // ---- Recitation test: record, listen, record again ----
  const minSec = () => (Number.isFinite(window.__testMinRec) ? window.__testMinRec : 30); const MAX_SEC = 15 * 60;
  let rec = null; let blob = null; let secs = a.recitation_seconds || 0; let tick = null; let url = '';
  const surahSel = form.querySelector('#rcSurah');
  getMeta().then((m) => {
    if (!alive(root)) return;
    surahSel.insertAdjacentHTML('beforeend', m.surahs.map((x) => `<option value="${x.number}" ${a.recitation_surah === x.number ? 'selected' : ''}>${x.number}. ${esc(x.english)} · ${esc(x.name)}</option>`).join(''));
  }).catch(() => {
    surahSel.insertAdjacentHTML('beforeend', Array.from({ length: 114 }, (_, i) => `<option value="${i + 1}" ${a.recitation_surah === i + 1 ? 'selected' : ''}>Surah ${i + 1}</option>`).join(''));
  });
  const box = form.querySelector('#recBox');
  function paintRec(state) {
    if (state === 'recording') {
      box.innerHTML = `<div class="rec-live"><span class="dot"></span><b id="recTime">0:00</b><span class="small muted">Recording… recite now</span></div>
        <button class="btn danger block" type="button" id="recStop">${icons.stop || '■'} Stop recording</button>`;
      box.querySelector('#recStop').addEventListener('click', stopRec);
    } else if (blob || a.recitation_path) {
      box.innerHTML = `${blob ? `<audio controls src="${url}" preload="metadata"></audio>` : '<p class="small">Your recitation was sent with the application.</p>'}
        <p class="xs muted">${fmtTime(secs * 1000)} recorded${blob ? ' · not sent yet' : ''}</p>
        <button class="btn outline sm" type="button" id="recAgain">${icons.mic} Record again</button>`;
      box.querySelector('#recAgain').addEventListener('click', startRec);
    } else {
      box.innerHTML = recordingSupported()
        ? `<button class="btn gold block lg" type="button" id="recStart">${icons.mic} Start recording</button><p class="xs muted">Your browser will ask to use the microphone. Tap Allow.</p>`
        : '<div class="notice">This browser cannot record audio. Open this page in Safari or Chrome on your phone.</div>';
      box.querySelector('#recStart')?.addEventListener('click', startRec);
    }
  }
  async function startRec() {
    if (!surahSel.value) { toast('First choose the surah you will recite.'); surahSel.focus(); return; }
    rec = new Recorder();
    const ok = await rec.start(null, { bitrate: 64000 });
    if (!ok) { rec = null; toast('The microphone could not start. Allow the microphone for rattilmai.com and try again.'); return; }
    if (!alive(root)) { rec.stop(); return; }
    paintRec('recording');
    tick = setInterval(() => {
      const t = Math.floor(rec.elapsed() / 1000);
      const el = box.querySelector('#recTime'); if (el) el.textContent = fmtTime(t * 1000);
      if (t >= MAX_SEC) stopRec();
    }, 500);
  }
  async function stopRec() {
    if (!rec) return;
    clearInterval(tick);
    const t = Math.floor(rec.elapsed() / 1000);
    const b = await rec.stop(); rec = null;
    if (!b || t < minSec()) { toast(`That was too short. Recite the whole surah (at least ${minSec()} seconds).`); paintRec(); return; }
    if (url) URL.revokeObjectURL(url);
    blob = b; secs = t; url = URL.createObjectURL(b);
    paintRec();
  }
  onLeave(root, () => { clearInterval(tick); if (rec) rec.stop(); if (url) URL.revokeObjectURL(url); });
  if (!locked) paintRec(); else box.innerHTML = a.recitation_path ? '<p class="small">Your recitation was sent with the application.</p>' : '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const main = readMain(form, 'main');
    if (!main) { toast('Choose your mother tongue.'); return; }
    if (rec) { toast('Stop the recording first.'); return; }
    if (!surahSel.value) { toast('Choose the surah of your recitation test.'); surahSel.focus(); return; }
    if (!blob && !a.recitation_path) { toast('Record your recitation test before sending.'); form.querySelector('#reciteTest').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const langs = [main, ...checked(form, 'lang').filter((l) => l !== main)].slice(0, MAX_LANGS);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      let path = a.recitation_path || '';
      if (blob) { btn.innerHTML = '<span class="spinner sm"></span> Uploading your recitation…'; path = await cloud.uploadRecitation(blob); }
      await cloud.submitApplication({
        recitation_path: path, recitation_surah: Number(surahSel.value) || null, recitation_seconds: secs,
        name: form.elements.fullname.value, gender: form.querySelector('input[name="gender"]:checked')?.value,
        years_experience: Number(form.elements.years.value), country: form.elements.country.value, languages: langs,
        teaches: checked(form, 'teaches'), ijazah: form.elements.ijazah.value, qualifications: form.elements.qual.value,
        bio: form.elements.bio.value, availability: form.elements.avail.value, hours_per_week: Number(form.elements.hours.value) || 5, phone: form.elements.phone.value,
      });
      toast(app ? 'Application updated' : 'Application sent. JazakAllahu khayran.');
      applyView(root);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = app ? 'Update my application' : 'Send my application';
      toast('Could not send. Check your connection and try again.');
      console.warn(err);
    }
  });
}

// ===================== Find me a teacher (student) =====================
export async function findTeacherView(root) {
  if (!isCloud()) {
    root.innerHTML = `<div class="stack"><div class="page-head"><h1>Find a teacher</h1></div><div class="card stack-s"><p class="small">Sign in with Google to be matched with a verified teacher who speaks your language.</p><a class="btn" href="#/signin">Sign in with Google</a></div></div>`;
    return;
  }
  root.innerHTML = loading('Loading');
  let req = null; let teachers = [];
  try { [req, teachers] = await Promise.all([cloud.myTeacherRequest(), cloud.myTeachers()]); } catch { /* offline */ }
  if (!alive(root)) return;
  const s = store.get();
  if (req && req.status === 'assigned' && req.teacher_id) {
    let t = null;
    try { t = await cloud.teacherProfile(req.teacher_id); } catch { /* ignore */ }
    if (!alive(root)) return;
    root.innerHTML = `<div class="stack"><div class="page-head"><h1>Your teacher</h1><p class="small muted">The academy matched you with this teacher. They can now call you for video sessions and see your plan and recordings.</p></div>
      ${t ? teacherCard(t) : '<div class="card"><p class="small">Your teacher is linked.</p></div>'}<a class="btn outline" href="#/">Back to Today</a></div>`;
    return;
  }
  const r = req && req.status === 'waiting' ? req : null;
  const r0 = r || { languages: [], teacher_gender: 'any', age_group: 'adult', level: '', note: '', student_name: s.profile?.name || '' };
  root.innerHTML = `
    <div class="stack">
      <div class="page-head"><p class="eyebrow">Recite With Me academy</p><h1>Find me a teacher</h1>
        <p class="small muted">Tell us your language. We match you with a verified teacher who speaks it${teachers.length ? '. You already have a teacher; this adds another.' : '.'}</p></div>
      ${r ? `<div class="notice green">You are on the list. We will match you with a teacher soon, and they will appear on your Today screen.</div>` : ''}
      <form class="card stack" id="reqForm">
        <div class="field"><label for="rName">Student's name</label><input class="input" id="rName" name="sname" value="${esc(r0.student_name)}" maxlength="80" required></div>
        <div class="field"><span class="label">Which language does the student speak best? (mother tongue)</span>
          <p class="xs muted" style="margin:0">We match you with a teacher who speaks it, so lessons are explained in your language.</p>
          ${mainLanguagePicker('main', r0.languages[0] || '')}</div>
        <div class="field"><span class="label">Other languages the student also understands</span><p class="xs muted" style="margin:0">Tap all that apply (optional). More languages means more teachers to choose from.</p>${langPicker('lang', r0.languages.slice(1), { max: 5, compact: true })}</div>
        <div class="row-wrap">
          <div class="field" style="flex:1 1 200px"><span class="label">Teacher</span>
            <div class="seg">${[['any', 'Any'], ['female', 'Female'], ['male', 'Male']].map(([v, l]) => `<label class="seg-radio"><input type="radio" name="tg" value="${v}" ${r0.teacher_gender === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
          <div class="field" style="flex:1 1 200px"><span class="label">Student is</span>
            <div class="seg">${[['child', 'A child'], ['teen', 'A teenager'], ['adult', 'An adult']].map(([v, l]) => `<label class="seg-radio"><input type="radio" name="age" value="${v}" ${r0.age_group === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        </div>
        <div class="field"><span class="label">Teachers who speak your languages</span><div id="tPreview" class="stack-s"><p class="small muted">Choose the main language to see verified teachers.</p></div></div>
        <div class="field"><label for="rLevel">Where the student is now</label><input class="input" id="rLevel" name="level" value="${esc(r0.level)}" maxlength="80" placeholder="For example: reads well, has memorized Juz ʿAmma"></div>
        <div class="field"><label for="rNote">Anything else (times that suit you, goals)</label><textarea class="input" id="rNote" name="note" maxlength="500">${esc(r0.note)}</textarea></div>
        <button class="btn block" type="submit">${r ? 'Update my request' : 'Ask for a teacher'}</button>
        ${r ? '' : '<a class="btn ghost block" href="#/">Not now</a>'}
        ${r ? '<button class="btn ghost block" type="button" id="cancelReq">Cancel my request</button>' : ''}
      </form>
    </div>`;
  limitPicks(root);
  const form = root.querySelector('#reqForm');
  let verified = [];
  try { verified = await cloud.listTeachers(); } catch { /* none yet */ }
  if (!alive(root)) return;
  let pref = r0.preferred_teacher || '';
  const preview = () => {
    const box = root.querySelector('#tPreview');
    const main = readMain(form, 'main');
    const g = form.querySelector('input[name="tg"]:checked')?.value || 'any';
    if (!main) { box.innerHTML = '<p class="small muted">Choose the main language to see verified teachers.</p>'; return; }
    const wanted = [main, ...checked(form, 'lang').filter((l) => l !== main)];
    const rank = (t) => (t.languages[0] === main ? 3 : t.languages.includes(main) ? 2 : 1);
    const list = verified.filter((t) => t.accepting && t.languages.some((l) => wanted.includes(l)) && (g === 'any' || t.gender === g))
      .sort((a, b) => rank(b) - rank(a) || b.years_experience - a.years_experience);
    if (!list.some((t) => t.user_id === pref)) pref = '';
    box.innerHTML = list.length ? `
      <label class="pick"><input type="radio" name="pref" value="" ${pref ? '' : 'checked'}><span>No preference: the academy chooses the best match</span></label>
      ${list.slice(0, 8).map((t) => `<label class="pick teacher-pick"><input type="radio" name="pref" value="${esc(t.user_id)}" ${pref === t.user_id ? 'checked' : ''}>
        <span><b>${esc(t.name)}</b> <span class="muted">· ${t.gender === 'female' ? 'Female' : 'Male'} · ${t.years_experience} yrs${t.languages[0] === main ? ` · ${esc(langName(main))} is their mother tongue` : ` · teaches in ${t.languages.filter((l) => wanted.includes(l)).map((l) => esc(langName(l))).join(', ')}`}</span>
        ${t.ijazah ? `<span class="xs muted" style="display:block">Ijazah: ${esc(t.ijazah)}</span>` : ''}</span></label>`).join('')}`
      : `<p class="small muted">No verified ${g === 'any' ? '' : g + ' '}teacher speaks ${wanted.map((l) => esc(langName(l))).join(' or ')} yet. Send your request and the academy will find one for you.</p>`;
    box.querySelectorAll('input[name="pref"]').forEach((x) => x.addEventListener('change', () => { pref = x.value; }));
  };
  wireMain(form, 'main', preview);
  form.querySelectorAll('input[name="tg"], input[name="lang"]').forEach((x) => x.addEventListener('change', preview));
  preview();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const main = readMain(form, 'main');
    if (!main) { toast('Choose the language the student speaks best.'); return; }
    const langs = [main, ...checked(form, 'lang').filter((l) => l !== main)].slice(0, 6);
    try {
      await cloud.requestTeacher({ preferred_teacher: pref || null, student_name: form.elements.sname.value, languages: langs, teacher_gender: form.querySelector('input[name="tg"]:checked')?.value || 'any', age_group: form.querySelector('input[name="age"]:checked')?.value || 'adult', level: form.elements.level.value, note: form.elements.note.value });
      toast('Request sent. We will match you soon.');
      findTeacherView(root);
    } catch (err) { console.warn(err); toast('Could not send. Check your connection.'); }
  });
  root.querySelector('#cancelReq')?.addEventListener('click', async () => {
    try { await cloud.cancelTeacherRequest(); toast('Request cancelled'); findTeacherView(root); } catch { toast('Could not cancel. Check your connection.'); }
  });
}
