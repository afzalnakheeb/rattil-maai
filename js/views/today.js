import * as store from '../store.js';
import { liveStreak } from '../report.js';
import * as plan from '../plan.js';
import { describePortions } from '../quran.js';
import { esc, todayKey, onLeave, fmtPages } from '../ui.js';
import { icons } from '../icons.js';
import { SETS, ADHKAR } from '../adhkar.js';
import * as cloud from '../cloud.js';
import { isCloud } from '../account.js';
import { computeTimes, nextPrayer, tzOffsetHours, optionsFrom } from '../prayer.js';
import { avatar } from './teacher.js';
import { planLabelHtml } from '../terms.js';
import { isStandalone, openInstallSheet } from '../fullscreen.js';

function nextPrayerLine(settings) {
  const p = settings.prayer;
  if (!p || typeof p.lat !== 'number') return '';
  try {
    const now = new Date();
    const tz = p.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const opts = optionsFrom(p);
    const t = computeTimes(now, p.lat, p.lng, tzOffsetHours(tz, now), opts);
    const tm = new Date(now.getTime() + 864e5);
    const t2 = computeTimes(tm, p.lat, p.lng, tzOffsetHours(tz, tm), opts);
    const n = nextPrayer(t, now, t2);
    if (!n) return '';
    const mins = Math.max(0, Math.round(n.ms / 60000));
    const left = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
    return `${n.en} at ${n.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz })} · in ${left}`;
  } catch { return ''; }
}

const ITEMS = [
  { key: 'sabaq', icon: 'book', tile: 'solid' },
  { key: 'sabqi', icon: 'check', tile: '' },
  { key: 'manzil', icon: 'repeat', tile: 'gold' },
];

// Rough time for a part, from how many pages it has: learning a page takes far longer than revising one.
export function minutesFor(key, portions) {
  const pages = portions.reduce((n, p) => n + (p.part === 'all' ? 1 : 0.5), 0);
  const raw = key === 'sabaq' ? Math.max(10, pages * 20) : Math.max(5, pages * 3);
  return Math.ceil(raw / 5) * 5;
}

