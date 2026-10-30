// Cloud: Google sign-in, synced progress, recordings, teacher links, live calls.
// Everything goes through Supabase with row-level security on the server.
// The rest of the app only talks to this module (tests swap it for a fake).

import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS } from './config.js';
import { cleanSession, cleanCall, cleanPerson, cleanState, cleanApplication, cleanTeacher, cleanRequest } from './clean.js';

let sb = null;
let me = null;
let accessToken = null;
let initPromise = null;
let urlError = '';
const authCbs = new Set();
const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function loadLib() {
  let last;
  for (const url of SUPABASE_JS) {
    try { return await import(/* @vite-ignore */ url); } catch (e) { last = e; }
  }
  throw last || new Error('cloud-unavailable');
}

function cleanUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error') && !q.has('error_description')) return;
  urlError = q.get('error_description') || q.get('error') || '';
  history.replaceState(null, '', location.pathname + (location.hash || '#/'));
}

export function lastUrlError() { const e = urlError; urlError = ''; return e; }

export function init() {
  if (!initPromise) {
    initPromise = (async () => {
      const lib = await withTimeout(loadLib(), 12000);
      sb = lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: 'rattil-auth' },
      });
      const { data } = await sb.auth.getSession();
      setSession(data.session);
      sb.auth.onAuthStateChange((_event, s) => {
        const prev = me?.id || null;
        setSession(s);
        if ((me?.id || null) !== prev) setTimeout(() => authCbs.forEach((f) => f(me)), 0);
      });
      cleanUrl();
      return { user: me };
    })().catch((e) => { initPromise = null; throw e; });
  }
  return initPromise;
}

function setSession(s) {
  me = s?.user || null;
  accessToken = s?.access_token || null;
  if (accessToken && sb?.realtime) sb.realtime.setAuth(accessToken);
}

export const ready = () => !!sb;
export const user = () => me;
export function onAuth(cb) { authCbs.add(cb); return () => authCbs.delete(cb); }

let googleCache = null;
export async function googleEnabled() {
  if (googleCache !== null) return googleCache;
  try {
    const r = await withTimeout(fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } }), 8000);
    const j = await r.json();
    googleCache = !!j?.external?.google;
  } catch { googleCache = false; }
  return googleCache;
}

export async function signInWithGoogle() {
  await init();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!sb) return;
  await sb.auth.signOut();
  me = null;
}

function need() { if (!sb || !me) throw new Error('not-signed-in'); }
function check({ data, error }) { if (error) throw error; return data; }

// ---- Profile ----
export async function getProfile() {
  need();
  return check(await sb.from('profiles').select('id,email,name,avatar_url,role,invite_code').eq('id', me.id).maybeSingle());
}

export async function updateProfile(patch) {
  need();
  const allowed = {};
  ['name', 'role', 'avatar_url'].forEach((k) => { if (k in patch) allowed[k] = patch[k]; });
  return check(await sb.from('profiles').update(allowed).eq('id', me.id).select('id,email,name,avatar_url,role,invite_code').single());
}

// ---- Synced progress (plan, daily, streak, adhkar, settings) ----
export async function pullState() {
  need();
  return check(await sb.from('user_state').select('data,updated_at').eq('user_id', me.id).maybeSingle());
}

export async function pushState(data) {
  need();
  const updated_at = new Date().toISOString();
  check(await sb.from('user_state').upsert({ user_id: me.id, data, updated_at }));
  return updated_at;
}

