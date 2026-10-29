// Data from another user (cloud rows, the other side of a call) is untrusted.
// Everything is coerced to the shape the app expects before any view sees it,
// so a crafted row can never inject markup or break the page.

export const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const int = (v, d = 0, min = -Infinity, max = Infinity) => { const n = Math.trunc(num(v, d)); return Math.min(max, Math.max(min, n)); };
export const str = (v, max = 2000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
export const id = (v) => str(v, 64).replace(/[^\w-]/g, '');
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

export const MARK_TYPES = ['wrong', 'skipped', 'extra', 'peek', 'teacher'];
const MARK_STATUS = ['suggested', 'final', 'confirmed', 'dismissed'];
const SOURCES = ['ai', 'teacher'];
const KINDS = ['practice', 'teacher', 'online'];
const DECISIONS = ['pass', 'repeat', ''];
const MAX_MARKS = 600;

export function cleanMark(m) {
  if (!m || typeof m !== 'object') return null;
  return {
    id: id(m.id) || `m${Math.random().toString(36).slice(2, 8)}`,
    index: int(m.index, 0, 0, 100000),
    type: oneOf(m.type, MARK_TYPES, 'wrong'),
    heard: str(m.heard, 120),
    word: str(m.word, 80),
    surah: int(m.surah, 1, 1, 114),
    ayah: int(m.ayah, 1, 1, 286),
    source: oneOf(m.source, SOURCES, 'ai'),
    status: oneOf(m.status, MARK_STATUS, 'final'),
    t: Math.max(0, num(m.t)),
  };
}

export const cleanMarks = (list) => (Array.isArray(list) ? list.slice(0, MAX_MARKS).map(cleanMark).filter(Boolean) : []);

export function cleanGrade(g) {
  if (!g || typeof g !== 'object') return null;
  const out = { hifz: int(g.hifz, 0, 0, 40), tajweed: int(g.tajweed, 0, 0, 30), makharij: int(g.makharij, 0, 0, 20), waqf: int(g.waqf, 0, 0, 10) };
  out.total = Number.isFinite(Number(g.total)) ? int(g.total, 0, 0, 100) : out.hifz + out.tajweed + out.makharij + out.waqf;
  return out;
}

export function cleanPortions(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).filter((p) => p && typeof p === 'object')
    .map((p) => ({ page: int(p.page, 1, 1, 604), part: oneOf(p.part, ['all', '1/2', '2/2'], 'all') }));
}

// A session as read from the cloud. `trustGrade` is false when the row's owner
// is not the teacher who graded it (a student cannot write a teacher's grade).
export function cleanSession(s) {
  const kind = oneOf(s.kind, KINDS, 'practice');
  const ownerIsTeacher = !!s.ownerId && s.ownerId === s.teacherId && kind !== 'practice';
  const review = s.review ? {
    grade: cleanGrade(s.review.grade),
    decision: oneOf(s.review.decision, DECISIONS, ''),
    comment: str(s.review.comment, 4000),
    marks: cleanMarks(s.review.marks),
    teacherId: id(s.review.teacherId),
    teacher: str(s.review.teacher, 120),
    updated: num(s.review.updated),
  } : null;
  return {
    ...s,
    id: id(s.id),
    kind,
    title: str(s.title, 200),
    student: str(s.student, 120),
    teacher: str(s.teacher, 120),
    created: num(s.created, Date.now()),
    duration: Math.max(0, num(s.duration)),
    aiScore: s.aiScore == null ? null : int(s.aiScore, 0, 0, 100),
    marks: cleanMarks(s.marks),
    portions: cleanPortions(s.portions),
    planItem: str(s.planItem, 40),
    words: int(s.words, 0, 0, 100000),
    grade: ownerIsTeacher ? cleanGrade(s.grade) : null,
    decision: ownerIsTeacher ? oneOf(s.decision, DECISIONS, '') : '',
    comment: ownerIsTeacher ? str(s.comment, 4000) : '',
    review,
  };
}

export function cleanCall(c) {
  if (!c || typeof c !== 'object') return c;
  return { ...c, id: id(c.id), status: oneOf(c.status, ['ringing', 'active', 'ended', 'missed', 'declined'], 'ended'), portions: cleanPortions(c.portions) };
}

// Only Google profile photos over https are shown (no arbitrary tracking URLs).
export function cleanAvatar(u) {
  const s = str(u, 600);
  try { const x = new URL(s); return x.protocol === 'https:' && /(^|\.)googleusercontent\.com$/.test(x.hostname) ? x.href : ''; } catch { return ''; }
}

export function cleanPerson(p) {
  if (!p || typeof p !== 'object') return p;
  return { ...p, id: id(p.id), name: str(p.name, 120), email: str(p.email, 200), avatar_url: cleanAvatar(p.avatar_url) };
}

// Another user's synced progress (a teacher reading a student's plan).
export function cleanState(d) {
  if (!d || typeof d !== 'object') return null;
  const out = { ...d };
  if (d.plan && typeof d.plan === 'object') {
    out.plan = { ...d.plan, units: int(d.plan.units, 0, 0, 1208), track: oneOf(d.plan.track, ['amma', 'fatiha'], 'amma'), level: oneOf(d.plan.level, ['half', 'one', 'two'], 'one') };
  } else delete out.plan;
  out.streak = { ...(d.streak || {}), count: int(d.streak?.count, 0, 0, 100000) };
  const daily = {};
  Object.entries(d.daily && typeof d.daily === 'object' ? d.daily : {}).slice(-400).forEach(([k, v]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object') daily[k] = { sabaq: !!v.sabaq, sabqi: !!v.sabqi, manzil: !!v.manzil };
  });
  out.daily = daily;
  const adhkar = {};
  Object.entries(d.adhkar && typeof d.adhkar === 'object' ? d.adhkar : {}).slice(-2000).forEach(([k, v]) => {
    if (v && typeof v === 'object') adhkar[str(k, 40)] = Object.fromEntries(Object.entries(v).slice(0, 60).map(([a, b]) => [str(a, 40), int(b, 0, 0, 100000)]));
  });
  out.adhkar = adhkar;
  return out;
}