export default function todayView(root) {
  const s = store.get();
  if (!s.plan) {
    // First set the plan: no tab bar to wander off before there is one.
    const bar = document.getElementById('tabbar');
    if (bar) { bar.hidden = true; onLeave(root, () => { if (store.get().profile?.role) bar.hidden = false; }); }
    return setupPlan(root);
  }

  const t = plan.today(s.plan);
  const day = todayKey();
  const done = s.daily[day] || {};
  const adhkarDone = SETS.filter((set) => {
    const c = s.adhkar[`${day}:${set.id}`] || {};
    return ADHKAR[set.id].every((d) => (c[d.id] || 0) >= d.count);
  }).map((set) => set.label.toLowerCase());
  const items = ITEMS.filter((it) => t[it.key].length);
  const doneCount = items.filter((it) => done[it.key]).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const greet = new Date().getHours() < 12 ? 'Sabah al-khayr' : 'As-salamu alaykum';
  const days = plan.projectedDays(s.plan);
  const finish = new Date(Date.now() + days * 864e5).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const streakNow = liveStreak(s.streak);
  const best = Math.max(s.streak?.best || 0, streakNow);
  const allDone = items.length > 0 && doneCount === items.length;
  // Until the first new lesson is done, show the two steps: listen first, then recite.
  const firstLesson = !Object.values(s.daily || {}).some((d) => d && d.sabaq);
  // After the first day, 'get a teacher' moves below the plan so today's task comes first.
  const newcomer = Object.keys(s.daily || {}).length === 0;

  root.innerHTML = `
    <div class="stack">
      <section class="hero">
        <div class="eyebrow">${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 style="margin-top:4px">${esc(greet)}, ${esc((s.profile?.name || '').split(' ')[0])}</h1>
        <a class="small hero-link" href="#/prayer">${icons.moon}<span>${esc(nextPrayerLine(s.settings) || 'Set your city for prayer times')}</span></a>
        <div class="hero-stats">
          <div><b>${streakNow}</b><span>${streakNow === 0 && best > 1 ? `Day streak · best ${best}` : 'Day streak'}</span></div>
          <div><b>${fmtPages(t.memorizedCount)}</b><span>${t.memorizedCount === 1 ? 'Page memorized' : 'Pages memorized'}</span></div>
          <div><b>${esc(plan.level(s.plan).short)}</b><span>Each day</span></div>
        </div>
      </section>
      <div id="liveNow"></div>
      ${newcomer ? '<div id="nextStep"></div>' : ''}
      <div id="feedback"></div>
      ${streakNow === 0 && best > 1 && !allDone ? `<div class="notice">Your best run is ${best} days. Start again today: even a small portion counts. The most beloved deeds are the most consistent, even if small.</div>` : ''}
      ${t.complete ? `<div class="card gold stack-s"><h2>You have completed the whole Quran. Allahumma barik.</h2><p class="small">Keep your older revision every day so it stays strong.</p></div>` : ''}
      <div class="card stack">
        <div class="spread"><h2>Today's plan</h2><span class="small muted">${doneCount} of ${items.length} done</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
        ${allDone ? `<div class="notice green"><b>Today's plan is complete. Allahumma barik.</b><br>See you tomorrow, in sha Allah. Keep your adhkar for the day.</div>` : ''}
        ${allDone && !s.meta?.installAsked && !isStandalone() ? `<div class="card row" id="installAsk" style="box-shadow:none;border:1px solid var(--line-2)"><div class="grow"><h3>Keep it on your home screen</h3><div class="xs muted">Open Recite With Me like an app, one tap every day.</div></div><button class="btn sm" type="button" id="installYes">Add</button><button class="btn ghost sm" type="button" id="installNo">Not now</button></div>` : ''}
        <div>
          ${items.map((it) => {
            const d = !!done[it.key];
            return `<div class="list-item${!d && it.key === 'sabaq' ? ' wrap-actions' : ''}">
              <div class="icon-tile ${d ? '' : it.tile}">${d ? icons.check : icons[it.icon]}</div>
              <div class="grow">
                <h3 style="${d ? 'color:var(--ink-2)' : ''}">${planLabelHtml(it.key)}</h3>
                <div class="small muted">${esc(describePortions(t[it.key]))}${d ? ' · done' : ` · about ${minutesFor(it.key, t[it.key])} min`}</div>
                ${!d && it.key === 'sabaq' && firstLesson ? '<div class="xs muted" style="margin-top:4px">1. Listen and read along 5 times · 2. Recite from memory</div>' : ''}
              </div>
              ${d ? `<span class="small" style="color:var(--green);font-weight:600">Done</span>`
                : `<div class="row" style="gap:6px">
                    ${it.key === 'sabaq'
                      ? `<a class="btn outline sm" href="#/mushaf?page=${t[it.key][0].page}&part=${t[it.key][0].part}&loops=5" aria-label="Listen to the new lesson 5 times">${icons.play} Listen</a>`
                      : `<a class="icon-btn" href="#/mushaf?page=${t[it.key][0].page}&part=${t[it.key][0].part}&loops=1" aria-label="Listen to this part">${icons.play}</a>`}
                    <a class="btn sm" href="#/recite?plan=${it.key}">Recite</a>
                  </div>`}
            </div>`;
          }).join('')}
          <div class="list-item">
            <div class="icon-tile gold">${icons.sun}</div>
            <div class="grow"><h3>Daily adhkar</h3><div class="small muted">${adhkarDone.length ? `Completed today: ${esc(adhkarDone.join(', '))}` : 'Morning, evening, after prayer and sleep'}</div></div>
            <a class="btn outline sm" href="#/adhkar">Open</a>
          </div>
          <div class="list-item">
            <div class="icon-tile gold">${icons.hands}</div>
            <div class="grow"><h3>Duas and Ruqyah</h3><div class="small muted">Short and full Ruqyah, duas for every moment</div></div>
            <a class="btn outline sm" href="#/duas">Open</a>
          </div>
        </div>
        <p class="xs muted">Recite each part with the AI and reach 90% to tick it off. The new lesson moves forward once it is done.</p>
      </div>
      ${newcomer ? '' : '<div id="nextStep"></div>'}
      <div class="card gold stack-s">
        <div class="spread"><div class="eyebrow" style="color:var(--gold-ink)">Your path</div><span style="color:var(--gold)">${icons.star.replace('<svg', '<svg width="18" height="18"')}</span></div>
        <p>${t.complete ? 'Hifz complete.' : `At this pace you complete the Quran around <b>${esc(finish)}</b>, in sha Allah.`}</p>
        <p class="small muted">Track: ${esc(plan.TRACKS.find((x) => x.id === s.plan.track)?.label || '')}. Change it in Settings.</p>
      </div>
      <a class="card row" href="#/report" style="text-decoration:none;color:inherit">
        <div class="icon-tile gold">${icons.grid}</div>
        <div class="grow"><h3>Report for parents</h3><div class="small muted">This week’s progress, mistakes and teacher feedback, ready to share</div></div>
        <span class="muted" aria-hidden="true">${icons.next.replace('<svg', '<svg width="18" height="18"')}</span>
      </a>
      <div class="card stack-s" id="teacherCard">
        <h2>My teacher</h2>
        ${isCloud() ? '<div class="spinner"></div>' : `<p class="small muted">Sign in with Google to join your teacher's class. Your teacher can then review your practice and call you for video sessions.</p><div><a class="btn sm" href="#/signin">Sign in with Google</a></div>`}
      </div>
    </div>`;
  const askedInstall = () => store.update((x) => { x.meta = { ...(x.meta || {}), installAsked: Date.now() }; }, { silent: true });
  root.querySelector('#installYes')?.addEventListener('click', () => { askedInstall(); root.querySelector('#installAsk')?.remove(); openInstallSheet(); });
  root.querySelector('#installNo')?.addEventListener('click', () => { askedInstall(); root.querySelector('#installAsk')?.remove(); });
  if (isCloud()) fillTeacher(root);
}

async function fillTeacher(root) {
  let teachers = [];
  let calls = [];
  let req = null;
  try { [teachers, calls] = await Promise.all([cloud.myTeachers(), cloud.openCalls()]); } catch { /* offline */ }
  if (!teachers.length) { try { req = await cloud.myTeacherRequest(); } catch { /* table not ready or offline */ } }
  else {
    // A teacher may have passed a lesson while this student was away: open the next one.
    try {
      const { applyTeacherPasses } = await import('../passplan.js');
      const records = await import('../records.js');
      const list = await records.list();
      if (applyTeacherPasses(list) && root.isConnected) { todayView(root); return; }
      showFeedback(root, list);
    } catch { /* offline */ }
  }
  const card = root.querySelector('#teacherCard');
  if (!card) return;
  const me = cloud.user()?.id;
  const live = calls.find((c) => c.student_id === me && c.status !== 'ended');
  const liveBox = root.querySelector('#liveNow');
  if (live && liveBox) {
    liveBox.innerHTML = `<div class="card row" style="border:1.5px solid var(--gold)">${avatar(live.teacher || {}, 46)}<div class="grow"><h3>${esc(live.teacher?.name || 'Your teacher')} is waiting</h3><div class="xs muted">Video session · page ${(live.portions || []).map((p) => Number(p.page) || 1).join(', ')}</div></div><a class="btn sm" href="#/call/${encodeURIComponent(live.id)}">${icons.video} Join</a></div>`;
  }
  const next = root.querySelector('#nextStep');
  if (next && !teachers.length && !(req && req.status === 'waiting')) {
    next.innerHTML = `<a class="card row" href="#/find-teacher" style="text-decoration:none;color:inherit;border:1.5px solid var(--gold)">
      <div class="icon-tile gold">${icons.users}</div>
      <div class="grow"><h3>Next step: get your teacher</h3><div class="small muted">Tell us your language and we match you with a verified Quran teacher.</div></div>
      <span class="btn sm">Find a teacher</span></a>`;
  }
  const canAlert = teachers.length && 'Notification' in window && Notification.permission === 'default';
  card.innerHTML = `<h2>My teacher</h2>${teachers.length
    ? teachers.map((t) => `<div class="list-item">${avatar(t)}<div class="grow"><h3>${esc(t.name)}</h3><div class="xs muted">Sees your plan and recordings · calls you for video sessions</div></div></div>`).join('')
      + (canAlert ? '<button class="btn outline sm" id="callAlerts" type="button" style="align-self:flex-start">Alert me when my teacher calls</button>' : '')
    : `${req && req.status === 'waiting'
        ? '<div class="notice green">You asked the academy for a teacher. As soon as a teacher who speaks your language is free, they will appear here. Lessons are video calls inside this app: keep it open at lesson time.</div><a class="btn sm outline" href="#/find-teacher" style="align-self:flex-start">See or change my request</a>'
        : '<p class="small muted">No teacher yet? The academy matches you with a verified teacher who speaks your language.</p><a class="btn sm" href="#/find-teacher" style="align-self:flex-start">Find me a teacher</a>'}
       <p class="xs muted" style="margin-top:6px">Already have a teacher? Enter their class code.</p>
       <form class="row" id="joinT"><label class="sr-only" for="tcode">Class code</label><input class="input grow code" id="tcode" maxlength="6" placeholder="CODE" autocomplete="off" required><button class="btn sm" type="submit">Join</button></form>`}`;
  card.querySelector('#callAlerts')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await Notification.requestPermission(); } catch { /* ignore */ }
    b.remove();
  });
  card.querySelector('#joinT')?.addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/join/${card.querySelector('#tcode').value.trim().toUpperCase()}`; });
}

