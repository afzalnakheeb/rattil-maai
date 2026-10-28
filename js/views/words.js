import { esc, arNum } from '../ui.js';

// Renders a session's words. hide: practice mode hides words until they are recited.
export function renderWords(session, { hide = false, tappable = false } = {}) {
  const parts = [];
  for (const it of session.items) {
    if (it.kind === 'surah') parts.push(`<span style="flex-basis:100%;height:0"></span><span class="surah-head" style="flex-basis:100%;max-width:260px">${esc(it.text)}</span><span style="flex-basis:100%;height:0"></span>`);
    else if (it.kind === 'basmala') continue;
    else if (it.kind === 'end') parts.push(`<span class="ayah-num">﴿${arNum(it.ayah)}﴾</span>`);
    else {
      const i = it.index;
      const w = session.words[i];
      const st = session.wordState(i);
      const cls = ['w'];
      if (st.firm) cls.push('bad');
      else if (st.suggested) cls.push('ai');
      else if (st.peeked) cls.push('peeked');
      else if (st.current) cls.push('current');
      else if (st.ok) cls.push('ok');
      else if (!hide) cls.push(st.reached ? 'ok' : 'pending');
      if (hide && !st.reached && !st.peeked) cls.push('hidden');
      const label = hide && !st.reached ? `Word ${i + 1}, hidden` : `${w.display}, ayah ${w.ayah}${st.firm ? ', mistake' : st.suggested ? ', AI suggestion' : ''}`;
      const tag = tappable ? 'button' : 'span';
      parts.push(`<${tag} ${tappable ? 'type="button"' : ''} class="${cls.join(' ')}" data-i="${i}" aria-label="${esc(label)}">${esc(w.display)}</${tag}>`);
    }
  }
  return `<div class="words" lang="ar">${parts.join('')}</div>`;
}
