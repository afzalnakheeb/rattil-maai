// Parent report emails for Recite With Me.
//   POST {action:'confirm', id}  (signed-in student) → sends a confirmation email to a parent address
//   POST {action:'test', id}     (signed-in student) → sends this week's report now to a confirmed address
//   POST {action:'run'}          (hourly, from pg_cron) → sends the weekly (Sunday 8:00) and monthly (1st, 8:00)
//                                reports that are due in each parent's time zone. Safe to call any time:
//                                only due, not-yet-sent reports go out.
//   GET  ?confirm=TOKEN | ?stop=TOKEN → confirms or stops emails, then redirects to rattilmai.com
// Email is sent with Resend (secret RESEND_API_KEY). Without it, nothing is sent and the app says so.

import { buildReport, fmtMinutes } from './lib/report.js';
import { cleanSession } from './lib/clean.js';
import { SURAHS } from './surahs.js';

const SITE = 'https://rattilmai.com';
const URL_ = Deno.env.get('SUPABASE_URL')!;
const FN = `${URL_}/functions/v1/reports`;
const FROM = Deno.env.get('REPORT_FROM') || 'Recite With Me <reports@rattilmai.com>';
const RESEND = Deno.env.get('RESEND_API_KEY') || '';

function key(kind: 'secret' | 'publishable'): string {
  try {
    const all = JSON.parse(Deno.env.get(kind === 'secret' ? 'SUPABASE_SECRET_KEYS' : 'SUPABASE_PUBLISHABLE_KEYS') || '{}');
    if (all.default) return all.default;
  } catch (_) { /* fall back to legacy keys */ }
  return Deno.env.get(kind === 'secret' ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY') || '';
}
const SECRET = key('secret');
const PUBLISHABLE = key('publishable');
const adminHeaders = () => {
  const h: Record<string, string> = { apikey: SECRET, 'Content-Type': 'application/json' };
  if (SECRET.split('.').length === 3) h.Authorization = `Bearer ${SECRET}`; // legacy JWT key
  return h;
};

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...adminHeaders(), ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const rpc = (fn: string, args: Record<string, unknown> = {}) => rest(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });

async function userId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { authorization: auth, apikey: PUBLISHABLE } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}

// ---------- Email ----------
async function send(to: string, subject: string, html: string, text: string, stopUrl?: string) {
  if (!RESEND) return { ok: false, reason: 'email-not-configured' };
  const headers: Record<string, string> = {};
  if (stopUrl) { headers['List-Unsubscribe'] = `<${stopUrl}>`; headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, headers }),
  });
  if (!r.ok) return { ok: false, reason: `send-failed ${r.status} ${(await r.text()).slice(0, 160)}` };
  return { ok: true };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const C = { green: '#18563F', gold: '#A8843A', ink: '#1C2420', muted: '#5E6B64', bg: '#F7F3EA', card: '#FFFFFF', line: '#E8E1D2', red: '#B4402F', redTint: '#FBEDEA' };

function shell(title: string, body: string, footer: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:4px 4px 16px"><span style="font-size:20px;font-weight:800;color:${C.green}">Recite With Me</span> <span style="font-size:20px;font-weight:700;color:${C.gold}" lang="ar" dir="rtl">رتّل معي</span></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:22px">${body}</td></tr>
<tr><td style="padding:16px 6px;font-size:12px;line-height:1.6;color:${C.muted}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function confirmEmail(p: { student_name: string; name: string }, token: string) {
  const who = (p.student_name || 'A student').split(' ')[0];
  const yes = `${FN}?confirm=${token}`;
  const body = `<h1 style="font-size:20px;margin:0 0 10px">Receive ${esc(who)}'s Quran progress reports?</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${esc(who)} added this email address in Recite With Me, a Quran memorization app, to send ${p.name ? esc(p.name) : 'you'} a short report every week and every month: days practised, new pages, teacher grades and comments, mistakes and the words to revise.</p>
<p style="margin:0 0 18px"><a href="${yes}" style="display:inline-block;background:${C.green};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Yes, send me the reports</a></p>
<p style="font-size:13px;color:${C.muted};margin:0">If you don't know ${esc(who)}, ignore this email. Nothing will be sent unless you confirm.</p>`;
  const text = `${who} added this email in Recite With Me to send you weekly and monthly Quran progress reports.\nConfirm: ${yes}\nIf you don't know ${who}, ignore this email.`;
  return { subject: `Confirm: ${who}'s Quran progress reports`, html: shell('Confirm reports', body, 'Recite With Me · rattilmai.com'), text };
}

