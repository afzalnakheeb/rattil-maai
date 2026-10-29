// Sessions (recordings with marks): one place for views to list, open, play and delete,
// whether they live on this device, in the cloud, or both.

import * as cloud from './cloud.js';
import * as store from './store.js';
import { isCloud, syncPending } from './account.js';

let cache = null;

export async function save(session, blob) {
  store.addSession({ ...session, synced: false });
  cache = null;
  if (isCloud()) {
    try {
      const { audioPath } = await cloud.saveSession(session, blob);
      store.update((x) => {
        const it = x.history.find((y) => y.id === session.id);
        if (it) { it.synced = true; it.audioPath = audioPath; }
      }, { silent: true });
    } catch (e) {
      console.warn('saved on device, will upload later', e?.message || e);
      setTimeout(syncPending, 15000);
    }
  }
  return store.get().history.find((h) => h.id === session.id) || session;
}

export async function list({ studentId } = {}) {
  const local = store.get().history;
  if (!isCloud()) return studentId ? [] : local;
  let remote;
  try {
    remote = await cloud.listSessions({ studentId });
    if (!studentId) cache = remote;
  } catch {
    remote = (!studentId && cache) || local.filter((h) => h.synced);
  }
  const byId = new Map(local.map((h) => [h.id, h]));
  const ids = new Set(remote.map((r) => r.id));
  const merged = remote.map((r) => ({ ...r, audioId: byId.get(r.id)?.audioId || null }));
  if (!studentId) local.filter((h) => !h.synced && !ids.has(h.id)).forEach((h) => merged.push(h));
  return merged.sort((a, b) => b.created - a.created);
}

export async function get(id) {
  const local = store.get().history.find((h) => h.id === id);
  if (isCloud()) {
    try {
      const r = await cloud.getSession(id);
      if (r) return { ...r, audioId: local?.audioId || null };
    } catch { /* offline: fall back */ }
  }
  return local || null;
}

// Returns a playable URL (object URL for local audio, signed URL for cloud audio).
export async function audioSrc(s) {
  if (s.audioId) {
    const blob = await store.getClip(s.audioId);
    if (blob) return { url: URL.createObjectURL(blob), local: true };
  }
  if (s.audioPath && isCloud()) {
    try { return { url: await cloud.audioUrl(s.audioPath), local: false }; } catch { /* ignore */ }
  }
  return null;
}

export function canDelete(s) {
  if (!s.synced) return true;
  return isCloud() && s.ownerId === cloud.user()?.id;
}

export async function remove(s) {
  if (s.synced && isCloud() && s.ownerId === cloud.user()?.id) await cloud.deleteSession(s);
  if (s.audioId) await store.deleteClip(s.audioId);
  store.update((x) => { x.history = x.history.filter((h) => h.id !== s.id); });
  cache = null;
}

export async function saveReview(sessionId, data) {
  await cloud.saveReview(sessionId, data);
  cache = null;
}
