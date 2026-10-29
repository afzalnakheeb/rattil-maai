// Run: node tests/prayer.test.mjs
// Sanity checks for js/prayer.js against reference values (tolerance in minutes).
import assert from 'node:assert/strict';
import {
  METHODS, PRAYERS, computeTimes, nextPrayer, qiblaBearing, distanceToMakkahKm,
  methodForCountry, methodForTimezone, tzOffsetHours, cardinal,
} from '../js/prayer.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
// Minutes after the location's midnight, independent of the machine's time zone.
const clock = (d, tz) => (((d.getTime() / 60000 + tz * 60) % 1440) + 1440) % 1440;
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const parse = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function near(d, tz, ref, tol, label) {
  const got = clock(d, tz);
  const diff = Math.abs(got - parse(ref));
  assert.ok(diff <= tol, `${label}: got ${hm(got)}, expected ${ref} ±${tol} min (off by ${diff})`);
}
function ordered(t, label) {
  for (const k of KEYS) assert.ok(t[k] instanceof Date && Number.isFinite(t[k].getTime()), `${label}: ${k} is not a valid Date`);
  for (let i = 1; i < KEYS.length; i++) assert.ok(t[KEYS[i - 1]] < t[KEYS[i]], `${label}: ${KEYS[i - 1]} should be before ${KEYS[i]}`);
}
const show = (t, tz) => KEYS.map((k) => `${k} ${hm(clock(t[k], tz))}`).join('  ');

// new Date(y, m, d) => that calendar day regardless of the machine's zone.
const MAKKAH = [21.4225, 39.8262];
const mk = computeTimes(new Date(2026, 2, 20), ...MAKKAH, 3, { method: 'makkah' });
console.log(`Makkah 2026-03-20 (makkah):  ${show(mk, 3)}`);
test('Makkah Dhuhr ~12:27', () => near(mk.dhuhr, 3, '12:27', 2, 'Dhuhr'));
test('Makkah Maghrib ~18:32', () => near(mk.maghrib, 3, '18:32', 2, 'Maghrib'));
test('Makkah Isha = Maghrib + 90 min exactly', () => assert.equal(mk.isha - mk.maghrib, 90 * 60000));
test('Makkah order', () => ordered(mk, 'Makkah'));
test('Umm al-Qura Ramadan Isha = Maghrib + 120', () => {
  const r = computeTimes(new Date(2026, 2, 20), ...MAKKAH, 3, { method: 'makkah', ramadan: true });
  assert.equal(r.isha - r.maghrib, 120 * 60000);
});
test('Qatar Isha = Maghrib + 90', () => {
  const q = computeTimes(new Date(2026, 5, 21), 25.2854, 51.531, 3, { method: 'qatar' });
  assert.equal(q.isha - q.maghrib, 90 * 60000);
});

const DUBAI = [25.2048, 55.2708];
const db = computeTimes(new Date(2026, 5, 21), ...DUBAI, 4, { method: 'dubai' });
console.log(`Dubai 2026-06-21 (dubai):    ${show(db, 4)}`);
test('Dubai Fajr ~04:00 (±5)', () => near(db.fajr, 4, '04:00', 5, 'Fajr'));
test('Dubai Dhuhr ~12:24 (incl. +3 min UAE precaution)', () => near(db.dhuhr, 4, '12:24', 2, 'Dhuhr'));
test('Dubai Maghrib ~19:15 (incl. +3 min UAE precaution)', () => near(db.maghrib, 4, '19:15', 2, 'Maghrib'));
test('Mosque offsets shift each prayer', () => {
  const base = computeTimes(new Date(2026, 9, 29), ...DUBAI, 4, { method: 'dubai' });
  const moved = computeTimes(new Date(2026, 9, 29), ...DUBAI, 4, { method: 'dubai', offsets: { fajr: 2, isha: -5 } });
  if (moved.fajr - base.fajr !== 2 * 60000) throw new Error('fajr offset');
  if (moved.isha - base.isha !== -5 * 60000) throw new Error('isha offset');
  if (moved.asr - base.asr !== 0) throw new Error('asr unchanged');
});
test('Dubai order', () => ordered(db, 'Dubai'));

const LONDON = [51.5074, -0.1278];
for (const highLat of ['angle', 'middle', 'seventh']) {
  const ld = computeTimes(new Date(2026, 5, 21), ...LONDON, 1, { method: 'mwl', highLat });
  console.log(`London 2026-06-21 (mwl, ${highLat.padEnd(7)}): ${show(ld, 1)}`);
  test(`London high-latitude (${highLat}) valid and ordered`, () => ordered(ld, `London/${highLat}`));
}
test('London sunrise ~04:43, Maghrib ~21:21', () => {
  const ld = computeTimes(new Date(2026, 5, 21), ...LONDON, 1, { method: 'mwl' });
  near(ld.sunrise, 1, '04:43', 2, 'Sunrise');
  near(ld.maghrib, 1, '21:21', 2, 'Maghrib');
});

test('Order holds for every method in several cities and seasons', () => {
  const places = [[...MAKKAH, 3], [...DUBAI, 4], [24.8607, 67.0011, 5], [40.7128, -74.006, -5], [-33.8688, 151.2093, 10], [1.3521, 103.8198, 8], [41.0082, 28.9784, 3]];
  for (const m of METHODS) for (const [la, lo, tz] of places) for (const mo of [0, 3, 6, 9]) {
    ordered(computeTimes(new Date(2026, mo, 15), la, lo, tz, { method: m.id }), `${m.id} ${la},${lo} month ${mo + 1}`);
  }
});

