import * as store from '../store.js';
import { icons } from '../icons.js';
import { esc } from '../ui.js';

const TILES = [
  ['adhkar', 'Adhkar', 'Morning, evening, after salah, sleep', 'sun', 'gold'],
  ['duas', 'Duas and Ruqyah', 'Short and full Ruqyah, duas for every moment', 'hands', 'gold'],
  ['prayer', 'Prayer times and Qibla', 'Salah times for your city and the Qibla compass', 'moon', ''],
  ['history', 'Recordings', 'Every practice and teacher session with marks', 'clock', ''],
  ['mushaf', 'Mushaf', 'Listen with ayah highlighting and repeat', 'book', ''],
  ['settings', 'Settings', 'Account, teacher, theme, reciter and plan', 'gear', ''],
];

export default function moreView(root) {
  const role = store.get().profile?.role;
  const tiles = role === 'teacher' ? TILES : TILES.filter(([r]) => r !== 'mushaf');
  root.innerHTML = `
    <div class="stack">
      <div class="page-head"><h1>More</h1></div>
      <div class="stack-s">
        ${tiles.map(([r, t, d, ic, tone]) => `
          <a class="card row" href="#/${r}" style="text-decoration:none;color:inherit">
            <div class="icon-tile ${tone}">${icons[ic]}</div>
            <div class="grow"><h3>${esc(t)}</h3><div class="xs muted">${esc(d)}</div></div>
            <span class="muted" aria-hidden="true">${icons.next.replace('<svg', '<svg width="18" height="18"')}</span>
          </a>`).join('')}
      </div>
    </div>`;
}
