import * as store from './store.js';
import * as cloud from './cloud.js';
import * as account from './account.js';
import { icons } from './icons.js';
import { applyTheme } from './theme.js';
import { esc, loading } from './ui.js';
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

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const roleChip = document.getElementById('roleChip');
const ring = document.getElementById('ring');
let cleanup = null;
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
const MORE_ROUTES = ['more', 'adhkar', 'duas', 'history', 'settings', 'prayer'];

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
  tabbar.hidden = !show || !role;
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
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  view.classList.remove('wide');
  const { route, id, params } = parse();
  const signedIn = account.isCloud();
  const s = store.get();
  const mine = ++renderId;

  if (!signedIn && !localAllowed()) {
    paintChrome(route, false);
    if (route === 'join' && id) { try { sessionStorage.setItem('rattil:join', id.toUpperCase()); } catch { /* ignore */ } }
    welcome(view, { ...bootInfo, onLocal: () => { sessionStorage.setItem('rattil:local', '1'); render(); } });
    return;
  }
  if (route === 'signin') {
    if (signedIn) { location.hash = '#/'; return; }
    paintChrome(route, false);
    welcome(view, { ...bootInfo, onLocal: () => { location.hash = '#/'; } });
    return;
  }
  if (!s.profile?.role) {
    paintChrome(route, false);
    rolePicker(view, () => { location.hash = '#/'; render(); });
    return;
  }
  if (signedIn) {
    let pending = null;
    try { pending = sessionStorage.getItem('rattil:join'); } catch { /* ignore */ }
    if (pending) { sessionStorage.removeItem('rattil:join'); location.hash = `#/join/${pending}`; return; }
  }

  paintChrome(route, true);
  const role = s.profile.role;
  const ctx = { rerender: render };
  let out;
  switch (route) {
    case '': out = role === 'teacher' ? teacherHome(view) : todayView(view); break;
    case 'mushaf': out = mushafView(view, params); break;
    case 'recite': out = reciteView(view, params); break;
    case 'adhkar': out = adhkarView(view, params); break;
    case 'duas': out = duasView(view, params); break;
    case 'prayer': out = prayerView(view, params); break;
    case 'history': out = historyView(view, { ...params, id }); break;
    case 'review': out = reviewView(view, { ...params, id }); break;
    case 'live': out = liveView(view, params); break;
    case 'call': out = callView(view, { ...params, id }); break;
    case 'join': out = joinView(view, { ...params, id }); break;
    case 'more': out = moreView(view, params); break;
    case 'settings': out = settingsView(view, params, ctx); break;
    default: view.innerHTML = '<div class="empty card">Page not found. <a href="#/">Go home</a></div>';
  }
  if (route !== 'call') window.scrollTo(0, 0);
  hideRingFor(route, id);
  const res = await out;
  if (typeof res === 'function') {
    if (mine === renderId) cleanup = res;
    else res();
  }
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
      <a class="btn gold sm" id="ringYes" href="#/call/${full.id}">${icons.video} Join</a>
    </div>`;
  playRingSound();
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Recite With Me', { body: `${t.name} is calling you for a recitation session`, icon: 'icons/icon-192.png', tag: full.id }); } catch { /* ignore */ }
  }
  ring.querySelector('#ringNo').addEventListener('click', () => { ring.innerHTML = ''; stopRingSound(); ringing = null; });
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
}

roleChip.addEventListener('click', () => { location.hash = '#/settings'; });
window.addEventListener('hashchange', render);
store.onChange(() => applyTheme());
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}


