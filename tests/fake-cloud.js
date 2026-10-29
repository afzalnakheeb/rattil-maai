// Test double for js/cloud.js. Same exports; every call goes to the Node test runner
// (window.__cloud binding), which keeps one shared fake database for all browser windows.
// Events (call changes, room messages) come back through window.__cloudEvent.

const rpc = async (m, ...a) => {
  const r = await window.__cloud(m, a);
  if (r && r.__error) throw new Error(r.__error);
  return r;
};
let me = null;
const authCbs = new Set();
const listeners = { calls: new Set(), room: new Map() };

window.__cloudEvent = (e) => {
  if (e.kind === 'calls') listeners.calls.forEach((f) => f(e.row, e.type));
  if (e.kind === 'room') (listeners.room.get(e.callId) || new Set()).forEach((f) => f(e.t, e.d));
};

export async function init() { me = await rpc('whoami'); return { user: me }; }
export const ready = () => true;
export const user = () => me;
export function onAuth(cb) { authCbs.add(cb); return () => authCbs.delete(cb); }
export function lastUrlError() { return ''; }
export async function googleEnabled() { return window.__fakeGoogle !== false; }
export async function signInWithGoogle() {
  me = await rpc('signIn');
  setTimeout(() => authCbs.forEach((f) => f(me)), 0);
}
export async function signOut() { await rpc('signOut'); me = null; }

export const getProfile = () => rpc('getProfile');
export const updateProfile = (p) => rpc('updateProfile', p);
export const pullState = () => rpc('pullState');
export const pushState = (d) => rpc('pushState', d);

async function b64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
export async function saveSession(s, blob) {
  const audio = blob ? { type: (blob.type || 'audio/webm').split(';')[0], size: blob.size, b64: await b64(blob) } : null;
  const { audioId, synced, review, ...rest } = s;
  return rpc('saveSession', rest, audio);
}
export const listSessions = (o = {}) => rpc('listSessions', o);
export const getSession = (id) => rpc('getSession', id);
export const deleteSession = (s) => rpc('deleteSession', s.id);
export const audioUrl = (p) => rpc('audioUrl', p);
export const saveReview = (id, d) => rpc('saveReview', id, d);
export const myStudents = () => rpc('myStudents');
export const myTeachers = () => rpc('myTeachers');
export const joinTeacher = (c) => rpc('joinTeacher', c);
export const unlink = (t, s) => rpc('unlink', t, s);
export const startCall = (sid, p) => rpc('startCall', sid, p);
export const getCall = (id) => rpc('getCall', id);
export const updateCall = (id, p) => rpc('updateCall', id, p);
export const openCalls = () => rpc('openCalls');

export function onCalls(cb) {
  listeners.calls.add(cb);
  return () => listeners.calls.delete(cb);
}

export function room(callId) {
  const handlers = {};
  const fn = (t, d) => (handlers[t] || []).forEach((f) => f(d || {}));
  if (!listeners.room.has(callId)) listeners.room.set(callId, new Set());
  listeners.room.get(callId).add(fn);
  const joined = rpc('roomJoin', callId);
  return {
    joined,
    on(t, f) { (handlers[t] = handlers[t] || []).push(f); return this; },
    onStatus() { return this; },
    send(t, d = {}) { return rpc('roomSend', callId, t, d); },
    close() { listeners.room.get(callId)?.delete(fn); rpc('roomLeave', callId); },
  };
}

export async function iceServers() { return []; }

// Academy
export const amIAdmin = () => rpc('amIAdmin');
export const myApplication = () => rpc('myApplication');
export const submitApplication = (a) => rpc('submitApplication', a);
export const listApplications = () => rpc('listApplications');
export const reviewApplication = (id, d, n = '', c = 10) => rpc('reviewApplication', id, d, n, c);
export const listTeachers = () => rpc('listTeachers');
export const teacherProfile = (id) => rpc('teacherProfile', id);
export const updateTeacher = (id, c, a) => rpc('updateTeacher', id, c, a);
export const myTeacherRequest = () => rpc('myTeacherRequest');
export const requestTeacher = (r) => rpc('requestTeacher', r);
export const cancelTeacherRequest = () => rpc('cancelTeacherRequest');
export const listRequests = () => rpc('listRequests');
export const assignTeacher = (s, t) => rpc('assignTeacher', s, t);
export const myAdminRole = () => rpc('myAdminRole');
export const listAdmins = () => rpc('listAdmins');
export const setAdmin = (e, r, a) => rpc('setAdmin', e, r, a);
export const amIApprovedTeacher = () => rpc('amIApprovedTeacher');
export async function uploadRecitation(blob) {
  const audio = { type: (blob.type || 'audio/webm').split(';')[0], size: blob.size, b64: await b64(blob) };
  return rpc('uploadRecitation', audio);
}
