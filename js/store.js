// Local cache of everything (localStorage for records, IndexedDB for audio).
// When signed in, progress syncs to the cloud (see sync.js) and sessions upload.

const KEY = 'rattil:v1';

const DEFAULTS = () => ({
  profile: null,            // { role: 'student' | 'teacher', name, id?, email?, avatar? }
  meta: { syncedAt: '', uid: '' },
  plan: null,               // { level, track, units, manzilCursor, created }
  daily: {},                // { 'YYYY-MM-DD': { sabaq, sabqi, manzil } }
  streak: { last: '', count: 0 },
  history: [],              // sessions, newest first
  adhkar: {},               // { 'YYYY-MM-DD:set': { id: count } }
  students: [],             // teacher's students: { id, name, note }
  settings: { reciter: 'ar.husary', repeat: 1, speed: 1, hideText: true, theme: 'system' },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    const d = DEFAULTS();
    return { ...d, ...parsed, meta: { ...d.meta, ...(parsed.meta || {}) }, settings: { ...d.settings, ...(parsed.settings || {}) } };
  } catch {
    return DEFAULTS();
  }
}

let warnedFull = false;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); warnedFull = false; } catch {
    // Storage full or blocked: tell the user once rather than failing silently.
    if (!warnedFull) { warnedFull = true; try { window.dispatchEvent(new CustomEvent('rattil:storage-full')); } catch { /* ignore */ } }
  }
}

export function get() { return state; }

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function update(fn, { silent = false } = {}) {
  fn(state);
  save();
  if (!silent) listeners.forEach((f) => { try { f(state); } catch { /* ignore */ } });
}

export function reset() {
  state = DEFAULTS();
  save();
  listeners.forEach((f) => { try { f(state); } catch { /* ignore */ } });
}

// The part of the state that follows the user across devices.
export const SYNC_KEYS = ['plan', 'daily', 'streak', 'adhkar', 'settings', 'students'];
export function syncedSnapshot() {
  const cutoff = Date.now() - 120 * 864e5;
  const recent = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => {
    const t = Date.parse(k.slice(0, 10));
    return Number.isNaN(t) || t >= cutoff;
  }));
  const snap = {};
  SYNC_KEYS.forEach((k) => { snap[k] = state[k]; });
  snap.daily = recent(state.daily);
  snap.adhkar = recent(state.adhkar);
  const out = JSON.parse(JSON.stringify(snap));
  // Prayer location stays on this device: never sent to the cloud.
  if (out.settings) delete out.settings.prayer;
  return out;
}
export function applySynced(data) {
  const d = DEFAULTS();
  update((s) => {
    const keepPrayer = s.settings?.prayer;
    SYNC_KEYS.forEach((k) => { if (data && k in data) s[k] = data[k]; });
    s.settings = { ...d.settings, ...(s.settings || {}) };
    if (keepPrayer) s.settings.prayer = keepPrayer; else delete s.settings.prayer;
  }, { silent: true });
}

export function addSession(session) {
  update((s) => {
    s.history.unshift(session);
    // Keep the newest 300 on the device, but never drop one that has not uploaded yet.
    if (s.history.length > 300) {
      const keep = [], drop = [];
      s.history.forEach((h, i) => ((i < 300 || !h.synced) ? keep : drop).push(h));
      s.history = keep;
      drop.forEach((h) => { if (h.audioId) deleteClip(h.audioId); });
    }
  });
}

export function touchStreak(day) {
  update((s) => {
    if (s.streak.last === day) return;
    const prev = new Date(day);
    prev.setDate(prev.getDate() - 1);
    const p = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    s.streak.count = s.streak.last === p ? s.streak.count + 1 : 1;
    s.streak.last = day;
  });
}

// ---- Audio clips in IndexedDB ----
const DB = 'rattil-audio';
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('clips');
    req.onsuccess = () => {
      const d = req.result;
      // Let sign-out delete the database: close when asked.
      d.onversionchange = () => { d.close(); dbp = null; };
      d.onclose = () => { dbp = null; };
      resolve(d);
    };
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}
export function closeDb() { if (dbp) dbp.then((d) => d.close()).catch(() => {}); dbp = null; }

export async function putClip(id, blob) {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const tx = d.transaction('clips', 'readwrite');
      tx.objectStore('clips').put(blob, id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}

export async function getClip(id) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const tx = d.transaction('clips', 'readonly');
      const r = tx.objectStore('clips').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch { return null; }
}

export async function deleteClip(id) {
  try {
    const d = await db();
    const tx = d.transaction('clips', 'readwrite');
    tx.objectStore('clips').delete(id);
  } catch { /* ignore */ }
}
