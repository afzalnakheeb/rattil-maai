import * as store from './store.js';
import * as cloud from './cloud.js';
import * as account from './account.js';
import { icons } from './icons.js';
import { applyTheme } from './theme.js';
import { initFullscreenButton, watchViewport } from './fullscreen.js';
import { esc, loading, onLeave, leave, toast } from './ui.js';
import todayView from './views/today.js';
import mushafView from './views/mushaf.js';
import reciteView from './views/recite.js';
import adhkarView from './views/adhkar.js';
import historyView, { reviewView } from './views/history.js';
import liveView, { teacherHome, avatar } from './views/teacher.js';
import settingsView, { welcome, rolePicker, joinView } from './views/settings.js';
import callView from './views/call.js';
import prayerView from './views/prayer.js';
import duasView from './views/duas.js';
import moreView from './views/more.js';
import reportView from './views/report.js';
import adminView from './views/admin.js';
import { applyView, findTeacherView } from './views/apply.js';

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const roleChip = document.getElementById('roleChip');
const ring = document.getElementById('ring');
let page = null; // each render gets a fresh container, so a late render of an old page lands off-screen
let renderId = 0;
let bootInfo = { signedIn: false, googleReady: false, cloudReady: false };
let stopCalls = () => {};

const TABS = {
  student: [
    ['', 'Today', 'home'], ['mushaf', 'Mushaf', 'book'], ['recite', 'Recite', 'mic'], ['prayer', 'Prayer', 'moon'], ['more', 'More', 'grid'],
  ],
  teacher: [
    ['', 'Home', 'home'], ['live', 'Session', 'video'], ['mushaf', 'Mushaf', 'book'], ['history', 'Recordings', 'clock'], ['more', 'More', 'grid'],
  ],
};
const MORE_ROUTES = ['more', 'adhkar', 'duas', 'history', 'settings', 'prayer', 'report', 'admin', 'apply', 'find-teacher'];

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const segs = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { route: segs[0] || '', id: segs[1], params };
}

function paintChrome(route, show) {
  const s = store.get();
  const role = s.profile?.role;
  // The tab bar hides during a video session so the controls have the whole screen.
  tabbar.hidden = !show || !role || route === 'call';
  roleChip.hidden = !show || !role;
  if (!show || !role) return;
  roleChip.innerHTML = `${s.profile?.avatar ? avatar(s.profile, 22) : ''}<span>${role === 'teacher' ? 'Teacher' : 'Student'}</span>${icons.gear.replace('<svg', '<svg width="15" height="15"')}`;
  const tabs = TABS[role];
  const active = tabs.some(([r]) => r === route) ? route : MORE_ROUTES.includes(route) ? 'more' : route;
  tabbar.innerHTML = tabs.map(([r, label, icon]) =>
    `<a href="#/${r}" ${active === r ? 'aria-current="page"' : ''}>${icons[icon]}<span>${label}</span></a>`).join('');
}

function localAllowed() {
  // Device-only use is allowed only while Google sign-in is not available.
  if (bootInfo.googleReady) return false;
  return !!store.get().profile || sessionStorage.getItem('rattil:local') === '1';
}

