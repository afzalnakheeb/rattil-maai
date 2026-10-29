// Prayer times and Qibla direction. Pure calculation: no DOM, safe to import in Node.
// Algorithm follows the well-known PrayTimes.org approach: sun declination and the
// equation of time from a low-precision solar model, Fajr/Isha by depression angle
// (or fixed minutes after Maghrib), Asr by shadow length, Maghrib at sunset.

export const KAABA = { lat: 21.4225, lng: 39.8262 };

// fajr / isha are sun depression angles in degrees; ishaMin means "minutes after Maghrib".
export const METHODS = [
  { id: 'makkah', label: 'Umm al-Qura, Makkah', region: 'Saudi Arabia', fajr: 18.5, ishaMin: 90, ishaMinRamadan: 120 },
  // UAE (Awqaf / IACAD): 18.2° plus 3-minute precautions on sunrise, Dhuhr, Asr and Maghrib.
  { id: 'dubai', label: 'UAE (Awqaf, Dubai)', region: 'United Arab Emirates', fajr: 18.2, isha: 18.2, adjust: { sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3 } },
  { id: 'mwl', label: 'Muslim World League', region: 'Europe, Far East, most other places', fajr: 18, isha: 17 },
  { id: 'egypt', label: 'Egyptian General Authority of Survey', region: 'Egypt, Africa, Levant', fajr: 19.5, isha: 17.5 },
  { id: 'karachi', label: 'University of Islamic Sciences, Karachi', region: 'Pakistan, India, Bangladesh', fajr: 18, isha: 18 },
  { id: 'isna', label: 'Islamic Society of North America', region: 'United States, Canada', fajr: 15, isha: 15 },
  { id: 'kuwait', label: 'Kuwait', region: 'Kuwait', fajr: 18, isha: 17.5 },
  { id: 'qatar', label: 'Qatar', region: 'Qatar', fajr: 18, ishaMin: 90 },
  { id: 'singapore', label: 'MUIS Singapore', region: 'Singapore, Malaysia, Indonesia', fajr: 20, isha: 18 },
  { id: 'turkey', label: 'Diyanet, Turkey', region: 'Turkey', fajr: 18, isha: 17 },
];

export const PRAYERS = [
  { key: 'fajr', en: 'Fajr', ar: 'الفجر' },
  { key: 'sunrise', en: 'Sunrise', ar: 'الشروق' },
  { key: 'dhuhr', en: 'Dhuhr', ar: 'الظهر' },
  { key: 'asr', en: 'Asr', ar: 'العصر' },
  { key: 'maghrib', en: 'Maghrib', ar: 'المغرب' },
  { key: 'isha', en: 'Isha', ar: 'العشاء' },
];

export const getMethod = (id) => METHODS.find((m) => m.id === id) || METHODS.find((m) => m.id === 'mwl');

// ---- Default method from a country (ISO code or English name) or an IANA time zone ----
const BY_CODE = {
  SA: 'makkah', AE: 'dubai', EG: 'egypt', PK: 'karachi', IN: 'karachi', BD: 'karachi',
  US: 'isna', CA: 'isna', KW: 'kuwait', QA: 'qatar', SG: 'singapore', MY: 'singapore', ID: 'singapore', TR: 'turkey',
};
const BY_NAME = {
  'saudi arabia': 'SA', 'united arab emirates': 'AE', uae: 'AE', egypt: 'EG', pakistan: 'PK', india: 'IN', bangladesh: 'BD',
  'united states': 'US', 'united states of america': 'US', usa: 'US', canada: 'CA', kuwait: 'KW', qatar: 'QA',
  singapore: 'SG', malaysia: 'MY', indonesia: 'ID', turkey: 'TR', 'türkiye': 'TR', turkiye: 'TR',
};
export function methodForCountry(country) {
  if (!country) return 'mwl';
  const c = String(country).trim();
  const code = c.length === 2 ? c.toUpperCase() : BY_NAME[c.toLowerCase()];
  return BY_CODE[code] || 'mwl';
}
const BY_TZ = {
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Africa/Cairo': 'EG', 'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD', 'Asia/Kuwait': 'KW', 'Asia/Qatar': 'QA', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY',
  'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Pontianak': 'ID', 'Europe/Istanbul': 'TR',
};
const NA_TZ = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns|Moncton|Whitehorse|Yellowknife|Iqaluit)|Pacific\/Honolulu|US\/.+|Canada\/.+)$/;
export function methodForTimezone(tz) {
  if (!tz) return 'mwl';
  if (NA_TZ.test(tz)) return 'isna';
  return BY_CODE[BY_TZ[tz]] || 'mwl';
}

