// #/report?range=week|month&o=0&student=<uuid>
// Weekly and monthly progress report for parents: activity, plan, mistakes, teacher feedback, adhkar.

import * as store from '../store.js';
import * as cloud from '../cloud.js';
import * as records from '../records.js';
import { isCloud } from '../account.js';
import { getMeta } from '../quran.js';
import { buildReport, fmtMinutes } from '../report.js';
import { MARK_LABEL } from '../session.js';
import { SETS } from '../adhkar.js';
import { esc, loading, errorBox, toast, band, fmtPages } from '../ui.js';
import { icons } from '../icons.js';
import { avatar } from './teacher.js';
import { parentEmailsSlot, fillParentEmails } from './parents.js';

const TYPE_LABEL = { wrong: 'Wrong word', skipped: 'Skipped word', extra: 'Extra word', teacher: 'Marked by teacher' };
const fmtDay = (d, o = {}) => d.toLocaleDateString([], { day: 'numeric', month: 'short', ...o });

export default async function reportView(root, params) {
  const s = store.get();
  const role = s.profile?.role;
  const kind = params.range === 'month' ? 'month' : 'week';
  const offset = Math.max(0, parseInt(params.o, 10) || 0);
  const go = (patch) => {
    const q = new URLSearchParams({ range: kind, o: String(offset), ...(params.student ? { student: params.student } : {}), ...patch });
    location.hash = `#/report?${q}`;
  };

  // A teacher without a chosen student picks one first.
  if (role === 'teacher' && !params.student) {
    if (!isCloud()) { root.innerHTML = '<div class="empty card">Sign in with Google to see your students’ reports.</div>'; return; }
    root.innerHTML = loading('Loading students');
    let students = [];
    try { students = await cloud.myStudents(); } catch { root.innerHTML = errorBox('Could not load your students. Check your connection.'); return; }
    root.innerHTML = `<div class="stack"><div class="page-head"><h1>Reports for parents</h1><p class="small muted">Choose a student to see their weekly or monthly report.</p></div>
      <div class="card stack-s">${students.length ? students.map((st) => `<a class="list-item" href="#/report?student=${encodeURIComponent(st.id)}" style="text-decoration:none;color:inherit">${avatar(st)}<div class="grow"><h3>${esc(st.name)}</h3><div class="xs muted">${esc(st.email || '')}</div></div><span class="muted">${icons.next.replace('<svg', '<svg width="18" height="18"')}</span></a>`).join('') : '<p class="small muted">No linked students yet.</p>'}</div></div>`;
    return;
  }

  root.innerHTML = loading('Preparing the report');
  let sessions = [];
  let state = s;
  let name = s.profile?.name || '';
  try {
    if (params.student && isCloud()) {
      const [list, students] = await Promise.all([records.list({ studentId: params.student }), cloud.myStudents()]);
      const st = students.find((x) => x.id === params.student);
      if (!st) { root.innerHTML = errorBox('This student is not in your class.'); return; }
      sessions = list;
      state = st.state?.data || {};
      name = st.name || 'Student';
    } else {
      const me = s.profile?.id;
      sessions = (await records.list()).filter((h) => !me || !h.studentId || h.studentId === me || h.kind === 'practice');
    }
  } catch {
    sessions = s.history;
  }
  let names = {};
  try { const meta = await getMeta(); meta.surahs.forEach((x) => { names[x.number] = x.english; }); } catch { names = {}; }
  const ref = (surah, ayah) => `${names[surah] ? `${names[surah]} ` : 'Surah '}${surah}:${ayah}`;

  const R = buildReport({ sessions, state, kind, offset });
  const prev = buildReport({ sessions, state, kind, offset: offset + 1 });
  const P = R.period;
  const lastDay = new Date(P.to.getTime() - 1);
  const range = `${fmtDay(P.from)} – ${fmtDay(lastDay, { year: 'numeric' })}`;
  const first = (name || 'Your child').split(' ')[0];
  // upGood: true when a rise is good news (time, recordings); false for mistakes.
  const delta = (a, b, unit = '', upGood = true) => {
    if (b === 0 && a === 0) return '';
    const d = a - b;
    if (d === 0) return '<span class="xs muted">same as before</span>';
    const good = upGood ? d > 0 : d < 0;
    return `<span class="xs" style="color:${good ? 'var(--green)' : 'var(--red-ink)'};font-weight:600">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs previous ${kind}</span>`;
  };

  // Summary sentence
  const parts = [];
  parts.push(R.count ? `${first} recited ${R.count} ${R.count === 1 ? 'time' : 'times'} (${fmtMinutes(R.minutes, R.anyTime)}) on ${R.activeDays} of ${P.days} days` : `${first} did not record a recitation in this period`);
  if (R.pagesNew) parts.push(`learned ${fmtPages(R.pagesNew)} new ${R.pagesNew === 1 ? 'page' : 'pages'}`);
  if (R.graded.length) parts.push(`was graded ${R.graded.length} ${R.graded.length === 1 ? 'time' : 'times'} by the teacher (average ${R.gradeAvg}/100)`);
  const summary = `${parts.join(', ')}.`;

  // Activity chart: minutes per day
  const maxM = Math.max(10, ...P.keys.map((k) => R.perDay[k].minutes));
  const bw = 600 / P.days;
  const bars = P.list.map((d, i) => {
    const m = R.perDay[P.keys[i]].minutes;
    const h = Math.round((m / maxM) * 120);
    const showLbl = P.days <= 7 || i % 5 === 0 || i === P.days - 1;
    const lbl = P.days <= 7 ? d.toLocaleDateString([], { weekday: 'short' }) : String(d.getDate());
    return `<g><rect class="rp-bar ${m > 0 ? '' : 'empty'}" x="${(i * bw + bw * 0.18).toFixed(1)}" y="${140 - Math.max(h, 2)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(h, 2)}" rx="${Math.min(6, bw * 0.2).toFixed(1)}"><title>${esc(fmtDay(d))}: ${Math.round(m)} min</title></rect>${showLbl ? `<text class="rp-lbl" x="${(i * bw + bw / 2).toFixed(1)}" y="168">${esc(lbl)}</text>` : ''}</g>`;
  }).join('');

  const typeChips = Object.entries(R.types).filter(([, n]) => n > 0).map(([t, n]) => `<span class="chip ${t === 'teacher' ? 'red' : t === 'skipped' ? 'gold' : 'plain'}">${esc(TYPE_LABEL[t] || MARK_LABEL[t] || t)} · ${n}</span>`).join('');
  const dayLabel = (n) => `${n}/${P.days}`;

  root.innerHTML = `
    <style>
      .rp-bar { fill: var(--primary); } .rp-bar.empty { fill: var(--line-2, var(--line)); opacity: .9; }
      .rp-lbl { fill: var(--muted); font-size: 19px; text-anchor: middle; font-family: var(--sans); }
      .rp-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      @media (max-width: 420px) { .rp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .rp-word { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }
      .rp-word:first-child { border-top: 0; }
      .rp-word .quran { font-size: 24px; min-width: 84px; text-align: center; padding: 0 8px; border-radius: 10px; background: var(--red-tint); border-bottom: 2px solid var(--red); }
      .rp-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      @media print {
        .topbar, .tabbar, .no-print, #ring, .toast { display: none !important; }
        body, html { background: #fff !important; }
        .view { padding: 0 !important; max-width: none !important; }
        .card, .hero { box-shadow: none !important; break-inside: avoid; }
        .card { border: 1px solid #ddd !important; }
        /* Print in black on white: the dark summary panel would print as white on white. */
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .hero, .rp-hero { background: #fff !important; color: #111 !important; border: 1px solid #ccc !important; }
        .hero *, .rp-hero * { color: #111 !important; }
        .hero-stats > div, .rp-hero .hero-stats > div { background: #f3f3f3 !important; }
      }
    </style>
    <div class="stack">
      <div class="rp-head-row">
        <div class="page-head"><div class="eyebrow">${kind === 'month' ? 'Monthly' : 'Weekly'} report for parents</div><h1>${esc(name || 'Progress report')}</h1><div class="small muted">${esc(range)}</div></div>
        <div class="row no-print" style="gap:6px">
          <button class="icon-btn" type="button" id="older" aria-label="Previous ${kind}">${icons.prev}</button>
          <button class="icon-btn" type="button" id="newer" aria-label="Next ${kind}" ${offset === 0 ? 'disabled' : ''}>${icons.next}</button>
        </div>
      </div>
      ${params.student ? '' : parentEmailsSlot()}
      <div class="seg no-print" role="group" aria-label="Report period" style="align-self:flex-start">
        <button type="button" data-range="week" aria-pressed="${kind === 'week'}">Weekly</button>
        <button type="button" data-range="month" aria-pressed="${kind === 'month'}">Monthly</button>
      </div>

      <section class="hero">
        <div class="eyebrow">Summary</div>
        <p style="margin-top:6px;font-size:16px;line-height:1.5">${esc(summary)}</p>
        <div class="hero-stats">
          <div><b>${R.activeDays}/${P.days}</b><span>Active days</span></div>
          <div><b>${fmtPages(R.pagesTotal)}</b><span>Pages memorized</span></div>
          <div><b>${R.streak}</b><span>Day streak</span></div>
        </div>
      </section>

      <div class="rp-grid">
        <div class="stat"><b>${esc(fmtMinutes(R.minutes, R.anyTime))}</b><span>Recitation time</span><div>${delta(R.minutes, prev.minutes, ' min')}</div></div>
        <div class="stat"><b>${R.count}</b><span>Recordings</span><div>${delta(R.count, prev.count)}</div></div>
        <div class="stat"><b>${fmtPages(R.pagesNew)}</b><span>New pages</span><div>${delta(R.pagesNew, prev.pagesNew)}</div></div>
        <div class="stat"><b>${R.aiAvg === null ? '–' : `${R.aiAvg}%`}</b><span>Words correct (AI check)</span></div>
        <div class="stat"><b>${R.gradeAvg === null ? '–' : R.gradeAvg}</b><span>Teacher grade</span></div>
        <div class="stat"><b>${R.mistakeTotal}</b><span>Mistakes</span><div>${delta(R.mistakeTotal, prev.mistakeTotal, '', false)}</div></div>
      </div>

      <div class="card stack-s">
        <div class="spread"><h2>Daily recitation</h2><span class="xs muted">minutes per day</span></div>
        <svg viewBox="0 0 600 176" role="img" aria-label="Minutes recited each day" style="width:100%;height:auto">${bars}</svg>
      </div>

      <div class="card stack-s">
        <h2>Daily plan</h2>
        <div class="row-wrap small">
          <span class="chip">${icons.book.replace('<svg', '<svg width="14" height="14"')} New lesson · ${dayLabel(R.plan.sabaq)} days</span>
          <span class="chip plain">Recent revision · ${dayLabel(R.plan.sabqi)}</span>
          ${R.plan.manzil || R.pagesTotal > 10 ? `<span class="chip gold">Old revision · ${dayLabel(R.plan.manzil)}</span>` : ''}
        </div>
        <p class="xs muted">A day counts when that part was recited with the AI at 90% or better.</p>
      </div>

      <div class="card stack-s">
        <div class="spread"><h2>Mistakes</h2><span class="small muted">${R.mistakeTotal} in this ${kind}</span></div>
        ${typeChips ? `<div class="row-wrap">${typeChips}</div>` : '<p class="small muted">No mistakes recorded. Mashallah.</p>'}
        ${R.topWords.length ? `<div class="eyebrow" style="margin-top:8px">Words to revise</div>
          <div>${R.topWords.map((w) => `<div class="rp-word"><span class="quran" lang="ar" dir="rtl">${esc(w.word)}</span><span class="grow small">${esc(ref(w.surah, w.ayah))}<span class="xs muted" style="display:block">${Object.entries(w.types).map(([t, n]) => `${esc(TYPE_LABEL[t] || t)}${n > 1 ? ` ×${n}` : ''}`).join(' · ')}</span></span><b>${w.count}×</b></div>`).join('')}</div>` : ''}
        ${R.topSurahs.length ? `<div class="eyebrow" style="margin-top:8px">Where most mistakes were</div><div class="row-wrap">${R.topSurahs.map((x) => `<span class="chip plain">${esc(names[x.surah] || `Surah ${x.surah}`)} · ${x.count}</span>`).join('')}</div>` : ''}
      </div>

      <div class="card stack-s">
        <div class="spread"><h2>Teacher feedback</h2>${R.graded.length ? `<span class="small muted">${R.passes} pass · ${R.repeats} repeat</span>` : ''}</div>
        ${R.graded.length ? R.graded.map((g) => `
          <a class="list-item" href="#/history/${encodeURIComponent(g.id)}" style="text-decoration:none;color:inherit;align-items:flex-start">
            <div class="icon-tile ${g.decision === 'repeat' ? 'red' : 'solid'}" style="font-weight:700">${g.total}</div>
            <div class="grow"><h3>${esc((g.title || '').split(' · ')[0] || 'Session')}</h3>
              <div class="xs muted">${esc(fmtDay(new Date(g.created), { weekday: 'short' }))}${g.teacher ? ` · ${esc(g.teacher)}` : ''} · ${esc(band(g.total).label)} · ${g.decision === 'pass' ? 'Pass' : g.decision === 'repeat' ? 'Repeat' : ''}</div>
              ${g.comment ? `<p class="small" style="margin-top:4px">“${esc(g.comment)}”</p>` : ''}</div>
          </a>`).join('') : '<p class="small muted">No teacher grades in this period.</p>'}
      </div>

      <div class="card stack-s">
        <h2>Adhkar</h2>
        ${SETS.some((set) => R.adhkarDays[set.id]) ? `<div class="row-wrap">${SETS.map((set) => `<span class="chip ${R.adhkarDays[set.id] ? '' : 'plain'}">${esc(set.label)} · ${dayLabel(R.adhkarDays[set.id])}</span>`).join('')}</div>` : '<p class="small muted">No full adhkar set completed in this period.</p>'}
      </div>

      <div class="row-wrap no-print">
        <button class="btn" type="button" id="share">${icons.share} Share with parents</button>
        <button class="btn outline" type="button" id="print">Print or save as PDF</button>
      </div>
      <p class="xs muted" style="text-align:center">Recite With Me · rattilmai.com · generated ${esc(new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}</p>
    </div>`;

  root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => go({ range: b.dataset.range, o: '0' })));
  root.querySelector('#older').addEventListener('click', () => go({ o: String(offset + 1) }));
  root.querySelector('#newer').addEventListener('click', () => { if (offset > 0) go({ o: String(offset - 1) }); });
  root.querySelector('#print').addEventListener('click', () => window.print());
  if (!params.student) fillParentEmails(root);
  root.querySelector('#share').addEventListener('click', async () => {
    const lines = [
      `Recite With Me · ${kind === 'month' ? 'Monthly' : 'Weekly'} report`,
      `${name} · ${range}`,
      '',
      summary,
      `Active days: ${R.activeDays}/${P.days} · Streak: ${R.streak} days · Pages memorized: ${R.pagesTotal}`,
      `Daily plan: new lesson ${R.plan.sabaq}/${P.days}, recent revision ${R.plan.sabqi}/${P.days}, old revision ${R.plan.manzil}/${P.days}`,
      R.aiAvg !== null ? `AI accuracy: ${R.aiAvg}%` : '',
      R.graded.length ? `Teacher grades: ${R.graded.map((g) => `${g.total}${g.decision ? ` (${g.decision})` : ''}`).join(', ')}` : '',
      ...R.graded.filter((g) => g.comment).slice(0, 3).map((g) => `Teacher: “${g.comment}”`),
      R.mistakeTotal ? `Mistakes: ${R.mistakeTotal} (${Object.entries(R.types).filter(([, n]) => n).map(([t, n]) => `${(TYPE_LABEL[t] || t).toLowerCase()} ${n}`).join(', ')})` : 'No mistakes recorded.',
      R.topWords.length ? `Words to revise: ${R.topWords.slice(0, 6).map((w) => `${w.word} (${ref(w.surah, w.ayah)})`).join(', ')}` : '',
      `Adhkar: ${SETS.map((set) => `${set.label.toLowerCase()} ${R.adhkarDays[set.id]}/${P.days}`).join(', ')}`,
    ].filter((x) => x !== '').join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Recite With Me report', text: lines });
      else { await navigator.clipboard.writeText(lines); toast('Report copied. Paste it in WhatsApp or email.'); }
    } catch { /* cancelled */ }
  });
}