async function render() {
  leave(page);
  view.classList.remove('wide');
  const pg = document.createElement('div');
  pg.className = 'page';
  view.replaceChildren(pg);
  page = pg;
  const { route, id, params } = parse();
  const signedIn = account.isCloud();
  const s = store.get();
  ++renderId;

  if (!signedIn && !localAllowed()) {
    paintChrome(route, false);
    if (route === 'join' && id) { try { sessionStorage.setItem('rattil:join', id.toUpperCase()); } catch { /* ignore */ } }
    // Come back to the teacher application or the admin panel after signing in.
    if (['apply', 'admin', 'find-teacher'].includes(route)) { try { sessionStorage.setItem('rattil:after', route); } catch { /* ignore */ } }
    welcome(pg, { ...bootInfo, onLocal: () => { sessionStorage.setItem('rattil:local', '1'); render(); } });
    return;
  }
  if (route === 'signin') {
    if (signedIn) { location.hash = '#/'; return; }
    paintChrome(route, false);
    welcome(pg, { ...bootInfo, onLocal: () => { location.hash = '#/'; } });
    return;
  }
  if (!s.profile?.role) {
    paintChrome(route, false);
    rolePicker(pg, (role) => {
      // A new teacher goes straight to the academy application; a student to Today.
      if (role === 'teacher' && account.isCloud()) { try { sessionStorage.setItem('rattil:after', 'apply'); } catch { /* ignore */ } }
      location.hash = '#/'; render();
    }, { suggest: (() => { try { return sessionStorage.getItem('rattil:after') === 'apply' ? 'teacher' : ''; } catch { return ''; } })() });
    return;
  }
  if (signedIn) {
    let pending = null;
    try { pending = sessionStorage.getItem('rattil:join'); } catch { /* ignore */ }
    if (pending) { sessionStorage.removeItem('rattil:join'); location.hash = `#/join/${pending}`; return; }
    let after = null;
    try { after = sessionStorage.getItem('rattil:after'); } catch { /* ignore */ }
    if (after) { sessionStorage.removeItem('rattil:after'); if (after !== route) { location.hash = `#/${after}`; return; } }
  }

  paintChrome(route, true);
  const role = s.profile.role;
  // Teaching pages stay closed until the academy approves the teacher.
  // Re-check with the server: the owner may have locked teaching since the last check.
  if (role === 'teacher' && account.isCloud() && ['live', 'review'].includes(route)) {
    try { await Promise.race([account.refreshApproval(), new Promise((r) => setTimeout(r, 4000))]); } catch { /* offline: use the last answer */ }
    if (page !== pg) return;
  }
  if (role === 'teacher' && account.isCloud() && !account.teacherApproved() && ['live', 'review'].includes(route)) {
    const { lockedNote } = await import('./views/teacher.js');
    pg.innerHTML = `<div class="stack">${lockedNote()}</div>`;
    account.refreshApproval().then((ok) => { if (ok && page === pg) render(); }).catch(() => {});
    return;
  }
  const ctx = { rerender: render };
  let out;
  switch (route) {
    case '': out = role === 'teacher' ? teacherHome(pg) : todayView(pg); break;
    case 'mushaf': out = mushafView(pg, params); break;
    case 'recite': out = reciteView(pg, params); break;
    case 'adhkar': out = adhkarView(pg, params); break;
    case 'duas': out = duasView(pg, params); break;
    case 'prayer': out = prayerView(pg, params); break;
    case 'history': out = historyView(pg, { ...params, id }); break;
    case 'review': out = reviewView(pg, { ...params, id }); break;
    case 'live': out = liveView(pg, params); break;
    case 'call': out = callView(pg, { ...params, id }); break;
    case 'join': out = joinView(pg, { ...params, id }); break;
    case 'more': out = moreView(pg, params); break;
    case 'report': out = reportView(pg, params); break;
    case 'admin': out = adminView(pg, params); break;
    case 'apply': out = applyView(pg, params); break;
    case 'find-teacher': out = findTeacherView(pg, params); break;
    case 'settings': out = settingsView(pg, params, ctx); break;
    default: pg.innerHTML = '<div class="empty card">Page not found. <a href="#/">Go home</a></div>';
  }
  if (route !== 'call') window.scrollTo(0, 0);
  hideRingFor(route, id);
  const res = await out;
  if (typeof res === 'function') onLeave(pg, res);
}

// ---------- Incoming video session (student) ----------
let ringing = null;
let ringTimer = null;
let ringCtx = null;

function stopRingSound() {
  clearInterval(ringTimer); ringTimer = null;
  if (ringCtx) { ringCtx.close().catch(() => {}); ringCtx = null; }
}

function playRingSound() {
  stopRingSound();
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ringCtx = new AC();
    let n = 0;
    const beep = () => {
      if (!ringCtx || n++ > 15) { stopRingSound(); return; }
      [0, 0.25].forEach((dt) => {
        const o = ringCtx.createOscillator(); const g = ringCtx.createGain();
        o.frequency.value = 660; g.gain.value = 0.0001;
        o.connect(g).connect(ringCtx.destination);
        const t = ringCtx.currentTime + dt;
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.start(t); o.stop(t + 0.22);
      });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    };
    beep();
    ringTimer = setInterval(beep, 2000);
  } catch { /* sound blocked until the user taps */ }
}

