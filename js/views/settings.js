import * as store from '../store.js';
import * as plan from '../plan.js';
import { RECITERS } from '../quran.js';
import { esc, toast } from '../ui.js';

export function welcome(root, onDone) {
  root.innerHTML = `
    <form class="stack welcome" id="welcomeForm">
      <div class="logo-big">
        <img src="icons/icon.svg" alt="" width="96" height="96" style="border-radius:24px">
        <h1 style="font-size:28px">Recite With Me</h1>
        <p class="muted">Memorize the Quran with a daily plan, an AI that listens as you recite, and teachers who check you, to the standard of al-Haram and an-Nabawi.</p>
      </div>
      <div class="card stack-s">
        <label class="label" for="nm">Your name</label>
        <input class="input" id="nm" required maxlength="40" autocomplete="given-name" placeholder="e.g. Yusuf">
      </div>
      <fieldset class="card stack-s" style="border:0;margin:0">
        <legend class="label" style="padding:0;margin-bottom:8px">I am a…</legend>
        <label class="choice"><input type="radio" name="role" value="student" checked><span><b>Student</b><br><span class="small muted">Daily plan, listen, recite with the AI check, adhkar and my recordings</span></span></label>
        <label class="choice"><input type="radio" name="role" value="teacher"><span><b>Teacher</b><br><span class="small muted">My students, live sessions with AI suggestions, grading and recordings</span></span></label>
      </fieldset>
      <button class="btn block" type="submit">Continue</button>
      <p class="xs muted" style="text-align:center">Free. Your data stays on this device for now.</p>
    </form>`;
  root.querySelector('#welcomeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = root.querySelector('#nm').value.trim();
    const role = new FormData(e.currentTarget).get('role');
    store.update((s) => { s.profile = { name, role }; });
    onDone();
  });
}

export default function settingsView(root, params, { rerender }) {
  const s = store.get();
  const p = s.plan;
  root.innerHTML = `
    <div class="stack">
      <div class="page-head"><h1>Settings</h1></div>
      <form class="card stack-s" id="profileForm">
        <h2>Profile</h2>
        <div class="field"><label for="nm">Name</label><input class="input" id="nm" value="${esc(s.profile?.name || '')}" maxlength="40" required></div>
        <div class="field"><span class="label">View</span>
          <div class="seg" role="group" aria-label="View">
            <button type="button" data-role="student" aria-pressed="${s.profile?.role !== 'teacher'}">Student</button>
            <button type="button" data-role="teacher" aria-pressed="${s.profile?.role === 'teacher'}">Teacher</button>
          </div>
          <p class="xs muted">One app, two views. Teachers use the Teacher view; students the Student view.</p>
        </div>
        <button class="btn sm" type="submit" style="align-self:flex-start">Save name</button>
      </form>
      <div class="card stack-s">
        <h2>Listening</h2>
        <div class="field"><label for="rec">Default reciter</label>
          <select class="input" id="rec">${RECITERS.map((r) => `<option value="${r.id}" ${r.id === s.settings.reciter ? 'selected' : ''}>${esc(r.name)} · ${esc(r.note)}</option>`).join('')}</select></div>
      </div>
      <div class="card stack-s">
        <h2>Hifz plan</h2>
        ${p ? `<p class="small">${esc(plan.level(p).label)} · ${esc(plan.TRACKS.find((t) => t.id === p.track)?.label || '')} · ${Math.floor(p.units / 2)} pages memorized</p>
          <div class="field"><label for="lvl">Daily target</label><select class="input" id="lvl">${plan.LEVELS.map((l) => `<option value="${l.id}" ${l.id === p.level ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="mem">Pages memorized</label><input class="input" id="mem" type="number" min="0" max="604" value="${Math.floor(p.units / 2)}" inputmode="numeric"></div>
          <div class="row-wrap"><button class="btn sm" id="savePlan" type="button">Save plan</button><button class="btn ghost sm" id="newPlan" type="button">Start a new plan</button></div>`
          : '<p class="small muted">No plan yet. Switch to the Student view to set one.</p>'}
      </div>
      <div class="card stack-s">
        <h2>About</h2>
        <p class="small">Recite With Me · رتّل معي. Quran text: Tanzil Uthmani (Madinah Mushaf, Hafs), via Al Quran Cloud. Recitations: Islamic Network CDN. Adhkar: Hisn al-Muslim.</p>
        <p class="small muted">The AI check uses your browser's speech engine. It checks words, not tajweed, and never replaces a teacher.</p>
      </div>
      <div class="card stack-s">
        <h2>Data on this device</h2>
        <p class="small muted">${s.history.length} recordings saved. Clearing removes everything on this device.</p>
        <button class="btn danger sm" id="clear" type="button" style="align-self:flex-start">Clear all data</button>
      </div>
    </div>`;

  root.querySelector('#profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    store.update((x) => { x.profile.name = root.querySelector('#nm').value.trim(); });
    toast('Saved');
    rerender();
  });
  root.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
    store.update((x) => { x.profile.role = b.dataset.role; });
    location.hash = '#/';
    rerender();
  }));
  root.querySelector('#rec').addEventListener('change', (e) => { store.update((x) => { x.settings.reciter = e.target.value; }); toast('Reciter saved'); });
  root.querySelector('#savePlan')?.addEventListener('click', () => {
    store.update((x) => {
      x.plan.level = root.querySelector('#lvl').value;
      const mem = Math.max(0, Math.min(604, parseInt(root.querySelector('#mem').value, 10) || 0));
      if (mem !== Math.floor(x.plan.units / 2)) x.plan.units = mem * 2;
    });
    toast('Plan saved');
  });
  root.querySelector('#newPlan')?.addEventListener('click', () => {
    if (!confirm('Start a new plan? Your recordings stay; plan progress resets.')) return;
    store.update((x) => { x.plan = null; });
    location.hash = '#/';
  });
  root.querySelector('#clear').addEventListener('click', () => {
    if (!confirm('Clear all data on this device? This cannot be undone.')) return;
    store.reset();
    try { indexedDB.deleteDatabase('rattil-audio'); } catch { /* ignore */ }
    location.hash = '#/';
    rerender();
  });
}