// ---- Sessions and recordings ----
function mime(blob) { return (blob.type || 'audio/webm').split(';')[0]; }
function ext(type) { return type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm'; }

export async function saveSession(s, blob) {
  need();
  let audioPath = s.audioPath || null;
  if (blob && !audioPath) {
    const type = mime(blob);
    // Each person uploads only into their own folder; readers get access through the session row.
    const path = `${me.id}/${s.id}.${ext(type)}`;
    check(await sb.storage.from('recordings').upload(path, blob, { contentType: type, upsert: true }));
    audioPath = path;
  }
  const { audioId, synced, review, studentName, teacherName, ...data } = s;
  data.audioPath = audioPath;
  check(await sb.from('sessions').upsert({
    id: s.id,
    student_id: s.studentId || null,
    teacher_id: s.teacherId || null,
    kind: s.kind,
    title: s.title || '',
    data,
    audio_path: audioPath,
    created_at: new Date(s.created || Date.now()).toISOString(),
  }));
  return { audioPath };
}

async function names(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const rows = check(await sb.from('profiles').select('id,name,email,avatar_url').in('id', list));
  return Object.fromEntries(rows.map((r) => [r.id, cleanPerson(r)]));
}

function fromRow(r, people, reviews) {
  const d = r.data || {};
  const rv = reviews.find((x) => x.session_id === r.id);
  return cleanSession({
    ...d,
    id: r.id,
    kind: r.kind,
    title: r.title || d.title || '',
    created: new Date(r.created_at).getTime(),
    ownerId: r.owner_id,
    studentId: r.student_id,
    teacherId: r.teacher_id,
    audioPath: r.audio_path,
    student: d.student || people[r.student_id]?.name || '',
    teacher: d.teacher || people[r.teacher_id]?.name || '',
    review: rv ? { ...rv.data, teacherId: rv.teacher_id, teacher: people[rv.teacher_id]?.name || '', updated: new Date(rv.updated_at).getTime() } : null,
    synced: true,
  });
}

export async function listSessions({ studentId, limit = 200 } = {}) {
  need();
  let q = sb.from('sessions').select('*').order('created_at', { ascending: false }).limit(limit);
  if (studentId) q = q.eq('student_id', studentId);
  const rows = check(await q);
  const reviews = rows.length ? check(await sb.from('reviews').select('*').in('session_id', rows.map((r) => r.id))) : [];
  const people = await names([...rows.flatMap((r) => [r.student_id, r.teacher_id]), ...reviews.map((x) => x.teacher_id)]);
  return rows.map((r) => fromRow(r, people, reviews));
}

export async function getSession(id) {
  need();
  const r = check(await sb.from('sessions').select('*').eq('id', id).maybeSingle());
  if (!r) return null;
  const reviews = check(await sb.from('reviews').select('*').eq('session_id', id));
  const people = await names([r.student_id, r.teacher_id, ...reviews.map((x) => x.teacher_id)]);
  return fromRow(r, people, reviews);
}

export async function deleteSession(s) {
  need();
  if (s.audioPath) await sb.storage.from('recordings').remove([s.audioPath]);
  check(await sb.from('sessions').delete().eq('id', s.id));
}

export async function audioUrl(path) {
  need();
  const d = check(await sb.storage.from('recordings').createSignedUrl(path, 900));
  return d.signedUrl;
}

export async function saveReview(sessionId, data) {
  need();
  check(await sb.from('reviews').upsert({ session_id: sessionId, teacher_id: me.id, data }, { onConflict: 'session_id,teacher_id' }));
}

// ---- Teacher and student links ----
export async function myStudents() {
  need();
  const links = check(await sb.from('links').select('student_id,created_at').eq('teacher_id', me.id));
  const ids = links.map((l) => l.student_id);
  if (!ids.length) return [];
  const people = await names(ids);
  const states = check(await sb.from('user_state').select('user_id,data,updated_at').in('user_id', ids));
  return ids.map((id) => ({
    ...(people[id] || { id, name: 'Student' }),
    linked: links.find((l) => l.student_id === id).created_at,
    state: (() => { const x = states.find((y) => y.user_id === id); return x ? { ...x, data: cleanState(x.data) } : null; })(),
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function myTeachers() {
  need();
  const links = check(await sb.from('links').select('teacher_id,created_at').eq('student_id', me.id));
  const people = await names(links.map((l) => l.teacher_id));
  return links.map((l) => people[l.teacher_id] || { id: l.teacher_id, name: 'Teacher' });
}

export async function joinTeacher(code) {
  need();
  const rows = check(await sb.rpc('join_teacher', { code }));
  const r = Array.isArray(rows) ? rows[0] : rows;
  return { id: r.teacher_id, name: r.teacher_name };
}

export async function unlink(teacherId, studentId) {
  need();
  check(await sb.from('links').delete().eq('teacher_id', teacherId).eq('student_id', studentId));
}

// ---- Live calls ----
export async function startCall(studentId, portions) {
  need();
  return cleanCall(check(await sb.from('calls').insert({ teacher_id: me.id, student_id: studentId, portions }).select('*').single()));
}

export async function getCall(id) {
  need();
  const c = check(await sb.from('calls').select('*').eq('id', id).maybeSingle());
  if (!c) return null;
  const people = await names([c.teacher_id, c.student_id]);
  return cleanCall({ ...c, teacher: people[c.teacher_id] || null, student: people[c.student_id] || null });
}

export async function updateCall(id, patch) {
  need();
  const p = { ...patch };
  if (p.status === 'ended') p.ended_at = new Date().toISOString();
  check(await sb.from('calls').update(p).eq('id', id));
}

export async function openCalls() {
  need();
  const since = new Date(Date.now() - 3 * 3600e3).toISOString();
  const rows = check(await sb.from('calls').select('*').in('status', ['ringing', 'active']).gte('created_at', since).order('created_at', { ascending: false }));
  const people = await names(rows.flatMap((c) => [c.teacher_id, c.student_id]));
  return rows.map((c) => cleanCall({ ...c, teacher: people[c.teacher_id] || null, student: people[c.student_id] || null }));
}

// Notifies on any change to calls involving me (ringing, joined, ended).
export function onCalls(cb) {
  if (!sb || !me) return () => {};
  const ch = sb.channel(`calls-for-${me.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `student_id=eq.${me.id}` }, (p) => cb(cleanCall(p.new), p.eventType))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `teacher_id=eq.${me.id}` }, (p) => cb(cleanCall(p.new), p.eventType))
    .subscribe();
  return () => { try { sb.removeChannel(ch); } catch { /* ignore */ } };
}

// A private realtime room for one call: signalling plus live marks.
export function room(callId) {
  need();
  if (accessToken) sb.realtime.setAuth(accessToken);
  const ch = sb.channel(`call:${callId}`, { config: { private: true, broadcast: { self: false, ack: false } } });
  const handlers = {};
  let statusCb = () => {};
  ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
    (handlers[payload?.t] || []).forEach((f) => { try { f(payload.d || {}); } catch (e) { console.error(e); } });
  });
  const joined = new Promise((resolve, reject) => {
    let done = false;
    ch.subscribe((status, err) => {
      statusCb(status);
      if (done) return;
      if (status === 'SUBSCRIBED') { done = true; resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { done = true; reject(err || new Error(status)); }
    });
  });
  return {
    joined,
    on(t, f) { (handlers[t] = handlers[t] || []).push(f); return this; },
    onStatus(f) { statusCb = f; return this; },
    send(t, d = {}) { return ch.send({ type: 'broadcast', event: 'msg', payload: { t, d } }); },
    close() { try { sb.removeChannel(ch); } catch { /* ignore */ } },
  };
}

export async function iceServers() {
  try {
    await init();
    const { data, error } = await withTimeout(sb.functions.invoke('ice-servers', { method: 'POST', body: {} }), 6000);
    if (error) throw error;
    if (Array.isArray(data?.iceServers) && data.iceServers.length) return data.iceServers;
  } catch { /* fall back */ }
  return STUN;
}

// ---- Academy: teacher applications, approved teachers, students asking for a teacher ----
export async function amIAdmin() {
  if (!sb || !me) return false;
  try { return !!check(await sb.rpc('am_i_admin')); } catch { return false; }
}

export async function myApplication() {
  need();
  return check(await sb.from('teacher_applications').select('*').eq('user_id', me.id).maybeSingle());
}

export async function submitApplication(a) {
  need();
  const row = cleanApplication({ ...a, user_id: me.id });
  delete row.status; delete row.admin_note; delete row.id; delete row.created_at; delete row.reviewed_at;
  const existing = await myApplication();
  if (existing) return check(await sb.from('teacher_applications').update({ ...row, updated_at: new Date().toISOString() }).eq('user_id', me.id).select('*').single());
  return check(await sb.from('teacher_applications').insert(row).select('*').single());
}

export async function listApplications() {
  need();
  const rows = check(await sb.from('teacher_applications').select('*').order('created_at', { ascending: false }));
  const people = await names(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...cleanApplication(r), email: people[r.user_id]?.email || '', avatar_url: people[r.user_id]?.avatar_url || '' }));
}

export async function reviewApplication(id, decision, note = '', cap = 10) {
  need();
  check(await sb.rpc('admin_review_application', { app_id: id, decision, note, cap }));
}

export async function listTeachers() {
  need();
  const rows = check(await sb.from('teacher_profiles').select('*').order('approved_at', { ascending: true }));
  let load = []; let seats = [];
  try { load = check(await sb.rpc('teacher_load')) || []; } catch { /* not admin */ }
  try { seats = check(await sb.rpc('teacher_open_seats')) || []; } catch { /* older database */ }
  return rows.map((r) => {
    const t = cleanTeacher(r);
    const seat = seats.find((x) => x.teacher_id === r.user_id);
    return { ...t, students: Number(load.find((x) => x.teacher_id === r.user_id)?.students || 0), hasRoom: seat ? !!seat.has_room : t.accepting };
  });
}

export async function teacherProfile(id) {
  need();
  const r = check(await sb.from('teacher_profiles').select('*').eq('user_id', id).maybeSingle());
  return r ? cleanTeacher(r) : null;
}

export async function updateTeacher(id, cap, accepting) {
  need();
  check(await sb.rpc('admin_update_teacher', { teacher: id, cap, is_accepting: accepting }));
}

export async function myTeacherRequest() {
  need();
  const r = check(await sb.from('teacher_requests').select('*').eq('student_id', me.id).maybeSingle());
  return r ? cleanRequest(r) : null;
}

export async function requestTeacher(req) {
  need();
  const row = cleanRequest({ ...req, student_id: me.id, status: 'waiting', teacher_id: null });
  delete row.created_at; delete row.assigned_at;
  return cleanRequest(check(await sb.from('teacher_requests').upsert(row, { onConflict: 'student_id' }).select('*').single()));
}

export async function cancelTeacherRequest() {
  need();
  check(await sb.from('teacher_requests').update({ status: 'cancelled' }).eq('student_id', me.id));
}

export async function listRequests() {
  need();
  const rows = check(await sb.from('teacher_requests').select('*').order('created_at', { ascending: true }));
  const people = await names(rows.map((r) => r.student_id));
  return rows.map((r) => ({ ...cleanRequest(r), email: people[r.student_id]?.email || '', avatar_url: people[r.student_id]?.avatar_url || '' }));
}

export async function unassignTeacher(studentId, teacherId) {
  need();
  check(await sb.rpc('admin_unassign', { student: studentId, teacher: teacherId }));
}

export async function assignTeacher(studentId, teacherId) {
  need();
  check(await sb.rpc('admin_assign', { student: studentId, teacher: teacherId }));
}

// ---- Who runs the academy: owners add or switch off admins ----
export async function myAdminRole() {
  if (!sb || !me) return null;
  try { const r = check(await sb.rpc('my_admin_role')); return r === 'owner' || r === 'admin' ? r : null; } catch { return null; }
}

export async function listAdmins() {
  need();
  const rows = check(await sb.rpc('admin_list')) || [];
  return rows.map((r) => ({
    email: String(r.email || '').slice(0, 200), role: r.role === 'owner' ? 'owner' : 'admin', active: !!r.active,
    added_by: String(r.added_by || '').slice(0, 200), added_at: String(r.added_at || ''), name: String(r.name || '').slice(0, 120), signed_up: !!r.signed_up,
  }));
}

export async function setAdmin(email, role, active) {
  need();
  check(await sb.rpc('admin_set', { admin_email: email, new_role: role, is_active: active }));
}

// ---- Teacher approval and the application recitation ----
export async function amIApprovedTeacher() {
  if (!sb || !me) return false;
  try { return !!check(await sb.rpc('am_i_approved_teacher')); } catch { return false; }
}

export async function uploadRecitation(blob) {
  need();
  const type = mime(blob);
  const path = `${me.id}/application-${Date.now()}.${ext(type)}`;
  check(await sb.storage.from('recordings').upload(path, blob, { contentType: type, upsert: false }));
  return path;
}

// ---- Academy settings (test phase: teachers may teach before approval) ----
export async function academySettings() {
  need();
  const r = check(await sb.rpc('academy_settings')) || {};
  return { open_teaching: !!r.open_teaching };
}
export async function setOpenTeaching(open) {
  need();
  check(await sb.rpc('admin_set_open_teaching', { is_open: !!open }));
}

// ---- Parent report emails ----
const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;
export async function listReportRecipients() {
  need();
  const rows = check(await sb.from('report_recipients').select('id,email,name,weekly,monthly,tz,confirmed_at,unsubscribed_at,last_weekly_at,last_monthly_at,created_at').eq('student_id', me.id).order('created_at'));
  return rows.map((r) => ({ ...r, email: String(r.email || '').slice(0, 200), name: String(r.name || '').slice(0, 60) }));
}
export async function addReportRecipient({ email, name = '', weekly = true, monthly = true }) {
  need();
  const e = String(email || '').trim().toLowerCase();
  if (!emailOk(e)) throw new Error('Enter a valid email address');
  let tz = 'Asia/Dubai';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch { /* default */ }
  return check(await sb.from('report_recipients').insert({ student_id: me.id, email: e, name: String(name).slice(0, 60), weekly, monthly, tz }).select('id').single());
}
export async function updateReportRecipient(id, patch) {
  need();
  const allowed = {};
  ['name', 'weekly', 'monthly', 'unsubscribed_at'].forEach((k) => { if (k in patch) allowed[k] = patch[k]; });
  check(await sb.from('report_recipients').update(allowed).eq('id', id));
}
export async function removeReportRecipient(id) {
  need();
  check(await sb.from('report_recipients').delete().eq('id', id));
}
export async function reportEmail(action, id, kind = 'week') {
  await init();
  const { data, error } = await withTimeout(sb.functions.invoke('reports', { method: 'POST', body: { action, id, kind } }), 20000);
  if (error) {
    let msg = error.message || 'failed';
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch { /* keep */ }
    throw new Error(msg);
  }
  return data;
}
