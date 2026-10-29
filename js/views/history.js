import * as store from '../store.js';
import * as records from '../records.js';
import { isCloud } from '../account.js';
import { MARK_LABEL } from '../session.js';
import { esc, fmtDate, fmtTime, band, toast, loading } from '../ui.js';
import { icons } from '../icons.js';

const SRC = {
  ai: { label: 'AI', cls: 'gold' },
  teacher: { label: 'Teacher', cls: 'red' },
  self: { label: 'Self', cls: 'plain' },
};
const KIND = { practice: 'AI practice', teacher: 'In-person session', online: 'Video session' };

function markChip(m) {
  if (m.source === 'ai' && m.status === 'confirmed') return '<span class="chip red">AI · confirmed</span>';
  if (m.source === 'ai' && m.status === 'dismissed') return '<span class="chip gold">AI · dismissed</span>';
  if (m.source === 'ai' && m.status === 'suggested') return '<span class="chip gold">AI suggestion</span>';
  const s = SRC[m.source] || SRC.ai;
  return `<span class="chip ${s.cls}">${s.label}</span>`;
}

const gradeOf = (h) => h.review?.grade || h.grade || null;
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const link = (id) => encodeURIComponent(String(id || ''));
// Recorded webm files often report an unknown (Infinity) length, which stops seeking. Probe it once.
function fixDuration(audio) {
  if (!audio) return;
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration !== Infinity) return;
    const back = () => { audio.removeEventListener('durationchange', back); audio.currentTime = 0; };
    audio.addEventListener('durationchange', back);
    audio.currentTime = 1e7;
  }, { once: true });
}

export default async function historyView(root, params) {
  if (params.id) return detail(root, params.id);
  const s = store.get();
  const role = s.profile?.role;
  const me = s.profile?.id;
  let filter = params.f || 'all';
  root.innerHTML = loading('Loading recordings');
  let all = [];
  try { all = await records.list({ studentId: params.student }); } catch { all = s.history; }
  const studentName = params.student ? (all.find((h) => h.studentId === params.student)?.student || 'Student') : '';

  function paint() {
    const list = all.filter((h) => filter === 'all'
      || (filter === 'teacher' ? h.kind !== 'practice' : filter === 'review' ? (h.kind === 'practice' && !h.review && h.studentId !== me) : h.kind === 'practice'));
    const week = Date.now() - 7 * 864e5;
    const recent = all.filter((h) => h.created >= week);
    const marks = recent.flatMap((h) => [...(h.marks || []), ...(h.review?.marks || []).filter((m) => m.source === 'teacher')].filter((m) => m.status !== 'dismissed' && m.status !== 'suggested' && m.type !== 'peek'));
    const byAi = marks.filter((m) => m.source === 'ai').length;
    const byTeacher = marks.filter((m) => m.source === 'teacher').length;
    const words = {};
    marks.forEach((m) => { words[m.word] = (words[m.word] || 0) + 1; });
    const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const filters = [['all', 'All'], ['teacher', 'Teacher sessions'], ['practice', 'AI practice']];
    if (role === 'teacher') filters.push(['review', 'To review']);

    root.innerHTML = `
      <div class="stack">
        <div class="page-head">
          ${params.student ? `<a class="small" href="#/history">${icons.prev.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} All recordings</a>` : ''}
          <h1>${params.student ? esc(studentName) : role === 'teacher' ? 'Recordings' : 'My recordings'}</h1>
          <p class="small muted">${role === 'teacher' ? 'Your sessions and your students’ AI practice, with every mark.' : 'Every practice and teacher session is saved here with its marks.'}</p>
        </div>
        <div class="seg" role="group" aria-label="Filter" style="align-self:flex-start">
          ${filters.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}
        </div>
        <div class="card stack-s">
          <div class="spread"><h2>This week</h2><span class="small muted">${recent.length} ${recent.length === 1 ? 'recording' : 'recordings'} · ${marks.length} ${marks.length === 1 ? 'mark' : 'marks'}</span></div>
          <div class="row-wrap small"><span class="chip gold">${byAi} found by AI</span><span class="chip red">${byTeacher} marked by teacher</span></div>
          ${top.length ? `<div class="eyebrow" style="margin-top:6px">Words to revise</div><div class="row-wrap" lang="ar" dir="rtl">${top.map(([w, n]) => `<span class="quran" style="font-size:20px;padding:0 10px;border-radius:10px;background:var(--red-tint);border-bottom:2px solid var(--red)">${esc(w)}${n > 1 ? ` <span class="xs" style="font-family:var(--sans)">×${n}</span>` : ''}</span>`).join('')}</div>` : ''}
        </div>
        ${list.length ? `<div class="stack-s">${list.map((h) => {
          const g = gradeOf(h);
          const active = (h.marks || []).filter((m) => m.status !== 'dismissed').length;
          const who = role === 'teacher' ? (h.student || '') : (h.teacher || h.review?.teacher || '');
          return `<a class="card row" href="#/history/${link(h.id)}" style="text-decoration:none;color:inherit">
            <div class="icon-tile ${h.kind === 'practice' ? 'gold' : 'solid'}">${h.kind === 'online' ? icons.video : h.kind === 'practice' ? icons.mic : icons.users}</div>
            <div class="grow">
              <h3>${KIND[h.kind] || 'Session'} · ${esc((h.title || '').split(' · ')[0])}</h3>
              <div class="xs muted">${esc(fmtDate(h.created))} · ${fmtTime(h.duration)}${who ? ` · ${esc(who)}` : ''}</div>
              <div class="xs muted">${active} ${active === 1 ? 'mark' : 'marks'}${h.audioId || h.audioPath ? ' · audio saved' : ''}${h.review ? ' · reviewed by teacher' : ''}${!h.synced && isCloud() ? ' · uploading' : ''}</div>
            </div>
            <div style="text-align:right"><b style="font-size:17px">${g ? n(g.total) : n(h.aiScore) + '%'}</b>${g ? `<div class="xs" style="color:var(--green);font-weight:600">${esc(band(g.total).label.split(' ·')[0])}</div>` : ''}</div>
          </a>`;
        }).join('')}</div>` : `<div class="empty card">${filter === 'review' ? 'Nothing waiting for review.' : filter !== 'all' && all.length ? 'No recordings match this filter.' : role === 'teacher' ? 'No recordings yet. Start a session to record one.' : 'No recordings yet. Recite a portion and it will appear here.'}</div>`}
        <p class="xs muted" style="text-align:center">${isCloud() ? 'Saved to your account and available on all your devices.' : 'Saved on this device. Sign in with Google to keep them in your account.'}</p>
      </div>`;
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; paint(); }));
  }
  paint();
}

