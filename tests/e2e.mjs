// End-to-end check with the Quran API, audio CDN and speech engine simulated.
// Run: node tests/e2e.mjs  (serves the app on a local port)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.SHOTS || path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(OUT, { recursive: true });

// ---------- fixtures ----------
const B = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const SURAHS = {
  1: { name: 'سُورَةُ ٱلْفَاتِحَةِ', en: 'Al-Faatiha', ayahs: [B, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'مَٰلِكِ يَوْمِ ٱلدِّينِ', 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ'], start: 1 },
  112: { name: 'سُورَةُ الإِخۡلَاصِ', en: 'Al-Ikhlaas', ayahs: [B + ' قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'ٱللَّهُ ٱلصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ'], start: 6222 },
  113: { name: 'سُورَةُ الفَلَقِ', en: 'Al-Falaq', ayahs: [B + ' قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', 'مِن شَرِّ مَا خَلَقَ', 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', 'وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ', 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ'], start: 6226 },
  114: { name: 'سُورَةُ النَّاسِ', en: 'An-Naas', ayahs: [B + ' قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ', 'مَلِكِ ٱلنَّاسِ', 'إِلَٰهِ ٱلنَّاسِ', 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ', 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ', 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ'], start: 6231 },
};
function ayahObj(sn, i, page) {
  const s = SURAHS[sn];
  return { number: s.start + i, text: s.ayahs[i], surah: { number: sn, name: s.name, englishName: s.en, englishNameTranslation: '', revelationType: 'Meccan', numberOfAyahs: s.ayahs.length }, numberInSurah: i + 1, juz: sn === 1 ? 1 : 30, manzil: 1, page, ruku: 1, hizbQuarter: 1, sajda: false };
}
function pageData(p) {
  if (p === 1) return SURAHS[1].ayahs.map((_, i) => ayahObj(1, i, 1));
  if (p === 604) return [112, 113, 114].flatMap((sn) => SURAHS[sn].ayahs.map((_, i) => ayahObj(sn, i, 604)));
  // generic filler page
  return Array.from({ length: 6 }, (_, i) => ({ number: 1000 + p * 6 + i, text: 'وَٱللَّهُ عَلِيمٌ حَكِيمٌ', surah: { number: 2, name: 'سُورَةُ البَقَرَةِ', englishName: 'Al-Baqara' }, numberInSurah: 10 + i, juz: 1, page: p }));
}
const meta = {
  surahs: { references: Array.from({ length: 114 }, (_, i) => ({ number: i + 1, name: SURAHS[i + 1]?.name || `سورة ${i + 1}`, englishName: SURAHS[i + 1]?.en || `Surah ${i + 1}`, englishNameTranslation: '', numberOfAyahs: 5, revelationType: 'Meccan' })) },
  pages: { references: Array.from({ length: 604 }, (_, i) => (i === 0 ? { surah: 1, ayah: 1 } : i === 603 ? { surah: 112, ayah: 1 } : { surah: 2, ayah: i })) },
  juzs: { references: Array.from({ length: 30 }, (_, i) => ({ surah: i === 29 ? 112 : 2, ayah: i === 0 ? 1 : i * 9 })) },
};
function surahData(sn) {
  if (SURAHS[sn]) return { number: sn, name: SURAHS[sn].name, englishName: SURAHS[sn].en, ayahs: SURAHS[sn].ayahs.map((_, i) => { const a = ayahObj(sn, i, 604); delete a.surah; return a; }) };
  return { number: sn, name: 'سُورَةُ البَقَرَةِ', englishName: 'Al-Baqara', ayahs: Array.from({ length: 286 }, (_, i) => ({ number: 8 + i, text: i === 254 ? 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ' : 'آية', numberInSurah: i + 1, juz: 3, page: 42 })) };
}

// silent wav, 0.4 s
function wav() {
  const sr = 8000, n = sr * 0.4, buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(n, 40); buf.fill(128, 44); return buf;
}

// ---------- static server ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const SPEECH_MOCK = `
  class FakeSR {
    constructor() { this.lang=''; window.__recs = (window.__recs||[]); window.__recs.push(this); }
    start() { window.__rec = this; this._on = true; }
    stop() { this._on = false; setTimeout(() => this.onend && this.onend(), 0); }
    abort() { this.stop(); }
  }
  window.SpeechRecognition = FakeSR;
  window.__say = (text) => {
    const r = window.__rec; if (!r || !r._on) return false;
    const res = [{ transcript: text }]; res.isFinal = true;
    r.onresult({ resultIndex: 0, results: [res] }); return true;
  };
`;

const errors = [];
const window_word_requests = [];
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  · ' + extra : ''}`); };

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['microphone'] });
  await ctx.addInitScript(SPEECH_MOCK);
  await ctx.route('https://api.alquran.cloud/**', (route) => {
    const u = new URL(route.request().url());
    let data;
    let m;
    if ((m = u.pathname.match(/\/v1\/page\/(\d+)\//))) data = { number: +m[1], ayahs: pageData(+m[1]) };
    else if (u.pathname.endsWith('/v1/meta')) data = meta;
    else if ((m = u.pathname.match(/\/v1\/surah\/(\d+)\//))) data = surahData(+m[1]);
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 200, status: 'OK', data }) });
  });
  await ctx.route('https://cdn.islamic.network/**', (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: wav() }));
  await ctx.route('https://audio.qurancdn.com/**', (route) => { window_word_requests.push(route.request().url()); route.fulfill({ status: 200, contentType: 'audio/wav', body: wav() }); });
  await ctx.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });

try {
  // ---------- Student ----------
  const page = await newPage({ width: 390, height: 844 });
  await page.goto(BASE);
  await page.waitForSelector('#welcomeForm');
  await shot(page, '01-welcome');
  await page.fill('#nm', 'Yusuf');
  await page.click('button[type=submit]');
  await page.waitForSelector('#planForm');
  check('Plan setup shows after welcome', true);
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Today\'s plan');
  const sabaqText = await page.textContent('.list-item');
  check('Today shows sabaq on page 604 first half', /Page 604, first half/.test(sabaqText), sabaqText.trim().replace(/\s+/g, ' ').slice(0, 80));
  await shot(page, '02-today');

  // Mushaf
  await page.goto(BASE + '#/mushaf?page=1');
  await page.waitForSelector('.ayah');
  const ayahCount = await page.locator('.ayah').count();
  check('Mushaf page 1 renders 7 ayahs', ayahCount === 7, `found ${ayahCount}`);
  await page.click('#plToggle');
  await page.waitForSelector('.ayah.playing', { timeout: 5000 });
  check('Playing highlights the current ayah', true);
  await page.waitForTimeout(1200);
  const playingIdx = await page.locator('.ayah.playing').getAttribute('data-idx').catch(() => null);
  check('Highlight moves to the next ayah', playingIdx !== null && +playingIdx >= 1, `now at index ${playingIdx}`);
  await shot(page, '03-mushaf');
  await page.click('#plToggle');

  // Mushaf 604: basmala stripping
  await page.goto(BASE + '#/mushaf?page=604');
  await page.waitForSelector('.surah-head');
  const heads = await page.locator('.surah-head').count();
  const basm = await page.locator('.basmala').count();
  const firstAyah = await page.locator('.ayah').first().textContent();
  check('Page 604 shows 3 surah headers with basmala lines', heads === 3 && basm === 3, `${heads} heads, ${basm} basmala`);
  check('Basmala removed from ayah 1 text', !firstAyah.includes('بِسْمِ'), firstAyah.slice(0, 30));

  // Recite sabaq
  await page.goto(BASE + '#/recite?plan=sabaq');
  await page.waitForSelector('.words');
  const hidden = await page.locator('.w.hidden').count();
  const total = await page.locator('.w').count();
  check('Recite hides words until recited', hidden === total && total > 0, `${hidden}/${total} hidden`);
  await page.click('#mic');
  await page.waitForFunction(() => window.__rec && window.__rec._on);
  await page.evaluate(() => window.__say('قل هو الله احد'));
  await page.evaluate(() => window.__say('الله الصمد'));
  await page.waitForTimeout(100);
  const okCount = await page.locator('.w.ok').count();
  check('Correct words are revealed', okCount === 6, `${okCount} revealed`);
  // skip "ولم" in ayah 3: say "لم يلد يولد" (skipped و-لم)
  await page.evaluate(() => window.__say('لم يلد يولد'));
  await page.waitForTimeout(100);
  const bad1 = await page.locator('.w.bad').count();
  check('A skipped word is marked', bad1 === 1, `${bad1} marked`);
  const fixVisible = await page.isVisible('#fix');
  check('A correction card appears straight away', fixVisible);
  await page.click('[data-fix="ayah"]');
  await page.waitForTimeout(100);
  const pausedWhilePlaying = await page.evaluate(() => !window.__rec._on);
  check('Listening pauses while the correction plays', pausedWhilePlaying);
  await page.waitForFunction(() => window.__rec && window.__rec._on, null, { timeout: 4000 }).catch(() => {});
  check('Listening resumes after the correction', await page.evaluate(() => !!(window.__rec && window.__rec._on)));
  await page.click('[data-fix="word"]');
  await page.waitForFunction(() => window.__rec && window.__rec._on, null, { timeout: 4000 }).catch(() => {});
  check('Word audio requested for the right word', window_word_requests.some((u) => /112_003_003\.mp3$/.test(u)), window_word_requests.slice(-1)[0] || 'none');
  await shot(page, '04-recite-live');
  // wrong word: "ولم يكن له كفوا واحد" (احد -> واحد is close; use clearly wrong "كبير")
  await page.evaluate(() => window.__say('ولم يكن له كفوا كبير'));
  await page.evaluate(() => window.__say('قل اعوذ برب الناس من شر ما كسب ومن شر غاسق اذا وقب ومن شر النفاثات في العقد'));
  await page.waitForSelector('#result .card', { timeout: 5000 });
  const resultText = await page.textContent('#result');
  check('Finishing shows a result with the score', /% correct/.test(resultText), resultText.replace(/\s+/g, ' ').slice(0, 70));
  check('Result lists the skipped and wrong words', /Skipped word/.test(resultText) && /Wrong word/.test(resultText));
  check('Each mistake in the result has a play button', (await page.locator('#result [data-play]').count()) >= 3);
  await shot(page, '05-recite-result');

  // Plan should NOT advance (score < 90)
  await page.goto(BASE + '#/');
  await page.waitForSelector('text=Today\'s plan');
  const doneTxt = await page.textContent('.card .spread .small');
  check('Plan not ticked below 90%', /0 of/.test(doneTxt), doneTxt);

  // Recite again perfectly
  await page.goto(BASE + '#/recite?plan=sabaq');
  await page.waitForSelector('.words');
  await page.click('#mic');
  await page.waitForFunction(() => window.__rec && window.__rec._on);
  await page.evaluate(() => window.__say('قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد'));
  await page.evaluate(() => window.__say('قل اعوذ برب الفلق من شر ما خلق ومن شر غاسق اذا وقب ومن شر النفاثات في العقد'));
  await page.waitForSelector('#result .card', { timeout: 5000 });
  const r2 = await page.textContent('#result');
  check('Perfect recitation scores 100%', /100% correct/.test(r2), r2.replace(/\s+/g, ' ').slice(0, 60));
  check('Plan ticks the new lesson', /Marked done/.test(r2));
  await page.goto(BASE + '#/');
  await page.waitForSelector('text=Today\'s plan');
  const t2 = await page.textContent('#view');
  check('Today shows sabaq done and 0.5 page memorized', /1 of 1 done|Done/.test(t2) && /0\.5 page/.test(t2), '');

  // Adhkar
  await page.goto(BASE + '#/adhkar?set=morning');
  await page.waitForSelector('#counter');
  await page.click('[data-go="1"]');
  await page.waitForSelector('#counter');
  for (let i = 0; i < 3; i++) { await page.click('#counter'); await page.waitForTimeout(80); }
  await page.waitForTimeout(700);
  const listTxt = await page.textContent('.dhikr-list');
  check('Adhkar counter reaches 3 / 3', /3 \/ 3 ✓/.test(listTxt));
  const curTitle = await page.textContent('.card h2');
  check('Counter auto-advances to the next dhikr', /Falaq/.test(curTitle), curTitle);
  await page.click('#counter');
  await shot(page, '06-adhkar');

  // History
  await page.goto(BASE + '#/history');
  await page.waitForSelector('.card');
  const hcount = await page.locator('a.card').count();
  check('History lists both practice sessions', hcount === 2, `${hcount} items`);
  await shot(page, '07-history');
  await page.locator('a.card').last().click();
  await page.waitForSelector('text=Marks');
  const hasAudio = await page.waitForSelector('audio', { timeout: 4000 }).then(() => 1).catch(() => 0);
  check('Practice recording audio is saved and playable', hasAudio === 1);
  await shot(page, '08-history-detail');

  // ---------- Teacher (tablet) ----------
  const tp = await newPage({ width: 1194, height: 834 });
  await tp.goto(BASE);
  await tp.waitForSelector('#welcomeForm');
  await tp.fill('#nm', 'Ustadh Ahmed');
  await tp.check('input[value=teacher]');
  await tp.click('button[type=submit]');
  await tp.waitForSelector('text=Teacher view');
  await tp.fill('#newStudent', 'Yusuf');
  await tp.click('#addStudent button');
  await tp.waitForSelector('text=sessions recorded');
  await shot(tp, '09-teacher-home');
  await tp.click('a.btn.sm[href^="#/live"]');
  await tp.waitForSelector('#setupForm');
  await tp.fill('#pg', '1');
  await tp.click('#setupForm button[type=submit]');
  await tp.waitForSelector('#wordsBox .words');
  await tp.click('#startBtn');
  await tp.waitForFunction(() => window.__rec && window.__rec._on);
  await tp.evaluate(() => window.__say('بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين اياك نعبد نستعين'));
  await tp.waitForTimeout(200);
  const sugg = await tp.locator('.w.ai').count();
  check('Teacher sees an AI suggestion highlighted', sugg === 1, `${sugg} suggestions`);
  await tp.click('#wordsBox [data-i="5"]'); // teacher marks "رب"
  await tp.waitForTimeout(100);
  const teacherMarks = await tp.textContent('#tCount');
  check('Teacher mark is logged', /Teacher 1/.test(teacherMarks), teacherMarks);
  await shot(tp, '10-teacher-live');
  await tp.click('[data-confirm]');
  await tp.waitForTimeout(100);
  const confirmed = await tp.locator('.log-item:has-text("AI · confirmed")').count();
  check('Teacher confirms the AI suggestion', confirmed === 1);
  await tp.waitForTimeout(1200);
  await tp.click('#gradeBtn');
  await tp.waitForSelector('#gradeForm');
  const total0 = await tp.textContent('#total');
  check('Grade form pre-fills a total', +total0 > 0, `total ${total0}`);
  await tp.fill('#comment', 'Practise the letter ح and keep going.');
  await shot(tp, '11-teacher-grade');
  await tp.click('[data-decision="pass"]');
  await tp.waitForSelector('text=Decision:', { timeout: 5000 }).catch(() => {});
  const det = await tp.textContent('#view');
  check('Saved session shows grade, decision and comment', /Decision:/.test(det) && /Practise the letter/.test(det));
  check('Saved teacher session has audio', await tp.waitForSelector('audio', { timeout: 4000 }).then(() => true).catch(() => false));
  await shot(tp, '12-teacher-session-saved');

  // Phone view of teacher live
  const tph = await newPage({ width: 390, height: 844 });
  await tph.goto(BASE);
  await tph.fill('#nm', 'Ustadh Ahmed');
  await tph.check('input[value=teacher]');
  await tph.click('button[type=submit]');
  await tph.goto(BASE + '#/live?page=1&part=all&name=Yusuf');
  await tph.waitForSelector('#wordsBox .words');
  await shot(tph, '13-teacher-live-phone');
  const overflow = await tph.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('No sideways scrolling on phone', !overflow);
} catch (e) {
  check('Run finished without exceptions', false, String(e).split('\n')[0]);
} finally {
  await browser.close();
  server.close();
}

const realErrors = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
check('No JavaScript errors in the console', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
