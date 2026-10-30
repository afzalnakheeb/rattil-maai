// Report numbers. Run in a zone with a clock change: TZ=America/New_York node tests/report.test.mjs
import { buildReport, period, liveStreak, sessionMistakes } from '../js/report.js';

let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`); };
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

// Week across the March 2026 clock change in New York (Sun 8 Mar).
const now = new Date(2026, 2, 10, 15);
const P = period('week', 0, now);
check('Week is 4–10 Mar with 7 calendar days', P.keys[0] === '2026-03-04' && P.keys[6] === '2026-03-10' && P.keys.includes('2026-03-08'), P.keys.join(' '));
const R = buildReport({ sessions: [{ id: 'a', kind: 'practice', created: at(2026, 3, 8, 9), duration: 600000, marks: [] }], state: {}, kind: 'week', now });
check('A practice on the clock-change day counts as an active day', R.activeDays === 1 && R.perDay['2026-03-08'].minutes === 10, `${R.activeDays}`);
const prevP = period('week', 1, now);
check('Previous week ends where this week starts', prevP.keys[6] === '2026-03-03' && prevP.keys[0] === '2026-02-25', prevP.keys.join(' '));
const M = period('month', 0, new Date(2026, 10, 2, 9));
check('A month that crosses the November clock change has 30 distinct days', new Set(M.keys).size === 30 && M.keys[29] === '2026-11-02', `${M.keys[0]}..${M.keys[29]}`);

// Mistakes after a teacher review
const ai = { type: 'wrong', word: 'ٱلصَّمَدُ', surah: 112, ayah: 2, status: 'final', source: 'ai' };
check('Without a review, AI marks count', sessionMistakes({ marks: [ai] }).length === 1);
check('A review that dismissed every AI mark leaves no mistakes', sessionMistakes({ marks: [ai], review: { marks: [{ ...ai, status: 'dismissed' }] } }).length === 0);
check('A review with no marks at all also means no mistakes', sessionMistakes({ marks: [ai], review: { marks: [] } }).length === 0);
check('Teacher marks in a review count', sessionMistakes({ marks: [ai], review: { marks: [{ ...ai, status: 'confirmed' }, { type: 'teacher', source: 'teacher', status: 'final', word: 'x', surah: 1, ayah: 1 }] } }).length === 2);

// Streak
const today = new Date(2026, 9, 9, 10);
check('Streak shows when the last practice was today', liveStreak({ last: '2026-10-09', count: 3 }, today) === 3);
check('Streak shows when the last practice was yesterday', liveStreak({ last: '2026-10-08', count: 3 }, today) === 3);
check('Streak resets after a missed day', liveStreak({ last: '2026-10-03', count: 3 }, today) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