async function loadStudent(sid: string) {
  const enc = encodeURIComponent(sid);
  const rows = await rest(`sessions?select=*&or=(student_id.eq.${enc},and(owner_id.eq.${enc},kind.eq.practice))&order=created_at.desc&limit=600`);
  const ids = rows.map((r: { id: string }) => r.id);
  const reviews = ids.length ? await rest(`reviews?select=*&session_id=in.(${ids.map((i: string) => `"${i}"`).join(',')})`) : [];
  const teacherIds = [...new Set([...rows.map((r: { teacher_id: string }) => r.teacher_id), ...reviews.map((r: { teacher_id: string }) => r.teacher_id)].filter(Boolean))];
  const people = teacherIds.length ? await rest(`profiles?select=id,name&id=in.(${teacherIds.join(',')})`) : [];
  const nameOf = (id: string) => people.find((p: { id: string }) => p.id === id)?.name || '';
  const sessions = rows.map((r: Record<string, any>) => {
    const d = r.data || {};
    const rv = reviews.find((x: { session_id: string }) => x.session_id === r.id);
    return cleanSession({ ...d, id: r.id, kind: r.kind, title: r.title || d.title || '', created: Date.parse(r.created_at), ownerId: r.owner_id, studentId: r.student_id, teacherId: r.teacher_id,
      teacher: d.teacher || nameOf(r.teacher_id), review: rv ? { ...rv.data, teacherId: rv.teacher_id, teacher: nameOf(rv.teacher_id), updated: Date.parse(rv.updated_at) } : null });
  });
  const st = await rest(`user_state?select=data&user_id=eq.${enc}`);
  return { sessions, state: st?.[0]?.data || {} };
}

// The time zone's wall clock, as fields.
function local(tz: string, at = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day, h = +p.hour, mi = +p.minute;
  return { y, m, d, h, weekday: p.weekday, offsetMs: Date.UTC(y, m - 1, d, h, mi) - Math.floor(at.getTime() / 60000) * 60000 };
}

