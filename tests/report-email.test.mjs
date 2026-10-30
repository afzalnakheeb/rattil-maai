// Checks the parent report email (supabase/functions/reports) without Deno or the network.
// Run: TZ=UTC node --experimental-strip-types --no-warnings tests/report-email.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
execSync('sh tools/build-report-fn.sh', { cwd: root, stdio: 'ignore' });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rwm-fn-'));
fs.cpSync(path.join(root, 'supabase/functions/reports'), dir, { recursive: true });
const src = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');
fs.writeFileSync(path.join(dir, 'index.mts'), "(globalThis as any).Deno={env:{get:(k: string)=>({SUPABASE_URL:'https://x.supabase.co'} as any)[k]}, serve:()=>{}};\n" + src + '\nexport { reportEmail, confirmEmail, due, local };\n');
const { reportEmail, confirmEmail, due, local } = await import(path.join(dir, 'index.mts'));

let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`); };
const at = new Date('2026-11-01T05:30:00Z'); // Sunday 9:30 in Dubai
const day = 864e5;
const sessions = [
  { id: 'a', kind: 'practice', created: at - 2 * day, duration: 300000, aiScore: 88, title: 'Al-Ikhlaas 1–4 · Page 604', marks: [{ type: 'wrong', word: 'يَلِدْ', surah: 112, ayah: 3, status: 'final', source: 'ai' }], review: null },
  { id: 'b', kind: 'online', created: at - 3 * day, duration: 600000, title: 'An-Naas 1–6 · Page 604', grade: { total: 92 }, decision: 'pass', comment: 'Mashallah, <b>great</b>', teacher: 'Ustadh Ahmed', ownerId: 't', teacherId: 't', marks: [] },
  { id: 'c', kind: 'practice', created: at - 20 * day, duration: 60000, aiScore: 50, title: 'old', marks: [] },
];
const realNow = Date.now; Date.now = () => at.getTime();
const RealDate = Date;
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [at.getTime()])); } static now() { return at.getTime(); } };
const e = reportEmail('week', 'Yusuf Ali', 'Mum', { sessions, state: { plan: { level: 'one', track: 'amma', units: 6 }, daily: {}, streak: { count: 3 } } }, 'Asia/Dubai', 'https://x/stop');
check('Weekly report covers the 7 days before Sunday', /25 Oct – 31 Oct 2026/.test(e.text), e.text.split('\n')[0]);
check('Counts only this week (2 recitations, not the old one)', /recited 2 times/.test(e.text));
check('Teacher grade and words to revise appear', /92/.test(e.html) && /يَلِدْ/.test(e.html) && /Al-Ikhlaas 112:3/.test(e.html));
check('Teacher comments are escaped', e.html.includes('&lt;b&gt;great&lt;/b&gt;'));
check('Every report email has a stop link', e.html.includes('https://x/stop') && e.text.includes('https://x/stop'));
check('Subject is short and specific', /^Yusuf's Quran week: \d\/7 days/.test(e.subject), e.subject);
const c = confirmEmail({ student_name: 'Yusuf Ali', name: 'Mum' }, 'tok');
check('Confirmation email asks before sending anything', /ignore this email/.test(c.text) && c.html.includes('?confirm=tok'));
check('Dubai local time is used', local('Asia/Dubai', at).h === 9 && local('Asia/Dubai', at).weekday === 'Sun');
check('Due on Sunday after 8:00 local, weekly and monthly on the 1st', due({ weekly: true, monthly: true, tz: 'Asia/Dubai' }, at).join() === 'week,month');
check('Not due before 8:00', due({ weekly: true, monthly: true, tz: 'Asia/Dubai' }, new RealDate('2026-11-01T03:30:00Z')).length === 0);
check('Not sent twice the same week', due({ weekly: true, tz: 'Asia/Dubai', last_weekly_at: '2026-11-01T05:00:00Z' }, new RealDate('2026-11-01T07:30:00Z')).length === 0);
check('Other time zones: London Sunday 8:30', due({ weekly: true, tz: 'Europe/London' }, new RealDate('2026-11-01T08:30:00Z')).join() === 'week');
check('Kuala Lumpur gets it on its own Sunday morning', due({ weekly: true, tz: 'Asia/Kuala_Lumpur' }, new RealDate('2026-11-01T00:30:00Z')).join() === 'week');
Date.now = realNow; globalThis.Date = RealDate;
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
