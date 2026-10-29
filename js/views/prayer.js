// Prayer times + Qibla (#/prayer). Location and preferences live in settings.prayer.
import {
  METHODS, PRAYERS, getMethod, computeTimes, nextPrayer, qiblaBearing, distanceToMakkahKm,
  methodForCountry, methodForTimezone, tzOffsetHours, cardinal,
} from '../prayer.js';
import * as store from '../store.js';
import { esc, toast, loading, errorBox } from '../ui.js';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  pin: svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  locate: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  compass: svg('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
};

const STYLE = `<style>
.prayer-page .prayer-row { padding: 11px 10px; margin: 0 -10px; border-top: 1px solid var(--line); }
.prayer-page .prayer-name { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
.prayer-page .prayer-row:first-child { border-top: 0; padding-top: 11px; }
.prayer-page .prayer-row:last-child { padding-bottom: 11px; }
.prayer-page .prayer-row.is-next { background: var(--green-tint); border-radius: 12px; }
.prayer-page .prayer-row.is-next, .prayer-page .prayer-row.is-next + .prayer-row { border-top-color: transparent; }
.prayer-page .prayer-en { font-weight: 600; }
.prayer-page .prayer-ar { font-family: var(--ar); color: var(--muted); font-size: 15px; font-weight: 500; }
.prayer-page .prayer-time { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.prayer-page .prayer-row.is-past .prayer-en, .prayer-page .prayer-row.is-past .prayer-time { color: var(--muted); font-weight: 500; }
.prayer-page .prayer-row.is-sun .prayer-en, .prayer-page .prayer-row.is-sun .prayer-time { color: var(--muted); font-weight: 500; }
.prayer-page .prayer-row.is-next .prayer-en, .prayer-page .prayer-row.is-next .prayer-time { color: var(--green); }
.prayer-page .prayer-countdown { font-size: 22px; font-weight: 600; color: var(--ink); }
.prayer-page .prayer-empty { text-align: center; align-items: center; padding: 24px 18px; }
.prayer-page .prayer-empty .icon-tile { width: 56px; height: 56px; border-radius: 16px; }
.prayer-page .prayer-empty .icon-tile svg { width: 28px; height: 28px; }
.prayer-page .prayer-empty form, .prayer-page .prayer-empty .prayer-results, .prayer-page .prayer-empty .prayer-msg { width: 100%; text-align: left; }
.prayer-page .prayer-search { display: flex; gap: 8px; }
.prayer-page .prayer-search .input { flex: 1; min-width: 0; }
.prayer-page .prayer-results { display: flex; flex-direction: column; }
.prayer-page .prayer-results button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: transparent; border: 0; border-top: 1px solid var(--line); padding: 11px 2px; cursor: pointer; color: var(--ink); }
.prayer-page .prayer-results button:first-child { border-top: 0; }
.prayer-page .prayer-results button:hover { color: var(--green); }
.prayer-page .prayer-results svg { width: 18px; height: 18px; flex: none; color: var(--muted); }
.prayer-page .prayer-dial-wrap { display: flex; justify-content: center; padding: 4px 0; }
.prayer-page .prayer-dial { width: min(250px, 70vw); height: auto; display: block; overflow: visible; }
.prayer-page .prayer-ring { fill: var(--card); stroke: var(--line); stroke-width: 2; transition: fill .3s, stroke .3s; }
.prayer-page .prayer-face { fill: var(--gold-tint); opacity: .55; }
.prayer-page .prayer-tick { stroke: var(--muted); stroke-width: 1; opacity: .55; }
.prayer-page .prayer-tick.major { stroke: var(--ink); stroke-width: 2; opacity: 1; }
.prayer-page .prayer-lbl { fill: var(--muted); font: 600 14px var(--sans); text-anchor: middle; dominant-baseline: central; }
.prayer-page .prayer-lbl.n { fill: var(--ink); font-size: 16px; }
.prayer-page .prayer-needle { stroke: var(--green); stroke-width: 4; stroke-linecap: round; }
.prayer-page .prayer-kaaba { fill: var(--ink); }
.prayer-page .prayer-kaaba-band { stroke: var(--gold); stroke-width: 2.4; }
.prayer-page .prayer-hub { fill: var(--green); stroke: var(--card); stroke-width: 3; }
.prayer-page .prayer-pointer { fill: var(--ink); }
.prayer-page .prayer-rose { transition: transform .25s ease-out; }
.prayer-page .prayer-status { text-align: center; }
.prayer-page .prayer-qibla.is-aligned .prayer-ring { stroke: var(--green); stroke-width: 4; fill: var(--green-tint); }
.prayer-page .prayer-qibla.is-aligned .prayer-status { color: var(--green); font-weight: 600; }
.prayer-page .prayer-msg:empty { display: none; }
@media (prefers-reduced-motion: reduce) { .prayer-page .prayer-rose { transition: none; } }
</style>`;

