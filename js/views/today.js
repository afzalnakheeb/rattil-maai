import * as store from '../store.js';
import * as plan from '../plan.js';
import { describePortions } from '../quran.js';
import { esc, todayKey } from '../ui.js';
import { icons } from '../icons.js';
import { SETS, ADHKAR } from '../adhkar.js';

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
      <div class="page-head">
        <div class="small muted">${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>${esc(greet)}, ${esc(s.profile?.name || '')}</h1>
      </div>
      <div class="stats">
        <div class="stat"><b>${s.streak.count || 0} ${s.streak.count === 1 ? 'day' : 'days'}</b><span>Streak</span></div>
        <div class="stat"><b>${t.memorizedCount} ${t.memorizedCount === 1 ? 'page' : 'pages'}</b><span>Memorized</span></div>
        <div class="stat"><b>${esc(plan.level(s.plan).short)}</b><span>Each day</span></div>
      </div>
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
        </div>
        <p class="xs muted">Recite each part with the AI and reach 90% to tick it off. The new lesson moves forward once it is done.</p>
      </div>
      <div class="card gold stack-s">
        <div class="spread"><div class="eyebrow" style="color:var(--gold-ink)">Your path</div><span style="color:var(--gold)">${icons.star.replace('<svg', '<svg width="18" height="18"')}</span></div>
        <p>${t.complete ? 'Hifz complete.' : `At this pace you complete the Quran around <b>${esc(finish)}</b>, in sha Allah.`}</p>
        <p class="small muted">Track: ${esc(plan.TRACKS.find((x) => x.id === s.plan.track)?.label || '')}. Change it in Settings.</p>
      </div>
      <div class="card stack-s">
        <h2>Teacher test</h2>
        <p class="small muted">When your portion is ready, show your teacher. In a halaqa, the teacher opens <b>Live session</b> on their device and listens to you recite; the session is recorded with every mark.</p>
      </div>
    </div>`;
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
