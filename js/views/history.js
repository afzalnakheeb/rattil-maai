import * as store from '../store.js';
import { MARK_LABEL } from '../session.js';
import { esc, fmtDate, fmtTime, band, toast } from '../ui.js';
import { icons } from '../icons.js';

const SRC = {
  ai: { label: 'AI', cls: 'gold' },
  teacher: { label: 'Teacher', cls: 'red' },
  self: { label: 'Self', cls: 'plain' },
};

function markChip(m) {
  if (m.source === 'ai' && m.status === 'confirmed') return '<span class="chip red">AI · confirmed</span>';
  if (m.source === 'ai' && m.status === 'dismissed') return '<span class="chip gold">AI · dismissed</span>';
  if (m.source === 'ai' && m.status === 'suggested') return '<span class="chip gold">AI suggestion</span>';
  const s = SRC[m.source] || SRC.ai;
  return `<span class="chip ${s.cls}">${s.label}</span>`;
}

export default function historyView(root, params) {
  if (params.id) return detail(root, params.id);
  const s = store.get();
  let filter = params.f || 'all';
  const role = s.profile?.role;

  function paint() {
    const list = s.history.filter((h) => filter === 'all' || (filter === 'teacher' ? h.kind === 'teacher' : h.kind === 'practice'));
    const week = Date.now() - 7 * 864e5;
    const recent = s.history.filter((h) => h.created >= week);
    const marks = recent.flatMap((h) => h.marks.filter((m) => m.status !== 'dismissed' && m.type !== 'peek'));
    const byAi = marks.filter((m) => m.source === 'ai').length;
    const byTeacher = marks.filter((m) => m.source === 'teacher').length;
    const words = {};
    marks.forEach((m) => { words[m.word] = (words[m.word] || 0) + 1; });
    const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 8);

    root.innerHTML = `
      <div class="stack">
        <div class="page-head"><h1>${role === 'teacher' ? 'Recordings' : 'My recordings'}</h1><p class="small muted">Every practice and teacher session is saved here with its marks.</p></div>
        <div class="seg" role="group" aria-label="Filter" style="align-self:flex-start">
          ${[['all', 'All'], ['teacher', 'Teacher sessions'], ['practice', 'AI practice']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}
        </div>
        <div class="card stack-s">
          <div class="spread"><h2>This week</h2><span class="small muted">${recent.length} recordings · ${marks.length} marks</span></div>
          <div class="row-wrap small"><span class="chip gold">${byAi} found by AI</span><span class="chip red">${byTeacher} marked by teacher</span></div>
          ${top.length ? `<div class="eyebrow" style="margin-top:6px">Words to revise</div><div class="row-wrap" lang="ar" dir="rtl">${top.map(([w, n]) => `<span class="quran" style="font-size:20px;padding:0 10px;border-radius:10px;background:var(--red-tint);border-bottom:2px solid var(--red)">${esc(w)}${n > 1 ? ` <span class="xs" style="font-family:var(--sans)">×${n}</span>` : ''}</span>`).join('')}</div>` : ''}
        </div>
        ${list.length ? `<div class="stack-s">${list.map((h) => {
          const g = h.grade ? h.grade.total : null;
          const active = h.marks.filter((m) => m.status !== 'dismissed').length;
          return `<a class="card row" href="#/history/${h.id}" style="text-decoration:none;color:inherit">
            <div class="icon-tile ${h.kind === 'teacher' ? 'solid' : 'gold'}">${h.kind === 'teacher' ? icons.users : icons.mic}</div>
            <div class="grow">
              <h3>${h.kind === 'teacher' ? 'Teacher session' : 'AI practice'} · ${esc(h.title.split(' · ')[0])}</h3>
              <div class="xs muted">${esc(fmtDate(h.created))} · ${fmtTime(h.duration)}${h.kind === 'teacher' ? ` · ${esc(h.student || '')}${h.teacher ? ' with ' + esc(h.teacher) : ''}` : ''}</div>
              <div class="xs muted">${active} ${active === 1 ? 'mark' : 'marks'}${h.audioId ? ' · audio saved' : ''}</div>
            </div>
            <div style="text-align:right"><b style="font-size:17px">${g !== null ? g : h.aiScore + '%'}</b>${g !== null ? `<div class="xs" style="color:var(--green);font-weight:600">${esc(band(g).label.split(' ·')[0])}</div>` : ''}</div>
          </a>`;
        }).join('')}</div>` : `<div class="empty card">No recordings yet. ${role === 'teacher' ? 'Start a live session to record one.' : 'Recite a portion and it will appear here.'}</div>`}
        <p class="xs muted" style="text-align:center">Saved on this device. Accounts and sync between student, parent and teacher devices come next.</p>
      </div>`;
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; paint(); }));
  }
  paint();
}

