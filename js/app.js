import * as store from './store.js';
import { icons } from './icons.js';
import todayView from './views/today.js';
import mushafView from './views/mushaf.js';
import reciteView from './views/recite.js';
import adhkarView from './views/adhkar.js';
import historyView from './views/history.js';
import liveView, { teacherHome } from './views/teacher.js';
import settingsView, { welcome } from './views/settings.js';

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const roleChip = document.getElementById('roleChip');
let cleanup = null;
let renderId = 0;

const TABS = {
  student: [
    ['', 'Today', 'home'], ['mushaf', 'Mushaf', 'book'], ['recite', 'Recite', 'mic'], ['adhkar', 'Adhkar', 'beads'], ['history', 'History', 'clock'],
  ],
  teacher: [
    ['', 'Home', 'home'], ['live', 'Live', 'live'], ['mushaf', 'Mushaf', 'book'], ['history', 'Recordings', 'clock'], ['adhkar', 'Adhkar', 'beads'],
  ],
};

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const segs = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { route: segs[0] || '', id: segs[1], params };
}

function paintChrome(route) {
  const s = store.get();
  const role = s.profile?.role;
  tabbar.hidden = !role;
  roleChip.hidden = !role;
  if (!role) return;
  roleChip.textContent = role === 'teacher' ? 'Teacher · Settings' : 'Student · Settings';
  tabbar.innerHTML = TABS[role].map(([r, label, icon]) =>
    `<a href="#/${r}" ${route === r ? 'aria-current="page"' : ''}>${icons[icon]}<span>${label}</span></a>`).join('');
}

async function render() {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  view.classList.remove('wide');
  const { route, id, params } = parse();
  const s = store.get();
  paintChrome(route);
  if (!s.profile) {
    welcome(view, () => { location.hash = '#/'; render(); });
    return;
  }
  const role = s.profile.role;
  const ctx = { rerender: render };
  let out;
  switch (route) {
    case '': out = role === 'teacher' ? teacherHome(view) : todayView(view); break;
    case 'mushaf': out = mushafView(view, params); break;
    case 'recite': out = reciteView(view, params); break;
    case 'adhkar': out = adhkarView(view, params); break;
    case 'history': out = historyView(view, { ...params, id }); break;
    case 'live': out = liveView(view, params); break;
    case 'settings': out = settingsView(view, params, ctx); break;
    default: view.innerHTML = '<div class="empty card">Page not found. <a href="#/">Go home</a></div>';
  }
  window.scrollTo(0, 0);
  const mine = ++renderId;
  const res = await out;
  if (typeof res === 'function') {
    if (mine === renderId) cleanup = res;
    else res();
  }
}

roleChip.addEventListener('click', () => { location.hash = '#/settings'; });
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
