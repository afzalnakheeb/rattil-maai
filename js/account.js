// Signed-in account: profile, progress sync across devices, pending uploads.
// Works offline: the local store is always the working copy.

import * as cloud from './cloud.js';
import { cleanAvatar } from './clean.js';
import * as store from './store.js';

let mode = 'local';
let profile = null;
let pushTimer = null;
let pushing = false;
let pushAgain = false;
let changeSeq = 0;
let unsubscribeStore = null;

export const isCloud = () => mode === 'cloud' && !!cloud.user();
export const profileRow = () => profile;

// Returns { signedIn, googleReady, cloudReady }.
export async function boot() {
  let cloudReady = true;
  try { await cloud.init(); } catch { cloudReady = false; }
  if (!cloudReady) { mode = 'local'; return { signedIn: false, googleReady: false, cloudReady }; }
  const googleReady = await cloud.googleEnabled();
  if (!cloud.user()) { mode = 'local'; return { signedIn: false, googleReady, cloudReady }; }
  try {
    await afterSignIn();
  } catch (e) {
    console.error(e);
    // Signed in but the server could not be reached: keep working from the local copy.
    mode = store.get().meta.uid === cloud.user().id ? 'cloud' : 'local';
  }
  return { signedIn: true, googleReady, cloudReady };
}

export async function afterSignIn() {
  const u = cloud.user();
  if (!u) return;
  profile = await cloud.getProfile();
  const before = store.get();
  const localRole = before.profile?.role || null;
  const firstLinkOfDevice = !before.meta.uid;
  if (before.meta.uid && before.meta.uid !== u.id) {
    // A different account on this device: clear the previous person's data and audio.
    store.reset();
    store.closeDb();
    try { indexedDB.deleteDatabase('rattil-audio'); } catch { /* ignore */ }
  }
  mode = 'cloud';
  if (!profile.role && localRole && firstLinkOfDevice) {
    profile = await cloud.updateProfile({ role: localRole });
  }
  applyProfile();
  try { await refreshApproval(); } catch { /* offline */ }
  await syncState();
  if (!unsubscribeStore) unsubscribeStore = store.onChange(() => schedulePush());
  syncPending();
}

function applyProfile() {
  const u = cloud.user();
  store.update((x) => {
    x.profile = {
      id: u.id,
      email: u.email || profile?.email || '',
      name: profile?.name || x.profile?.name || (u.email || '').split('@')[0],
      avatar: cleanAvatar(profile?.avatar_url),
      role: profile?.role || null,
      code: profile?.invite_code || '',
      approved: x.profile?.id === u.id ? !!x.profile?.approved : false,
    };
    x.meta.uid = u.id;
  }, { silent: true });
}

// A teacher can teach only after the academy approves them (checked again on the server).
export const teacherApproved = () => !isCloud() || !!store.get().profile?.approved;
export async function refreshApproval() {
  if (!isCloud()) return true;
  const ok = await cloud.amIApprovedTeacher();
  if (!!store.get().profile?.approved !== ok) store.update((x) => { if (x.profile) x.profile.approved = ok; }, { silent: true });
  return ok;
}

export async function setRole(role) {
  if (isCloud()) { profile = await cloud.updateProfile({ role }); applyProfile(); }
  else store.update((x) => { x.profile = { ...(x.profile || {}), role }; });
}

export async function setName(name) {
  if (isCloud()) { profile = await cloud.updateProfile({ name }); applyProfile(); }
  else store.update((x) => { x.profile.name = name; });
}

// Recordings not yet uploaded (they would be lost by signing out).
export function unsyncedCount() { return store.get().history.filter((h) => !h.synced).length; }

export async function signOut({ force = false } = {}) {
  clearTimeout(pushTimer);
  if (isCloud()) {
    try { await syncPending(); } catch { /* checked below */ }
    if (!force && unsyncedCount()) { const e = new Error('unsynced'); e.count = unsyncedCount(); throw e; }
  }
  if (isCloud() && store.get().meta.dirty) { try { await pushNow(); } catch { /* best effort */ } }
  await cloud.signOut();
  mode = 'local';
  profile = null;
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
  // Clear this device so the next person starts clean; audio stays in the cloud.
  store.reset();
  store.closeDb();
  try { indexedDB.deleteDatabase('rattil-audio'); } catch { /* ignore */ }
}

