// Data-integrity checks for the Duas and Ruqyah library.
// Run: node tests/duas.test.mjs   (no installs, no network, no DOM)
import { CATEGORIES, LIBRARY, reviewed, findCategory, searchDuas } from '../js/duas.js';

// Ayah counts of the 114 surahs (Hafs, Madinah Mushaf).
const AYAHS = [
  0, 7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89,
  59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30,
  52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
  21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

let failed = 0;
let passed = 0;
const check = (name, ok, extra = '') => {
  if (ok) passed++;
  else { failed++; console.log(`FAIL  ${name}${extra ? '  · ' + extra : ''}`); }
};

// The table itself.
check('ayah table has 114 surahs', AYAHS.length === 115);
check('ayah table sums to 6236', AYAHS.reduce((a, b) => a + b, 0) === 6236, String(AYAHS.reduce((a, b) => a + b, 0)));

check('module is marked reviewed: false', reviewed === false && LIBRARY.reviewed === false);
check('there are categories', Array.isArray(CATEGORIES) && CATEGORIES.length > 0);

const HARAKAT = /[ً-ْ]/g;
const ARABIC_LETTER = /[ء-ي]/g;
const catIds = new Set();
const itemIds = new Set();

for (const c of CATEGORIES) {
  const where = `category ${c.id}`;
  check(`${where}: has id`, typeof c.id === 'string' && c.id.length > 0);
  check(`${where}: has title`, typeof c.title === 'string' && c.title.length > 0);
  check(`${where}: has Arabic title`, typeof c.ar === 'string' && c.ar.length > 0);
  check(`${where}: has items`, Array.isArray(c.items) && c.items.length > 0);
  check(`${where}: id unique`, !catIds.has(c.id));
  catIds.add(c.id);
  check(`${where}: findCategory works`, findCategory(c.id) === c);

  (c.items || []).forEach((it, i) => {
    const w = `${c.id}[${i}] ${it.id}`;
    check(`${w}: has id`, typeof it.id === 'string' && it.id.length > 0);
    check(`${w}: id unique`, !itemIds.has(it.id));
    itemIds.add(it.id);
    check(`${w}: has title`, typeof it.title === 'string' && it.title.length > 0);
    check(`${w}: has meaning`, typeof it.meaning === 'string' && it.meaning.length > 0);
    check(`${w}: count is a positive integer`, Number.isInteger(it.count) && it.count >= 1, String(it.count));

    const hasQ = !!it.quran;
    const hasA = typeof it.arabic === 'string' && it.arabic.trim().length > 0;
    check(`${w}: has arabic text or a quran ref`, hasQ || hasA);
    check(`${w}: not both arabic text and a quran ref`, !(hasQ && 'arabic' in it));
    check(`${w}: no legacy "text" field`, !('text' in it));

    if (hasQ) {
      const { surah, from, to } = it.quran;
      const ints = [surah, from, to].every(Number.isInteger);
      check(`${w}: quran ref integers`, ints, JSON.stringify(it.quran));
      check(`${w}: 1 ≤ surah ≤ 114`, surah >= 1 && surah <= 114, String(surah));
      check(`${w}: 1 ≤ from ≤ to`, from >= 1 && from <= to, `${from}-${to}`);
      check(`${w}: to ≤ ayahs in surah`, surah >= 1 && surah <= 114 && to <= AYAHS[surah], `${surah}:${to} (max ${AYAHS[surah]})`);
    } else {
      check(`${w}: non-Quran item has a source`, typeof it.source === 'string' && it.source.trim().length > 0);
    }

    if (hasA) {
      // Quran text must never be typed in: Mushaf-only marks suggest a copy from the Uthmani text.
      check(`${w}: arabic has no Uthmani-only marks (alif wasla, small high marks)`, !/[ٱۖ-ۭ]/.test(it.arabic));
      const letters = (it.arabic.match(ARABIC_LETTER) || []).length;
      const marks = (it.arabic.match(HARAKAT) || []).length;
      check(`${w}: arabic is vocalised (tashkeel)`, letters > 0 && marks / letters >= 0.5, `${marks}/${letters}`);
      check(`${w}: arabic has no Latin letters`, !/[A-Za-z]/.test(it.arabic));
    }
  });
}

// Ruqyah: the full set contains everything in the short set.
const short = findCategory('ruqyah-short');
const full = findCategory('ruqyah-full');
check('ruqyah sets exist and come first', CATEGORIES[0] === short && CATEGORIES[1] === full);
const key = (it) => (it.quran ? `q${it.quran.surah}:${it.quran.from}-${it.quran.to}` : `a${it.arabic}`) + `x${it.count}`;
if (short && full) {
  const fullKeys = new Set(full.items.map(key));
  short.items.forEach((it) => check(`full ruqyah includes ${it.id}`, fullKeys.has(key(it))));
}

// Search.
check('search finds travel dua', searchDuas('travel').some((r) => r.category.id === 'travel'));
check('search is case and accent insensitive', searchDuas('ISTIGHFAR').length > 0);
check('search for nonsense finds nothing', searchDuas('zzqxj').length === 0);
check('empty search returns nothing', searchDuas('  ').length === 0);
check('search results point to real items', searchDuas('forgive').every((r) => r.category.items[r.index] === r.item));

const total = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
console.log(`${failed ? 'FAILED' : 'OK'}  ${passed} checks passed, ${failed} failed · ${CATEGORIES.length} categories, ${total} items`);
process.exit(failed ? 1 : 0);