const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };
const valid = (d) => d instanceof Date && Number.isFinite(d.getTime());
const norm180 = (a) => ((a % 360) + 540) % 360 - 180;

function fmtCoords(lat, lng) {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? 'E' : 'W'}`;
}
function fmtUntil(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
function fmtOffset(h) {
  const sign = h < 0 ? '−' : '+';
  const a = Math.abs(h);
  return `UTC${sign}${Math.floor(a)}${a % 1 ? `:${String(Math.round((a % 1) * 60)).padStart(2, '0')}` : ''}`;
}
function hijriDate(date, timeZone) {
  for (const loc of ['en-u-ca-islamic-umalqura', 'en-u-ca-islamic']) {
    try {
      const f = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', ...(timeZone ? { timeZone } : {}) });
      if (!String(f.resolvedOptions().calendar).startsWith('islamic')) continue;
      return f.format(date);
    } catch { /* calendar or zone unsupported */ }
  }
  return '';
}

export default async function prayerView(root, params) { // eslint-disable-line no-unused-vars
  let alive = true;
  let tick = null;
  let searchCtl = null;
  const ui = { searchOpen: false, geoMsg: '', geoBusy: false };
  const compass = { on: false, heading: null, rot: 0, raf: 0, gotData: false, waitTimer: null, msg: '', aligned: false };
  let shownNextKey = '';

  const cfg = () => {
    const p = store.get().settings?.prayer;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
  };
  const savePrayer = (patch) => store.update((s) => {
    s.settings = s.settings || {};
    s.settings.prayer = { asr: 'standard', method: 'mwl', ...(s.settings.prayer || {}), ...patch };
  });

  // The place's zone: shown times and "today" follow the chosen place, not the device.
  const placeTz = (c) => c.tz || deviceTz();
  const zoneOpt = (c) => { const tz = placeTz(c); return tz && tz !== deviceTz() ? { timeZone: tz } : {}; };
  const fmtTime = (c, d) => (valid(d) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', ...zoneOpt(c) }) : '—');

  function timesFor(c, now, dayOffset = 0) {
    const tz = placeTz(c);
    const off = tz ? tzOffsetHours(tz, now) : -now.getTimezoneOffset() / 60;
    const local = new Date(now.getTime() + off * 3600000); // UTC getters = the place's wall clock
    const day = new Date(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset);
    const noon = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12) - off * 3600000);
    const offDay = tz ? tzOffsetHours(tz, noon) : -day.getTimezoneOffset() / 60;
    return {
      offset: offDay,
      times: computeTimes(day, c.lat, c.lng, offDay, { method: c.method, asr: c.asr, ramadan: c.method === 'makkah' ? 'auto' : false }),
    };
  }

  // ---------- Markup ----------
  function headHtml(c, now) {
    const zone = c ? zoneOpt(c) : {};
    const hijri = hijriDate(now, zone.timeZone);
    const greg = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', ...zone });
    return `<div class="page-head"><h1>Prayer times</h1>
      <p class="small muted">${esc(greg)}${hijri ? ` · <span>${esc(hijri)}</span>` : ''}</p></div>`;
  }

  function searchHtml(autofocus) {
    return `<form class="prayer-search" id="pSearch" role="search">
        <label class="sr-only" for="pQuery">City name</label>
        <input class="input" id="pQuery" type="search" placeholder="Search for a city" autocomplete="off" enterkeyhint="search" required minlength="2" ${autofocus ? 'autofocus' : ''}>
        <button class="btn outline" type="submit" aria-label="Search">${ICON.search}</button>
      </form>
      <div class="prayer-results" id="pResults" aria-live="polite"></div>`;
  }

  function emptyHtml() {
    return `<div class="card stack prayer-empty">
      <div class="icon-tile">${ICON.pin}</div>
      <div class="stack-s"><h2>Set your location</h2>
        <p class="small muted">Prayer times and the Qibla direction depend on where you are. Your location stays on this device.</p></div>
      <button class="btn block" id="pGeo" type="button" ${ui.geoBusy ? 'disabled' : ''}>${ICON.locate}<span>${ui.geoBusy ? 'Finding you…' : 'Use my location'}</span></button>
      <div class="notice small prayer-msg" id="pGeoMsg" role="status">${esc(ui.geoMsg)}</div>
      <div class="xs muted">or</div>
      ${searchHtml(false)}
    </div>`;
  }

  function locationHtml(c) {
    const tz = placeTz(c);
    const off = tz ? tzOffsetHours(tz, new Date()) : null;
    return `<div class="card stack-s">
      <div class="row">
        <div class="icon-tile">${ICON.pin}</div>
        <div class="grow">
          <div class="eyebrow">Location</div>
          <div style="font-weight:600">${esc(c.name || fmtCoords(c.lat, c.lng))}</div>
          <div class="xs muted">${c.name ? `${esc(fmtCoords(c.lat, c.lng))} · ` : ''}${tz ? esc(`${tz.replace(/_/g, ' ')} (${fmtOffset(off)})`) : ''}</div>
        </div>
      </div>
      <div class="row-wrap">
        <button class="btn ghost sm" id="pGeo" type="button" ${ui.geoBusy ? 'disabled' : ''}>${ICON.locate}<span>${ui.geoBusy ? 'Finding you…' : 'Use my location'}</span></button>
        <button class="btn ghost sm" id="pToggleSearch" type="button" aria-expanded="${ui.searchOpen}">${ICON.search}<span>Search city</span></button>
      </div>
      <div class="notice small prayer-msg" id="pGeoMsg" role="status">${esc(ui.geoMsg)}</div>
      ${ui.searchOpen ? searchHtml(true) : ''}
    </div>`;
  }

  function timesHtml(c, now) {
    const { times } = timesFor(c, now);
    const tomorrow = timesFor(c, now, 1).times;
    const next = nextPrayer(times, now, tomorrow);
    shownNextKey = next ? `${next.key}:${next.time.getTime()}` : '';
    const otherZone = !!zoneOpt(c).timeZone;
    const anyInvalid = PRAYERS.some((p) => !valid(times[p.key]));
    const rows = PRAYERS.map((p) => {
      const t = times[p.key];
      const isNext = next && !next.tomorrow && next.key === p.key;
      const past = valid(t) && t <= now && !isNext;
      const cls = ['list-item', 'prayer-row', isNext ? 'is-next' : '', past ? 'is-past' : '', p.key === 'sunrise' ? 'is-sun' : ''].join(' ');
      return `<div class="${cls}" role="listitem" ${isNext ? 'aria-current="time"' : ''}>
        <span class="grow prayer-name"><span class="prayer-en">${p.en}</span><span class="prayer-ar" lang="ar" dir="rtl">${p.ar}</span></span>
        ${isNext ? '<span class="chip">Next</span>' : ''}
        <span class="prayer-time">${fmtTime(c, t)}</span>
      </div>`;
    }).join('');
    return `<div class="card stack">
      <div class="spread">
        <div class="stack-s" style="gap:2px">
          <div class="eyebrow">Next prayer</div>
          <div class="prayer-countdown" id="pCountdown" aria-live="off">${next ? esc(`${next.en} in ${fmtUntil(next.ms)}`) : 'No more prayers today'}</div>
        </div>
        ${next ? `<span class="chip gold">${next.tomorrow ? 'Tomorrow ' : ''}${esc(fmtTime(c, next.time))}</span>` : ''}
      </div>
      <div role="list" aria-label="Today's prayer times">${rows}</div>
      ${anyInvalid ? '<p class="notice small">The sun does not rise or set here today, so some times cannot be calculated.</p>' : ''}
      ${otherZone ? `<p class="xs muted">Times are in ${esc((c.name || 'this place').split(',')[0])} local time.</p>` : ''}
    </div>`;
  }

  function methodHtml(c) {
    const m = getMethod(c.method);
    const asr = c.asr === 'hanafi' ? 'hanafi' : 'standard';
    return `<div class="card stack">
      <div class="field"><label for="pMethod">Calculation method</label>
        <select class="input" id="pMethod">${METHODS.map((x) => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        <span class="xs muted">Used in ${esc(m.region)}. Fajr ${m.fajr}°, Isha ${m.ishaMin ? `${m.ishaMin} min after Maghrib${m.ishaMinRamadan ? ` (${m.ishaMinRamadan} in Ramadan)` : ''}` : `${m.isha}°`}.</span>
      </div>
      <div class="field"><span class="label" id="pAsrLbl">Asr time</span>
        <div class="seg" role="group" aria-labelledby="pAsrLbl">
          <button type="button" data-asr="standard" aria-pressed="${asr === 'standard'}">Standard</button>
          <button type="button" data-asr="hanafi" aria-pressed="${asr === 'hanafi'}">Hanafi</button>
        </div>
        <span class="xs muted">${asr === 'hanafi' ? 'Hanafi: when a shadow is twice an object’s length.' : 'Standard: Shafi’i, Maliki and Hanbali, when a shadow equals an object’s length.'}</span>
      </div>
    </div>`;
  }

  function dialSvg(bearing) {
    let ticks = '';
    for (let a = 0; a < 360; a += 10) {
      const major = a % 90 === 0;
      const r2 = major ? 90 : a % 30 === 0 ? 95 : 99;
      ticks += `<line class="prayer-tick ${major ? 'major' : ''}" x1="0" y1="-104" x2="0" y2="${-r2}" transform="rotate(${a})"/>`;
    }
    const lbl = (t, a, cls = '') => {
      const x = (78 * Math.sin(a * Math.PI / 180)).toFixed(1), y = (-78 * Math.cos(a * Math.PI / 180)).toFixed(1);
      return `<text class="prayer-lbl ${cls}" x="${x}" y="${y}">${t}</text>`;
    };
    return `<svg class="prayer-dial" viewBox="-120 -128 240 248" role="img" aria-label="Compass dial. The Qibla is ${Math.round(bearing)} degrees from north.">
      <g class="prayer-rose" id="pRose" style="transform:rotate(${compass.rot}deg)">
        <circle class="prayer-ring" r="112"/>
        <circle class="prayer-face" r="64"/>
        ${ticks}
        ${lbl('N', 0, 'n')}${lbl('E', 90)}${lbl('S', 180)}${lbl('W', 270)}
        <g transform="rotate(${bearing.toFixed(2)})">
          <line class="prayer-needle" x1="0" y1="0" x2="0" y2="-46"/>
          <g transform="translate(0 -58)">
            <rect class="prayer-kaaba" x="-8" y="-8" width="16" height="16" rx="1.5"/>
            <line class="prayer-kaaba-band" x1="-8" y1="-3.5" x2="8" y2="-3.5"/>
          </g>
        </g>
      </g>
      <circle class="prayer-hub" r="7"/>
      <path class="prayer-pointer" id="pPointer" d="M0 -127 L-7 -115 L7 -115 Z" ${compass.on ? '' : 'visibility="hidden"'}/>
    </svg>`;
  }

  function qiblaHtml(c) {
    const b = qiblaBearing(c.lat, c.lng);
    const km = distanceToMakkahKm(c.lat, c.lng);
    const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    return `<div class="card stack prayer-qibla ${compass.aligned ? 'is-aligned' : ''}" id="pQibla">
      <div class="spread">
        <div class="stack-s" style="gap:2px">
          <div class="eyebrow">Qibla</div>
          <h2>${Math.round(b)}° <span class="muted" style="font-weight:500">${cardinal(b)}</span></h2>
          <div class="xs muted">${km < 1 ? 'Under 1 km to the Kaaba' : `${Math.round(km).toLocaleString()} km to Makkah`}</div>
        </div>
        ${supported ? `<button class="btn ${compass.on ? 'ghost' : 'outline'} sm" id="pCompass" type="button" aria-pressed="${compass.on}">${ICON.compass}<span>${compass.on ? 'Stop compass' : 'Start compass'}</span></button>` : ''}
      </div>
      <div class="prayer-dial-wrap">${dialSvg(b)}</div>
      <p class="small prayer-status" id="pQStatus" aria-live="off">${esc(statusText(b))}</p>
      <p class="xs muted" id="pQHint" style="text-align:center">${esc(hintText())}</p>
    </div>`;
  }

  function statusText(b) {
    if (compass.on && compass.heading != null) {
      const d = norm180(b - compass.heading);
      if (Math.abs(d) <= 5) return 'You are facing the Qibla';
      return `Turn ${d > 0 ? 'right' : 'left'} ${Math.round(Math.abs(d))}°`;
    }
    return `Face ${Math.round(b)}° from north`;
  }
  function hintText() {
    if (compass.msg) return compass.msg;
    if (compass.on) return compass.gotData ? 'Hold the phone flat, away from metal and magnets. Point the top of the phone to the Kaaba.' : 'Hold the phone flat, away from metal. Waiting for the compass…';
    return 'The green needle points to the Kaaba with north at the top. Turn until you face it, or start the compass on your phone.';
  }

  // ---------- Render ----------
  function render() {
    if (!alive) return;
    const c = cfg();
    const now = new Date();
    root.innerHTML = `${STYLE}<div class="stack prayer-page">
      ${headHtml(c, now)}
      ${c ? `${locationHtml(c)}${timesHtml(c, now)}${qiblaHtml(c)}${methodHtml(c)}` : emptyHtml()}
    </div>`;
    bind(c);
  }

  function bind(c) {
    root.querySelector('#pGeo')?.addEventListener('click', locate);
    root.querySelector('#pToggleSearch')?.addEventListener('click', () => { ui.searchOpen = !ui.searchOpen; render(); });
    root.querySelector('#pSearch')?.addEventListener('submit', (e) => { e.preventDefault(); search(root.querySelector('#pQuery').value.trim()); });
    if (!c) return;
    root.querySelector('#pMethod').addEventListener('change', (e) => {
      savePrayer({ method: e.target.value, methodAuto: false });
      render();
    });
    root.querySelectorAll('[data-asr]').forEach((btn) => btn.addEventListener('click', () => { savePrayer({ asr: btn.dataset.asr }); render(); }));
    root.querySelector('#pCompass')?.addEventListener('click', () => (compass.on ? stopCompass(true) : startCompass()));
  }

  // ---------- Location ----------
  function setGeoMsg(msg) {
    ui.geoMsg = msg;
    const el = root.querySelector('#pGeoMsg');
    if (el) el.textContent = msg;
  }

  function locate() {
    if (!('geolocation' in navigator)) { setGeoMsg('This browser cannot share your location. Search for your city instead.'); return; }
    if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) { setGeoMsg('Location needs a secure (https) connection. Search for your city instead.'); return; }
    ui.geoBusy = true; ui.geoMsg = '';
    render();
    navigator.geolocation.getCurrentPosition((pos) => {
      if (!alive) return;
      ui.geoBusy = false; ui.searchOpen = false; ui.geoMsg = '';
      const tz = deviceTz();
      const method = methodForTimezone(tz);
      savePrayer({ lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5), name: null, country: null, tz, method, methodAuto: true });
      render();
      toast(`Location set · ${getMethod(method).label}`);
    }, (err) => {
      if (!alive) return;
      ui.geoBusy = false;
      ui.geoMsg = err && err.code === 1
        ? 'Location permission was denied. Allow location for this site in your browser settings, or search for your city.'
        : err && err.code === 3
          ? 'Finding your location took too long. Try again, or search for your city.'
          : 'Your location is not available right now. Search for your city instead.';
      if (cfg()) ui.searchOpen = true;
      render();
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  }

  async function search(q) {
    const box = root.querySelector('#pResults');
    if (!box || q.length < 2) return;
    if (searchCtl) searchCtl.abort();
    searchCtl = new AbortController();
    box.innerHTML = loading('Searching');
    try {
      const url = `${GEO_URL}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
      const r = await fetch(url, { signal: searchCtl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!alive) return;
      const list = (data.results || []).filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
      if (!list.length) { box.innerHTML = `<p class="small muted" style="padding:8px 2px">No places found for “${esc(q)}”. Check the spelling or try a nearby city.</p>`; return; }
      box.innerHTML = list.map((x, i) => `<button type="button" data-pick="${i}">${ICON.pin}<span class="grow"><b>${esc(x.name)}</b><span class="xs muted" style="display:block">${esc([x.admin1, x.country].filter(Boolean).join(', '))}</span></span></button>`).join('');
      box.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => pick(list[+btn.dataset.pick])));
    } catch (e) {
      if (e.name === 'AbortError' || !alive) return;
      box.innerHTML = errorBox('Could not search for places. Check your connection and try again.', 'pRetry');
      box.querySelector('#pRetry')?.addEventListener('click', () => search(q));
    }
  }

  function pick(x) {
    const method = methodForCountry(x.country_code || x.country);
    const name = [x.name, x.country].filter(Boolean).join(', ');
    savePrayer({ lat: x.latitude, lng: x.longitude, name, country: x.country || null, countryCode: x.country_code || null, tz: x.timezone || deviceTz(), method, methodAuto: true });
    ui.searchOpen = false; ui.geoMsg = '';
    render();
    toast(`${x.name} · ${getMethod(method).label}`);
  }

  // ---------- Compass ----------
  function onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading;
    else if ((e.absolute === true || e.type === 'deviceorientationabsolute') && e.alpha != null) h = 360 - e.alpha;
    if (h == null) return;
    const screenAngle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0;
    compass.heading = ((h + screenAngle) % 360 + 360) % 360;
    if (!compass.gotData) {
      compass.gotData = true; compass.msg = '';
      clearTimeout(compass.waitTimer);
      const hint = root.querySelector('#pQHint');
      if (hint) hint.textContent = hintText();
    }
    if (!compass.raf) compass.raf = requestAnimationFrame(paintCompass);
  }

  function paintCompass() {
    compass.raf = 0;
    const c = cfg();
    if (!alive || !c || compass.heading == null) return;
    const b = qiblaBearing(c.lat, c.lng);
    compass.rot += norm180(-compass.heading - compass.rot); // shortest turn, no spin at 359/0
    const rose = root.querySelector('#pRose');
    if (rose) rose.style.transform = `rotate(${compass.rot}deg)`;
    const aligned = Math.abs(norm180(b - compass.heading)) <= 5;
    if (aligned && !compass.aligned && navigator.vibrate) navigator.vibrate(25);
    compass.aligned = aligned;
    root.querySelector('#pQibla')?.classList.toggle('is-aligned', aligned);
    const st = root.querySelector('#pQStatus');
    if (st) st.textContent = statusText(b);
  }

  async function startCompass() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission(); // iOS 13+: must be called from this click
        if (res !== 'granted') { compass.msg = 'Motion access was not allowed, so the compass cannot turn. Face the bearing shown from north.'; render(); return; }
      } catch {
        compass.msg = 'The compass could not start. Face the bearing shown from north.'; render(); return;
      }
    }
    compass.on = true; compass.gotData = false; compass.heading = null; compass.msg = ''; compass.aligned = false;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrient);
    window.addEventListener('deviceorientation', onOrient);
    clearTimeout(compass.waitTimer);
    compass.waitTimer = setTimeout(() => {
      if (!alive || compass.gotData) return;
      stopCompass(false);
      compass.msg = 'No compass reading from this device. Use the dial with north at the top.';
      render();
    }, 4000);
    render();
  }

  function stopCompass(rerender) {
    window.removeEventListener('deviceorientationabsolute', onOrient);
    window.removeEventListener('deviceorientation', onOrient);
    clearTimeout(compass.waitTimer);
    if (compass.raf) cancelAnimationFrame(compass.raf);
    compass.raf = 0; compass.on = false; compass.heading = null; compass.aligned = false;
    compass.rot = 0;
    if (rerender) { compass.msg = ''; render(); }
  }

  // ---------- Live countdown ----------
  function refresh() {
    if (!alive) return;
    const c = cfg();
    if (!c) return;
    const now = new Date();
    const { times } = timesFor(c, now);
    const next = nextPrayer(times, now, timesFor(c, now, 1).times);
    const key = next ? `${next.key}:${next.time.getTime()}` : '';
    if (key !== shownNextKey) { render(); return; } // a prayer began or the day changed
    const el = root.querySelector('#pCountdown');
    if (el && next) el.textContent = `${next.en} in ${fmtUntil(next.ms)}`;
  }
  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };

  render();
  tick = setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    alive = false;
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onVisible);
    if (searchCtl) searchCtl.abort();
    stopCompass(false);
  };
}