async function detail(root, id) {
  root.innerHTML = loading('Loading the recording');
  const s = store.get();
  const me = s.profile?.id;
  const h = await records.get(id);
  if (!h) { root.innerHTML = '<div class="empty card">This recording was not found.</div>'; return; }
  const marks = [...(h.marks || [])].sort((a, b) => a.t - b.t);
  const review = h.review;
  const reviewMarks = (review?.marks || []).filter((m) => m.status !== 'dismissed');
  const g = gradeOf(h);
  const decision = review?.decision || h.decision;
  const comment = review?.comment || h.comment;
  const canReview = s.profile?.role === 'teacher' && isCloud() && h.kind === 'practice' && h.studentId && h.studentId !== me;

  const markRow = (m) => `
          <button type="button" class="list-item" data-t="${n(m.t)}" style="background:none;border-left:0;border-right:0;border-bottom:0;width:100%;text-align:left;cursor:pointer;color:inherit;${m.status === 'dismissed' ? 'opacity:.6' : ''}">
            <span class="icon-tile" style="width:38px;height:38px">${icons.play.replace('<svg', '<svg width="15" height="15"')}</span>
            <span class="grow"><span class="quran" style="font-size:20px" lang="ar">${esc(m.word)}</span>
              <span class="small" style="display:block">${esc(MARK_LABEL[m.type] || m.type)} · ayah ${n(m.ayah)} · ${fmtTime(m.t)}</span></span>
            ${markChip(m)}
          </button>`;

  root.innerHTML = `
    <div class="stack">
      <div class="row"><a class="icon-btn" href="#/history" aria-label="Back to recordings">${icons.prev}</a>
        <div class="grow"><div class="eyebrow">${KIND[h.kind] || 'Session'}</div><h1 style="font-size:18px">${esc(h.title)}</h1></div></div>
      <div class="small muted">${esc(fmtDate(h.created))} · ${fmtTime(h.duration)}${h.student ? ` · Student: ${esc(h.student)}` : ''}${h.teacher || review?.teacher ? ` · Teacher: ${esc(h.teacher || review.teacher)}` : ''}</div>
      <div class="card stack-s" id="audioCard">${h.audioId || h.audioPath ? '<div class="spinner"></div>' : '<p class="small muted">No audio was saved for this session.</p>'}</div>
      ${canReview ? `<a class="btn block" href="#/review/${link(h.id)}">${review ? 'Edit your review' : 'Review and grade this practice'}</a>` : ''}
      ${g ? `<div class="card stack-s">
        <div class="spread"><h2>${review && !h.grade ? 'Teacher review' : 'Grade'}</h2><span class="chip ${band(g.total).cls}">${n(g.total)} · ${esc(band(g.total).label)}</span></div>
        ${[['hifz', 'Hifz accuracy', 40], ['tajweed', 'Tajweed', 30], ['makharij', 'Makharij', 20], ['waqf', 'Waqf and fluency', 10]].map(([k, l, max]) => `
          <div class="rubric-row"><span class="small">${l}</span><div class="bar"><i style="width:${Math.round((n(g[k]) / max) * 100)}%"></i></div><span class="small" style="text-align:right"><b>${n(g[k])}</b>/${max}</span></div>`).join('')}
        ${decision ? `<p class="small"><b>Decision:</b> ${decision === 'pass' ? 'Pass, next portion opens' : 'Repeat this portion'}</p>` : ''}
        ${comment ? `<p class="small"><b>Comment:</b> ${esc(comment)}</p>` : ''}
      </div>` : `<div class="card"><div class="spread"><h2>AI score</h2><span class="chip">${n(h.aiScore)}%</span></div></div>`}
      ${reviewMarks.length ? `<div class="card stack-s"><div class="spread"><h2>Teacher's marks</h2><span class="small muted">Tap to hear that moment</span></div>${reviewMarks.sort((a, b) => a.t - b.t).map(markRow).join('')}</div>` : ''}
      <div class="card stack-s">
        <div class="spread"><h2>${reviewMarks.length ? 'Original marks' : 'Marks'}</h2><span class="small muted">Tap to hear that moment</span></div>
        ${marks.length ? marks.map(markRow).join('') : '<p class="small muted">No mistakes were marked.</p>'}
      </div>
      <div class="row-wrap">
        <button class="btn outline" id="share" type="button">${icons.share} Share summary</button>
        ${records.canDelete(h) ? `<button class="btn danger" id="del" type="button">${icons.trash} Delete</button>` : ''}
      </div>
    </div>`;

  let audio = null;
  let objectUrl = null;
  if (h.audioId || h.audioPath) {
    const src = await records.audioSrc(h);
    const card = root.querySelector('#audioCard');
    if (src && card) {
      if (src.local) objectUrl = src.url;
      card.innerHTML = `<audio id="aud" controls preload="metadata" src="${esc(src.url)}"></audio>`;
      fixDuration(card.querySelector('#aud'));
      audio = card.querySelector('#aud');
    } else if (card) card.innerHTML = '<p class="small muted">The audio is not available right now.</p>';
  }

  root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    if (!audio) { toast('No audio saved for this session.'); return; }
    audio.currentTime = Math.max(0, +b.dataset.t / 1000 - 2);
    audio.play().catch(() => {});
  }));

  root.querySelector('#share').addEventListener('click', async () => {
    const all = [...reviewMarks, ...marks].filter((m) => m.status !== 'dismissed' && m.status !== 'suggested');
    const lines = [
      `Recite With Me · ${KIND[h.kind] || 'Session'}`,
      h.title,
      h.student ? `Student: ${h.student}` : '',
      h.teacher || review?.teacher ? `Teacher: ${h.teacher || review.teacher}` : '',
      g ? `Grade: ${g.total}/100 (${band(g.total).label})` : `AI score: ${h.aiScore}%`,
      decision ? `Decision: ${decision === 'pass' ? 'Pass' : 'Repeat'}` : '',
      comment ? `Comment: ${comment}` : '',
      all.length ? 'Mistakes: ' + all.map((m) => `${m.word} (ayah ${m.ayah}, ${MARK_LABEL[m.type] || m.type})`).join('; ') : 'No mistakes marked.',
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Recite With Me', text: lines });
      else { await navigator.clipboard.writeText(lines); toast('Summary copied. Paste it in WhatsApp or email.'); }
    } catch { /* cancelled */ }
  });

  root.querySelector('#del')?.addEventListener('click', async () => {
    if (!confirm('Delete this recording and its marks? This cannot be undone.')) return;
    try { await records.remove(h); location.hash = '#/history'; } catch { toast('Could not delete. Check your connection.'); }
  });

  return () => { if (audio) audio.pause(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
}

// Teacher reviews a student's AI practice: listen, confirm or dismiss AI marks, add marks, grade.
export async function reviewView(root, params) {
  const { RecitationSession } = await import('../session.js');
  const { markingPanel, paintMarking, wireMarking, gradeForm } = await import('./teacher.js');
  root.innerHTML = loading('Loading the recording');
  const h = await records.get(params.id);
  if (!h || !isCloud()) { root.innerHTML = '<div class="empty card">This recording was not found.</div>'; return; }
  root.closest('.view')?.classList.add('wide');
  const session = new RecitationSession({ portions: h.portions, mode: 'teacher', listen: false, record: false, onUpdate: () => paintMarking(root, session) });
  await session.load();
  session.words.forEach((w) => { w.status = 'ok'; });
  session.matcher.cursor = session.words.length;
  const prior = h.review?.marks || h.marks || [];
  session.marks = prior.map((m) => ({ ...m, status: m.source === 'ai' && m.status === 'final' ? 'suggested' : m.status }));
  session.title = h.title;

  root.innerHTML = `
    <div class="stack">
      <div class="row"><a class="icon-btn" href="#/history/${link(h.id)}" aria-label="Back">${icons.prev}</a>
        <div class="grow"><div class="eyebrow">Review · ${esc(h.student || 'Student')}</div><h1 style="font-size:18px">${esc(h.title)}</h1></div>
        <button class="btn" id="gradeBtn" type="button">Grade</button></div>
      <div class="card stack-s" id="audioCard"><div class="spinner"></div></div>
      <p class="small muted">Play the recording. Tap a word to mark it at the current moment; confirm or dismiss what the AI found.</p>
      ${markingPanel({ hint: 'Tap a word to mark it at the current audio time' })}
      <div id="gradeBox"></div>
    </div>`;
  let audio = null;
  const src = await records.audioSrc(h);
  const card = root.querySelector('#audioCard');
  if (src) { card.innerHTML = `<audio id="aud" controls preload="metadata" src="${esc(src.url)}"></audio>`; audio = card.querySelector('#aud'); fixDuration(audio); }
  else card.innerHTML = '<p class="small muted">No audio for this practice. You can still review the marks.</p>';
  session.started = Date.now();
  wireMarking(root, session, { timeNow: () => (audio ? Math.round(audio.currentTime * 1000) : 0) });
  paintMarking(root, session);
  root.querySelector('#gradeBtn').addEventListener('click', () => {
    if (audio) audio.pause();
    root.closest('.view')?.classList.remove('wide');
    session.started = Date.now() - (h.duration || 0);
    gradeForm(root, session, {
      studentName: h.student || 'Student', blob: null, title: 'Grade this practice', note: `AI practice · ${fmtTime(h.duration || 0)}`,
      onSubmit: async ({ grade, comment, decision }) => {
        const marksOut = session.marks.map(({ id: mid, index, type, word, surah, ayah, source, status, t, heard }) => ({ id: mid, index, type, word, surah, ayah, source, status, t, heard }));
        await records.saveReview(h.id, { grade, comment, decision, marks: marksOut, at: Date.now() });
        toast(`Review saved. ${h.student || 'The student'} can see it now.`);
        location.hash = `#/history/${h.id}`;
      },
    });
  });
  return () => { if (audio) audio.pause(); root.closest('.view')?.classList.remove('wide'); };
}
