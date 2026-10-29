// Small UI helpers shared by every view.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (same(d, today)) return `Today, ${time}`;
  if (same(d, y)) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + `, ${time}`;
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loading(label = 'Loading') {
  return `<div class="spinner" role="img" aria-label="${esc(label)}"></div>`;
}

export function errorBox(msg, retryId) {
  return `<div class="notice red stack-s"><p>${esc(msg)}</p>${retryId ? `<div><button class="btn sm" id="${retryId}" type="button">Try again</button></div>` : ''}</div>`;
}

export function band(total) {
  if (total >= 90) return { label: 'Excellent · mumtaz', cls: '' };
  if (total >= 80) return { label: 'Very good', cls: '' };
  if (total >= 70) return { label: 'Good', cls: 'gold' };
  return { label: 'Repeat', cls: 'red' };
}

// Page lifecycle. A view registers what to stop when the user leaves it
// (microphone, camera, timers, audio). If the user already left, it runs now.
export function onLeave(root, fn) {
  const page = root?.closest?.('.page') || root;
  if (!page || !page.isConnected) { try { fn(); } catch (e) { console.error(e); } return; }
  (page.__leave = page.__leave || []).push(fn);
}
export function leave(page) {
  if (!page) return;
  const fns = page.__leave || [];
  page.__leave = [];
  fns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
}
// True while this view is still the one on screen.
export const alive = (root) => !!root && root.isConnected;
