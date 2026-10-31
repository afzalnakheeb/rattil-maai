// Private area: rattilmai.com/decks (pitch deck and film), behind a passcode.
// The passcode is checked on the server. Only a keyed fingerprint of it is stored here; the key lives in
// the DECKS_KEY environment variable on Vercel, so this public file does not reveal the passcode.
// A correct passcode sets a signed, HttpOnly cookie for 30 days.

export const config = { matcher: ['/decks', '/decks/:path*'] };

const EXPECTED = '4ad136b55180829ffed1be59601dcd096dceceaf3935809b93a1dc387c3920d8';
const COOKIE = 'rwm_decks';

const enc = new TextEncoder();
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function readCookie(req, name) {
  const all = req.headers.get('cookie') || '';
  const m = all.split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}

const HEAD = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' };

const TEXT = {
  en: { lang: 'en', dir: 'ltr', home: '/decks/', title: 'Recite With Me · Decks', ogTitle: 'Recite With Me · Film and pitch deck',
    desc: 'A 3-minute narrated film and the product deck for Recite With Me, the Quran memorization app. Passcode required.',
    ogDesc: 'A 3-minute narrated film and the product deck. Enter the passcode to open.', img: 'decks-share.jpg', alt: 'Recite With Me: film and pitch deck',
    h1: 'Recite With Me · Decks', p: 'The pitch deck and the film are private. Enter the passcode to open them.',
    wrong: 'That passcode is not right. Try again.', label: 'Passcode', btn: 'Open', other: '<a href="/decks/ar/" lang="ar">العربية</a>' },
  ar: { lang: 'ar', dir: 'rtl', home: '/decks/ar/', title: 'رتّل معي · الفيلم والعرض', ogTitle: 'رتّل معي · الفيلم التعريفي والعرض التقديمي',
    desc: 'فيلم تعريفي بصوت راوٍ وعرض تقديمي عن «رتّل معي»، تطبيق حفظ القرآن الكريم. يلزم رمز الدخول.',
    ogDesc: 'فيلم تعريفي قصير وعرض تقديمي عن التطبيق. أدخل رمز الدخول لفتحهما.', img: 'decks-share-ar.jpg', alt: 'رتّل معي: الفيلم والعرض التقديمي',
    h1: 'رتّل معي · الفيلم والعرض', p: 'الفيلم التعريفي والعرض التقديمي خاصّان. أدخل رمز الدخول لفتحهما.',
    wrong: 'رمز الدخول غير صحيح. حاول مرة أخرى.', label: 'رمز الدخول', btn: 'فتح', other: '<a href="/decks/" lang="en">English</a>' },
};

function lockPage(wrong = false, status = 200, lang = 'en') {
  const T = TEXT[lang] || TEXT.en;
  const html = `<!doctype html><html lang="${T.lang}" dir="${T.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${T.title}</title><meta name="robots" content="noindex,nofollow">
<meta name="description" content="${T.desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Recite With Me · رتّل معي">
<meta property="og:title" content="${T.ogTitle}">
<meta property="og:description" content="${T.ogDesc}">
<meta property="og:url" content="https://rattilmai.com${T.home}">
<meta property="og:image" content="https://rattilmai.com/icons/${T.img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${T.alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://rattilmai.com/icons/${T.img}">
<style>
:root{--bg:#051510;--card:#0C241B;--ivory:#F4EFE2;--muted:rgba(244,239,226,.72);--line:rgba(244,239,226,.18);--gold:#D9B66A;--red:#F0A08C;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(900px 500px at 80% -10%,rgba(47,143,104,.3),transparent 60%),var(--bg);color:var(--ivory);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",Tahoma,sans-serif;padding:24px max(16px,env(safe-area-inset-right)) 24px max(16px,env(safe-area-inset-left))}
form{width:100%;max-width:380px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px;display:grid;gap:16px}
img{width:56px;height:56px;border-radius:15px}h1{margin:0;font-size:24px;line-height:1.3}p{margin:0;color:var(--muted);font-size:15px}
label{font-size:14px;font-weight:600}input{width:100%;min-height:52px;border-radius:14px;border:1.5px solid #6B7F74;background:#08190F;color:var(--ivory);font-size:24px;letter-spacing:.35em;text-align:center;padding:8px;direction:ltr}
input:focus{outline:3px solid var(--gold);outline-offset:2px}button{min-height:52px;border:0;border-radius:999px;background:var(--gold);color:#2B2004;font-weight:700;font-size:17px;cursor:pointer;font-family:inherit}
button:focus-visible{outline:3px solid var(--ivory);outline-offset:2px}.err{color:var(--red);font-weight:600}.other{font-size:14px;text-align:center}.other a{color:var(--muted)}
</style></head><body>
<form method="post" action="/decks/unlock/" autocomplete="off">
<img src="/icons/icon-192.png" alt="">
<h1>${T.h1}</h1>
<p>${T.p}</p>
${wrong ? `<p class="err" role="alert">${T.wrong}</p>` : ''}
<label for="code">${T.label}</label>
<input id="code" name="code" type="password" inputmode="numeric" maxlength="32" required autofocus>
<input type="hidden" name="lang" value="${T.lang}">
<button type="submit">${T.btn}</button>
<p class="other">${T.other}</p>
</form></body></html>`;
  return new Response(html, { status, headers: HEAD });
}

export default async function middleware(request) {
  const key = process.env.DECKS_KEY;
  if (!key) return new Response('The decks area is not configured yet.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const session = await hmac(key, 'session-v1');

  if (path === '/decks/unlock') {
    if (request.method !== 'POST') return Response.redirect(new URL('/decks/', request.url), 303);
    let code = '';
    let lang = 'en';
    try {
      const form = await request.formData();
      code = String(form.get('code') || '').trim().slice(0, 32);
      lang = form.get('lang') === 'ar' ? 'ar' : 'en';
    } catch { /* bad form */ }
    if (!same(await hmac(key, 'pass:' + code), EXPECTED)) {
      await new Promise((r) => setTimeout(r, 900)); // slows down guessing
      return lockPage(true, 401, lang);
    }
    return new Response(null, { status: 303, headers: {
      Location: TEXT[lang].home, 'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE}=${session}; Path=/decks; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
    } });
  }
  if (path === '/decks/lock') {
    return new Response(null, { status: 303, headers: { Location: '/decks/', 'Cache-Control': 'no-store', 'Set-Cookie': `${COOKIE}=; Path=/decks; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  const unlocked = same(readCookie(request, COOKIE), session);

  // Download links carry their own signed key, valid for 6 hours. A phone's download manager fetches the
  // file again outside the browser, without the cookie, so a cookie alone would hand it the "Locked" text.
  if (path === '/decks/token') {
    if (!unlocked) return new Response('Locked', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
    const t = `${exp}.${await hmac(key, 'dl-v1:' + exp)}`;
    return new Response(JSON.stringify({ t }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  if (unlocked) return; // unlocked: serve the file
  if (path.startsWith('/decks/media/')) {
    const [exp, sig] = String(url.searchParams.get('t') || '').split('.');
    if (/^\d{10}$/.test(exp || '') && +exp > Date.now() / 1000 && same(sig, await hmac(key, 'dl-v1:' + exp))) return;
  }
  if (path === '/decks') return lockPage(false);
  if (path === '/decks/ar') return lockPage(false, 200, 'ar');
  return new Response('Locked', { status: 401, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
