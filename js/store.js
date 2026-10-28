// Everything is saved on this device (localStorage for records, IndexedDB for audio).
// Accounts and cloud sync come later; the shapes here are what the server will store.

const KEY = 'rattil:v1';

const DEFAULTS = () => ({
  profile: null,            // { role: 'student' | 'teacher', name }
  plan: null,               // { level, track, units, manzilCursor, created }
  daily: {},                // { 'YYYY-MM-DD': { sabaq, sabqi, manzil } }
  streak: { last: '', count: 0 },
  history: [],              // sessions, newest first
  adhkar: {},               // { 'YYYY-MM-DD:set': { id: count } }
  students: [],             // teacher's students: { id, name, note }
  settings: { reciter: 'ar.husary', repeat: 1, speed: 1, hideText: true },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    const d = DEFAULTS();
    return { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings || {}) } };
  } catch {
    return DEFAULTS();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export function get() { return state; }

export function update(fn) {
  fn(state);
  save();
}

export function reset() {
  state = DEFAULTS();
  save();
}

export function addSession(session) {
  update((s) => {
    s.history.unshift(session);
    if (s.history.length > 300) s.history.length = 300;
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
function db() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no-idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('clips');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

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
