import * as store from '../store.js';
import * as plan from '../plan.js';
import * as cloud from '../cloud.js';
import * as account from '../account.js';
import { reciterOptions } from '../quran.js';
import { esc, toast, loading } from '../ui.js';
import { icons } from '../icons.js';
import { avatar } from './teacher.js';
import { applyTheme } from '../theme.js';
import { SITE_URL } from '../config.js';

const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

const FEATURES = [
  ['book', 'A daily hifz plan', 'New lesson, recent revision and old revision, every day.'],
  ['mic', 'An AI that listens', 'Recite from memory; it follows word by word and plays the correct word when you slip.'],
  ['video', 'Live sessions with your teacher', 'Free video calls. Your teacher sees the AI’s marks, adds their own and grades you.'],
  ['moon', 'Adhkar, duas and prayer times', 'Morning and evening adhkar, Ruqyah, duas, salah times and the Qibla.'],
];

function brandBlock() {
  return `
      <div class="logo-big">
        <img src="icons/icon.svg" alt="" width="104" height="104">
        <h1 class="sr-only">Recite With Me · رتّل معي</h1>
        <img class="wordmark wm-light" src="icons/wordmark-light.svg" alt="" width="290" height="126">
        <img class="wordmark wm-dark" src="icons/wordmark-dark.svg" alt="" width="290" height="126">
        <div class="ornament" aria-hidden="true">${icons.star.replace('<svg', '<svg width="12" height="12"')}</div>
        <p class="muted tagline">Memorize the Quran to the standard of al-Haram and an-Nabawi, with a daily plan, an AI that listens, and teachers who check you.</p>
      </div>`;
}

// Signed-out entry. Google sign-in is the way in; device-only mode exists only until Google is switched on.
export function welcome(root, { googleReady, cloudReady, onLocal }) {
  const err = cloud.lastUrlError();
  root.innerHTML = `
    <div class="stack welcome">
      ${brandBlock()}
      ${err ? `<div class="notice red">${esc(err)}</div>` : ''}
      <div class="card stack">
        <div class="stack-s">
          <h2>Join with your Google account</h2>
          <p class="small muted">Students and teachers sign in with Gmail, so your progress, recordings and teacher stay with you on every device.</p>
        </div>
        <button class="btn-google" id="google" type="button" ${googleReady ? '' : 'disabled'}>${GOOGLE_G} Continue with Google</button>
        ${googleReady ? '' : `<p class="xs muted" style="text-align:center">${cloudReady ? 'Google sign-in is being switched on. You can start on this device and sign in later; everything moves to your account.' : 'You seem to be offline. You can start on this device now.'}</p>`}
        ${googleReady ? '' : '<button class="btn ghost block" id="local" type="button">Start on this device for now</button>'}
      </div>
      <div class="card stack-s">
        <h2>How to join</h2>
        <div class="row"><div class="icon-tile">${icons.mic}</div><div class="grow"><h3>Students</h3><p class="small muted">Continue with Google and choose <b>Student</b>. Then tap <b>Find me a teacher</b> and pick your language, or enter your teacher's class code.</p></div></div>
        <div class="row"><div class="icon-tile gold">${icons.users}</div><div class="grow"><h3>Teachers</h3><p class="small muted">Continue with Google and choose <b>Teacher</b>. The application form opens: languages, experience and ijazah. <a href="/teach/">How teaching works</a></p></div></div>
      </div>
      <div class="card stack-s feature-list">
        ${FEATURES.map(([ic, t, d]) => `<div class="row"><div class="icon-tile">${icons[ic]}</div><div class="grow"><h3>${t}</h3><p class="small muted">${d}</p></div></div>`).join('')}
      </div>
      <p class="xs muted" style="text-align:center">Free. Hafs ʿan ʿĀṣim · Madinah Mushaf.<br>Rattil Maʿī · <span lang="ar">رتّل معي</span> means “Recite With Me”.</p>
    </div>`;
  root.querySelector('#google').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    b.innerHTML = `<span class="spinner sm"></span> Opening Google…`;
    try { await cloud.signInWithGoogle(); } catch (x) {
      console.error(x);
      toast('Google sign-in could not open. Try again in a moment.');
      b.disabled = false; b.innerHTML = `${GOOGLE_G} Continue with Google`;
    }
  });
  root.querySelector('#local')?.addEventListener('click', () => onLocal());
}

