// Quran text and audio from free sources.
// Text: Tanzil Uthmani (Madinah Mushaf, Hafs) via the Al Quran Cloud API.
// Audio: Islamic Network CDN, ayah by ayah.

import { splitWords, stripBasmala } from './arabic.js';

export const API = 'https://api.alquran.cloud/v1';
export const EDITION = 'quran-uthmani';
export const TOTAL_PAGES = 604;

// Reciters, ayah by ayah (needed for highlighting, repeat and corrections).
// src 'in': Islamic Network CDN (alquran.cloud terms allow use in apps). src 'ea': EveryAyah.com.
// Every entry was checked on 234 sample ayahs (first and last ayah of all 114 surahs and more).
export const RECITER_GROUPS = [
  ['haramain', 'Imams of al-Haram and an-Nabawi'],
  ['teaching', 'Teaching and tajweed'],
  ['classic', 'Classic Egyptian masters'],
  ['popular', 'Popular reciters'],
];
export const RECITERS = [
  // Imams of the Two Holy Mosques (current and former)
  { id: 'ar.abdurrahmaansudais', src: 'in', path: '192/ar.abdurrahmaansudais', name: 'Abdul Rahman as-Sudais', ar: 'عبدالرحمن السديس', group: 'haramain', note: 'Masjid al-Haram' },
  { id: 'ar.saoodshuraym', src: 'in', path: '64/ar.saoodshuraym', name: "Sa'ud ash-Shuraim", ar: 'سعود الشريم', group: 'haramain', note: 'Masjid al-Haram' },
  { id: 'ar.mahermuaiqly', src: 'in', path: '128/ar.mahermuaiqly', name: 'Maher al-Muaiqly', ar: 'ماهر المعيقلي', group: 'haramain', note: 'Masjid al-Haram' },
  { id: 'ea.yasser', src: 'ea', path: 'Yasser_Ad-Dussary_128kbps', name: 'Yasser ad-Dosari', ar: 'ياسر الدوسري', group: 'haramain', note: 'Masjid al-Haram' },
  { id: 'ea.juhany', src: 'ea', path: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps', name: 'Abdullah al-Juhany', ar: 'عبدالله الجهني', group: 'haramain', note: 'Masjid al-Haram' },
  { id: 'ea.muhsin', src: 'ea', path: 'Muhsin_Al_Qasim_192kbps', name: 'Abdulmohsen al-Qasim', ar: 'عبدالمحسن القاسم', group: 'haramain', note: 'Masjid an-Nabawi' },
  { id: 'ar.hudhaify', src: 'in', path: '128/ar.hudhaify', name: 'Ali al-Hudhaify', ar: 'علي الحذيفي', group: 'haramain', note: 'Masjid an-Nabawi' },
  { id: 'ea.budair', src: 'ea', path: 'Salah_Al_Budair_128kbps', name: 'Salah al-Budair', ar: 'صلاح البدير', group: 'haramain', note: 'Masjid an-Nabawi' },
  { id: 'ar.muhammadayyoub', src: 'in', path: '128/ar.muhammadayyoub', name: 'Muhammad Ayyub', ar: 'محمد أيوب', group: 'haramain', note: 'Masjid an-Nabawi' },
  { id: 'ar.ibrahimakhbar', src: 'in', path: '32/ar.ibrahimakhbar', name: 'Ibrahim al-Akhdar', ar: 'إبراهيم الأخضر', group: 'haramain', note: 'Masjid an-Nabawi' },
  { id: 'ea.alijaber', src: 'ea', path: 'Ali_Jaber_64kbps', name: 'Ali Jaber', ar: 'علي جابر', group: 'haramain', note: 'Masjid al-Haram' },
  // Teaching and tajweed
  { id: 'ar.husary', src: 'in', path: '128/ar.husary', name: 'Mahmoud Khalil al-Husary', ar: 'محمود خليل الحصري', group: 'teaching', note: 'Teaching pace' },
  { id: 'ea.husarymuallim', src: 'ea', path: 'Husary_Muallim_128kbps', name: 'al-Husary · Muʿallim', ar: 'الحصري (المعلم)', group: 'teaching', note: 'Teacher style, for repeating after' },
  { id: 'ar.aymanswoaid', src: 'in', path: '64/ar.aymanswoaid', name: 'Ayman Suwayd', ar: 'أيمن سويد', group: 'teaching', note: 'Tajweed scholar' },
  { id: 'ar.minshawi', src: 'in', path: '128/ar.minshawi', name: 'Muhammad Siddiq al-Minshawi', ar: 'محمد صديق المنشاوي', group: 'teaching', note: 'Murattal' },
  { id: 'ar.abdullahbasfar', src: 'in', path: '192/ar.abdullahbasfar', name: 'Abdullah Basfar', ar: 'عبدالله بصفر', group: 'teaching', note: 'Murattal' },
  // Classic Egyptian masters
  { id: 'ar.abdulbasitmurattal', src: 'in', path: '192/ar.abdulbasitmurattal', name: 'Abdul Basit Abdul Samad', ar: 'عبد الباسط عبد الصمد', group: 'classic', note: 'Murattal' },
  { id: 'ar.abdulsamad', src: 'in', path: '64/ar.abdulsamad', name: 'Abdul Basit · Mujawwad', ar: 'عبد الباسط (مجود)', group: 'classic', note: 'Mujawwad' },
  { id: 'ar.husarymujawwad', src: 'in', path: '128/ar.husarymujawwad', name: 'al-Husary · Mujawwad', ar: 'الحصري (مجود)', group: 'classic', note: 'Mujawwad' },
  { id: 'ar.minshawimujawwad', src: 'in', path: '64/ar.minshawimujawwad', name: 'al-Minshawi · Mujawwad', ar: 'المنشاوي (مجود)', group: 'classic', note: 'Mujawwad' },
  { id: 'ea.tablawi', src: 'ea', path: 'Mohammad_al_Tablaway_128kbps', name: 'Muhammad al-Tablawi', ar: 'محمد الطبلاوي', group: 'classic', note: 'Murattal' },
  { id: 'ea.banna', src: 'ea', path: 'mahmoud_ali_al_banna_32kbps', name: 'Mahmoud Ali al-Banna', ar: 'محمود علي البنا', group: 'classic', note: 'Murattal' },
  // Popular reciters
  { id: 'ar.alafasy', src: 'in', path: '128/ar.alafasy', name: 'Mishary Alafasy', ar: 'مشاري العفاسي', group: 'popular', note: 'Murattal' },
  { id: 'ea.ghamdi', src: 'ea', path: 'Ghamadi_40kbps', name: "Sa'd al-Ghamdi", ar: 'سعد الغامدي', group: 'popular', note: 'Murattal' },
  { id: 'ar.ahmedajamy', src: 'in', path: '128/ar.ahmedajamy', name: 'Ahmed al-Ajamy', ar: 'أحمد العجمي', group: 'popular', note: 'Murattal' },
  { id: 'ar.shaatree', src: 'in', path: '128/ar.shaatree', name: 'Abu Bakr ash-Shatri', ar: 'أبو بكر الشاطري', group: 'popular', note: 'Murattal' },
  { id: 'ea.qatami', src: 'ea', path: 'Nasser_Alqatami_128kbps', name: 'Nasser al-Qatami', ar: 'ناصر القطامي', group: 'popular', note: 'Murattal' },
  { id: 'ar.hanirifai', src: 'in', path: '192/ar.hanirifai', name: 'Hani ar-Rifai', ar: 'هاني الرفاعي', group: 'popular', note: 'Murattal' },
  { id: 'ar.muhammadjibreel', src: 'in', path: '128/ar.muhammadjibreel', name: 'Muhammad Jibreel', ar: 'محمد جبريل', group: 'popular', note: 'Murattal' },
  { id: 'ea.bukhatir', src: 'ea', path: 'Salaah_AbdulRahman_Bukhatir_128kbps', name: 'Salah Bukhatir', ar: 'صلاح بو خاطر', group: 'popular', note: 'Murattal' },
  { id: 'ea.qahtani', src: 'ea', path: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps', name: 'Khalid al-Qahtani', ar: 'خالد القحطاني', group: 'popular', note: 'Murattal' },
  { id: 'ea.fares', src: 'ea', path: 'Fares_Abbad_64kbps', name: 'Fares Abbad', ar: 'فارس عباد', group: 'popular', note: 'Murattal' },
  { id: 'ea.matroud', src: 'ea', path: 'Abdullah_Matroud_128kbps', name: 'Abdullah al-Matrood', ar: 'عبدالله المطرود', group: 'popular', note: 'Murattal' },
  { id: 'ea.alaqimy', src: 'ea', path: 'Akram_AlAlaqimy_128kbps', name: 'Akram al-Alaqimi', ar: 'أكرم العلاقمي', group: 'popular', note: 'Murattal' },
];

// Saved settings from before: old ids that did not exist on the CDN map to the right reciter.
const RECITER_ALIASES = { 'ar.sudais': 'ar.abdurrahmaansudais', 'ar.shuraim': 'ar.saoodshuraym', 'ar.abdulbasit': 'ar.abdulbasitmurattal', 'ar.ajamy': 'ar.ahmedajamy' };

export function reciter(id) {
  const real = RECITER_ALIASES[id] || id;
  return RECITERS.find((r) => r.id === real) || RECITERS.find((r) => r.id === 'ar.husary');
}

// Ayahs per surah (Hafs), to turn a global ayah number (1–6236) into surah and ayah.
const AYAH_COUNTS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
export function surahAyahOf(n) {
  let left = Math.max(1, Math.min(6236, n | 0));
  for (let s = 0; s < 114; s++) { if (left <= AYAH_COUNTS[s]) return [s + 1, left]; left -= AYAH_COUNTS[s]; }
  return [114, 6];
}

export function audioUrl(reciterId, ayahNumber) {
  const r = reciter(reciterId);
  if (r.src === 'ea') {
    const [s, a] = surahAyahOf(ayahNumber);
    const p = (x) => String(x).padStart(3, '0');
    return `https://everyayah.com/data/${r.path}/${p(s)}${p(a)}.mp3`;
  }
  return `https://cdn.islamic.network/quran/audio/${r.path}/${ayahNumber}.mp3`;
}

// A grouped <select> of reciters.
export function reciterOptions(selected) {
  const sel = reciter(selected).id;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return RECITER_GROUPS.map(([g, label]) => `<optgroup label="${esc(label)}">${RECITERS.filter((r) => r.group === g).map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.name)} · ${esc(r.note)}</option>`).join('')}</optgroup>`).join('');
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
