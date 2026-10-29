// System / Light / Dark. The inline script in index.html applies it before first paint.
import * as store from './store.js';

export function applyTheme() {
  const t = store.get().settings.theme || 'system';
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
}