// After sign-in (or device-only start) when no role is chosen yet.
export function rolePicker(root, onDone, { suggest = '' } = {}) {
  const s = store.get();
  root.innerHTML = `
    <form class="stack welcome" id="roleForm">
      ${brandBlock()}
      <div class="card stack-s">
        ${s.profile?.id ? `<div class="row">${avatar(s.profile)}<div class="grow"><h3>${esc(s.profile.name)}</h3><div class="xs muted">${esc(s.profile.email || '')}</div></div></div>`
          : `<label class="label" for="nm">Your name</label><input class="input" id="nm" required maxlength="40" autocomplete="given-name" placeholder="e.g. Yusuf">`}
      </div>
      <fieldset class="card stack-s" style="border:0;margin:0">
        <legend class="label" style="padding:0;margin-bottom:8px">I am a…</legend>
        <label class="choice"><input type="radio" name="role" value="student" ${suggest !== 'teacher' ? 'checked' : ''}><span><b>Student · I want to learn</b><br><span class="small muted">Daily plan, recite with the AI check, adhkar. We match you with a verified teacher who speaks your language, or join your own teacher with their code.</span></span></label>
        <label class="choice"><input type="radio" name="role" value="teacher" ${suggest === 'teacher' ? 'checked' : ''}><span><b>Teacher · I want to teach</b><br><span class="small muted">Apply to teach with the academy (every teacher is reviewed), and teach your own students with a class code, live video, AI suggestions and grading.</span></span></label>
      </fieldset>
      <button class="btn block lg" type="submit">Continue</button>
    </form>`;
  root.querySelector('#roleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = new FormData(e.currentTarget).get('role');
    const nm = root.querySelector('#nm');
    try {
      if (nm) store.update((x) => { x.profile = { ...(x.profile || {}), name: nm.value.trim() }; });
      await account.setRole(role);
      onDone(role);
    } catch { toast('Could not save. Check your connection and try again.'); }
  });
}

// #/join/CODE: a student opens the teacher's invite link.
export async function joinView(root, params) {
  const code = (params.id || '').toUpperCase();
  if (!account.isCloud()) {
    try { sessionStorage.setItem('rattil:join', code); } catch { /* ignore */ }
    root.innerHTML = `<div class="empty card stack-s"><h2>Sign in to join this class</h2><p class="small muted">Class code <b>${esc(code)}</b> will be used after you sign in with Google.</p><div><a class="btn sm" href="#/">Continue</a></div></div>`;
    return;
  }
  root.innerHTML = loading('Joining the class');
  try {
    const t = await cloud.joinTeacher(code);
    if (store.get().profile?.role !== 'student') await account.setRole('student');
    root.innerHTML = `<div class="card stack-s"><h2>You joined ${esc(t.name)}’s class</h2><p class="small muted">Your teacher can now see your plan and recordings, review your practice and call you for video sessions.</p><div><a class="btn sm" href="#/">Go to Today</a></div></div>`;
  } catch (e) {
    root.innerHTML = `<div class="notice red stack-s"><p>${esc(/own code/.test(e.message) ? 'This is your own class code.' : 'No teacher has this code. Check it and try again.')}</p><div><a class="btn sm" href="#/settings">Enter a code</a></div></div>`;
  }
}