function hideRingFor(route, id) {
  if (ringing && route === 'call' && id === ringing.id) { ring.innerHTML = ''; stopRingSound(); ringing = null; }
}

async function showRing(callRow) {
  const me = cloud.user()?.id;
  if (!me || callRow.student_id !== me || callRow.status === 'ended') return;
  const { route, id } = parse();
  if (route === 'call' && id === callRow.id) return;
  if (Date.now() - new Date(callRow.created_at).getTime() > 20 * 60e3) return;
  let full = callRow;
  if (!callRow.teacher) { try { full = await cloud.getCall(callRow.id); } catch { /* ignore */ } }
  if (!full) return;
  ringing = full;
  const t = full.teacher || { name: 'Your teacher' };
  ring.innerHTML = `
    <div class="ring-banner" role="alertdialog" aria-label="Incoming video session">
      ${avatar(t, 46)}
      <div class="grow"><b>${esc(t.name)}</b><div class="small" style="opacity:.8">is calling you for a recitation session</div></div>
      <button class="btn ghost sm" id="ringNo" type="button" style="color:inherit;border-color:rgba(255,255,255,.35)">Later</button>
      <a class="btn gold sm" id="ringYes" href="#/call/${encodeURIComponent(full.id)}">${icons.video} Join</a>
    </div>`;
  playRingSound();
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Recite With Me', { body: `${t.name} is calling you for a recitation session`, icon: 'icons/icon-192.png', tag: full.id }); } catch { /* ignore */ }
  }
  ring.querySelector('#ringNo').addEventListener('click', () => {
    ring.innerHTML = ''; stopRingSound(); ringing = null;
    // Today shows a 'waiting' card with a Join button: refresh it now.
    if (parse().route === '') render();
  });
  ring.querySelector('#ringYes').addEventListener('click', () => { stopRingSound(); });
}

function clearRing(callRow) {
  if (ringing && callRow.id === ringing.id && callRow.status === 'ended') { ring.innerHTML = ''; stopRingSound(); ringing = null; }
}

async function watchCalls() {
  stopCalls();
  if (!account.isCloud()) return;
  stopCalls = cloud.onCalls((row) => {
    if (!row) return;
    if (row.status === 'ringing') showRing(row);
    else clearRing(row);
  });
  try {
    const open = await cloud.openCalls();
    const mine = open.find((c) => c.student_id === cloud.user().id && c.status === 'ringing');
    if (mine) showRing(mine);
  } catch { /* offline */ }
}

// ---------- Boot ----------
async function boot() {
  applyTheme();
  view.innerHTML = loading('Opening Recite With Me');
  try { bootInfo = await account.boot(); } catch (e) { console.error(e); }
  applyTheme();
  cloud.onAuth(async (u) => {
    if (u) { try { await account.afterSignIn(); } catch (e) { console.error(e); } watchCalls(); }
    render();
  });
  if (account.isCloud()) watchCalls();
  render();
  if (account.isCloud() && 'Notification' in window && Notification.permission === 'default' && store.get().profile?.role === 'student') {
    // Ask once, after a tap, so call alerts can reach a backgrounded tab.
    window.addEventListener('pointerdown', () => { try { Notification.requestPermission(); } catch { /* ignore */ } }, { once: true });
  }
  window.addEventListener('online', () => { account.syncPending(); });
  // Ask the browser to keep recordings that have not uploaded yet (Safari clears idle sites).
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignore */ }
}

window.addEventListener('rattil:storage-full', () => toast('This device is out of storage space. New progress may not be saved until you free some space.'));

roleChip.addEventListener('click', () => { location.hash = '#/settings'; });
initFullscreenButton(document.getElementById('fsBtn'));
watchViewport();
window.addEventListener('hashchange', render);
store.onChange(() => applyTheme());
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}


