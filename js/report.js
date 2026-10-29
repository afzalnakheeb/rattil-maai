// Parent report: pure calculation over sessions and synced progress (no DOM).
// A period is [from, to) in local time; "week" = 7 days, "month" = 30 days, ending today.

import { ADHKAR, SETS } from './adhkar.js';
import { LEVELS } from './plan.js';

const DAY = 864e5;
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// offset 0 = the period ending today; 1 = the one before, and so on.
export function period(kind = 'week', offset = 0, now = new Date()) {
  const days = kind === 'month' ? 30 : 7;
  const end = new Date(startOfDay(now).getTime() + DAY - offset * days * DAY);
  const from = new Date(end.getTime() - days * DAY);
  const list = Array.from({ length: days }, (_, i) => new Date(from.getTime() + i * DAY));
  return { kind, days, from, to: end, list, keys: list.map(keyOf) };
}

const isMistake = (m) => m && m.type !== 'peek' && m.status !== 'dismissed' && m.status !== 'suggested';

// All confirmed mistakes of a session: the session's own marks, plus a teacher review's marks if any.
function sessionMistakes(s) {
  const own = (s.marks || []).filter(isMistake);
  const rv = (s.review?.marks || []).filter(isMistake);
  if (!rv.length) return own;
  // The review replaces the AI's verdict on the same practice.
  return rv;
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
    const g = s.grade || s.review?.grade;
    if (!g) return null;
    return {
      id: s.id, created: s.created, title: s.title || '', kind: s.kind, total: g.total, grade: g,
      decision: s.decision || s.review?.decision || '', comment: s.comment || s.review?.comment || '',
      teacher: s.teacher || s.review?.teacher || '',
    };
  }).filter(Boolean).reverse();
  const gradeAvg = graded.length ? Math.round(graded.reduce((a, g) => a + g.total, 0) / graded.length) : null;
  const passes = graded.filter((g) => g.decision === 'pass').length;
  const repeats = graded.filter((g) => g.decision === 'repeat').length;

  return {
    period: P, sessions: list, count: list.length, byKind, minutes: Math.round(minutes), anyTime: minutes > 0, perDay, activeDays,
    plan, pagesNew, pagesTotal: Math.floor((state.plan?.units || 0) / 2), streak: state.streak?.count || 0,
    adhkarDays, mistakeTotal, types, topWords, topSurahs, aiAvg, graded, gradeAvg, passes, repeats,
  };
}

export function fmtMinutes(m, any = false) {
  if (m < 1) return any ? 'under 1 min' : '0 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