// The latest grade or comment from the teacher that the student has not seen yet.
function showFeedback(root, list) {
  const box = root.querySelector('#feedback');
  if (!box) return;
  const seen = store.get().meta?.feedbackSeen || 0;
  const since = Date.now() - 21 * 864e5;
  const item = list.map((h) => {
    const g = h.review?.grade || (h.kind !== 'practice' ? h.grade : null);
    if (!g) return null;
    const at = h.review?.updated || h.created || 0;
    return { h, g, at, decision: h.review?.decision || h.decision || '', comment: h.review?.comment || h.comment || '', teacher: h.review?.teacher || h.teacher || 'Your teacher' };
  }).filter((x) => x && x.at > seen && x.at > since).sort((a, b) => b.at - a.at)[0];
  if (!item) return;
  const total = Number(item.g.total) || 0;
  box.innerHTML = `<div class="card stack-s" style="border:1.5px solid var(--gold)">
    <div class="spread"><div class="eyebrow">Feedback from ${esc(item.teacher)}</div><span class="chip ${item.decision === 'repeat' ? 'red' : ''}">${total}/100${item.decision ? ` · ${item.decision === 'pass' ? 'Pass' : 'Repeat'}` : ''}</span></div>
    <div class="small muted">${esc((item.h.title || '').split(' · ')[0])}</div>
    ${item.comment ? `<p>“${esc(item.comment)}”</p>` : ''}
    <div class="row-wrap"><a class="btn sm" id="fbOpen" href="#/history/${encodeURIComponent(item.h.id)}">See marks and listen</a><button class="btn ghost sm" id="fbDone" type="button">Got it</button></div>
  </div>`;
  const mark = () => store.update((x) => { x.meta = { ...(x.meta || {}), feedbackSeen: item.at }; }, { silent: true });
  box.querySelector('#fbOpen').addEventListener('click', mark);
  box.querySelector('#fbDone').addEventListener('click', () => { mark(); box.innerHTML = ''; });
}

