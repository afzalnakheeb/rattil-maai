import * as store from '../store.js';
import * as plan from '../plan.js';
import { describePortions } from '../quran.js';
import { esc, todayKey } from '../ui.js';
import { icons } from '../icons.js';
import { SETS, ADHKAR } from '../adhkar.js';
import * as cloud from '../cloud.js';
import { isCloud } from '../account.js';
import { computeTimes, nextPrayer, tzOffsetHours, optionsFrom } from '../prayer.js';
import { avatar } from './teacher.js';

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
  { key: 'sabaq', title: 'New lesson · Sabaq', icon: 'book', tile: 'solid', minutes: 30 },
  { key: 'sabqi', title: 'Recent revision · Sabqi', icon: 'check', tile: '', minutes: 25 },
  { key: 'manzil', title: 'Old revision · Manzil', icon: 'repeat', tile: 'gold', minutes: 40 },
];

export default function todayView(root) {
  const s = store.get();
  if (!s.plan) return setupPlan(root);

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

  root.innerHTML = `
    <div class="stack">
      <section class="hero">
        <div class="eyebrow">${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 style="margin-top:4px">${esc(greet)}, ${esc((s.profile?.name || '').split(' ')[0])}</h1>
        <a class="small" href="#/prayer" style="color:var(--gold-2);text-decoration:none;display:inline-flex;gap:6px;align-items:center;margin-top:4px">${icons.moon.replace('<svg', '<svg width="15" height="15"')}<span>${esc(nextPrayerLine(s.settings) || 'Set your city for prayer times')}</span></a>
        <div class="hero-stats">
          <div><b>${s.streak.count || 0}</b><span>${s.streak.count === 1 ? 'Day streak' : 'Days streak'}</span></div>
          <div><b>${t.memorizedCount}</b><span>${t.memorizedCount === 1 ? 'Page memorized' : 'Pages memorized'}</span></div>
          <div><b>${esc(plan.level(s.plan).short)}</b><span>Each day</span></div>
        </div>
      </section>
      <div id="liveNow"></div>
      ${t.complete ? `<div class="card gold stack-s"><h2>You have completed the whole Quran. Allahumma barik.</h2><p class="small">Keep your manzil every day so it stays strong.</p></div>` : ''}
      <div class="card stack">
        <div class="spread"><h2>Today's plan</h2><span class="small muted">${doneCount} of ${items.length} done</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <div>
          ${items.map((it) => {
            const d = !!done[it.key];
            return `<div class="list-item">
              <div class="icon-tile ${d ? '' : it.tile}">${d ? icons.check : icons[it.icon]}</div>
              <div class="grow">
                <h3 style="${d ? 'color:var(--ink-2)' : ''}">${it.title}</h3>
                <div class="small muted">${esc(describePortions(t[it.key]))}${d ? ' · done' : ` · about ${it.minutes} min`}</div>
              </div>
              ${d ? `<span class="small" style="color:var(--green);font-weight:600">Done</span>`
                : `<div class="row" style="gap:6px">
                    <a class="icon-btn" href="#/mushaf?page=${t[it.key][0].page}&part=${t[it.key][0].part}&loops=${it.key === 'sabaq' ? 5 : 1}" aria-label="Listen to ${it.title}">${icons.book}</a>
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
      <div class="card gold stack-s">
        <div class="spread"><div class="eyebrow" style="color:var(--gold-ink)">Your path</div><span style="color:var(--gold)">${icons.star.replace('<svg', '<svg width="18" height="18"')}</span></div>
        <p>${t.complete ? 'Hifz complete.' : `At this pace you complete the Quran around <b>${esc(finish)}</b>, in sha Allah.`}</p>
        <p class="small muted">Track: ${esc(plan.TRACKS.find((x) => x.id === s.plan.track)?.label || '')}. Change it in Settings.</p>
      </div>
      <div class="card stack-s" id="teacherCard">
        <h2>My teacher</h2>
        ${isCloud() ? '<div class="spinner"></div>' : `<p class="small muted">Sign in with Google to join your teacher's class. Your teacher can then review your practice and call you for video sessions.</p><div><a class="btn sm" href="#/signin">Sign in with Google</a></div>`}
      </div>
    </div>`;
  if (isCloud()) fillTeacher(root);
}

async function fillTeacher(root) {
  let teachers = [];
  let calls = [];
  try { [teachers, calls] = await Promise.all([cloud.myTeachers(), cloud.openCalls()]); } catch { /* offline */ }
  const card = root.querySelector('#teacherCard');
  if (!card) return;
  const me = cloud.user()?.id;
  const live = calls.find((c) => c.student_id === me && c.status !== 'ended');
  const liveBox = root.querySelector('#liveNow');
  if (live && liveBox) {
    liveBox.innerHTML = `<div class="card row" style="border:1.5px solid var(--gold)">${avatar(live.teacher || {}, 46)}<div class="grow"><h3>${esc(live.teacher?.name || 'Your teacher')} is waiting</h3><div class="xs muted">Video session · page ${(live.portions || []).map((p) => p.page).join(', ')}</div></div><a class="btn sm" href="#/call/${live.id}">${icons.video} Join</a></div>`;
  }
  card.innerHTML = `<h2>My teacher</h2>${teachers.length
    ? teachers.map((t) => `<div class="list-item">${avatar(t)}<div class="grow"><h3>${esc(t.name)}</h3><div class="xs muted">Sees your plan and recordings · calls you for video sessions</div></div></div>`).join('')
    : `<p class="small muted">Enter your teacher's class code to join their class.</p>
       <form class="row" id="joinT"><label class="sr-only" for="tcode">Class code</label><input class="input grow code" id="tcode" maxlength="6" placeholder="CODE" autocomplete="off" required><button class="btn sm" type="submit">Join</button></form>`}`;
  card.querySelector('#joinT')?.addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/join/${card.querySelector('#tcode').value.trim().toUpperCase()}`; });
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
        <p class="xs muted">These count as memorized and go into your revision (sabqi and manzil).</p>
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
    if (onDone) onDone(); else location.hash = '#/';
    todayView(root);
    window.scrollTo(0, 0);
  });
}
