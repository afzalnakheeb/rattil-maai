// Daily hifz plan: sabaq (new lesson), sabqi (recent revision), manzil (old revision).
// Progress is counted in half-page units along the student's track.

import { TOTAL_PAGES } from './quran.js';

export const LEVELS = [
  { id: 'half', label: 'Half a page a day', short: '½ page', units: 1, note: 'Steady · about 4.6 years for the whole Quran' },
  { id: 'one', label: 'One page a day', short: '1 page', units: 2, note: 'Strong · about 2.3 years' },
  { id: 'two', label: 'Two pages a day', short: '2 pages', units: 4, note: 'Intensive · about 1.2 years' },
];

export const TRACKS = [
  { id: 'amma', label: "Juz 'Amma first", note: 'Starts with the last page (Al-Ikhlas, Al-Falaq, An-Nas) and moves back, the usual path for children' },
  { id: 'fatiha', label: 'From Al-Fatiha forward', note: 'Starts at page 1 and moves through the Mushaf in order' },
];

export const SABQI_PAGES = 10;
export const MANZIL_PAGES = 20;

// Page order for a track.
export function pageOrder(track) {
  const pages = [];
  if (track === 'amma') for (let p = TOTAL_PAGES; p >= 1; p--) pages.push(p);
  else for (let p = 1; p <= TOTAL_PAGES; p++) pages.push(p);
  return pages;
}

// Unit index -> { page, part } (two half-page units per page, in reading order within the page).
export function unitToPortion(track, unit) {
  const order = pageOrder(track);
  const page = order[Math.floor(unit / 2)];
  if (page === undefined) return null;
  return { page, part: unit % 2 === 0 ? '1/2' : '2/2' };
}

export function level(plan) {
  return LEVELS.find((l) => l.id === plan.level) || LEVELS[0];
}

// Merge consecutive halves of the same page into a whole page.
function compact(portions) {
  const out = [];
  for (const p of portions) {
    const last = out[out.length - 1];
    if (last && last.page === p.page && last.part === '1/2' && p.part === '2/2') last.part = 'all';
    else out.push({ ...p });
  }
  return out;
}

export function memorizedPages(plan) {
  const order = pageOrder(plan.track);
  return order.slice(0, Math.floor(plan.units / 2));
}

export function today(plan) {
  const lv = level(plan);
  const sabaq = [];
  for (let u = plan.units; u < plan.units + lv.units; u++) {
    const p = unitToPortion(plan.track, u);
    if (p) sabaq.push(p);
  }
  const mem = memorizedPages(plan);
  // Pages already memorized, most recent last.
  const recent = mem.slice(-SABQI_PAGES);
  const older = mem.slice(0, Math.max(0, mem.length - SABQI_PAGES));
  let manzil = [];
  if (older.length) {
    const start = (plan.manzilCursor || 0) % older.length;
    const take = Math.min(MANZIL_PAGES, older.length);
    for (let i = 0; i < take; i++) manzil.push(older[(start + i) % older.length]);
  }
  // A half-memorized page (odd units) belongs to sabqi too.
  const sabqi = recent.map((page) => ({ page, part: 'all' }));
  if (plan.units % 2 === 1) {
    const p = unitToPortion(plan.track, plan.units - 1);
    sabqi.push({ page: p.page, part: '1/2' });
  }
  return {
    sabaq: compact(sabaq),
    sabqi,
    manzil: manzil.map((page) => ({ page, part: 'all' })),
    memorizedCount: mem.length + (plan.units % 2 ? 0.5 : 0),
    complete: plan.units >= TOTAL_PAGES * 2,
  };
}

export function completeSabaq(plan) {
  const lv = level(plan);
  plan.units = Math.min(TOTAL_PAGES * 2, plan.units + lv.units);
}

export function completeManzil(plan) {
  const mem = memorizedPages(plan);
  const olderLen = Math.max(0, mem.length - SABQI_PAGES);
  if (olderLen) plan.manzilCursor = ((plan.manzilCursor || 0) + Math.min(MANZIL_PAGES, olderLen)) % olderLen;
}

export function projectedDays(plan) {
  const lv = level(plan);
  const remaining = TOTAL_PAGES * 2 - plan.units;
  return Math.ceil(remaining / lv.units);
}
