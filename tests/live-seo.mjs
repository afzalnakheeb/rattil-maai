// Live SEO / AEO / GEO and security-header check of https://rattilmai.com.
import { chromium } from 'playwright';
const BASE = 'https://rattilmai.com';
const results = []; const check = (n, ok, x = '') => { results.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`); };
const PAGES = ['/', '/about/', '/faq/', '/ar/', '/teach/', '/privacy/', '/terms/'];
for (const p of PAGES) {
  const r = await fetch(BASE + p, { redirect: 'follow' });
  const html = await r.text();
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const canon = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || '';
  const desc = (html.match(/name="description" content="([^"]+)"/) || [])[1] || '';
  let ld = null; try { ld = JSON.parse((html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]); } catch { /* bad */ }
  const types = ld ? (ld['@graph'] || [ld]).map((x) => x['@type']).join(',') : 'none';
  check(`${p} 200, title, description, canonical, JSON-LD`, r.status === 200 && title.length > 10 && desc.length > 50 && canon.startsWith(BASE) && !!ld, `${r.status} · ${types} · ${title.slice(0, 50)}`);
  if (p === '/') {
    const h = r.headers;
    check('Security headers (CSP, nosniff, frame, HSTS, permissions)', !!h.get('content-security-policy') && h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY' && !!h.get('strict-transport-security') && !!h.get('permissions-policy'));
    check('Home has crawlable text before JavaScript', /A free app to memorize the Quran/.test(html));
    check('Open Graph image is the 1200x630 card', /og-image\.jpg/.test(html));
  }
  if (p === '/faq/') check('FAQ has FAQPage structured data', types.includes('FAQPage'));
  if (p === '/ar/') check('Arabic page is lang="ar" dir="rtl"', /<html lang="ar" dir="rtl">/.test(html));
}
for (const [p, re] of [['/robots.txt', /Sitemap: https:\/\/rattilmai\.com\/sitemap\.xml/], ['/sitemap.xml', /<loc>https:\/\/rattilmai\.com\/teach\/<\/loc>/], ['/llms.txt', /# Recite With Me/], ['/icons/og-image.jpg', null]]) {
  const r = await fetch(BASE + p);
  const t = re ? await r.text() : '';
  check(`${p} served`, r.status === 200 && (!re || re.test(t)), `${r.status} ${r.headers.get('content-type')}`);
}
const r404 = await fetch(BASE + '/about');
check('/about redirects or serves the page', r404.status === 200, `${r404.status} ${r404.url}`);

// CSP: the app must run with no blocked resources.
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const csp = []; const errs = [];
page.on('console', (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) csp.push(t.slice(0, 200)); else if (m.type() === 'error') errs.push(t.slice(0, 160)); });
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForSelector('#google', { timeout: 20000 });
check('App boots under the Content Security Policy', true);
if (await page.locator('#local').count()) {
  await page.click('#local'); await page.waitForSelector('#nm'); await page.fill('#nm', 'CSP Test');
  await page.click('#roleForm button[type=submit]'); await page.waitForSelector('#planForm'); await page.click('#planForm button[type=submit]');
  await page.waitForSelector('.hero', { timeout: 15000 });
  await page.goto(BASE + '/#/mushaf?page=604'); await page.waitForSelector('.ayah', { timeout: 20000 });
  await page.click('#plToggle'); await page.waitForTimeout(2500);
  await page.goto(BASE + '/#/prayer'); await page.waitForTimeout(1500);
  await page.goto(BASE + '/#/apply'); await page.waitForSelector('text=Sign in with Google', { timeout: 10000 });
  check('Teach with us page asks to sign in when signed out', true);
}
for (const p of ['/about/', '/teach/', '/ar/']) { await page.goto(BASE + p, { waitUntil: 'load' }); await page.waitForTimeout(500); }
check('No Content Security Policy violations anywhere', csp.length === 0, csp.slice(0, 3).join(' | '));
check('No JavaScript errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await b.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
