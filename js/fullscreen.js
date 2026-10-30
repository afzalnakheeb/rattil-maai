// Full screen and "install as app".
// - Android and desktop: the Fullscreen API hides the browser bars; Esc or the button exits.
// - Where the browser offers it: one-tap install, which opens the app full screen from its own icon.
// - iPhone: Safari has no fullscreen for pages, so we show the two-step "Add to Home Screen" guide.
// Also keeps the bottom tab bar above toolbars some browsers draw over the page.

import { icons } from './icons.js';
import { toast } from './ui.js';

let deferredPrompt = null;
const listeners = new Set();

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const isIPhone = () => /iPhone|iPod/.test(navigator.userAgent);
const fsEnabled = () => !isIPhone() && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: fullscreen)').matches || window.navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/></svg>';
const SHRINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4"/></svg>';
const IOS_SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M6.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7.5A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-.5"/></svg>';
const IOS_ADD = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true" style="vertical-align:-3px"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>';

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; listeners.forEach((f) => f()); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; closeSheet(); toast('Installed. Open Recite With Me from your home screen.'); listeners.forEach((f) => f()); });

async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    return true;
  } catch { return false; }
}
function exitFullscreen() {
  try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch { /* ignore */ }
}

let sheetEl = null;
function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }

function openSheet() {
  closeSheet();
  const ios = isIOS();
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet-backdrop';
  sheetEl.innerHTML = `
    <div class="sheet card stack" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
      <div class="spread"><h2 id="sheetTitle">Open as a full-screen app</h2><button class="icon-btn" type="button" data-close aria-label="Close">✕</button></div>
      <p class="small muted">Recite With Me works best as an app on your home screen: full screen, no browser bars, and it opens straight to your plan.</p>
      ${deferredPrompt ? `<button class="btn block lg" type="button" data-install>${icons.plus} Install the app</button>` : ''}
      ${ios ? `
        <ol class="sheet-steps">
          <li>Tap the Share button ${IOS_SHARE} in Safari’s toolbar.</li>
          <li>Choose <b>Add to Home Screen</b> ${IOS_ADD}.</li>
          <li>Open <b>Recite With Me</b> from your home screen. It runs full screen.</li>
        </ol>
        <p class="xs muted">On iPhone, Safari does not let websites go full screen on their own; the home-screen app is the way.</p>`
      : !deferredPrompt ? `
        <ol class="sheet-steps">
          <li>Open your browser’s menu (⋮ or ⋯).</li>
          <li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
          <li>Open <b>Recite With Me</b> from your home screen or app list.</li>
        </ol>` : ''}
      ${fsEnabled() ? '<button class="btn ghost block" type="button" data-fs>Just go full screen now</button>' : ''}
    </div>`;
  document.body.appendChild(sheetEl);
  sheetEl.addEventListener('click', async (e) => {
    if (e.target === sheetEl || e.target.closest('[data-close]')) { closeSheet(); return; }
    if (e.target.closest('[data-install]') && deferredPrompt) {
      const p = deferredPrompt; deferredPrompt = null;
      p.prompt();
      try { await p.userChoice; } catch { /* ignore */ }
      closeSheet();
      return;
    }
    if (e.target.closest('[data-fs]')) { closeSheet(); await enterFullscreen(); }
  });
  sheetEl.querySelector('[data-close]').focus();
}

// The header button: full screen where possible, otherwise the install guide.
export function initFullscreenButton(btn) {
  const paint = () => {
    const on = !!fsEl();
    btn.hidden = isStandalone() && !on;
    btn.innerHTML = on ? SHRINK : EXPAND;
    btn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    btn.title = on ? 'Exit full screen (Esc)' : 'Full screen';
  };
  btn.addEventListener('click', async () => {
    if (fsEl()) { exitFullscreen(); return; }
    // Offer install first when the browser supports it (true app, every time); otherwise full screen now.
    if (deferredPrompt || !fsEnabled()) { openSheet(); return; }
    const ok = await enterFullscreen();
    if (!ok) openSheet();
  });
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  listeners.add(paint);
  paint();
}

// Keep the bottom bar clear of browser toolbars drawn over the page, and hide it while the keyboard is up.
export function watchViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const update = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    const keyboard = vv.height < window.innerHeight * 0.72 && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    root.style.setProperty('--vv-bottom', `${keyboard ? 0 : Math.min(covered, 160)}px`);
    root.classList.toggle('keyboard-open', keyboard);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 300));
  update();
}

// Offer 'add to home screen' from elsewhere in the app (after a first completed day).
export const openInstallSheet = () => openSheet();
