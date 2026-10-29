// Live check of https://rattilmai.com in a real browser. Run where the internet is open:
// npm i playwright @supabase/supabase-js && npx playwright install chromium && node tests/live-check.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'https://rattilmai.com/';
const OUT = '/vercel/t/shots'; fs.mkdirSync(OUT, { recursive: true });
const results = []; const check = (n, ok, x = '') => { results.push({ n, ok, x }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  · ' + x : ''}`); };
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone', 'camera', 'geolocation'], geolocation: { latitude: 25.2048, longitude: 55.2708 }, timezoneId: 'Asia/Dubai', locale: 'en-AE' });
const errors = [], bad = [];
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 120)}`); });
page.on('requestfailed', (r) => bad.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const t0 = Date.now();
try {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#google', { timeout: 20000 });
  check('Site loads and shows the welcome screen', true, `${Date.now() - t0} ms`);
  const wm = await page.evaluate(() => [...document.querySelectorAll('img.wordmark')].filter((i) => i.offsetParent).map((i) => i.naturalWidth > 0));
  check('Wordmark images load', wm.length >= 1 && wm.every(Boolean), JSON.stringify(wm));
  const g = await page.evaluate(() => ({ disabled: document.querySelector('#google').disabled, local: !!document.querySelector('#local'), note: document.querySelector('.welcome .card p.xs')?.textContent || '' }));
  check('Google button state', true, JSON.stringify(g));
  await shot('01-welcome');
  const swOk = await page.evaluate(async () => { const r = await navigator.serviceWorker?.getRegistration(); return !!r; });
  check('Offline service worker registers', swOk);
  if (g.local) {
    await page.click('#local');
    await page.waitForSelector('#roleForm #nm');
    await page.fill('#nm', 'Live Test');
    await page.click('#roleForm button[type=submit]');
    await page.waitForSelector('#planForm');
    await page.click('#planForm button[type=submit]');
    await page.waitForSelector('.hero', { timeout: 15000 });
    check('Device-only start reaches Today', true);
    await shot('02-today');
    check('Today: no sideways scroll', !(await overflow()));
    const f2 = await page.evaluate(async () => { await document.fonts.ready; return ['700 20px Alexandria', '20px "IBM Plex Sans"'].map((f) => document.fonts.check(f)); });
    check('Brand heading font (Alexandria) and UI font load', f2.every(Boolean), JSON.stringify(f2));
    check('Full-screen button visible', await page.isVisible('#fsBtn'));
    await page.click('#fsBtn'); await page.waitForTimeout(500);
    const fs1 = await page.evaluate(() => ({ fs: !!document.fullscreenElement, sheet: !!document.querySelector('.sheet') }));
    check('Full-screen button works', fs1.fs || fs1.sheet, JSON.stringify(fs1));
    if (fs1.fs) await page.evaluate(() => document.exitFullscreen()); else await page.keyboard.press('Escape');
    const bar = await page.evaluate(() => { const r = document.querySelector('#tabbar').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 40; });
    check('Bottom tab bar visible', bar);
  }
  // Mushaf with real Quran text and audio
  await page.goto(BASE + '#/mushaf?page=1');
  await page.waitForSelector('.ayah', { timeout: 20000 });
  check('Mushaf page 1 loads 7 ayahs from the Quran API', (await page.locator('.ayah').count()) === 7);
  check('Mushaf font (Amiri Quran) loads', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('25px "Amiri Quran"'); }));
  await page.click('#plToggle');
  const played = await page.waitForSelector('.ayah.playing', { timeout: 15000 }).then(() => true).catch(() => false);
  check('Recitation audio plays with ayah highlighting', played);
  await page.waitForTimeout(2500);
  await shot('03-mushaf');
  await page.click('#plToggle').catch(() => {});
  await page.goto(BASE + '#/mushaf?page=604');
  await page.waitForSelector('.surah-head', { timeout: 20000 });
  check('Page 604 shows 3 surah headers', (await page.locator('.surah-head').count()) === 3);
  // Recite
  await page.goto(BASE + '#/recite?plan=sabaq');
  await page.waitForSelector('.words', { timeout: 20000 });
  check('Recite page loads hidden words', (await page.locator('.w.hidden').count()) > 0);
  await shot('04-recite');
  // Adhkar
  await page.goto(BASE + '#/adhkar?set=morning');
  await page.waitForSelector('#counter', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const dtext = await page.textContent('#dtext');
  check('Adhkar loads (Ayat al-Kursi text from the API)', dtext && dtext.trim().length > 20, dtext?.trim().slice(0, 40));
  await shot('05-adhkar');
  // Duas and Ruqyah
  await page.goto(BASE + '#/duas');
  await page.waitForTimeout(1200);
  const dl = await page.textContent('#view');
  check('Duas and Ruqyah library opens', /Ruqyah/i.test(dl));
  await shot('06-duas');
  const firstLink = page.locator('#view a[href*="#/duas?c=ruqyah-short"]').first();
  if (await firstLink.count()) { await firstLink.click(); await page.waitForTimeout(1500); await shot('07-ruqyah'); }
  await page.goto(BASE + '#/duas?c=ruqyah-short&i=0');
  await page.waitForTimeout(2500);
  const rq = await page.textContent('#view');
  check('Ruqyah reader shows Al-Fatihah from the API', /ٱلْحَمْدُ|الحمد/.test(rq));
  await shot('07-ruqyah-reader');
  // Prayer times with real city search
  await page.goto(BASE + '#/prayer');
  await page.waitForTimeout(800);
  await shot('08-prayer-empty');
  const search = page.locator('#view input[type="search"], #view input[placeholder*="city" i]').first();
  if (await search.count()) {
    await search.fill('Dubai'); await search.press('Enter');
    await page.waitForTimeout(2500);
    const pick = page.locator('#view button:has-text("Dubai"), #view [role="option"]:has-text("Dubai"), #view li:has-text("Dubai")').first();
    if (await pick.count()) await pick.click();
    await page.waitForTimeout(1500);
  }
  const pt = await page.textContent('#view');
  check('Prayer times show for Dubai', /Fajr/.test(pt) && /Maghrib/.test(pt) && /\d{1,2}:\d{2}/.test(pt), (pt.match(/Fajr[^A-Za-z]{0,40}/) || [''])[0].replace(/\s+/g, ' '));
  check('Qibla bearing shown', /258|Qibla/.test(pt));
  await shot('09-prayer');
  check('Prayer: no sideways scroll', !(await overflow()));
  // Today shows next prayer now
  await page.goto(BASE + '#/');
  await page.waitForSelector('.hero');
  const hero = await page.textContent('.hero');
  check('Today shows the next prayer', /at \d/.test(hero), (hero.match(/(Fajr|Dhuhr|Asr|Maghrib|Isha)[^·]*·[^0-9]*\d[^\n]*/) || [''])[0].trim().slice(0, 50));
  // History, More, Settings, dark theme
  await page.goto(BASE + '#/history'); await page.waitForTimeout(800); await shot('10-history');
  await page.goto(BASE + '#/more'); await page.waitForTimeout(500); await shot('11-more');
  await page.goto(BASE + '#/settings'); await page.waitForSelector('[data-theme-opt="dark"]');
  await page.click('[data-theme-opt="dark"]'); await page.waitForTimeout(500);
  await page.goto(BASE + '#/'); await page.waitForSelector('.hero'); await page.waitForTimeout(500);
  const dk = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('Dark theme applies', dk === 'rgb(11, 20, 17)', dk);
  await shot('12-today-dark');
  await page.goto(BASE + '#/settings'); await page.click('[data-role="teacher"]');
  await page.waitForSelector('.hero', { timeout: 10000 }); await page.waitForTimeout(800);
  await shot('13-teacher-dark');
  check('Teacher view opens', /Teacher view/i.test(await page.textContent('.hero')));
  await page.goto(BASE + '#/live?student=&page=1&part=all&name=Test');
  await page.waitForSelector('#wordsBox .words', { timeout: 20000 });
  await shot('14-teacher-live-dark');
  check('Teacher: no sideways scroll', !(await overflow()));
} catch (e) { check('Run finished without exceptions', false, String(e).split('\n')[0]); await shot('99-error').catch(() => {}); }
const realErr = errors.filter((e) => !/favicon/.test(e));
check('No JavaScript errors on the live site', realErr.length === 0, realErr.slice(0, 5).join(' | '));
check('No failed network requests', bad.length === 0, [...new Set(bad)].slice(0, 6).join(' | '));
// Contact sheet
const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort();
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1800, height: 800 });
await sheet.setContent(`<body style="margin:0;background:#ddd;display:flex;flex-wrap:wrap;gap:10px;padding:10px">${files.map((f) => `<figure style="margin:0;width:286px;font:12px sans-serif"><img src="data:image/png;base64,${fs.readFileSync(OUT + '/' + f).toString('base64')}" style="width:286px;display:block"><figcaption>${f}</figcaption></figure>`).join('')}</body>`);
await sheet.screenshot({ path: '/vercel/t/sheet.jpg', fullPage: true, type: 'jpeg', quality: 70 });
fs.writeFileSync('/vercel/t/results.json', JSON.stringify(results, null, 1));
await b.close();