function reportEmail(kind: 'week' | 'month', student: string, recipientName: string, data: { sessions: any[]; state: any }, tz: string, stopUrl: string) {
  const L = local(tz);
  // The server runs in UTC: shift times so the report's day boundaries are the family's local days.
  const sessions = data.sessions.map((s) => ({ ...s, created: s.created + L.offsetMs }));
  const now = new Date(Date.UTC(L.y, L.m - 1, L.d) - 12 * 3600e3); // yesterday, local
  const R = buildReport({ sessions, state: data.state, kind, offset: 0, now });
  const prev = buildReport({ sessions, state: data.state, kind, offset: 1, now });
  const P = R.period;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions = {}) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC', ...o });
  const range = `${fmt(P.from)} – ${fmt(new Date(P.to.getTime() - 1), { year: 'numeric' })}`;
  const first = (student || 'Your child').split(' ')[0];
  const parts: string[] = [];
  parts.push(R.count ? `${first} recited ${R.count} ${R.count === 1 ? 'time' : 'times'} (${fmtMinutes(R.minutes, R.anyTime)}) on ${R.activeDays} of ${P.days} days` : `${first} did not record a recitation this ${kind}`);
  if (R.pagesNew) parts.push(`learned ${R.pagesNew} new ${R.pagesNew === 1 ? 'page' : 'pages'}`);
  if (R.graded.length) parts.push(`was graded ${R.graded.length} ${R.graded.length === 1 ? 'time' : 'times'} by the teacher (average ${R.gradeAvg}/100)`);
  const summary = `${parts.join(', ')}.`;
  const trend = (a: number, b: number, upGood = true) => {
    if (a === b) return '';
    const good = upGood ? a > b : a < b;
    return `<div style="font-size:11px;font-weight:700;color:${good ? C.green : C.red}">${a > b ? '▲' : '▼'} ${Math.abs(a - b)} vs last ${kind}</div>`;
  };
  const stat = (v: string, label: string, t = '') => `<td style="padding:6px;width:33%;vertical-align:top"><div style="background:${C.bg};border-radius:12px;padding:10px 12px"><div style="font-size:20px;font-weight:800">${v}</div><div style="font-size:12px;color:${C.muted}">${label}</div>${t}</div></td>`;
  const ref = (s: number, a: number) => `${SURAHS[s - 1] || `Surah ${s}`} ${s}:${a}`;
  const words = R.topWords.slice(0, 8).map((w: any) => `<tr><td style="padding:6px 0;font-size:20px;font-family:'Amiri Quran','Traditional Arabic',serif" lang="ar" dir="rtl">${esc(w.word)}</td><td style="padding:6px 8px;font-size:13px;color:${C.muted}">${esc(ref(w.surah, w.ayah))}</td><td style="padding:6px 0;font-size:13px;font-weight:700;text-align:right">${w.count}×</td></tr>`).join('');
  const feedback = R.graded.slice(0, 5).map((g: any) => `<tr><td style="padding:8px 0;border-top:1px solid ${C.line}"><b style="color:${g.decision === 'repeat' ? C.red : C.green}">${g.total}/100</b> · ${g.decision === 'pass' ? 'Pass' : g.decision === 'repeat' ? 'Repeat' : ''}${g.teacher ? ` · ${esc(g.teacher)}` : ''}<div style="font-size:12px;color:${C.muted}">${esc(g.title.split(' · ')[0])}</div>${g.comment ? `<div style="font-size:14px;margin-top:4px">“${esc(g.comment)}”</div>` : ''}</td></tr>`).join('');
  const types = Object.entries(R.types).filter(([, n]) => (n as number) > 0).map(([t, n]) => `${({ wrong: 'Wrong word', skipped: 'Skipped word', extra: 'Extra word', teacher: 'Marked by teacher' } as Record<string, string>)[t] || t}: ${n}`).join(' · ');
  const body = `<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.gold};font-weight:700;margin:0">${kind === 'week' ? 'Weekly' : 'Monthly'} report · ${esc(range)}</p>
<h1 style="font-size:22px;margin:6px 0 10px">${esc(student || 'Your child')}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${esc(summary)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${stat(`${R.activeDays}/${P.days}`, 'Active days', trend(R.activeDays, prev.activeDays))}${stat(String(R.pagesNew), 'New pages', trend(R.pagesNew, prev.pagesNew))}${stat(R.gradeAvg === null ? '–' : String(R.gradeAvg), 'Teacher grade')}
</tr><tr>
${stat(String(R.count), 'Recordings', trend(R.count, prev.count))}${stat(R.aiAvg === null ? '–' : `${R.aiAvg}%`, 'AI accuracy')}${stat(String(R.mistakeTotal), 'Mistakes', trend(R.mistakeTotal, prev.mistakeTotal, false))}
</tr></table>
<p style="font-size:13px;color:${C.muted};margin:10px 0 0">Plan: new lesson ${R.plan.sabaq} · recent revision ${R.plan.sabqi} · old revision ${R.plan.manzil} days · ${R.pagesTotal} pages memorized · ${R.streak}-day streak</p>
${types ? `<p style="font-size:13px;margin:8px 0 0"><b>Mistakes:</b> ${esc(types)}</p>` : ''}
${words ? `<h2 style="font-size:16px;margin:18px 0 4px">Words to revise</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${words}</table>` : ''}
${feedback ? `<h2 style="font-size:16px;margin:18px 0 4px">Teacher feedback</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${feedback}</table>` : ''}
<p style="margin:20px 0 0"><a href="${SITE}/#/report?range=${kind}" style="display:inline-block;background:${C.green};color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:12px">Open the full report</a></p>`;
  const footer = `You receive this because ${esc(first)} added ${recipientName ? esc(recipientName) : 'this address'} in Recite With Me and you confirmed it.<br><a href="${stopUrl}" style="color:${C.muted}">Stop these emails</a> · rattilmai.com`;
  const text = `${kind === 'week' ? 'Weekly' : 'Monthly'} report · ${range}\n${student}\n\n${summary}\n\nActive days ${R.activeDays}/${P.days} · New pages ${R.pagesNew} · Recordings ${R.count} · Mistakes ${R.mistakeTotal}${R.gradeAvg === null ? '' : ` · Teacher grade ${R.gradeAvg}`}\n\nOpen the full report: ${SITE}/#/report?range=${kind}\nStop these emails: ${stopUrl}`;
  return { subject: `${first}'s Quran ${kind === 'week' ? 'week' : 'month'}: ${R.activeDays}/${P.days} days, ${R.pagesNew} new ${R.pagesNew === 1 ? 'page' : 'pages'}`, html: shell('Quran progress report', body, footer), text };
}

