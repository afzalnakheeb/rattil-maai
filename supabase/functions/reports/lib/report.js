// Parent report: pure calculation over sessions and synced progress (no DOM).
// A period is [from, to) in local time; "week" = 7 days, "month" = 30 days, ending today.

import { ADHKAR, SETS } from './adhkar.js';
import { LEVELS } from './plan.js';

const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// offset 0 = the period ending today; 1 = the one before, and so on.
// Days are calendar days (new Date(y, m, d + n)), so weeks that cross a clock change stay correct.
export function period(kind = 'week', offset = 0, now = new Date()) {
  const days = kind === 'month' ? 30 : 7;
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const endDay = d + 1 - offset * days;
  const end = new Date(y, m, endDay);
  const from = new Date(y, m, endDay - days);
  const list = Array.from({ length: days }, (_, i) => new Date(y, m, endDay - days + i));
  return { kind, days, from, to: end, list, keys: list.map(keyOf) };
}

// The streak only counts if the last practice was today or yesterday.
export function liveStreak(streak, now = new Date()) {
  if (!streak || !streak.last) return 0;
  const today = keyOf(now);
  const yesterday = keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return streak.last === today || streak.last === yesterday ? (streak.count || 0) : 0;
}

const isMistake = (m) => m && m.type !== 'peek' && m.status !== 'dismissed' && m.status !== 'suggested';

// Confirmed mistakes of a session. Once a teacher has reviewed a practice, the review is the
// verdict: AI marks the teacher dismissed are not mistakes, even when no mark is left.
export function sessionMistakes(s) {
  if (s.review && Array.isArray(s.review.marks)) return s.review.marks.filter(isMistake);
  return (s.marks || []).filter(isMistake);
}

export function buildReport({ sessions = [], state = {}, kind = 'week', offset = 0, now = new Date() }) {
  const P = period(kind, offset, now);
  const inP = (t) => t >= P.from.getTime() && t < P.to.getTime();
  const list = sessions.filter((s) => inP(s.created)).sort((a, b) => a.created - b.created);

  const byKind = { practice: 0, teacher: 0, online: 0 };
  let minutes = 0;
  const perDay = Object.fromEntries(P.keys.map((k) => [k, { minutes: 0, sessions: 0 }]));
  list.forEach((s) => {
    byKind[s.kind] = (byKind[s.kind] || 0) + 1;
    const m = Math.max(0, (s.duration || 0) / 60000);
    minutes += m;
    const k = keyOf(new Date(s.created));
    if (perDay[k]) { perDay[k].minutes += m; perDay[k].sessions += 1; }
  });

  const daily = state.daily || {};
  const plan = { sabaq: 0, sabqi: 0, manzil: 0 };
  P.keys.forEach((k) => { const d = daily[k] || {}; ['sabaq', 'sabqi', 'manzil'].forEach((x) => { if (d[x]) plan[x] += 1; }); });
  const level = LEVELS.find((l) => l.id === state.plan?.level) || LEVELS[0];
  const pagesNew = plan.sabaq * (level.units / 2);

  const activeDays = P.keys.filter((k) => perDay[k].sessions > 0 || Object.values(daily[k] || {}).some(Boolean)).length;

  // Adhkar: a set counts when every dhikr in it reached its count that day.
  const adhkarDays = {};
  SETS.forEach((set) => {
    adhkarDays[set.id] = P.keys.filter((k) => {
      const c = (state.adhkar || {})[`${k}:${set.id}`] || {};
      return ADHKAR[set.id].every((d) => (c[d.id] || 0) >= d.count);
    }).length;
  });

  // Mistakes
  const types = { wrong: 0, skipped: 0, extra: 0, teacher: 0 };
  const words = new Map();
  const surahs = new Map();
  let mistakeTotal = 0;
  list.forEach((s) => {
    sessionMistakes(s).forEach((m) => {
      mistakeTotal += 1;
      const t = m.source === 'teacher' || m.type === 'teacher' ? 'teacher' : m.type;
      types[t] = (types[t] || 0) + 1;
      const key = `${m.word}|${m.surah}:${m.ayah}`;
      const w = words.get(key) || { word: m.word, surah: m.surah, ayah: m.ayah, count: 0, types: {} };
      w.count += 1; w.types[t] = (w.types[t] || 0) + 1;
      words.set(key, w);
      if (m.surah) surahs.set(m.surah, (surahs.get(m.surah) || 0) + 1);
    });
  });
  const topWords = [...words.values()].sort((a, b) => b.count - a.count || a.surah - b.surah || a.ayah - b.ayah).slice(0, 12);
  const topSurahs = [...surahs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([surah, count]) => ({ surah, count }));

  // Accuracy and grades
  const practice = list.filter((s) => s.kind === 'practice' && Number.isFinite(s.aiScore));
  const aiAvg = practice.length ? Math.round(practice.reduce((a, s) => a + s.aiScore, 0) / practice.length) : null;
  const graded = list.map((s) => {
    // A teacher's review outranks anything stored on the student's own row.
    const rv = s.review?.grade ? s.review : null;
    const g = rv ? rv.grade : s.grade;
    if (!g) return null;
    return {
      id: s.id, created: s.created, title: s.title || '', kind: s.kind, total: Number(g.total) || 0, grade: g,
      decision: (rv ? rv.decision : s.decision) || '', comment: (rv ? rv.comment : s.comment) || '',
      teacher: (rv ? rv.teacher : s.teacher) || s.teacher || '',
    };
  }).filter(Boolean).reverse();
  const gradeAvg = graded.length ? Math.round(graded.reduce((a, g) => a + g.total, 0) / graded.length) : null;
  const passes = graded.filter((g) => g.decision === 'pass').length;
  const repeats = graded.filter((g) => g.decision === 'repeat').length;

  return {
    period: P, sessions: list, count: list.length, byKind, minutes: Math.round(minutes), anyTime: minutes > 0, perDay, activeDays,
    plan, pagesNew, pagesTotal: (state.plan?.units || 0) / 2, streak: liveStreak(state.streak),
    adhkarDays, mistakeTotal, types, topWords, topSurahs, aiAvg, graded, gradeAvg, passes, repeats,
  };
}

export function fmtMinutes(m, any = false) {
  if (m < 1) return any ? 'under 1 min' : '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