export function setupPlan(root, { onDone } = {}) {
  root.innerHTML = `
    <form class="stack" id="planForm">
      <div class="page-head"><h1>Set your daily target</h1><p class="small muted">You can change this later. Your teacher can adjust it too.</p></div>
      <fieldset class="card stack-s" style="border:0;margin:0">
        <legend class="label" style="padding:0;margin-bottom:8px">How much new memorization each day?</legend>
        ${plan.LEVELS.map((l, i) => `<label class="choice"><input type="radio" name="level" value="${l.id}" ${i === 0 ? 'checked' : ''}><span><b>${esc(l.label)}</b><br><span class="small muted">${esc(l.note)}</span></span></label>`).join('')}
      </fieldset>
      <fieldset class="card stack-s" style="border:0;margin:0">
        <legend class="label" style="padding:0;margin-bottom:8px">Where do you start?</legend>
        ${plan.TRACKS.map((tr, i) => `<label class="choice"><input type="radio" name="track" value="${tr.id}" ${i === 0 ? 'checked' : ''}><span><b>${esc(tr.label)}</b><br><span class="small muted">${esc(tr.note)}</span></span></label>`).join('')}
      </fieldset>
      <div class="card stack-s">
        <label class="label" for="already">Pages already memorized on this track</label>
        <input class="input" id="already" type="number" min="0" max="604" value="0" inputmode="numeric">
        <p class="xs muted">These count as memorized and go into your recent and older revision.</p>
      </div>
      <button class="btn block" type="submit">Start my plan</button>
    </form>`;
  root.querySelector('#planForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const already = Math.max(0, Math.min(604, parseInt(root.querySelector('#already').value, 10) || 0));
    store.update((st) => {
      st.plan = { level: f.get('level'), track: f.get('track'), units: already * 2, manzilCursor: 0, created: Date.now() };
    });
    const bar = document.getElementById('tabbar');
    if (bar && !onDone) bar.hidden = false;
    if (onDone) onDone(); else location.hash = '#/';
    todayView(root);
    window.scrollTo(0, 0);
  });
}
