import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const S = process.argv[2], FONT = S + '/gfonts/ofl/alexandria/Alexandria[wght].ttf';
const EN_W = 800, AR_W = 600, GAP = 0.45;
const face = `@font-face{font-family:A;src:url(data:font/ttf;base64,${fs.readFileSync(FONT).toString('base64')});font-weight:100 900}`;
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent(`<html><head><style>${face}</style></head><body></body></html>`);
await p.evaluate(() => Promise.all([600, 800].map((w) => document.fonts.load(`${w} 100px A`))));
const L = await p.evaluate(([EN_W, AR_W, GAP]) => {
  const c = document.createElement('canvas').getContext('2d');
  const ink = (t, w, s) => { c.font = `${w} ${s}px A`; const m = c.measureText(t); return { l: -m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, t: -m.actualBoundingBoxAscent, b: m.actualBoundingBoxDescent }; };
  const EN = 'Recite With Me', AR = 'رتّل معي';
  const e = ink(EN, EN_W, 100); const W = e.r - e.l, eh = e.b - e.t;
  const a0 = ink(AR, AR_W, 100); const as = 100 * W / (a0.r - a0.l); const a = ink(AR, AR_W, as);
  const g = GAP * eh;
  return { W, H: eh + g + (a.b - a.t), eh, ex: -e.l, ey: -e.t, ax: -a.l, ay: eh + g - a.t, as };
}, [EN_W, AR_W, GAP]);
const pad = 8;
for (const [name, en, ar] of [['light', '#17231E', '#1F6A50'], ['dark', '#EEE8D9', '#6CC39E'], ['reverse', '#F7F3EA', '#E6D199']]) {
  const W = L.W + 2 * pad, H = L.H + 2 * pad;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-pad} ${-pad} ${W} ${H}" style="display:block"><text x="${L.ex}" y="${L.ey}" font-family="A" font-weight="${EN_W}" font-size="100" fill="${en}">Recite With Me</text><text x="${L.ax}" y="${L.ay}" font-family="A" font-weight="${AR_W}" font-size="${L.as}" fill="${ar}">رتّل معي</text></svg>`;
  await p.setContent(`<html><head><style>${face}@page{margin:0;size:${W}px ${H}px}html,body{margin:0;padding:0}</style></head><body>${svg}</body></html>`);
  await p.evaluate(() => Promise.all([600, 800].map((w) => document.fonts.load(`${w} 100px A`))));
  await p.pdf({ path: `${S}/wm/wm-${name}.pdf`, width: `${W}px`, height: `${H}px`, printBackground: false });
}
fs.writeFileSync(`${S}/wm/layout.json`, JSON.stringify(L));
await b.close();
console.log(JSON.stringify(L));