// ---- Degree maths ----
const RAD = Math.PI / 180;
const dsin = (d) => Math.sin(d * RAD);
const dcos = (d) => Math.cos(d * RAD);
const dtan = (d) => Math.tan(d * RAD);
const darcsin = (x) => Math.asin(x) / RAD;
const darccos = (x) => Math.acos(x) / RAD;
const darctan2 = (y, x) => Math.atan2(y, x) / RAD;
const darccot = (x) => Math.atan(1 / x) / RAD;
const fix = (a, b) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };
const fixAngle = (a) => fix(a, 360);
const fixHour = (h) => fix(h, 24);
const timeDiff = (t1, t2) => fixHour(t2 - t1);

function julian(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

// Solar declination (degrees) and equation of time (hours) for a Julian date.
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
  return { declination: darcsin(dsin(e) * dsin(L)), equation: q / 15 - fixHour(RA) };
}

// Time offset in hours for an IANA zone on a given date (e.g. 'Asia/Riyadh' -> 3).
export function tzOffsetHours(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000) / 60;
  } catch {
    return -date.getTimezoneOffset() / 60;
  }
}

// Is this date inside Ramadan (Umm al-Qura calendar)? Used for Isha +120 min.
export function isRamadan(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).formatToParts(date);
    return parts.find((x) => x.type === 'month')?.value === '9';
  } catch { return false; }
}

/**
 * Compute the day's times.
 * date: any Date; its local calendar day (getFullYear/getMonth/getDate) is the day computed.
 * tzOffsetHours: the location's UTC offset; defaults to the device's offset on that date.
 * opts: { method: id, asr: 'standard'|'hanafi', highLat: 'angle'|'middle'|'seventh'|'none',
 *         ramadan: boolean|'auto' (Umm al-Qura Isha 120 min, default 'auto'), dhuhrOffset: minutes (default 0),
 *         offsets: { fajr, sunrise, dhuhr, asr, maghrib, isha } minutes added after the method's own adjustments }
 * Returns { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date instants rounded to the minute.
 * When tzOffsetHours equals the device's zone they read correctly with toLocaleTimeString();
 * for another zone, format them with { timeZone } of that place.
 */
