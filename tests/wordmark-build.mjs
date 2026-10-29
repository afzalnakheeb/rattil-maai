// Bilingual wordmark: English line and Arabic line of equal width.
// Arabic at 1.2x with kashida (4 + 3), words pinned to the English ink edges.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const S = process.argv[2], FONT = S + '/gfonts/ofl/alexandria/Alexandria[wght].ttf';
const EN_W = 800, AR_W = 700, K = 1.2, A = 4, M = 3, LINE_GAP = 0.5, PAD = 8;
const face = `@font-face{font-family:A;src:url(data:font/ttf;base64,${fs.readFileSync(FONT).toString('base64')});font-weight:100 900}`;
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent(`<html><head><style>${face}</style></head><body></body></html>`);
await p.evaluate(() => Promise.all([700, 800].map((w) => document.fonts.load(`${w} 100px A`))));
const L = await p.evaluate(([EN_W, AR_W, K, A, M, LINE_GAP]) => {
  const c = document.createElement('canvas').getContext('2d');
  const ink = (t, w, s) => { c.font = `${w} ${s}px A`; const m = c.measureText(t); return { l: -m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, t: -m.actualBoundingBoxAscent, b: m.actualBoundingBoxDescent }; };
  const k = 'ـ', EN = 'Recite With Me';
  const e = ink(EN, EN_W, 100), W = e.r - e.l, eh = e.b - e.t, as = 100 * K;
  const w1 = 'رتّ' + k.repeat(A) + 'ل', w2 = 'م' + k.repeat(M) + 'ع' + k.repeat(M) + 'ي';
  const i1 = ink(w1, AR_W, as), i2 = ink(w2, AR_W, as);
  const top = Math.min(i1.t, i2.t), bot = Math.max(i1.b, i2.b), g = LINE_GAP * eh;
  return { W, H: eh + g + (bot - top), as, w1, w2, en: { x: -e.l, y: -e.t }, a1: { x: W - i1.r, y: eh + g - top }, a2: { x: -i2.l, y: eh + g - top } };
}, [EN_W, AR_W, K, A, M, LINE_GAP]);
const VARIANTS = { light: ['#18563F', '#A8843A'], dark: ['#6DBF98', '#D8BC78'], reverse: ['#F7F3EA', '#E6D199'] }; // green = logo tile (#2E7D5F→#164C3A), a shade darker; gold = logo arch, darkened for ivory
for (const [name, [en, ar]] of Object.entries(VARIANTS)) {
  const Wp = L.W + 2 * PAD, Hp = L.H + 2 * PAD;
  const t = (x, y, w, s, f, txt) => `<text x="${x}" y="${y}" font-family="A" font-weight="${w}" font-size="${s}" fill="${f}">${txt}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wp}" height="${Hp}" viewBox="${-PAD} ${-PAD} ${Wp} ${Hp}" style="display:block">${t(L.en.x, L.en.y, EN_W, 100, en, 'Recite With Me')}${t(L.a1.x, L.a1.y, AR_W, L.as, ar, L.w1)}${t(L.a2.x, L.a2.y, AR_W, L.as, ar, L.w2)}</svg>`;
  await p.setContent(`<html><head><style>${face}@page{margin:0;size:${Wp}px ${Hp}px}html,body{margin:0;padding:0}</style></head><body>${svg}</body></html>`);
  await p.evaluate(() => Promise.all([700, 800].map((w) => document.fonts.load(`${w} 100px A`))));
  await p.pdf({ path: `${S}/wm/wm2-${name}.pdf`, width: `${Wp}px`, height: `${Hp}px`, printBackground: false });
}
console.log(JSON.stringify({ W: L.W, H: L.H, ratio: L.W / L.H }));
await b.close();
