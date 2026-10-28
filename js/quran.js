// Quran text and audio from free sources.
// Text: Tanzil Uthmani (Madinah Mushaf, Hafs) via the Al Quran Cloud API.
// Audio: Islamic Network CDN, ayah by ayah.

import { splitWords, stripBasmala } from './arabic.js';

export const API = 'https://api.alquran.cloud/v1';
export const EDITION = 'quran-uthmani';
export const TOTAL_PAGES = 604;

export const RECITERS = [
  { id: 'ar.husary', name: 'Mahmoud Khalil al-Husary', ar: 'محمود خليل الحصري', kbps: 128, note: 'Teaching pace' },
  { id: 'ar.minshawi', name: 'Muhammad Siddiq al-Minshawi', ar: 'محمد صديق المنشاوي', kbps: 128, note: 'Murattal' },
  { id: 'ar.sudais', name: 'Abdul Rahman al-Sudais', ar: 'عبدالرحمن السديس', kbps: 192, note: 'Imam, Masjid al-Haram' },
  { id: 'ar.shuraim', name: "Sa'ud al-Shuraim", ar: 'سعود الشريم', kbps: 128, note: 'Masjid al-Haram' },
  { id: 'ar.hudhaify', name: 'Ali al-Hudhaify', ar: 'علي الحذيفي', kbps: 128, note: 'Imam, Masjid an-Nabawi' },
  { id: 'ar.alafasy', name: 'Mishary Alafasy', ar: 'مشاري العفاسي', kbps: 128, note: 'Murattal' },
  { id: 'ar.abdulbasit', name: 'Abdul Basit Abdul Samad', ar: 'عبد الباسط عبد الصمد', kbps: 192, note: 'Murattal' },
  { id: 'ar.ajamy', name: 'Ahmed al-Ajamy', ar: 'أحمد العجمي', kbps: 128, note: 'Murattal' },
];

export function reciter(id) {
  return RECITERS.find((r) => r.id === id) || RECITERS[0];
}

export function audioUrl(reciterId, ayahNumber) {
  const r = reciter(reciterId);
  return `https://cdn.islamic.network/quran/audio/${r.kbps}/${r.id}/${ayahNumber}.mp3`;
}

// Single word, from the Quran.com word-by-word audio (public CDN).
export function wordAudioUrl(surah, ayah, pos) {
  const p = (n) => String(n).padStart(3, '0');
  return `https://audio.qurancdn.com/wbw/${p(surah)}_${p(ayah)}_${p(pos)}.mp3`;
}

const mem = new Map();

async function getJSON(path) {
  if (mem.has(path)) return mem.get(path);
  const p = fetch(API + path).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.code !== 200) throw new Error(body.status || 'API error');
    return body.data;
  });
  mem.set(path, p);
  try {
    return await p;
  } catch (e) {
    mem.delete(path);
    throw e;
  }
}

// Turn an API ayah into our shape.
function shapeAyah(a) {
  const surah = a.surah || {};
  let text = a.text;
  let basmala = '';
  if (a.numberInSurah === 1 && surah.number !== 1) {
    const s = stripBasmala(text);
    text = s.text;
    basmala = s.basmala;
  }
  return {
    number: a.number,
    surah: surah.number,
    surahName: surah.name,
    surahEnglish: surah.englishName,
    ayah: a.numberInSurah,
    page: a.page,
    juz: a.juz,
    text,
    basmala,
    words: splitWords(text),
  };
}

export async function getPage(page) {
  const data = await getJSON(`/page/${page}/${EDITION}`);
  return data.ayahs.map(shapeAyah);
}

export async function getAyahs(surah, from, to) {
  const data = await getJSON(`/surah/${surah}/${EDITION}`);
  return data.ayahs
    .map((a) => shapeAyah({ ...a, surah: { number: data.number, name: data.name, englishName: data.englishName } }))
    .filter((a) => a.ayah >= from && a.ayah <= to);
}

// Surah list and page starts (cached on device).
export async function getMeta() {
  try {
    const cached = JSON.parse(localStorage.getItem('rattil:meta') || 'null');
    if (cached && cached.surahs && cached.pages) return cached;
  } catch { /* ignore */ }
  const data = await getJSON('/meta');
  const meta = {
    surahs: data.surahs.references.map((s) => ({ number: s.number, name: s.name, english: s.englishName, meaning: s.englishNameTranslation, ayahs: s.numberOfAyahs })),
    pages: data.pages.references.map((p) => [p.surah, p.ayah]),
    juzs: data.juzs.references.map((j) => [j.surah, j.ayah]),
  };
  try { localStorage.setItem('rattil:meta', JSON.stringify(meta)); } catch { /* ignore */ }
  return meta;
}

export function pageOf(meta, surah, ayah = 1) {
  let page = 1;
  for (let i = 0; i < meta.pages.length; i++) {
    const [s, a] = meta.pages[i];
    if (s < surah || (s === surah && a <= ayah)) page = i + 1;
    else break;
  }
  return page;
}

export function juzStartPage(meta, juz) {
  const [s, a] = meta.juzs[juz - 1];
  return pageOf(meta, s, a);
}

// Split one page into parts by ayah count. part: 'all' | '1/2' | '2/2'
export function slicePart(ayahs, part) {
  if (part === 'all' || !part) return ayahs;
  const half = Math.ceil(ayahs.length / 2);
  return part === '1/2' ? ayahs.slice(0, half) : ayahs.slice(half);
}

export async function getPortions(portions) {
  const out = [];
  for (const p of portions) {
    const ayahs = await getPage(p.page);
    out.push(...slicePart(ayahs, p.part));
  }
  return out;
}

export function describePortions(portions) {
  if (!portions.length) return '';
  const pages = [...new Set(portions.map((p) => p.page))];
  const parts = portions.length === 1 && portions[0].part !== 'all' ? (portions[0].part === '1/2' ? ', first half' : ', second half') : '';
  if (pages.length === 1) return `Page ${pages[0]}${parts}`;
  const lo = Math.min(...pages), hi = Math.max(...pages);
  return `Pages ${lo}–${hi}`;
}
