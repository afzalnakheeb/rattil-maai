// End-to-end check: Google sign-in, cloud sync, teacher-student video call, reviews, themes.
// The Quran API, audio CDN, speech engine and cloud (tests/fake-cloud.js) are simulated;
// the video call is a real WebRTC connection between two browser windows with fake cameras.
// Run: node tests/e2e.mjs  (serves the app on a local port)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.SHOTS || path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(OUT, { recursive: true });

// ---------- fixtures ----------
const B = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const SURAHS = {
  1: { name: 'سُورَةُ ٱلْفَاتِحَةِ', en: 'Al-Faatiha', ayahs: [B, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'مَٰلِكِ يَوْمِ ٱلدِّينِ', 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ'], start: 1 },
  112: { name: 'سُورَةُ الإِخۡلَاصِ', en: 'Al-Ikhlaas', ayahs: [B + ' قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'ٱللَّهُ ٱلصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ'], start: 6222 },
  113: { name: 'سُورَةُ الفَلَقِ', en: 'Al-Falaq', ayahs: [B + ' قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', 'مِن شَرِّ مَا خَلَقَ', 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', 'وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ', 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ'], start: 6226 },
  114: { name: 'سُورَةُ النَّاسِ', en: 'An-Naas', ayahs: [B + ' قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ', 'مَلِكِ ٱلنَّاسِ', 'إِلَٰهِ ٱلنَّاسِ', 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ', 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ', 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ'], start: 6231 },
};
function ayahObj(sn, i, page) {
  const s = SURAHS[sn];
  return { number: s.start + i, text: s.ayahs[i], surah: { number: sn, name: s.name, englishName: s.en, englishNameTranslation: '', revelationType: 'Meccan', numberOfAyahs: s.ayahs.length }, numberInSurah: i + 1, juz: sn === 1 ? 1 : 30, manzil: 1, page, ruku: 1, hizbQuarter: 1, sajda: false };
}
function pageData(p) {
  if (p === 1) return SURAHS[1].ayahs.map((_, i) => ayahObj(1, i, 1));
  if (p === 604) return [112, 113, 114].flatMap((sn) => SURAHS[sn].ayahs.map((_, i) => ayahObj(sn, i, 604)));
  // generic filler page
  return Array.from({ length: 6 }, (_, i) => ({ number: 1000 + p * 6 + i, text: 'وَٱللَّهُ عَلِيمٌ حَكِيمٌ', surah: { number: 2, name: 'سُورَةُ البَقَرَةِ', englishName: 'Al-Baqara' }, numberInSurah: 10 + i, juz: 1, page: p }));
}
const meta = {
  surahs: { references: Array.from({ length: 114 }, (_, i) => ({ number: i + 1, name: SURAHS[i + 1]?.name || `سورة ${i + 1}`, englishName: SURAHS[i + 1]?.en || `Surah ${i + 1}`, englishNameTranslation: '', numberOfAyahs: 5, revelationType: 'Meccan' })) },
  pages: { references: Array.from({ length: 604 }, (_, i) => (i === 0 ? { surah: 1, ayah: 1 } : i === 603 ? { surah: 112, ayah: 1 } : { surah: 2, ayah: i })) },
  juzs: { references: Array.from({ length: 30 }, (_, i) => ({ surah: i === 29 ? 112 : 2, ayah: i === 0 ? 1 : i * 9 })) },
};
function surahData(sn) {
  if (SURAHS[sn]) return { number: sn, name: SURAHS[sn].name, englishName: SURAHS[sn].en, ayahs: SURAHS[sn].ayahs.map((_, i) => { const a = ayahObj(sn, i, 604); delete a.surah; return a; }) };
  return { number: sn, name: 'سُورَةُ البَقَرَةِ', englishName: 'Al-Baqara', ayahs: Array.from({ length: 286 }, (_, i) => ({ number: 8 + i, text: i === 254 ? 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ' : 'آية', numberInSurah: i + 1, juz: 3, page: 42 })) };
}

// silent wav, 0.4 s
function wav() {
  const sr = 8000, n = sr * 0.4, buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(n, 40); buf.fill(128, 44); return buf;
}

// ---------- static server ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/`;



// ---------- fake cloud (one shared database for every browser window) ----------
const db = { profiles: [], links: [], state: {}, sessions: [], reviews: [], calls: [], files: {}, apps: [], teachers: [], requests: [] };
const admins = [{ email: 'admin@gmail.com', role: 'owner', active: true, added_by: '', added_at: new Date().toISOString() }];
const adminRole = (uid) => { const e = (prof(uid)?.email || '').toLowerCase(); const a = admins.find((x) => x.email === e && x.active); return a ? a.role : null; };
const ctxUser = new Map();
const ctxIdentity = new Map();
const rooms = new Map();
let seq = 0;
const iso = () => new Date().toISOString();
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const code = () => 'ABC' + String(100 + seq).slice(-3);
const prof = (id) => db.profiles.find((p) => p.id === id);
const teacherOf = (t, s) => db.links.some((l) => l.teacher_id === t && l.student_id === s);
const pub = (p) => p && ({ id: p.id, name: p.name, email: p.email, avatar_url: p.avatar_url });
function pagesOf(uid) {
  const out = [];
  for (const [ctx, id] of ctxUser) if (id === uid) out.push(...ctx.pages());
  return out;
}
function emit(pages, e) { pages.forEach((p) => p.evaluate((ev) => window.__cloudEvent && window.__cloudEvent(ev), e).catch(() => {})); }
function rowOut(r, uid) {
  const rv = db.reviews.filter((x) => x.session_id === r.id)[0];
  return {
    ...r.data, id: r.id, kind: r.kind, title: r.title, created: Date.parse(r.created_at), ownerId: r.owner_id, studentId: r.student_id, teacherId: r.teacher_id,
    audioPath: r.audio_path, student: r.data.student || prof(r.student_id)?.name || '', teacher: r.data.teacher || prof(r.teacher_id)?.name || '',
    review: rv ? { ...rv.data, teacherId: rv.teacher_id, teacher: prof(rv.teacher_id)?.name || '', updated: Date.parse(rv.updated_at) } : null, synced: true,
  };
}
const reallyApproved = (uid) => db.teachers.some((t) => t.user_id === uid) && db.apps.some((a) => a.user_id === uid && a.status === 'approved');
const settings = { open_teaching: false };
const approvedTeacher = (uid) => settings.open_teaching || reallyApproved(uid);
const visible = (r, uid) => r.owner_id === uid || r.student_id === uid || r.teacher_id === uid || teacherOf(uid, r.student_id);
function callOut(c) { return { ...c, teacher: pub(prof(c.teacher_id)), student: pub(prof(c.student_id)) }; }

const api = {
  whoami(ctx) { const id = ctxUser.get(ctx); return id ? { id, email: prof(id).email } : null; },
  signIn(ctx) {
    const who = ctxIdentity.get(ctx);
    let p = db.profiles.find((x) => x.email === who.email);
    if (!p) { p = { id: uuid(), email: who.email, name: who.name, avatar_url: '', role: null, invite_code: code() }; db.profiles.push(p); }
    ctxUser.set(ctx, p.id);
    return { id: p.id, email: p.email };
  },
  signOut(ctx) { ctxUser.delete(ctx); return true; },
  getProfile(ctx, uid) { return { ...prof(uid) }; },
  updateProfile(ctx, uid, [patch]) { Object.assign(prof(uid), patch); return { ...prof(uid) }; },
  pullState(ctx, uid) { return db.state[uid] || null; },
  pushState(ctx, uid, [data]) { const at = iso(); db.state[uid] = { data, updated_at: at }; return at; },
  saveSession(ctx, uid, [s, audio]) {
    if (s.studentId && s.studentId !== uid && !teacherOf(uid, s.studentId)) return { __error: 'rls' };
    if (s.kind !== 'practice' && !approvedTeacher(uid)) return { __error: 'rls' };
    let audioPath = s.audioPath || null;
    if (audio && !audioPath) { audioPath = `${s.studentId || uid}/${s.id}.webm`; db.files[audioPath] = audio; }
    const row = { id: s.id, owner_id: uid, student_id: s.studentId || null, teacher_id: s.teacherId || null, kind: s.kind, title: s.title, data: { ...s, audioPath }, audio_path: audioPath, created_at: new Date(s.created).toISOString() };
    db.sessions = db.sessions.filter((x) => x.id !== s.id).concat(row);
    return { audioPath };
  },
  listSessions(ctx, uid, [o = {}]) { return db.sessions.filter((r) => visible(r, uid) && (!o.studentId || r.student_id === o.studentId)).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => rowOut(r, uid)); },
  getSession(ctx, uid, [id]) { const r = db.sessions.find((x) => x.id === id && visible(x, uid)); return r ? rowOut(r, uid) : null; },
  deleteSession(ctx, uid, [id]) { db.sessions = db.sessions.filter((x) => !(x.id === id && x.owner_id === uid)); return true; },
  audioUrl(ctx, uid, [p]) { const f = db.files[p]; return f ? `data:${f.type};base64,${f.b64}` : null; },
  saveReview(ctx, uid, [id, data]) {
    const s = db.sessions.find((x) => x.id === id);
    if (!s || !teacherOf(uid, s.student_id) || !approvedTeacher(uid)) return { __error: 'rls' };
    db.reviews = db.reviews.filter((x) => !(x.session_id === id && x.teacher_id === uid)).concat({ session_id: id, teacher_id: uid, data, updated_at: iso() });
    return true;
  },
  myStudents(ctx, uid) { return db.links.filter((l) => l.teacher_id === uid).map((l) => ({ ...pub(prof(l.student_id)), linked: l.created_at, state: db.state[l.student_id] ? { user_id: l.student_id, ...db.state[l.student_id] } : null })); },
  myTeachers(ctx, uid) { return db.links.filter((l) => l.student_id === uid).map((l) => pub(prof(l.teacher_id))); },
  joinTeacher(ctx, uid, [c]) {
    const t = db.profiles.find((p) => p.invite_code === String(c).toUpperCase() && p.role === 'teacher');
    if (!t) return { __error: 'No teacher has this code' };
    if (!approvedTeacher(t.id)) return { __error: 'This teacher is not yet approved by the academy' };
    if (!teacherOf(t.id, uid)) db.links.push({ teacher_id: t.id, student_id: uid, created_at: iso() });
    return { id: t.id, name: t.name };
  },
  unlink(ctx, uid, [t, s]) { db.links = db.links.filter((l) => !(l.teacher_id === t && l.student_id === s)); return true; },
  startCall(ctx, uid, [sid, portions]) {
    if (!teacherOf(uid, sid) || !approvedTeacher(uid)) return { __error: 'rls' };
    const c = { id: uuid(), teacher_id: uid, student_id: sid, status: 'ringing', portions, created_at: iso(), ended_at: null };
    db.calls.push(c);
    emit([...pagesOf(uid), ...pagesOf(sid)], { kind: 'calls', row: c, type: 'INSERT' });
    return c;
  },
  getCall(ctx, uid, [id]) { const c = db.calls.find((x) => x.id === id && (x.teacher_id === uid || x.student_id === uid)); return c ? callOut(c) : null; },
  updateCall(ctx, uid, [id, p]) {
    const c = db.calls.find((x) => x.id === id);
    if (!c) return true;
    Object.assign(c, p, p.status === 'ended' ? { ended_at: iso() } : {});
    emit([...pagesOf(c.teacher_id), ...pagesOf(c.student_id)], { kind: 'calls', row: c, type: 'UPDATE' });
    return true;
  },
  // Academy (mirrors the Supabase policies and admin functions)
  amIAdmin(ctx, uid) { return !!adminRole(uid); },
  myAdminRole(ctx, uid) { return adminRole(uid); },
  listAdmins(ctx, uid) { if (!adminRole(uid)) return { __error: 'Admins only' }; return admins.map((a) => { const p = db.profiles.find((x) => x.email === a.email); return { ...a, name: p?.name || '', signed_up: !!p }; }); },
  setAdmin(ctx, uid, [email, role, active]) {
    if (adminRole(uid) !== 'owner') return { __error: 'Only an owner can manage admins' };
    const e = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { __error: 'Enter a valid email address' };
    const before = JSON.stringify(admins);
    const a = admins.find((x) => x.email === e);
    if (a) Object.assign(a, { role, active }); else admins.push({ email: e, role, active, added_by: prof(uid).email, added_at: new Date().toISOString() });
    if (!admins.some((x) => x.role === 'owner' && x.active)) { admins.splice(0, admins.length, ...JSON.parse(before)); return { __error: 'There must be at least one active owner' }; }
    return true;
  },
  amIApprovedTeacher(ctx, uid) { return approvedTeacher(uid); },
  academySettings() { return { ...settings }; },
  setOpenTeaching(ctx, uid, [o]) { if (adminRole(uid) !== 'owner') return { __error: 'Only an owner can change this' }; settings.open_teaching = !!o; return true; },
  uploadRecitation(ctx, uid, [audio]) { const p = `${uid}/application-${Date.now()}.webm`; db.files[p] = audio; return p; },
  myApplication(ctx, uid) { return db.apps.find((x) => x.user_id === uid) || null; },
  submitApplication(ctx, uid, [a]) {
    let x = db.apps.find((y) => y.user_id === uid);
    if (x && x.status !== 'pending') return { __error: 'rls' };
    if (!x) { x = { id: uuid(), user_id: uid, status: 'pending', admin_note: '', created_at: iso(), reviewed_at: null }; db.apps.push(x); }
    const { status, admin_note, id, user_id, created_at, reviewed_at, ...rest } = a;
    Object.assign(x, rest, { updated_at: iso() });
    return { ...x };
  },
  listApplications(ctx, uid) { if (!api.amIAdmin(ctx, uid)) return []; return db.apps.map((x) => ({ ...x, email: prof(x.user_id)?.email || '' })); },
  reviewApplication(ctx, uid, [id, decision, note, cap]) {
    if (!api.amIAdmin(ctx, uid)) return { __error: 'Admins only' };
    const a = db.apps.find((x) => x.id === id); if (!a) return { __error: 'Application not found' };
    if (decision === 'approved' && !a.recitation_path) return { __error: 'A recitation test is needed before approval' };
    Object.assign(a, { status: decision, admin_note: note || '', reviewed_at: iso() });
    if (decision === 'approved') {
      db.teachers = db.teachers.filter((t) => t.user_id !== a.user_id).concat({ user_id: a.user_id, name: a.name, country: a.country, gender: a.gender, languages: a.languages, years_experience: a.years_experience, ijazah: a.ijazah, qualifications: a.qualifications, teaches: a.teaches, bio: a.bio, availability: a.availability, capacity: cap, accepting: true, approved_at: iso() });
      prof(a.user_id).role = 'teacher';
    } else db.teachers.filter((t) => t.user_id === a.user_id).forEach((t) => { t.accepting = false; t.capacity = 0; });
    return true;
  },
  listTeachers(ctx, uid) { return db.teachers.map((t) => ({ ...t, students: api.amIAdmin(ctx, uid) || t.user_id === uid ? db.links.filter((l) => l.teacher_id === t.user_id).length : 0 })); },
  teacherProfile(ctx, uid, [id]) { return db.teachers.find((t) => t.user_id === id) || null; },
  updateTeacher(ctx, uid, [id, cap, acc]) { if (!api.amIAdmin(ctx, uid)) return { __error: 'Admins only' }; const t = db.teachers.find((x) => x.user_id === id); if (t) Object.assign(t, { capacity: cap, accepting: acc }); return true; },
  myTeacherRequest(ctx, uid) { return db.requests.find((r) => r.student_id === uid) || null; },
  requestTeacher(ctx, uid, [r]) { db.requests = db.requests.filter((x) => x.student_id !== uid).concat({ ...r, student_id: uid, status: 'waiting', teacher_id: null, created_at: iso() }); return db.requests.find((x) => x.student_id === uid); },
  cancelTeacherRequest(ctx, uid) { const r = db.requests.find((x) => x.student_id === uid); if (r) r.status = 'cancelled'; return true; },
  listRequests(ctx, uid) { if (!api.amIAdmin(ctx, uid)) return []; return db.requests.map((r) => ({ ...r, email: prof(r.student_id)?.email || '' })); },
  assignTeacher(ctx, uid, [s, t]) {
    if (!api.amIAdmin(ctx, uid)) return { __error: 'Admins only' };
    if (!reallyApproved(t)) return { __error: 'Not an approved teacher' };
    if (!teacherOf(t, s)) db.links.push({ teacher_id: t, student_id: s, created_at: iso() });
    const r = db.requests.find((x) => x.student_id === s); if (r) Object.assign(r, { status: 'assigned', teacher_id: t, assigned_at: iso() });
    return true;
  },
  openCalls(ctx, uid) { return db.calls.filter((c) => (c.teacher_id === uid || c.student_id === uid) && c.status !== 'ended').map(callOut); },
};

async function cloudBinding(source, m, a) {
  const ctx = source.context;
  try {
    if (m === 'roomJoin') { const [id] = a; if (!rooms.has(id)) rooms.set(id, new Set()); rooms.get(id).add(source.page); return true; }
    if (m === 'roomLeave') { rooms.get(a[0])?.delete(source.page); return true; }
    if (m === 'roomSend') {
      const [id, t, d] = a;
      const peers = [...(rooms.get(id) || [])].filter((p) => p !== source.page);
      emit(peers, { kind: 'room', callId: id, t, d });
      return true;
    }
    if (m === 'whoami' || m === 'signIn' || m === 'signOut') return api[m](ctx);
    const uid = ctxUser.get(ctx);
    if (!uid) return { __error: 'not-signed-in' };
    return api[m](ctx, uid, a);
  } catch (e) { return { __error: String(e) }; }
}

// ---------- browser ----------
const SPEECH_MOCK = `
  class FakeSR {
    constructor() { this.lang=''; window.__recs = (window.__recs||[]); window.__recs.push(this); }
    start() { window.__rec = this; this._on = true; }
    stop() { this._on = false; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { this.stop(); }
  }
  window.SpeechRecognition = FakeSR;
  window.__say = (text) => {
    const r = window.__rec; if (!r || !r._on) return false;
    const res = [{ transcript: text }]; res.isFinal = true;
    r.onresult({ resultIndex: 0, results: [res] }); return true;
  };
`;

const errors = [];
const audioRequests = [];
const window_word_requests = [];
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] });

async function newPage(viewport, identity = { email: 'user@gmail.com', name: 'User' }, { google = true, scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport, permissions: ['microphone', 'camera'], colorScheme: scheme });
  ctxIdentity.set(ctx, identity);
  await ctx.exposeBinding('__cloud', cloudBinding);
  await ctx.addInitScript(SPEECH_MOCK + (google ? '' : 'window.__fakeGoogle=false;'));
  await ctx.route('**/js/cloud.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'tests', 'fake-cloud.js'), 'utf8') }));
  await ctx.route('https://api.alquran.cloud/**', (route) => {
    const u = new URL(route.request().url());
    let data;
    let m;
    if ((m = u.pathname.match(/\/v1\/page\/(\d+)\//))) data = { number: +m[1], ayahs: pageData(+m[1]) };
    else if (u.pathname.endsWith('/v1/meta')) data = meta;
    else if ((m = u.pathname.match(/\/v1\/surah\/(\d+)\//))) data = surahData(+m[1]);
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 200, status: 'OK', data }) });
  });
  await ctx.route('https://cdn.islamic.network/**', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav() }));
  await ctx.route('https://everyayah.com/**', (route) => { audioRequests.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav() }); });
  await ctx.route('https://audio.qurancdn.com/**', (route) => { window_word_requests.push(route.request().url()); route.fulfill({ status: 200, contentType: 'audio/wav', body: wav() }); });
  await ctx.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://fonts.gstatic.com/**', (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[${identity.name}] ${msg.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${identity.name}] ${String(e)}`));
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

try {
  // ---------- Device-only start while Google is off ----------
  const lp = await newPage({ width: 390, height: 844 }, { email: 'x@gmail.com', name: 'X' }, { google: false });
  await lp.goto(BASE);
  await lp.waitForSelector('#local');
  check('Without Google sign-in, device-only start is offered', await lp.isDisabled('#google'));
  await lp.click('#local');
  await lp.waitForSelector('#roleForm #nm');
  check('Device-only start asks name and role', true);
  await lp.context().close();

  // ---------- Student signs in with Google ----------
  const page = await newPage({ width: 390, height: 844 }, { email: 'yusuf.ali@gmail.com', name: 'Yusuf Ali' });
  await page.goto(BASE);
  await page.waitForSelector('#google');
  check('Welcome requires Google sign-in (no device-only button)', (await page.locator('#local').count()) === 0);
  await shot(page, '01-welcome');
  await page.click('#google');
  await page.waitForSelector('#roleForm');
  const roleTxt = await page.textContent('#roleForm');
  check('After Google sign-in the role picker shows the Google account', /yusuf\.ali@gmail\.com/.test(roleTxt) && /Yusuf Ali/.test(roleTxt));
  await page.click('#roleForm button[type=submit]');
  await page.waitForSelector('#planForm');
  check('Plan setup shows after choosing Student', true);
  await page.click('#planForm button[type=submit]');
  await page.waitForSelector('text=Today\'s plan');
  const sabaqText = await page.textContent('.card .list-item');
  check('Today shows sabaq on page 604 first half', /Page 604, first half/.test(sabaqText), sabaqText.trim().replace(/\s+/g, ' ').slice(0, 80));
  await page.waitForSelector('#teacherCard #joinT');
  await page.waitForSelector('#nextStep a[href="#/find-teacher"]');
  check('Today shows "Next step: get your teacher" for a new student', true);
  check('Today offers to join a teacher with a class code', true);
  await shot(page, '02-today');
  await page.waitForTimeout(1800);
  const studentId = db.profiles.find((p) => p.email === 'yusuf.ali@gmail.com').id;
  check('Plan is saved to the cloud', !!db.state[studentId]?.data?.plan, JSON.stringify(db.state[studentId]?.data?.plan || null).slice(0, 60));

  // Mushaf
  await page.goto(BASE + '#/mushaf?page=1');
  await page.waitForSelector('.ayah');
  check('Mushaf page 1 renders 7 ayahs', (await page.locator('.ayah').count()) === 7);
  await page.click('#plToggle');
  await page.waitForSelector('.ayah.playing', { timeout: 5000 });
  check('Playing highlights the current ayah', true);
  check('34 reciters in groups, imams of al-Haram and an-Nabawi first', (await page.locator('#recSel option').count()) === 34 && /Imams of al-Haram/.test(await page.locator('#recSel optgroup').first().getAttribute('label')));
  await page.selectOption('#recSel', 'ea.yasser');
  await page.waitForTimeout(800);
  check('Yasser ad-Dosari plays ayah by ayah from EveryAyah', audioRequests.some((u) => /Yasser_Ad-Dussary_128kbps\/001001\.mp3$/.test(u) || /Yasser_Ad-Dussary_128kbps\/00100\d\.mp3$/.test(u)), audioRequests.slice(-2).join(' '));
  await page.selectOption('#recSel', 'ar.husary');
  await page.click('#plToggle');

  // Recite sabaq with mistakes
  await page.goto(BASE + '#/recite?plan=sabaq');
  await page.waitForSelector('.words');
  await page.click('#mic');
  await page.waitForFunction(() => window.__rec && window.__rec._on);
  await page.evaluate(() => window.__say('قل هو الله احد'));
  await page.evaluate(() => window.__say('الله الصمد'));
  await page.evaluate(() => window.__say('لم يلد يولد'));
  await page.waitForTimeout(100);
  check('A skipped word is marked with a correction card', (await page.locator('.w.bad').count()) === 1 && await page.isVisible('#fix'));
  await page.click('[data-fix="word"]');
  await page.waitForFunction(() => window.__rec && window.__rec._on, null, { timeout: 4000 }).catch(() => {});
  check('Correct word audio requested', window_word_requests.some((u) => /112_003_003\.mp3$/.test(u)));
  await page.evaluate(() => window.__say('ولم يكن له كفوا كبير'));
  await page.evaluate(() => window.__say('قل اعوذ برب الناس من شر ما كسب ومن شر غاسق اذا وقب ومن شر النفاثات في العقد'));
  await page.waitForSelector('#result .card', { timeout: 5000 });
  check('Finishing shows the result', /% correct/.test(await page.textContent('#result')));
  await page.waitForTimeout(600);
  const practice = db.sessions.find((r) => r.owner_id === studentId && r.kind === 'practice');
  check('Practice session uploads to the cloud with audio', !!practice && !!db.files[practice.audio_path] && db.files[practice.audio_path].size > 0, practice ? `${db.files[practice.audio_path]?.size || 0} bytes` : 'none');

  // History from the cloud
  await page.goto(BASE + '#/history');
  await page.waitForSelector('a.card');
  check('History lists the practice from the cloud', (await page.locator('a.card').count()) === 1);
  await page.locator('a.card').first().click();
  check('Cloud recording is playable', await page.waitForSelector('audio', { timeout: 5000 }).then(() => true).catch(() => false));

  // ---------- Teacher signs in, student joins with the class code ----------
  const tp = await newPage({ width: 1280, height: 860 }, { email: 'ustadh.ahmed@gmail.com', name: 'Ustadh Ahmed' });
  await tp.goto(BASE);
  await tp.click('#google');
  await tp.waitForSelector('#roleForm');
  await tp.check('input[value=teacher]');
  await tp.click('#roleForm button[type=submit]');
  await tp.waitForSelector('#appForm');
  check('Choosing Teacher opens the academy application form', true);
  await tp.goto(BASE + '#/');
  await tp.waitForSelector('.locked-note');
  check('An unapproved teacher cannot teach (no class code, no students)', (await tp.locator('#code, #students').count()) === 0);
  await tp.waitForSelector('#academyStatus .card');
  check('Teacher home invites the teacher to apply to the academy', /Teach with the academy/.test(await tp.textContent('#academyStatus')));
  await tp.goto(BASE + '#/live');
  await tp.waitForSelector('.locked-note');
  check('Teaching pages are closed before approval', true);
  // The academy approves Ustadh Ahmed (the full apply -> approve flow is tested in the academy section).
  const ahmedId = db.profiles.find((p) => p.email === 'ustadh.ahmed@gmail.com').id;
  db.apps.push({ id: uuid(), user_id: ahmedId, name: 'Ustadh Ahmed', status: 'approved', languages: ['ar', 'en'], gender: 'male', years_experience: 15, teaches: ['hifz', 'tajweed'], recitation_path: `${ahmedId}/application.webm`, admin_note: '', created_at: iso() });
  db.teachers.push({ user_id: ahmedId, name: 'Ustadh Ahmed', country: 'UAE', gender: 'male', languages: ['ar', 'en'], years_experience: 15, ijazah: '', qualifications: '', teaches: ['hifz', 'tajweed'], bio: '', availability: '', capacity: 20, accepting: true, approved_at: iso() });
  await tp.goto(BASE + '#/mushaf');
  await tp.goto(BASE + '#/');
  await tp.waitForSelector('text=Your class code');
  check('After approval the class code and students open', true);
  const classCode = (await tp.textContent('#code')).trim();
  check('Teacher gets a class code', /^[A-Z0-9]{6}$/.test(classCode), classCode);
  await shot(tp, '09-teacher-home');

  await page.goto(BASE + `#/join/${classCode}`);
  await page.waitForSelector('text=You joined', { timeout: 5000 });
  check('Student joins the class with the invite link', /Ustadh Ahmed/.test(await page.textContent('#view')));

  await tp.reload();
  await tp.waitForSelector('#students .list-item', { timeout: 6000 });
  const stTxt = await tp.textContent('#students');
  check('Teacher sees the linked student with progress', /Yusuf Ali/.test(stTxt) && /page|plan/i.test(stTxt), stTxt.replace(/\s+/g, ' ').slice(0, 90));

  // ---------- Video session ----------
  await tp.click('#students a[href*="online=1"]');
  await tp.waitForSelector('#setupForm');
  check('Session setup prefills today’s sabaq page', (await tp.inputValue('#pg')) === '604');
  await tp.click('#go');
  await tp.waitForURL(/#\/call\//, { timeout: 6000 });
  await tp.waitForSelector('#join');
  await tp.click('#join');
  await tp.waitForSelector('#stage');

  await page.goto(BASE + '#/');
  await page.waitForSelector('.ring-banner', { timeout: 6000 });
  check('Student’s app rings with the teacher’s name', /Ustadh Ahmed/.test(await page.textContent('.ring-banner')));
  await shot(page, '14-student-ring');
  await page.click('#ringYes');
  await page.waitForSelector('#join');
  await shot(page, '15-student-prejoin');
  await page.click('#join');
  await page.waitForSelector('#stage');

  const connected = await Promise.all([
    tp.waitForFunction(() => document.querySelector('#statusText')?.textContent === 'Connected', null, { timeout: 25000 }).then(() => true).catch(() => false),
    page.waitForFunction(() => document.querySelector('#statusText')?.textContent === 'Connected', null, { timeout: 25000 }).then(() => true).catch(() => false),
  ]);
  check('Video call connects on both sides', connected[0] && connected[1], `teacher ${connected[0]}, student ${connected[1]}`);
  const videoFlows = await page.waitForFunction(() => { const v = document.querySelector('#remoteVid'); return v && v.videoWidth > 0; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
  check('Student receives the teacher’s video', videoFlows);
  const tVideo = await tp.waitForFunction(() => { const v = document.querySelector('#remoteVid'); return v && v.videoWidth > 0; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
  check('Teacher receives the student’s video', tVideo);

  await tp.waitForFunction(() => !document.querySelector('#startBtn').disabled, null, { timeout: 5000 });
  await tp.click('#startBtn');
  await page.waitForFunction(() => window.__rec && window.__rec._on, null, { timeout: 6000 });
  check('Teacher’s Start turns on the AI on the student’s phone', /Recite now/.test(await page.textContent('#phaseNote')));
  await page.evaluate(() => window.__say('قل هو الله احد الله الصمد لم يلد يولد'));
  await tp.waitForSelector('#wordsBox .w.ai', { timeout: 5000 }).catch(() => {});
  check('Teacher sees the AI suggestion from the student’s phone', (await tp.locator('#wordsBox .w.ai').count()) >= 1);
  const tCurrent = await tp.locator('#wordsBox .w.current').count();
  check('Teacher follows the student’s position live', tCurrent === 1);
  await tp.click('#wordsBox [data-i="1"]');
  await page.waitForFunction(() => document.querySelectorAll('#wordsCard .w.bad').length >= 1, null, { timeout: 5000 }).then(() => true).catch(() => false);
  check('Teacher’s mark appears on the student’s screen', (await page.locator('#wordsCard .w.bad').count()) >= 1);
  await tp.click('[data-confirm]');
  await shot(tp, '16-teacher-call');
  await shot(page, '17-student-call');
  check('No sideways scrolling on the student’s call screen', await noOverflow(page));
  await page.evaluate(() => window.__say('ولم يكن له كفوا احد'));
  await tp.waitForTimeout(1500);
  await tp.click('#gradeBtn');
  await tp.waitForSelector('#work #gradeForm');
  await tp.fill('#comment', 'Mashallah. Revise ولم in ayah 3.');
  await tp.click('[data-decision="pass"]');
  await tp.waitForSelector('text=Saved ·', { timeout: 8000 });
  await page.waitForSelector('#result .card', { timeout: 6000 });
  const sRes = await page.textContent('#result');
  check('Student sees the grade and comment at once', /\/100/.test(sRes) && /Mashallah/.test(sRes), sRes.replace(/\s+/g, ' ').slice(0, 80));
  const online = db.sessions.find((r) => r.kind === 'online');
  check('Video session saved with the call recording', !!online && (db.files[online.audio_path]?.size || 0) > 1000, online ? `${db.files[online.audio_path]?.size || 0} bytes` : 'none');
  check('Saved video session has teacher and AI marks', !!online && online.data.marks.some((m) => m.source === 'teacher') && online.data.marks.some((m) => m.source === 'ai' && m.status === 'confirmed'));
  await shot(page, '18-student-graded');
  await page.click('#result a');
  await page.waitForSelector('text=Video session');
  check('Student opens the graded video session in History', await page.waitForSelector('audio', { timeout: 5000 }).then(() => true).catch(() => false));
  await tp.click('#endBtn');
  await tp.waitForTimeout(300);
  check('Leaving ends the call', db.calls[0]?.status === 'ended');

  // ---------- Teacher reviews the student's AI practice ----------
  await tp.goto(BASE + '#/history?f=review');
  await tp.waitForSelector('a.card');
  await tp.locator('a.card').first().click();
  await tp.waitForSelector('a[href^="#/review/"]');
  await tp.click('a[href^="#/review/"]');
  await tp.waitForSelector('#wordsBox .words');
  check('Review shows the student’s AI marks as suggestions', (await tp.locator('#wordsBox .w.ai').count()) >= 1);
  await tp.click('#wordsBox [data-i="0"]');
  await tp.click('#gradeBtn');
  await tp.waitForSelector('#gradeForm');
  await tp.click('[data-decision="repeat"]');
  await tp.waitForSelector('text=Teacher review', { timeout: 6000 });
  check('Teacher review saved', db.reviews.length === 1);
  await page.goto(BASE + `#/history/${practice.id}`);
  await page.waitForSelector('text=Teacher review', { timeout: 6000 }).catch(() => {});
  const pv = await page.textContent('#view');
  check('Student sees the teacher’s review on their practice', /Teacher review/.test(pv) && /Repeat this portion/.test(pv));

  // ---------- Parent reports ----------
  await page.goto(BASE + '#/report');
  await page.waitForSelector('.hero', { timeout: 8000 });
  const rep = await page.textContent('#view');
  check('Weekly report shows a summary', /Yusuf recited \d+ times/.test(rep), (rep.match(/Yusuf recited[^.]*\./) || [''])[0].slice(0, 90));
  check('Report lists words to revise', /Words to revise/.test(rep));
  check('Report shows teacher feedback with the comment', /Mashallah\. Revise/.test(rep));
  check('Report counts mistakes by type', /Skipped word · \d/.test(rep));
  await page.screenshot({ path: path.join(OUT, '23-report-week.png'), fullPage: true });
  await page.click('[data-range="month"]');
  await page.waitForSelector('text=Monthly report for parents');
  check('Monthly report switches the period', /\/30/.test(await page.textContent('#view')));
  await page.click('#older');
  await page.waitForTimeout(300);
  check('Previous period shows an empty report without errors', /did not record/.test(await page.textContent('#view')));
  check('No sideways scrolling on the report', await noOverflow(page));
  await tp.goto(BASE + `#/report?student=${studentId}`);
  await tp.waitForSelector('.hero', { timeout: 8000 });
  check('Teacher sees the same report for the student', /Yusuf Ali/.test(await tp.textContent('#view')) && /Words to revise/.test(await tp.textContent('#view')));
  await shot(tp, '24-report-teacher');

  // ---------- In-person session on the teacher's device ----------
  await tp.goto(BASE + '#/');
  await tp.fill('#newStudent', 'Maryam');
  await tp.click('#addStudent button');
  await tp.click('#local a[href*="student=l:"]');
  await tp.waitForSelector('#setupForm');
  await tp.fill('#pg', '1');
  await tp.click('#go');
  await tp.waitForSelector('#wordsBox .words');
  await tp.click('#startBtn');
  await tp.waitForFunction(() => window.__rec && window.__rec._on);
  await tp.evaluate(() => window.__say('بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين اياك نعبد نستعين'));
  await tp.waitForTimeout(200);
  check('In-person: AI suggestion appears', (await tp.locator('.w.ai').count()) === 1);
  await tp.click('[data-confirm]');
  await tp.waitForTimeout(1100);
  await tp.click('#gradeBtn');
  await tp.waitForSelector('#gradeForm');
  await tp.click('[data-decision="pass"]');
  await tp.waitForSelector('text=Decision:', { timeout: 6000 }).catch(() => {});
  check('In-person session saved with grade', /Decision:/.test(await tp.textContent('#view')));

  // ---------- Theme ----------
  await tp.goto(BASE + '#/settings');
  await tp.click('[data-theme-opt="dark"]');
  await tp.waitForTimeout(400);
  const dark = await tp.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]);
  check('Dark theme applies', dark[0] === 'dark' && dark[1] === 'rgb(11, 20, 17)', dark.join(' '));
  await tp.goto(BASE + '#/');
  await tp.waitForSelector('#students .list-item');
  await shot(tp, '19-teacher-home-dark');
  const dp = await newPage({ width: 390, height: 844 }, { email: 'yusuf.ali@gmail.com', name: 'Yusuf Ali' }, { scheme: 'dark' });
  await dp.goto(BASE);
  await dp.click('#google');
  await dp.waitForSelector('text=Today\'s plan', { timeout: 8000 });
  check('Same Google account on a second device restores the plan', /Page 604/.test(await dp.textContent('#view')));
  await shot(dp, '20-today-dark-second-device');
  await dp.goto(BASE + '#/recite?plan=sabqi');
  await dp.waitForTimeout(400);
  await dp.goto(BASE + '#/more');
  await dp.waitForSelector('a[href="#/duas"]');
  await dp.goto(BASE + '#/duas');
  await dp.waitForTimeout(500);
  await shot(dp, '21-duas-dark');
  await dp.goto(BASE + '#/prayer');
  await dp.waitForTimeout(500);
  await shot(dp, '22-prayer-dark');
  check('No sideways scrolling on phone (dark)', await noOverflow(dp));
  // Full screen button and bottom bar visibility
  await dp.goto(BASE + '#/');
  await dp.waitForSelector('#fsBtn');
  check('Full-screen button is in the header', await dp.isVisible('#fsBtn'));
  await dp.click('#fsBtn');
  await dp.waitForTimeout(400);
  const fsState = await dp.evaluate(() => ({ fs: !!document.fullscreenElement, sheet: !!document.querySelector('.sheet') }));
  check('Full-screen button enters full screen (or shows install steps)', fsState.fs || fsState.sheet, JSON.stringify(fsState));
  if (fsState.fs) {
    check('Button switches to "Exit full screen"', (await dp.getAttribute('#fsBtn', 'aria-label')) === 'Exit full screen');
    await dp.evaluate(() => document.exitFullscreen());
    await dp.waitForTimeout(300);
    check('Leaving full screen restores the button', (await dp.getAttribute('#fsBtn', 'aria-label')) === 'Full screen');
  } else { await dp.keyboard.press('Escape'); }
  await dp.setViewportSize({ width: 390, height: 560 });
  await dp.waitForTimeout(200);
  const barOk = await dp.evaluate(() => { const r = document.querySelector('#tabbar').getBoundingClientRect(); return r.height > 40 && r.bottom <= innerHeight + 1 && r.top < innerHeight; });
  check('Bottom tab bar stays on screen on a short phone screen', barOk);
  // ---------- Academy: apply to teach, admin approves, student asks, admin assigns ----------
  const ap = await newPage({ width: 390, height: 844 }, { email: 'maryam.teacher@gmail.com', name: 'Maryam Khan' });
  await ap.goto(BASE + '#/apply');
  await ap.waitForSelector('#google');
  await ap.click('#google');
  await ap.waitForSelector('#roleForm');
  check('Arriving to apply suggests the Teacher role', await ap.isChecked('#roleForm input[value="teacher"]'));
  await ap.click('#roleForm button[type=submit]');
  await ap.waitForSelector('#appForm');
  check('After sign-in the teacher lands on the application form', true);
  await ap.click('#appForm label:has(input[name="gender"][value="female"])');
  await ap.fill('#aYears', '12');
  await ap.fill('#aCountry', 'Pakistan');
  await ap.click('#appForm label:has(input[name="main"][value="ur"])');
  await ap.click('#appForm label:has(input[name="lang"][value="en"])');
  await ap.click('#appForm label:has(input[name="lang"][value="ar"])');
  await ap.check('#appForm input[name="teaches"][value="children"]');
  await ap.fill('#aIjazah', 'Ijazah in Hafs from Jamia Ashrafia, Lahore');
  await ap.fill('#aBio', 'I teach children and sisters with patience. <script>x</script>');
  await ap.fill('#aAvail', 'Weekdays after Asr (GMT+5)');
  check('Application explains the recitation test', /Your recitation test/.test(await ap.textContent('#reciteTest')) && /tajweed/.test(await ap.textContent('#reciteTest')));
  await ap.waitForFunction(() => document.querySelectorAll('#rcSurah option').length > 1);
  await ap.selectOption('#rcSurah', '1');
  await ap.click('#appForm button[type=submit]');
  await ap.waitForSelector('text=Record your recitation test before sending');
  check('The application cannot be sent without a recitation', !db.apps.some((x) => x.name === 'Maryam Khan'));
  await ap.waitForFunction(() => document.querySelectorAll('#rcSurah option').length > 1);
  await ap.selectOption('#rcSurah', '1');
  await ap.evaluate(() => { window.__testMinRec = 1; });
  await ap.click('#recStart');
  await ap.waitForSelector('#recStop');
  await ap.waitForTimeout(1800);
  await ap.click('#recStop');
  await ap.waitForSelector('#recBox audio');
  await ap.locator('#reciteTest').screenshot({ path: path.join(OUT, '44-recite-test.png') });
  check('Teacher records the surah and can listen back', true);
  await ap.click('#appForm button[type=submit]');
  await ap.waitForSelector('text=Under review');
  const mApp = db.apps.find((x) => x.name === 'Maryam Khan');
  check('Recitation uploads with the application', !!mApp?.recitation_path && !!db.files[mApp.recitation_path]?.size && mApp.recitation_surah === 1);
  check('Teacher application is sent and shows "Under review"', !!mApp && mApp.years_experience === 12 && mApp.languages.join() === 'ur,ar,en', JSON.stringify(mApp || {}).slice(0, 160));
  await shot(ap, '40-apply');
  check('No sideways scrolling on the application form', await noOverflow(ap));

  const sp = await newPage({ width: 390, height: 844 }, { email: 'aisha.student@gmail.com', name: 'Aisha' });
  await sp.goto(BASE);
  await sp.click('#google');
  await sp.waitForSelector('#roleForm');
  await sp.click('#roleForm button[type=submit]');
  await sp.waitForSelector('#planForm');
  await sp.click('#planForm button[type=submit]');
  await sp.waitForSelector('#teacherCard a[href="#/find-teacher"]');
  check('Today offers "Find me a teacher" when there is no teacher', true);
  await sp.click('#teacherCard a[href="#/find-teacher"]');
  await sp.waitForSelector('#reqForm');
  check('Find-a-teacher asks the mother tongue first', /speak best/.test(await sp.textContent('#reqForm')));
  await sp.click('#reqForm label:has(input[name="main"][value="ur"])');
  await sp.click('#reqForm label:has(input[name="lang"][value="en"])');
  await sp.click('#reqForm label:has(input[name="tg"][value="female"])');
  await sp.click('#reqForm label:has(input[name="age"][value="child"])');
  await sp.fill('#rLevel', 'Reads Qaida');
  await sp.click('#reqForm button[type=submit]');
  await sp.waitForSelector('text=You are on the list');
  check('Student request is saved with language and teacher gender', db.requests[0]?.languages?.join() === 'ur,en' && db.requests[0]?.teacher_gender === 'female');

  const adm = await newPage({ width: 1280, height: 860 }, { email: 'admin@gmail.com', name: 'Afzal' });
  await adm.goto(BASE + '#/admin');
  await adm.click('#google');
  await adm.waitForSelector('#roleForm');
  await adm.click('#roleForm button[type=submit]');
  await adm.waitForSelector('#planForm, .admin-tabs', { timeout: 8000 });
  if (await adm.locator('#planForm').count()) { await adm.click('#planForm button[type=submit]'); await adm.goto(BASE + '#/admin'); }
  await adm.waitForSelector('.admin-tabs');
  check('Admin panel opens for the admin account', true);
  const ov = await adm.textContent('#pane');
  check('Overview counts the application and the waiting student', /1\s*Applications to review/.test(ov.replace(/\s+/g, ' ')) && /1\s*Students waiting/.test(ov.replace(/\s+/g, ' ')), ov.replace(/\s+/g, ' ').slice(0, 120));
  await shot(adm, '41-admin-overview');
  await adm.click('[data-tab="applications"]');
  await adm.waitForSelector('[data-app]');
  const appTxt = await adm.textContent('[data-app]');
  check('Application shows experience, languages and ijazah', /12 years/.test(appTxt) && /Urdu/.test(appTxt) && /Jamia Ashrafia/.test(appTxt));
  check('Application text is escaped (no injected script)', (await adm.locator('[data-app] script').count()) === 0 && /<script>x<\/script>/.test(appTxt));
  await adm.click('[data-app] [data-listen]');
  await adm.waitForSelector('[data-app] audio');
  check('Admin can listen to the recitation before approving', /Recitation test/.test(await adm.textContent('[data-app]')));
  await adm.fill('[data-app] input[id^="cap-"]', '8');
  await adm.click('[data-review="approved"]');
  await adm.waitForSelector('text=Approved. The teacher is now verified.');
  check('Approving makes a verified teacher with the capacity set', db.teachers.some((t) => t.name === 'Maryam Khan' && t.capacity === 8));
  await adm.click('[data-tab="students"]');
  await adm.waitForSelector('[data-req] [data-assign]');
  const reqTxt = await adm.textContent('[data-req]');
  check('Waiting student is matched to the Urdu-speaking female teacher', /Maryam Khan/.test(reqTxt) && /Urdu/.test(reqTxt));
  await shot(adm, '42-admin-match');
  await adm.click('[data-req] [data-assign]');
  await adm.waitForSelector('text=Recently matched');
  const aishaId = db.profiles.find((p) => p.email === 'aisha.student@gmail.com').id;
  const maryamId = db.profiles.find((p) => p.email === 'maryam.teacher@gmail.com').id;
  check('Assigning links the student to the teacher', db.links.some((l) => l.teacher_id === maryamId && l.student_id === aishaId));
  await adm.click('[data-tab="teachers"]');
  await adm.waitForSelector('.teacher-card');
  check('Teacher card shows 1 of 8 students', /1 of 8 students/.test(await adm.textContent('.teacher-card:has-text("Maryam Khan")')));
  check('No sideways scrolling on the admin panel', await noOverflow(adm));

  const sp2 = await newPage({ width: 390, height: 844 }, { email: 'bilal.student@gmail.com', name: 'Bilal' });
  await sp2.goto(BASE); await sp2.click('#google'); await sp2.waitForSelector('#roleForm'); await sp2.click('#roleForm button[type=submit]');
  await sp2.waitForSelector('#planForm'); await sp2.click('#planForm button[type=submit]');
  await sp2.goto(BASE + '#/find-teacher'); await sp2.waitForSelector('#reqForm');
  await sp2.click('#reqForm label:has(input[name="main"][value="other"])');
  await sp2.selectOption('#reqForm select[name="main-other"]', 'ta');
  check('Other mother tongue: no teacher yet message', /No verified teacher speaks Tamil yet/.test(await sp2.textContent('#tPreview')));
  await sp2.click('#reqForm label:has(input[name="main"][value="ur"])');
  await sp2.waitForSelector('#tPreview .teacher-pick');
  check('Student sees verified teachers who speak their language', /Maryam Khan/.test(await sp2.textContent('#tPreview')) && /Urdu is their mother tongue/.test(await sp2.textContent('#tPreview')));
  await sp2.click('#tPreview .teacher-pick input', { force: true });
  await sp2.locator('#reqForm').scrollIntoViewIfNeeded();
  await sp2.screenshot({ path: path.join(OUT, '43-find-teacher.png'), fullPage: true });
  await sp2.click('#reqForm button[type=submit]');
  await sp2.waitForSelector('text=You are on the list');
  const bilalReq = db.requests.find((r) => r.student_name === 'Bilal');
  check('Student can choose a preferred teacher', !!bilalReq?.preferred_teacher && bilalReq.languages[0] === 'ur');
  await adm.goto(BASE + '#/admin?tab=students');
  await adm.waitForSelector('text=Student chose this teacher');
  check('Admin sees the student\'s chosen teacher and mother-tongue match', /Speaks best: Urdu/.test(await adm.textContent('#pane')) && /Same mother tongue/.test(await adm.textContent('#pane')));
  await sp2.context().close();
  await sp.goto(BASE + '#/');
  await sp.waitForSelector('#teacherCard .list-item');
  check('Student now sees the assigned teacher on Today', /Maryam Khan/.test(await sp.textContent('#teacherCard')));
  await sp.goto(BASE + '#/find-teacher');
  await sp.waitForSelector('.teacher-card');
  check('Student sees the teacher profile card (experience, languages)', /12 years teaching/.test(await sp.textContent('.teacher-card')));
  const nonAdmin = sp;
  await nonAdmin.goto(BASE + '#/admin');
  await nonAdmin.waitForSelector('text=This page is for academy admins.');
  check('A non-admin cannot open the admin panel', true);
  await ap.goto(BASE + '#/');
  await ap.waitForSelector('text=Aisha', { timeout: 8000 }).catch(() => {});
  check('The teacher sees the assigned student on Home', /Aisha/.test(await ap.textContent('#view')));
  // ---------- Admins: only listed Google accounts; only owners manage the list ----------
  await adm.goto(BASE + '#/admin?tab=admins');
  await adm.waitForSelector('#addAdmin');
  check('Owner sees the Admins tab with the add form', /Owner/.test(await adm.textContent('#pane')));
  await adm.fill('#adEmail', 'Helper@Gmail.com');
  await adm.click('#addAdmin button[type=submit]');
  await adm.waitForSelector('[data-admin="helper@gmail.com"]');
  check('Owner adds a new admin by Google email', admins.some((x) => x.email === 'helper@gmail.com' && x.role === 'admin' && x.active));
  const hp = await newPage({ width: 390, height: 844 }, { email: 'helper@gmail.com', name: 'Helper' });
  await hp.goto(BASE);
  await hp.click('#google');
  await hp.waitForSelector('#roleForm');
  await hp.click('#roleForm button[type=submit]');
  await hp.waitForSelector('#planForm');
  await hp.click('#planForm button[type=submit]');
  await hp.goto(BASE + '#/admin?tab=admins');
  await hp.waitForSelector('.admin-tabs');
  check('The added admin can open the panel', true);
  check('An admin (not owner) cannot change the admin list', (await hp.locator('#addAdmin, [data-admin-off]').count()) === 0);
  await adm.goto(BASE + '#/admin?tab=admins');
  await adm.waitForSelector('[data-admin="helper@gmail.com"] [data-admin-off]');
  adm.once('dialog', (d) => d.accept());
  await adm.click('[data-admin="helper@gmail.com"] [data-admin-off]');
  await adm.waitForSelector('[data-admin="helper@gmail.com"] [data-admin-on]');
  await hp.goto(BASE + '#/');
  await hp.goto(BASE + '#/admin');
  await hp.waitForSelector('text=This page is for academy admins.');
  check('Removing access locks the admin out at once', true);
  adm.once('dialog', (d) => d.accept());
  await adm.click('[data-admin="admin@gmail.com"] [data-admin-off]');
  await adm.waitForTimeout(600);
  check('The last owner cannot be removed', admins.some((x) => x.email === 'admin@gmail.com' && x.active && x.role === 'owner'));
  await hp.context().close();

  // ---------- Test phase: the owner opens teaching before approval, then locks it again ----------
  await adm.goto(BASE + '#/admin');
  await adm.waitForSelector('#togglePhase');
  await adm.click('#togglePhase');
  await adm.waitForSelector('text=Test phase: teaching is open');
  check('Owner opens teaching for the test phase', settings.open_teaching === true);
  const zp = await newPage({ width: 390, height: 844 }, { email: 'zaid.teacher@gmail.com', name: 'Zaid' });
  await zp.goto(BASE); await zp.click('#google'); await zp.waitForSelector('#roleForm');
  await zp.click('#roleForm label:has(input[value="teacher"])'); await zp.click('#roleForm button[type=submit]');
  await zp.waitForSelector('#appForm');
  await zp.goto(BASE + '#/');
  await zp.waitForSelector('text=Your class code');
  check('In the test phase an unapproved teacher can teach', (await zp.locator('.locked-note').count()) === 0);
  adm.once('dialog', (d) => d.accept());
  await adm.click('#togglePhase');
  await adm.waitForSelector('text=Teaching is locked to approved teachers');
  await zp.goto(BASE + '#/mushaf'); await zp.goto(BASE + '#/');
  await zp.waitForSelector('.locked-note');
  check('Locking again closes teaching for unapproved teachers', settings.open_teaching === false);
  await zp.context().close();
  await Promise.all([ap.context().close(), sp.context().close(), adm.context().close()]);
} catch (e) {
  check('Run finished without exceptions', false, String(e).split('\n').slice(0, 4).join(' | '));
} finally {
  await browser.close();
  server.close();
}

const realErrors = errors.filter((e) => !/favicon|Failed to load resource|net::ERR/.test(e));
check('No JavaScript errors in the console', realErrors.length === 0, realErrors.slice(0, 4).join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