async function detail(root, id) {
  const s = store.get();
  const h = s.history.find((x) => x.id === id);
  if (!h) { root.innerHTML = '<div class="empty card">This recording was not found on this device.</div>'; return; }
  const marks = [...h.marks].sort((a, b) => a.t - b.t);
  const g = h.grade;

  root.innerHTML = `
    <div class="stack">
      <div class="row"><a class="icon-btn" href="#/history" aria-label="Back to recordings">${icons.next.replace('<svg', '<svg style="transform:scaleX(-1)"')}</a>
        <div class="grow"><div class="eyebrow">${h.kind === 'teacher' ? 'Teacher session' : 'AI practice'}</div><h1 style="font-size:18px">${esc(h.title)}</h1></div></div>
      <div class="small muted">${esc(fmtDate(h.created))} · ${fmtTime(h.duration)}${h.student ? ` · Student: ${esc(h.student)}` : ''}${h.teacher ? ` · Teacher: ${esc(h.teacher)}` : ''}</div>
      <div class="card stack-s" id="audioCard">${h.audioId ? '<div class="spinner"></div>' : '<p class="small muted">No audio was saved for this session.</p>'}</div>
      ${g ? `<div class="card stack-s">
        <div class="spread"><h2>Grade</h2><span class="chip ${band(g.total).cls}">${g.total} · ${esc(band(g.total).label)}</span></div>
        ${[['hifz', 'Hifz accuracy', 40], ['tajweed', 'Tajweed', 30], ['makharij', 'Makharij', 20], ['waqf', 'Waqf and fluency', 10]].map(([k, l, max]) => `
          <div class="rubric-row"><span class="small">${l}</span><div class="bar"><i style="width:${Math.round((g[k] / max) * 100)}%"></i></div><span class="small" style="text-align:right"><b>${g[k]}</b>/${max}</span></div>`).join('')}
        ${h.decision ? `<p class="small"><b>Decision:</b> ${h.decision === 'pass' ? 'Pass, next portion opens' : 'Repeat this portion'}</p>` : ''}
        ${h.comment ? `<p class="small"><b>Comment:</b> ${esc(h.comment)}</p>` : ''}
      </div>` : `<div class="card"><div class="spread"><h2>AI score</h2><span class="chip">${h.aiScore}%</span></div></div>`}
      <div class="card stack-s">
        <div class="spread"><h2>Marks</h2><span class="small muted">Tap to hear that moment</span></div>
        ${marks.length ? marks.map((m) => `
          <button type="button" class="list-item" data-t="${m.t}" style="background:none;border-left:0;border-right:0;border-bottom:0;width:100%;text-align:left;cursor:pointer;${m.status === 'dismissed' ? 'opacity:.6' : ''}">
            <span class="icon-tile" style="width:38px;height:38px">${icons.play.replace('<svg', '<svg width="15" height="15"')}</span>
            <span class="grow"><span class="quran" style="font-size:20px" lang="ar">${esc(m.word)}</span>
              <span class="small" style="display:block">${esc(MARK_LABEL[m.type] || m.type)} · ayah ${m.ayah} · ${fmtTime(m.t)}</span></span>
            ${markChip(m)}
          </button>`).join('') : '<p class="small muted">No mistakes were marked.</p>'}
      </div>
      <div class="row-wrap">
        <button class="btn outline" id="share" type="button">${icons.share} Share summary</button>
        <button class="btn danger" id="del" type="button">${icons.trash} Delete</button>
      </div>
    </div>`;

  let audio = null;
  if (h.audioId) {
    const blob = await store.getClip(h.audioId);
    const card = root.querySelector('#audioCard');
    if (blob && card) {
      const url = URL.createObjectURL(blob);
      card.innerHTML = `<audio id="aud" controls preload="metadata" src="${url}"></audio>`;
      audio = card.querySelector('#aud');
    } else if (card) card.innerHTML = '<p class="small muted">The audio is no longer on this device.</p>';
  }

  root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    if (!audio) { toast('No audio saved for this session.'); return; }
    audio.currentTime = Math.max(0, +b.dataset.t / 1000 - 2);
    audio.play().catch(() => {});
  }));

  root.querySelector('#share').addEventListener('click', async () => {
    const lines = [
      `Recite With Me · ${h.kind === 'teacher' ? 'Teacher session' : 'AI practice'}`,
      h.title,
      h.student ? `Student: ${h.student}` : '',
      h.teacher ? `Teacher: ${h.teacher}` : '',
      g ? `Grade: ${g.total}/100 (${band(g.total).label})` : `AI score: ${h.aiScore}%`,
      h.decision ? `Decision: ${h.decision === 'pass' ? 'Pass' : 'Repeat'}` : '',
      h.comment ? `Comment: ${h.comment}` : '',
      marks.filter((m) => m.status !== 'dismissed').length ? 'Mistakes: ' + marks.filter((m) => m.status !== 'dismissed').map((m) => `${m.word} (ayah ${m.ayah}, ${MARK_LABEL[m.type] || m.type})`).join('; ') : 'No mistakes marked.',
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Recite With Me', text: lines });
      else { await navigator.clipboard.writeText(lines); toast('Summary copied. Paste it in WhatsApp or email.'); }
    } catch { /* cancelled */ }
  });

  root.querySelector('#del').addEventListener('click', async () => {
    if (!confirm('Delete this recording and its marks from this device?')) return;
    if (h.audioId) await store.deleteClip(h.audioId);
    store.update((st) => { st.history = st.history.filter((x) => x.id !== id); });
    location.hash = '#/history';
  });

  return () => { if (audio) audio.pause(); };
}