export function computeTimes(date, lat, lng, tzOffset, opts = {}) {
  const { asr = 'standard', highLat = 'angle', ramadan = 'auto', dhuhrOffset = 0 } = opts;
  const adj = (k) => ((getMethod(opts.method).adjust || {})[k] || 0) + (Number((opts.offsets || {})[k]) || 0);
  const m = getMethod(opts.method);
  const y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
  const tz = Number.isFinite(tzOffset) ? tzOffset : -new Date(y, mo - 1, d, 12).getTimezoneOffset() / 60;
  const jDate = julian(y, mo, d) - lng / (15 * 24);

  const midDay = (t) => fixHour(12 - sunPosition(jDate + t).equation);
  const sunAngleTime = (angle, t, ccw) => {
    const decl = sunPosition(jDate + t).declination;
    const noon = midDay(t);
    const v = darccos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15;
    return noon + (ccw ? -v : v);
  };
  const asrTime = (factor, t) => {
    const decl = sunPosition(jDate + t).declination;
    return sunAngleTime(-darccot(factor + dtan(Math.abs(lat - decl))), t);
  };

  const riseSet = 0.833; // refraction + solar semi-diameter
  const ishaMin = m.ishaMin != null
    ? ((ramadan === true || (ramadan === 'auto' && isRamadan(date))) && m.ishaMinRamadan ? m.ishaMinRamadan : m.ishaMin)
    : null;

  // Initial guesses (hours), refined once at those day portions.
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
  t = {
    fajr: sunAngleTime(m.fajr, p.fajr, true),
    sunrise: sunAngleTime(riseSet, p.sunrise, true),
    dhuhr: midDay(p.dhuhr),
    asr: asrTime(asr === 'hanafi' ? 2 : 1, p.asr),
    sunset: sunAngleTime(riseSet, p.sunset),
    isha: ishaMin == null ? sunAngleTime(m.isha, p.isha) : NaN,
  };

  // Local solar time -> the location's clock.
  for (const k in t) t[k] += tz - lng / 15;

  // High latitudes: cap Fajr/Isha to a portion of the night (also fills in when the angle is never reached).
  if (highLat !== 'none' && Number.isFinite(t.sunrise) && Number.isFinite(t.sunset)) {
    const night = timeDiff(t.sunset, t.sunrise);
    const portion = (angle) => night * (highLat === 'middle' ? 1 / 2 : highLat === 'seventh' ? 1 / 7 : angle / 60);
    const fp = portion(m.fajr);
    if (!Number.isFinite(t.fajr) || timeDiff(t.fajr, t.sunrise) > fp) t.fajr = t.sunrise - fp;
    if (ishaMin == null) {
      const ip = portion(m.isha);
      if (!Number.isFinite(t.isha) || timeDiff(t.sunset, t.isha) > ip) t.isha = t.sunset + ip;
    }
  }

  // Round each to the nearest minute; fixed-minute Isha is exact from rounded Maghrib.
  const mins = (h) => Math.round(h * 60);
  const out = {
    fajr: mins(t.fajr) + adj('fajr'),
    sunrise: mins(t.sunrise) + adj('sunrise'),
    dhuhr: mins(t.dhuhr) + dhuhrOffset + adj('dhuhr'),
    asr: mins(t.asr) + adj('asr'),
    maghrib: mins(t.sunset) + adj('maghrib'),
  };
  out.isha = (ishaMin == null ? mins(t.isha) : out.maghrib + ishaMin) + adj('isha');

  const base = Date.UTC(y, mo - 1, d) - tz * 3600000;
  const res = {};
  for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    res[k] = new Date(Number.isFinite(out[k]) ? base + out[k] * 60000 : NaN);
  }
  return res;
}

// Options for computeTimes from the saved settings.prayer object.
export function optionsFrom(p = {}) {
  return { method: p.method || 'mwl', asr: p.asr || 'standard', highLat: p.highLat || 'angle', offsets: p.offsets || {}, ramadan: 'auto' };
}

/**
 * The next prayer after `now` (sunrise is skipped unless includeSunrise).
 * Pass tomorrow's times to roll over to tomorrow's Fajr after Isha; otherwise returns null then.
 * Returns { key, en, ar, time, ms, tomorrow } or null.
 */
export function nextPrayer(times, now = new Date(), tomorrowTimes = null, { includeSunrise = false } = {}) {
  const list = PRAYERS.filter((p) => includeSunrise || p.key !== 'sunrise');
  for (const p of list) {
    const tt = times[p.key];
    if (tt && Number.isFinite(tt.getTime()) && tt > now) return { ...p, time: tt, ms: tt - now, tomorrow: false };
  }
  if (tomorrowTimes?.fajr && Number.isFinite(tomorrowTimes.fajr.getTime())) {
    const p = PRAYERS[0];
    return { ...p, time: tomorrowTimes.fajr, ms: tomorrowTimes.fajr - now, tomorrow: true };
  }
  return null;
}

// Initial great-circle bearing from (lat, lng) to the Kaaba, degrees clockwise from true north.
export function qiblaBearing(lat, lng) {
  const p1 = lat * RAD, p2 = KAABA.lat * RAD, dl = (KAABA.lng - lng) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return fixAngle(Math.atan2(y, x) / RAD);
}

// Great-circle (haversine) distance to the Kaaba in kilometres.
export function distanceToMakkahKm(lat, lng) {
  const R = 6371.0088;
  const p1 = lat * RAD, p2 = KAABA.lat * RAD;
  const dp = (KAABA.lat - lat) * RAD, dl = (KAABA.lng - lng) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// 16-point compass label for a bearing, e.g. 119 -> 'ESE'.
export function cardinal(deg) {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return pts[Math.round(fixAngle(deg) / 22.5) % 16];
}
