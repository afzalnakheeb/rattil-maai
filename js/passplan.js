// When a teacher passes a portion that is in the student's plan for today, tick it and open the
// next lesson. Runs on the student's device: live after a video session, and on Today for passes
// given while the student was away (in-person sessions, reviews, a call they had already left).

import * as store from './store.js';
import * as plan from './plan.js';
import { toast, todayKey } from './ui.js';

const key = (list) => list.map((p) => `${p.page}:${p.part}`).sort().join(',');

export function passPlan(portions, { quiet = false } = {}) {
  const st = store.get();
  if (!st.plan || !Array.isArray(portions) || !portions.length) return false;
  const t = plan.today(st.plan);
  const item = ['sabaq', 'sabqi', 'manzil'].find((k) => (t[k] || []).length && key(t[k]) === key(portions));
  if (!item) return false;
  const day = todayKey();
  let changed = false;
  store.update((x) => {
    x.daily[day] = x.daily[day] || {};
    if (x.daily[day][item]) return;
    x.daily[day][item] = true;
    if (item === 'sabaq') plan.completeSabaq(x.plan);
    if (item === 'manzil') plan.completeManzil(x.plan);
    changed = true;
  });
  if (!changed) return false;
  store.touchStreak(day);
  if (!quiet) toast(item === 'sabaq' ? 'Passed. Your next lesson is open.' : 'Passed and ticked in today\'s plan.');
  return true;
}

const decisionOf = (s) => (s.review?.decision || (s.kind !== 'practice' ? s.decision : '') || '');

// Passes from the last 3 days that this device has not applied yet.
export function applyTeacherPasses(sessions) {
  const since = Date.now() - 3 * 864e5;
  const done = new Set(store.get().meta.passes || []);
  let opened = false;
  sessions.filter((s) => s.created >= since && decisionOf(s) === 'pass' && !done.has(s.id))
    .sort((a, b) => a.created - b.created)
    .forEach((s) => {
      if (passPlan(s.portions, { quiet: true })) opened = true;
      done.add(s.id);
    });
  store.update((x) => { x.meta.passes = [...done].slice(-200); }, { silent: true });
  if (opened) toast('Your teacher passed your lesson. The next one is open.');
  return opened;
}