function due(r: any, at = new Date()) {
  const L = local(r.tz || 'Asia/Dubai', at);
  const out: ('week' | 'month')[] = [];
  const since = (t: string | null) => (t ? at.getTime() - Date.parse(t) : Infinity);
  if (r.weekly && L.weekday === 'Sun' && L.h >= 8 && since(r.last_weekly_at) > 5 * 864e5) out.push('week');
  if (r.monthly && L.d === 1 && L.h >= 8 && since(r.last_monthly_at) > 20 * 864e5) out.push('month');
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url);
  try {
    if (req.method === 'GET') {
      const c = u.searchParams.get('confirm'); const s = u.searchParams.get('stop');
      if (c && /^[a-f0-9]{48}$/.test(c)) { const r = await rpc('report_confirm', { tok: c }); return redirect(`${SITE}/parents/${r?.ok ? 'confirmed' : 'invalid'}/`); }
      if (s && /^[a-f0-9]{48}$/.test(s)) { const r = await rpc('report_unsubscribe', { tok: s }); return redirect(`${SITE}/parents/${r?.ok ? 'stopped' : 'invalid'}/`); }
      return redirect(`${SITE}/parents/invalid/`);
    }
    // One-click unsubscribe from mail apps (RFC 8058) posts to the stop link.
    if (req.method === 'POST' && u.searchParams.get('stop')) {
      const s = u.searchParams.get('stop')!;
      if (/^[a-f0-9]{48}$/.test(s)) await rpc('report_unsubscribe', { tok: s });
      return json({ ok: true });
    }
    const body = await req.json().catch(() => ({}));
    if (body.action === 'status') return json({ email: !!RESEND });
    if (body.action === 'run') {
      const list = await rpc('report_active_recipients');
      const at = new Date();
      let sent = 0; const errors: string[] = [];
      const cache = new Map<string, any>();
      for (const r of list || []) {
        for (const kind of due(r, at)) {
          if (!RESEND) { errors.push('email-not-configured'); break; }
          if (!cache.has(r.student_id)) cache.set(r.student_id, await loadStudent(r.student_id));
          const e = reportEmail(kind, r.student_name, r.name, cache.get(r.student_id), r.tz, `${FN}?stop=${r.token}`);
          const res = await send(r.email, e.subject, e.html, e.text, `${FN}?stop=${r.token}`);
          if (res.ok) { await rpc('report_mark_sent', { rid: r.id, kind }); sent++; } else errors.push(res.reason || 'send-failed');
          if (sent >= 300) break;
        }
      }
      return json({ checked: (list || []).length, sent, errors: [...new Set(errors)].slice(0, 5) });
    }
    const uid = await userId(req);
    if (!uid) return json({ error: 'sign-in required' }, 401);
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'bad-id' }, 400);
    if (body.action === 'confirm') {
      const p = await rpc('report_prepare_confirm', { rid: id, uid });
      if (p?.error) return json({ error: p.error }, 400);
      const e = confirmEmail(p, p.token);
      const res = await send(p.email, e.subject, e.html, e.text);
      return json(res.ok ? { ok: true } : { error: res.reason }, res.ok ? 200 : 503);
    }
    if (body.action === 'test') {
      const p = await rpc('report_prepare_test', { rid: id, uid });
      if (p?.error) return json({ error: p.error }, 400);
      const [r] = (await rest(`report_recipients?select=id,email,name,tz&id=eq.${id}`)) || [];
      const prof = await rest(`profiles?select=name&id=eq.${uid}`);
      const tok = (await rpc('report_active_recipients')).find((x: { id: string }) => x.id === id)?.token || '';
      const e = reportEmail(body.kind === 'month' ? 'month' : 'week', prof?.[0]?.name || '', r?.name || '', await loadStudent(uid), r?.tz || 'Asia/Dubai', `${FN}?stop=${tok}`);
      const res = await send(r.email, `Sample · ${e.subject}`, e.html, e.text, `${FN}?stop=${tok}`);
      return json(res.ok ? { ok: true } : { error: res.reason }, res.ok ? 200 : 503);
    }
    return json({ error: 'unknown-action' }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: 'server-error' }, 500);
  }
});
