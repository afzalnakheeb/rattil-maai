// Admin panel: review teacher applications, manage teachers and their capacity,
// and assign students waiting for a teacher, matched by language.
// Every action is checked again on the server (admin-only database functions).

import * as cloud from '../cloud.js';
import { esc, loading, errorBox, toast, alive, fmtDate } from '../ui.js';
import { icons } from '../icons.js';
import { LANGUAGES, TEACHES, langName, matchTeachers } from '../clean.js';
import { teacherCard } from './apply.js';

const TABS = [['overview', 'Overview'], ['applications', 'Applications'], ['teachers', 'Teachers'], ['students', 'Students waiting'], ['admins', 'Admins']];
const AGE = { child: 'Child', teen: 'Teenager', adult: 'Adult' };
const when = (t) => { const n = Date.parse(t); return Number.isFinite(n) ? fmtDate(n) : ''; };

export default async function adminView(root, params) {
  root.innerHTML = loading('Opening the admin panel');
  const myRole = await cloud.myAdminRole();
  if (!myRole) {
    if (!alive(root)) return;
    root.innerHTML = '<div class="empty card">This page is for academy admins.</div>';
    return;
  }
  let tab = TABS.some(([k]) => k === params.tab) ? params.tab : 'overview';
  let appFilter = 'pending';
  let langFilter = '';
  let data = { apps: [], teachers: [], requests: [], admins: [] };

  async function refresh() {
    const [apps, teachers, requests, admins] = await Promise.all([cloud.listApplications(), cloud.listTeachers(), cloud.listRequests(), cloud.listAdmins().catch(() => [])]);
    data = { apps, teachers, requests, admins };
  }

  try { await refresh(); } catch (e) {
    if (!alive(root)) return;
    root.innerHTML = errorBox('The admin data could not load. Check your connection.', 'retry');
    root.querySelector('#retry')?.addEventListener('click', () => adminView(root, params));
    return;
  }
  if (!alive(root)) return;
  root.closest('.view')?.classList.add('wide');

  function paint() {
    const pending = data.apps.filter((a) => a.status === 'pending').length;
    const waiting = data.requests.filter((r) => r.status === 'waiting');
    root.innerHTML = `
      <div class="stack">
        <div class="page-head"><p class="eyebrow">Recite With Me academy · ${myRole === 'owner' ? 'Owner' : 'Admin'}</p><h1>Admin panel</h1></div>
        <div class="seg admin-tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-pressed="${tab === k}">${l}${k === 'applications' && pending ? ` <span class="badge">${pending}</span>` : ''}${k === 'students' && waiting.length ? ` <span class="badge">${waiting.length}</span>` : ''}</button>`).join('')}</div>
        <div id="pane">${{ overview, applications, teachers, students, admins }[tab]()}</div>
      </div>`;
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; history.replaceState(null, '', `#/admin?tab=${tab}`); paint(); }));
    wire();
  }

  // ---------- Overview ----------
  function overview() {
    const approved = data.teachers.filter((t) => t.capacity > 0);
    const seats = approved.reduce((n, t) => n + Math.max(0, t.capacity - t.students), 0);
    const assigned = data.teachers.reduce((n, t) => n + t.students, 0);
    const waiting = data.requests.filter((r) => r.status === 'waiting');
    const byLang = LANGUAGES.map(([c, en]) => ({
      c, en,
      teachers: approved.filter((t) => t.languages.includes(c)).length,
      seats: approved.filter((t) => t.languages.includes(c) && t.accepting).reduce((n, t) => n + Math.max(0, t.capacity - t.students), 0),
      waiting: waiting.filter((r) => r.languages.includes(c)).length,
    })).filter((x) => x.teachers || x.waiting);
    return `
      <div class="stat-grid">
        <div class="stat"><b>${data.apps.filter((a) => a.status === 'pending').length}</b><span>Applications to review</span></div>
        <div class="stat"><b>${approved.length}</b><span>Verified teachers</span></div>
        <div class="stat"><b>${assigned}</b><span>Students with a teacher</span></div>
        <div class="stat"><b>${waiting.length}</b><span>Students waiting</span></div>
        <div class="stat"><b>${seats}</b><span>Free places</span></div>
      </div>
      <div class="card stack-s"><h2>By language</h2>
        ${byLang.length ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Language</th><th>Teachers</th><th>Free places</th><th>Waiting</th></tr></thead><tbody>
          ${byLang.map((x) => `<tr><td>${esc(x.en)}</td><td>${x.teachers}</td><td>${x.seats}</td><td>${x.waiting ? `<b class="${x.waiting > x.seats ? 'text-red' : ''}">${x.waiting}</b>` : 0}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="xs muted">Red means more students are waiting than there are free places in that language: onboard more teachers who speak it.</p>` : '<p class="small muted">No teachers or requests yet. Share the “Apply to teach” link to start onboarding.</p>'}
      </div>
      <div class="card stack-s"><h2>Onboard teachers</h2>
        <p class="small muted">Send teachers this link. They sign in with Google and fill in their languages, experience and ijazah, and the application appears here.</p>
        <div class="code-box"><b style="font-size:15px;letter-spacing:0">rattilmai.com/teach/</b><button class="icon-btn" id="copyApply" type="button" aria-label="Copy the apply link">${icons.copy}</button></div>
        <a class="btn outline sm" href="#/apply" style="align-self:flex-start">Apply as a teacher yourself</a>
      </div>`;
  }

  // ---------- Applications ----------
  function applications() {
    const list = data.apps.filter((a) => a.status === appFilter);
    return `
      <div class="seg" style="margin-bottom:12px">${[['pending', 'To review'], ['approved', 'Approved'], ['declined', 'Declined']].map(([k, l]) => `<button type="button" data-af="${k}" aria-pressed="${appFilter === k}">${l} (${data.apps.filter((a) => a.status === k).length})</button>`).join('')}</div>
      ${list.length ? `<div class="stack-s">${list.map((a) => `
        <div class="card stack-s" data-app="${esc(a.id)}">
          <div class="spread"><div><h3>${esc(a.name)}</h3><div class="xs muted">${esc(a.email)} · applied ${esc(when(a.created_at))}</div></div>
            <span class="chip ${a.status === 'pending' ? 'gold' : a.status === 'declined' ? 'red' : ''}">${a.status === 'pending' ? 'To review' : a.status === 'approved' ? 'Approved' : 'Declined'}</span></div>
          <div class="kv">
            <div><span>Gender</span><b>${a.gender === 'female' ? 'Female' : 'Male'}</b></div>
            <div><span>Experience</span><b>${a.years_experience} ${a.years_experience === 1 ? 'year' : 'years'}</b></div>
            <div><span>Country</span><b>${esc(a.country || '—')}</b></div>
            <div><span>Hours / week</span><b>${a.hours_per_week}</b></div>
          </div>
          <div class="row-wrap">${a.languages.map((l) => `<span class="chip plain">${esc(langName(l))}</span>`).join('')}</div>
          ${a.teaches.length ? `<p class="xs muted">Teaches: ${a.teaches.map((k) => esc((TEACHES.find((x) => x[0] === k) || [k, k])[1])).join(' · ')}</p>` : ''}
          ${a.ijazah ? `<p class="small"><b>Ijazah:</b> ${esc(a.ijazah)}</p>` : ''}
          ${a.qualifications ? `<p class="small"><b>Studies:</b> ${esc(a.qualifications)}</p>` : ''}
          ${a.bio ? `<p class="small"><b>About:</b> ${esc(a.bio)}</p>` : ''}
          ${a.availability ? `<p class="small"><b>Free:</b> ${esc(a.availability)}</p>` : ''}
          ${a.phone ? `<p class="small"><b>WhatsApp:</b> <a href="https://wa.me/${esc(a.phone.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener">${esc(a.phone)}</a></p>` : ''}
          ${a.admin_note ? `<p class="xs muted">Note: ${esc(a.admin_note)}</p>` : ''}
          <div class="row-wrap admin-actions">
            <div class="field" style="flex:0 1 150px"><label for="cap-${esc(a.id)}">Max students</label><input class="input" id="cap-${esc(a.id)}" type="number" min="1" max="200" value="10" inputmode="numeric"></div>
            <div class="field" style="flex:1 1 220px"><label for="note-${esc(a.id)}">Note to the teacher (optional)</label><input class="input" id="note-${esc(a.id)}" maxlength="600" value=""></div>
          </div>
          <div class="row-wrap">
            ${a.status !== 'approved' ? `<button class="btn sm" type="button" data-review="approved">${icons.check} Approve</button>` : ''}
            ${a.status !== 'declined' ? `<button class="btn ghost sm" type="button" data-review="declined">Decline</button>` : ''}
            ${a.status !== 'pending' ? `<button class="btn ghost sm" type="button" data-review="pending">Back to review</button>` : ''}
          </div>
        </div>`).join('')}</div>` : `<div class="empty card">${appFilter === 'pending' ? 'No applications waiting. Share rattilmai.com/teach/ with teachers.' : 'Nothing here yet.'}</div>`}`;
  }

  // ---------- Teachers ----------
  function teachers() {
    const list = data.teachers.filter((t) => !langFilter || t.languages.includes(langFilter));
    return `
      <div class="row-wrap" style="margin-bottom:12px"><label class="sr-only" for="tLang">Filter by language</label>
        <select class="input" id="tLang" style="max-width:240px"><option value="">All languages</option>${LANGUAGES.map(([c, en]) => `<option value="${c}" ${langFilter === c ? 'selected' : ''}>${esc(en)}</option>`).join('')}</select></div>
      ${list.length ? `<div class="admin-grid">${list.map((t) => teacherCard(t, { extra: `
        <div class="load"><div class="spread xs"><span>${t.students} of ${t.capacity} students</span><span class="${t.accepting ? '' : 'text-red'}">${t.accepting ? 'Taking students' : 'Not taking students'}</span></div>
          <div class="bar"><i style="width:${t.capacity ? Math.min(100, Math.round((t.students / t.capacity) * 100)) : 100}%"></i></div></div>
        <div class="row-wrap" data-teacher="${esc(t.user_id)}">
          <div class="field" style="flex:0 1 120px"><label for="tc-${esc(t.user_id)}">Max students</label><input class="input" id="tc-${esc(t.user_id)}" type="number" min="0" max="200" value="${t.capacity}" inputmode="numeric"></div>
          <label class="choice" style="padding:8px 12px;align-self:flex-end"><input type="checkbox" data-acc ${t.accepting ? 'checked' : ''}><span class="small">Taking students</span></label>
          <button class="btn sm outline" type="button" data-save-teacher style="align-self:flex-end">Save</button>
        </div>` })).join('')}</div>` : '<div class="empty card">No verified teachers yet. Approve applications to add them.</div>'}`;
  }

  // ---------- Students waiting ----------
  function students() {
    const waiting = data.requests.filter((r) => r.status === 'waiting' && (!langFilter || r.languages.includes(langFilter)));
    const assigned = data.requests.filter((r) => r.status === 'assigned');
    const tName = (id) => data.teachers.find((t) => t.user_id === id)?.name || 'Teacher';
    return `
      <div class="row-wrap" style="margin-bottom:12px"><label class="sr-only" for="sLang">Filter by language</label>
        <select class="input" id="sLang" style="max-width:240px"><option value="">All languages</option>${LANGUAGES.map(([c, en]) => `<option value="${c}" ${langFilter === c ? 'selected' : ''}>${esc(en)}</option>`).join('')}</select></div>
      ${waiting.length ? `<div class="stack-s">${waiting.map((r) => {
        const matches = matchTeachers(r, data.teachers).slice(0, 4);
        return `
        <div class="card stack-s" data-req="${esc(r.student_id)}">
          <div class="spread"><div><h3>${esc(r.student_name || 'Student')}</h3><div class="xs muted">${esc(r.email)} · waiting since ${esc(when(r.created_at))}</div></div>
            <span class="chip gold">${AGE[r.age_group]}</span></div>
          <div class="row-wrap">${r.languages.map((l, i) => `<span class="chip ${i === 0 ? '' : 'plain'}">${esc(langName(l))}</span>`).join('')}${r.teacher_gender !== 'any' ? `<span class="chip plain">${r.teacher_gender === 'female' ? 'Female teacher' : 'Male teacher'}</span>` : ''}</div>
          ${r.level ? `<p class="small"><b>Level:</b> ${esc(r.level)}</p>` : ''}
          ${r.note ? `<p class="small"><b>Note:</b> ${esc(r.note)}</p>` : ''}
          <div class="eyebrow">Best matches</div>
          ${matches.length ? matches.map((m) => `
            <div class="list-item"><div class="grow"><h3 style="font-size:15px">${esc(m.teacher.name)}</h3>
              <div class="xs muted">${m.shared.map((l) => esc(langName(l))).join(', ')} · ${m.teacher.years_experience} yrs · ${m.teacher.students}/${m.teacher.capacity} students${m.room ? '' : ' · <span class="text-red">full or paused</span>'}</div></div>
              <button class="btn sm ${m.room ? '' : 'outline'}" type="button" data-assign="${esc(m.teacher.user_id)}">Assign</button></div>`).join('')
            : `<p class="small text-red">No verified teacher speaks ${esc(r.languages.map(langName).join(' or '))}${r.teacher_gender !== 'any' ? ` (${r.teacher_gender})` : ''} yet.</p>`}
        </div>`;
      }).join('')}</div>` : '<div class="empty card">No students waiting for a teacher.</div>'}
      ${assigned.length ? `<div class="card stack-s"><h2>Recently matched</h2>${assigned.slice(-12).reverse().map((r) => `<div class="list-item"><div class="grow"><h3 style="font-size:15px">${esc(r.student_name || 'Student')}</h3><div class="xs muted">with ${esc(tName(r.teacher_id))} · ${esc(when(r.assigned_at))}</div></div></div>`).join('')}</div>` : ''}`;
  }

  // ---------- Admins (only owners can change this list) ----------
  function admins() {
    const owner = myRole === 'owner';
    return `
      <div class="card stack-s"><h2>Who can open this panel</h2>
        <p class="small muted">Only the Google accounts listed here can open the admin panel. Signing in with Google is not enough. <b>Owners</b> can add and remove admins. <b>Admins</b> can review teachers and assign students, but cannot change this list.</p>
        ${data.admins.map((a) => `
          <div class="list-item" data-admin="${esc(a.email)}">
            <div class="grow"><h3 style="font-size:15px">${esc(a.name || a.email)} ${a.role === 'owner' ? '<span class="chip gold">Owner</span>' : '<span class="chip plain">Admin</span>'} ${a.active ? '' : '<span class="chip red">Switched off</span>'}</h3>
              <div class="xs muted">${esc(a.email)}${a.signed_up ? '' : ' · has not signed in yet'}${a.added_by ? ` · added by ${esc(a.added_by)}` : ''}</div></div>
            ${owner ? `<div class="row-wrap" style="justify-content:flex-end">
              ${a.active ? `<button class="btn ghost sm" type="button" data-admin-role="${a.role === 'owner' ? 'admin' : 'owner'}">${a.role === 'owner' ? 'Make admin' : 'Make owner'}</button>
                <button class="btn ghost sm" type="button" data-admin-off>Remove access</button>`
                : '<button class="btn sm outline" type="button" data-admin-on>Give access again</button>'}
            </div>` : ''}
          </div>`).join('')}
      </div>
      ${owner ? `<form class="card stack-s" id="addAdmin"><h2>Add an admin</h2>
        <p class="small muted">Enter their Google (Gmail) address. They get access the next time they open the app signed in with that account.</p>
        <div class="row-wrap">
          <div class="field" style="flex:2 1 240px"><label for="adEmail">Google email</label><input class="input" id="adEmail" type="email" required autocomplete="off" placeholder="name@gmail.com"></div>
          <div class="field" style="flex:1 1 150px"><label for="adRole">Role</label><select class="input" id="adRole"><option value="admin">Admin</option><option value="owner">Owner</option></select></div>
        </div>
        <button class="btn" type="submit" style="align-self:flex-start">Add admin</button>
      </form>` : '<p class="small muted">Ask an owner to add or remove admins.</p>'}`;
  }

  async function saveAdmin(email, role, active, msg) {
    try { await cloud.setAdmin(email, role, active); await refresh(); toast(msg); if (alive(root)) paint(); } catch (e) { toast(`Could not save: ${e?.message || 'check your connection'}`); }
  }

  function wire() {
    root.querySelector('#addAdmin')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = root.querySelector('#adEmail').value.trim().toLowerCase();
      const role = root.querySelector('#adRole').value;
      saveAdmin(email, role, true, `${email} can now open the admin panel`);
    });
    root.querySelectorAll('[data-admin-role]').forEach((b) => b.addEventListener('click', () => {
      const email = b.closest('[data-admin]').dataset.admin;
      saveAdmin(email, b.dataset.adminRole, true, b.dataset.adminRole === 'owner' ? `${email} is now an owner` : `${email} is now an admin`);
    }));
    root.querySelectorAll('[data-admin-off]').forEach((b) => b.addEventListener('click', () => {
      const row = b.closest('[data-admin]');
      const email = row.dataset.admin;
      const a = data.admins.find((x) => x.email === email);
      if (!confirm(`Remove admin access for ${email}?`)) return;
      saveAdmin(email, a?.role || 'admin', false, `${email} no longer has admin access`);
    }));
    root.querySelectorAll('[data-admin-on]').forEach((b) => b.addEventListener('click', () => {
      const email = b.closest('[data-admin]').dataset.admin;
      const a = data.admins.find((x) => x.email === email);
      saveAdmin(email, a?.role || 'admin', true, `${email} has admin access again`);
    }));
    root.querySelectorAll('[data-af]').forEach((b) => b.addEventListener('click', () => { appFilter = b.dataset.af; paint(); }));
    root.querySelector('#tLang')?.addEventListener('change', (e) => { langFilter = e.target.value; paint(); });
    root.querySelector('#sLang')?.addEventListener('change', (e) => { langFilter = e.target.value; paint(); });
    root.querySelector('#copyApply')?.addEventListener('click', async () => {
      const link = 'https://rattilmai.com/teach/';
      try { await navigator.clipboard.writeText(link); toast('Apply link copied'); } catch { toast(link); }
    });
    root.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', async () => {
      const card = b.closest('[data-app]');
      const id = card.dataset.app;
      const decision = b.dataset.review;
      const cap = Math.max(1, Math.min(200, Number(card.querySelector(`[id^="cap-"]`).value) || 10));
      const note = card.querySelector(`[id^="note-"]`).value;
      b.disabled = true;
      try {
        await cloud.reviewApplication(id, decision, note, cap);
        await refresh();
        toast(decision === 'approved' ? 'Approved. The teacher is now verified.' : decision === 'declined' ? 'Application declined' : 'Moved back to review');
        if (alive(root)) paint();
      } catch (e) { b.disabled = false; toast(`Could not save: ${e?.message || 'check your connection'}`); }
    }));
    root.querySelectorAll('[data-save-teacher]').forEach((b) => b.addEventListener('click', async () => {
      const row = b.closest('[data-teacher]');
      const cap = Math.max(0, Math.min(200, Number(row.querySelector('input[type="number"]').value) || 0));
      const acc = row.querySelector('[data-acc]').checked;
      try { await cloud.updateTeacher(row.dataset.teacher, cap, acc); await refresh(); toast('Saved'); if (alive(root)) paint(); } catch (e) { toast(`Could not save: ${e?.message || 'check your connection'}`); }
    }));
    root.querySelectorAll('[data-assign]').forEach((b) => b.addEventListener('click', async () => {
      const sid = b.closest('[data-req]').dataset.req;
      const t = data.teachers.find((x) => x.user_id === b.dataset.assign);
      if (t && (t.students >= t.capacity || !t.accepting) && !confirm(`${t.name} is full or not taking students. Assign anyway?`)) return;
      b.disabled = true;
      try { await cloud.assignTeacher(sid, b.dataset.assign); await refresh(); toast(`Assigned to ${t?.name || 'the teacher'}`); if (alive(root)) paint(); } catch (e) { b.disabled = false; toast(`Could not assign: ${e?.message || 'check your connection'}`); }
    }));
  }

  paint();
}