export default function settingsView(root, params, { rerender }) {
  const s = store.get();
  const p = s.plan;
  const cloudOn = account.isCloud();
  const isTeacher = s.profile?.role === 'teacher';
  const theme = s.settings.theme || 'system';
  root.innerHTML = `
    <div class="stack">
      <div class="page-head"><h1>Settings</h1></div>
      <div class="card stack-s">
        <h2>Account</h2>
        ${cloudOn ? `
          <div class="row">${avatar(s.profile)}<div class="grow"><h3>${esc(s.profile.name)}</h3><div class="xs muted">${esc(s.profile.email || '')} · signed in with Google</div></div></div>
          <form class="row" id="nameForm"><label class="sr-only" for="nm">Display name</label><input class="input grow" id="nm" value="${esc(s.profile?.name || '')}" maxlength="40" required><button class="btn sm" type="submit">Save</button></form>
          <button class="btn ghost sm" id="signOut" type="button" style="align-self:flex-start">${icons.logout} Sign out</button>`
        : `<p class="small muted">You are using Recite With Me on this device only. Sign in with Google to keep your progress and recordings in your account and to join a teacher.</p>
          <a class="btn sm" href="#/signin" style="align-self:flex-start">Sign in with Google</a>`}
      </div>
      ${cloudOn && isTeacher ? `
      <div class="card stack-s">
        <h2>Class code</h2>
        <div class="code-box"><b>${esc(s.profile.code || '')}</b><button class="icon-btn" id="copyCode" type="button" aria-label="Copy invite link">${icons.copy}</button></div>
        <p class="xs muted">Students enter this code, or open ${esc(SITE_URL.replace('https://', ''))}/#/join/${esc(s.profile.code || '')}</p>
      </div>` : ''}
      ${cloudOn && !isTeacher ? `
      <div class="card stack-s">
        <h2>My teachers</h2>
        <div id="teachers">${loading()}</div>
        <form class="row" id="joinForm" style="margin-top:4px"><label class="sr-only" for="code">Class code</label><input class="input grow code" id="code" maxlength="6" placeholder="CODE" autocomplete="off" autocapitalize="characters" required><button class="btn sm" type="submit">Join</button></form>
        <p class="xs muted">Ask your teacher for their 6-letter class code.</p>
      </div>` : ''}
      ${cloudOn ? `
      <div class="card stack-s" id="academyCard">
        <h2>Academy</h2>
        ${!isTeacher ? '<a class="list-item" href="#/find-teacher" style="text-decoration:none;color:inherit"><div class="grow"><h3>Find me a teacher</h3><div class="xs muted">Matched by your language</div></div></a>' : ''}
        <a class="list-item" href="#/apply" style="text-decoration:none;color:inherit"><div class="grow"><h3>Teach with us</h3><div class="xs muted">Apply to become a verified teacher</div></div></a>
      </div>` : ''}
      <div class="card stack-s">
        <h2>Appearance</h2>
        <div class="seg full three" role="group" aria-label="Theme">
          ${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" data-theme-opt="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="card stack-s">
        <h2>View</h2>
        <div class="seg" role="group" aria-label="View">
          <button type="button" data-role="student" aria-pressed="${!isTeacher}">Student</button>
          <button type="button" data-role="teacher" aria-pressed="${isTeacher}">Teacher</button>
        </div>
        <p class="xs muted">One app, two views. Teachers use the Teacher view; students the Student view.</p>
      </div>
      <div class="card stack-s">
        <h2>Listening</h2>
        <div class="field"><label for="rec">Default reciter</label>
          <select class="input" id="rec">${reciterOptions(s.settings.reciter)}</select></div>
      </div>
      <div class="card stack-s">
        <h2>Hifz plan</h2>
        ${p ? `<p class="small">${esc(plan.level(p).label)} · ${esc(plan.TRACKS.find((t) => t.id === p.track)?.label || '')} · ${Math.floor(p.units / 2)} pages memorized</p>
          <div class="field"><label for="lvl">Daily target</label><select class="input" id="lvl">${plan.LEVELS.map((l) => `<option value="${l.id}" ${l.id === p.level ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="mem">Pages memorized</label><input class="input" id="mem" type="number" min="0" max="604" value="${Math.floor(p.units / 2)}" inputmode="numeric"></div>
          <div class="row-wrap"><button class="btn sm" id="savePlan" type="button">Save plan</button><button class="btn ghost sm" id="newPlan" type="button">Start a new plan</button></div>`
          : '<p class="small muted">No plan yet. Switch to the Student view to set one.</p>'}
      </div>
      <div class="card stack-s">
        <h2>About</h2>
        <p class="small">Recite With Me · <span lang="ar">رتّل معي</span>. Quran text: Tanzil Uthmani (Madinah Mushaf, Hafs), via Al Quran Cloud. Recitations: Islamic Network CDN and EveryAyah.com, ayah by ayah. Adhkar and duas: Hisn al-Muslim.</p>
        <p class="small muted">The AI check uses your browser's speech engine. It checks words, not tajweed, and never replaces a teacher. Video calls connect your two devices directly and are encrypted.</p>
      </div>
      ${!cloudOn ? `<div class="card stack-s">
        <h2>Data on this device</h2>
        <p class="small muted">${s.history.length} ${s.history.length === 1 ? 'recording' : 'recordings'} saved. Clearing removes everything on this device.</p>
        <button class="btn danger sm" id="clear" type="button" style="align-self:flex-start">Clear all data</button>
      </div>` : ''}
    </div>`;

  root.querySelector('#nameForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await account.setName(root.querySelector('#nm').value.trim()); toast('Saved'); rerender(); } catch { toast('Could not save. Check your connection.'); }
  });
  root.querySelector('#signOut')?.addEventListener('click', async () => {
    if (!confirm('Sign out on this device? Your progress and recordings stay in your account.')) return;
    try {
      await account.signOut();
    } catch (e) {
      if (e?.message !== 'unsynced') { toast('Could not sign out. Check your connection.'); return; }
      const n = e.count;
      if (!confirm(`${n} ${n === 1 ? 'recording has' : 'recordings have'} not uploaded yet (no connection). Signing out now deletes ${n === 1 ? 'it' : 'them'} from this device. Sign out anyway?`)) return;
      await account.signOut({ force: true });
    }
    location.hash = '#/';
    location.reload();
  });
  root.querySelector('#copyCode')?.addEventListener('click', async () => {
    const link = `${SITE_URL}/#/join/${s.profile.code}`;
    try { await navigator.clipboard.writeText(link); toast('Invite link copied'); } catch { toast(link); }
  });
  if (root.querySelector('#academyCard')) {
    cloud.amIAdmin().then((yes) => {
      const c = root.querySelector('#academyCard');
      if (yes && c) c.insertAdjacentHTML('beforeend', '<a class="list-item" href="#/admin" style="text-decoration:none;color:inherit"><div class="grow"><h3>Admin panel</h3><div class="xs muted">Teacher applications, teachers and students waiting</div></div><span class="chip gold">Admin</span></a>');
    }).catch(() => {});
  }
  if (root.querySelector('#teachers')) {
    cloud.myTeachers().then((list) => {
      const box = root.querySelector('#teachers');
      if (!box) return;
      box.innerHTML = list.length ? list.map((t) => `<div class="list-item">${avatar(t)}<div class="grow"><h3>${esc(t.name)}</h3><div class="xs muted">${esc(t.email || '')}</div></div><button class="btn ghost sm" type="button" data-leave="${t.id}">Leave</button></div>`).join('') : '<p class="small muted">Not linked to a teacher yet.</p>';
      box.querySelectorAll('[data-leave]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Leave this teacher’s class? They will no longer see your progress.')) return;
        await cloud.unlink(b.dataset.leave, s.profile.id); rerender();
      }));
    }).catch(() => { const box = root.querySelector('#teachers'); if (box) box.innerHTML = '<p class="small muted">Could not load. Check your connection.</p>'; });
  }
  root.querySelector('#joinForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = `#/join/${root.querySelector('#code').value.trim().toUpperCase()}`;
  });
  root.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => {
    store.update((x) => { x.settings.theme = b.dataset.themeOpt; });
    applyTheme();
    root.querySelectorAll('[data-theme-opt]').forEach((y) => y.setAttribute('aria-pressed', String(y === b)));
  }));
  root.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', async () => {
    try { await account.setRole(b.dataset.role); } catch { toast('Could not switch. Check your connection.'); return; }
    location.hash = '#/';
    rerender();
  }));
  root.querySelector('#rec').addEventListener('change', (e) => { store.update((x) => { x.settings.reciter = e.target.value; }); toast('Reciter saved'); });
  root.querySelector('#savePlan')?.addEventListener('click', () => {
    store.update((x) => {
      x.plan.level = root.querySelector('#lvl').value;
      const mem = Math.max(0, Math.min(604, parseInt(root.querySelector('#mem').value, 10) || 0));
      if (mem !== Math.floor(x.plan.units / 2)) x.plan.units = mem * 2;
    });
    toast('Plan saved');
  });
  root.querySelector('#newPlan')?.addEventListener('click', () => {
    if (!confirm('Start a new plan? Your recordings stay; plan progress resets.')) return;
    store.update((x) => { x.plan = null; });
    location.hash = '#/';
  });
  root.querySelector('#clear')?.addEventListener('click', () => {
    if (!confirm('Clear all data on this device? This cannot be undone.')) return;
    store.reset();
    try { indexedDB.deleteDatabase('rattil-audio'); } catch { /* ignore */ }
    location.hash = '#/';
    rerender();
  });
}