// ---- Progress sync ----
function merge(remote, local, localDirty) {
  const out = { ...remote };
  const daily = { ...(remote.daily || {}) };
  Object.entries(local.daily || {}).forEach(([day, v]) => {
    daily[day] = { ...(daily[day] || {}) };
    Object.entries(v || {}).forEach(([k, flag]) => { daily[day][k] = daily[day][k] || flag; });
  });
  out.daily = daily;
  const adhkar = { ...(remote.adhkar || {}) };
  Object.entries(local.adhkar || {}).forEach(([key, counts]) => {
    adhkar[key] = { ...(adhkar[key] || {}) };
    Object.entries(counts || {}).forEach(([id, n]) => { adhkar[key][id] = Math.max(adhkar[key][id] || 0, n); });
  });
  out.adhkar = adhkar;
  const rs = remote.streak || { last: '', count: 0 };
  const ls = local.streak || { last: '', count: 0 };
  out.streak = ls.last > rs.last ? ls : rs.last > ls.last ? rs : (ls.count > rs.count ? ls : rs);
  if (!remote.plan) out.plan = local.plan || null;
  else if (local.plan && ((local.plan.units || 0) > (remote.plan.units || 0) || localDirty)) out.plan = local.plan;
  out.settings = localDirty ? { ...(remote.settings || {}), ...(local.settings || {}) } : { ...(local.settings || {}), ...(remote.settings || {}) };
  const students = [...(remote.students || [])];
  (local.students || []).forEach((st) => { if (!students.some((x) => x.id === st.id)) students.push(st); });
  out.students = students;
  return out;
}

async function syncState() {
  const remote = await cloud.pullState();
  const s = store.get();
  const local = store.syncedSnapshot();
  if (!remote || !remote.data || !Object.keys(remote.data).length) { await pushNow(); return; }
  const merged = merge(remote.data, local, !!s.meta.dirty);
  store.applySynced(merged);
  store.update((x) => { x.meta.syncedAt = remote.updated_at; x.meta.dirty = false; }, { silent: true });
  if (JSON.stringify(merged) !== JSON.stringify(remote.data)) await pushNow();
}

function schedulePush() {
  if (!isCloud()) return;
  store.update((x) => { x.meta.dirty = true; }, { silent: true });
  changeSeq += 1;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 1500);
}

async function pushNow() {
  if (!isCloud()) return;
  if (pushing) { pushAgain = true; return; } // a change arrived mid-push: push again after
  pushing = true;
  try {
    do {
      pushAgain = false;
      const seq = changeSeq;
      const at = await cloud.pushState(store.syncedSnapshot());
      store.update((x) => { x.meta.syncedAt = at; if (seq === changeSeq) x.meta.dirty = false; }, { silent: true });
    } while (pushAgain);
  } finally { pushing = false; }
}

// ---- Upload sessions recorded while offline or before signing in ----
let uploading = false;
export async function syncPending() {
  if (!isCloud() || uploading) return;
  uploading = true;
  try {
    const pending = store.get().history.filter((h) => !h.synced);
    for (const h of pending.reverse()) {
      try {
        const blob = h.audioId ? await store.getClip(h.audioId) : null;
        const row = { ...h, studentId: h.studentId || (h.kind === 'practice' ? cloud.user().id : null), teacherId: h.kind === 'practice' ? null : cloud.user().id };
        const { audioPath } = await cloud.saveSession(row, blob);
        store.update((x) => {
          const it = x.history.find((y) => y.id === h.id);
          if (it) { it.synced = true; it.audioPath = audioPath; it.studentId = row.studentId; }
        }, { silent: true });
      } catch (e) { console.warn('upload later', e?.message || e); }
    }
  } finally { uploading = false; }
}