test('Hanafi Asr later than standard', () => {
  for (const [la, lo, tz] of [[...MAKKAH, 3], [...DUBAI, 4], [...LONDON, 1], [24.8607, 67.0011, 5]]) {
    const s = computeTimes(new Date(2026, 5, 21), la, lo, tz, { method: 'mwl', asr: 'standard' });
    const h = computeTimes(new Date(2026, 5, 21), la, lo, tz, { method: 'mwl', asr: 'hanafi' });
    assert.ok(h.asr > s.asr, `${la},${lo}: hanafi ${h.asr.toISOString()} <= standard ${s.asr.toISOString()}`);
    assert.equal(h.dhuhr.getTime(), s.dhuhr.getTime());
  }
});

test('Dhuhr offset option', () => {
  const a = computeTimes(new Date(2026, 2, 20), ...MAKKAH, 3, { method: 'makkah', dhuhrOffset: 1 });
  assert.equal(a.dhuhr - mk.dhuhr, 60000);
});

test('Times are whole minutes', () => {
  for (const k of KEYS) assert.equal(db[k].getTime() % 60000, 0, k);
});

test('Default tz offset comes from the Date', () => {
  const d = new Date(2026, 5, 21);
  const a = computeTimes(d, ...DUBAI, undefined, { method: 'dubai' });
  const b = computeTimes(d, ...DUBAI, -new Date(2026, 5, 21, 12).getTimezoneOffset() / 60, { method: 'dubai' });
  assert.equal(a.dhuhr.getTime(), b.dhuhr.getTime());
});

const qb = (la, lo) => qiblaBearing(la, lo);
console.log(`Qibla: London ${qb(...LONDON).toFixed(2)}°, New York ${qb(40.7128, -74.006).toFixed(2)}°, Dubai ${qb(...DUBAI).toFixed(2)}°`);
test('Qibla from London ~119°', () => assert.ok(Math.abs(qb(...LONDON) - 119) <= 1, String(qb(...LONDON))));
test('Qibla from New York ~58.5°', () => assert.ok(Math.abs(qb(40.7128, -74.006) - 58.5) <= 1, String(qb(40.7128, -74.006))));
test('Qibla from Dubai ~258°', () => assert.ok(Math.abs(qb(...DUBAI) - 258) <= 1, String(qb(...DUBAI))));
test('Distance to Makkah', () => {
  const l = distanceToMakkahKm(...LONDON), d = distanceToMakkahKm(...DUBAI);
  console.log(`       London ${l.toFixed(0)} km, Dubai ${d.toFixed(0)} km`);
  assert.ok(Math.abs(l - 4790) < 30, String(l));
  assert.ok(Math.abs(d - 1630) < 30, String(d));
  assert.ok(distanceToMakkahKm(...MAKKAH) < 0.001);
});

test('nextPrayer', () => {
  const t = mk;
  const at = (min) => new Date(Date.UTC(2026, 2, 20) - 3 * 3600000 + min * 60000);
  assert.equal(nextPrayer(t, at(parse('03:00'))).key, 'fajr');
  assert.equal(nextPrayer(t, at(parse('06:30'))).key, 'dhuhr', 'sunrise is skipped');
  assert.equal(nextPrayer(t, at(parse('06:30')), null, { includeSunrise: true }).key, clock(t.sunrise, 3) > parse('06:30') ? 'sunrise' : 'dhuhr');
  const n = nextPrayer(t, at(parse('13:00')));
  assert.equal(n.key, 'asr');
  assert.equal(n.ms, t.asr - at(parse('13:00')));
  assert.equal(nextPrayer(t, at(parse('23:30'))), null);
  const tomorrow = computeTimes(new Date(2026, 2, 21), ...MAKKAH, 3, { method: 'makkah' });
  const r = nextPrayer(t, at(parse('23:30')), tomorrow);
  assert.equal(r.key, 'fajr');
  assert.equal(r.tomorrow, true);
});

test('Default method by country and time zone', () => {
  const cases = { SA: 'makkah', 'Saudi Arabia': 'makkah', AE: 'dubai', 'United Arab Emirates': 'dubai', EG: 'egypt', PK: 'karachi', India: 'karachi', BD: 'karachi',
    US: 'isna', Canada: 'isna', KW: 'kuwait', Qatar: 'qatar', SG: 'singapore', Malaysia: 'singapore', ID: 'singapore', Turkey: 'turkey', GB: 'mwl', France: 'mwl' };
  for (const [c, m] of Object.entries(cases)) assert.equal(methodForCountry(c), m, c);
  assert.equal(methodForCountry(undefined), 'mwl');
  assert.equal(methodForTimezone('America/Chicago'), 'isna');
  assert.equal(methodForTimezone('Asia/Riyadh'), 'makkah');
  assert.equal(methodForTimezone('Europe/London'), 'mwl');
});

test('tzOffsetHours', () => {
  assert.equal(tzOffsetHours('Asia/Riyadh', new Date(Date.UTC(2026, 0, 1))), 3);
  assert.equal(tzOffsetHours('Europe/London', new Date(Date.UTC(2026, 5, 21, 12))), 1);
  assert.equal(tzOffsetHours('Asia/Kolkata', new Date(Date.UTC(2026, 5, 21, 12))), 5.5);
  assert.equal(tzOffsetHours('America/New_York', new Date(Date.UTC(2026, 0, 15, 12))), -5);
});

test('METHODS and PRAYERS shape', () => {
  assert.deepEqual(METHODS.map((m) => m.id), ['makkah', 'dubai', 'mwl', 'egypt', 'karachi', 'isna', 'kuwait', 'qatar', 'singapore', 'turkey']);
  for (const m of METHODS) assert.ok(m.label && m.region, m.id);
  assert.deepEqual(PRAYERS.map((p) => p.key), KEYS);
  assert.equal(cardinal(119), 'ESE');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
