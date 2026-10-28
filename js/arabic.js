// Arabic normalisation and the word-level recitation matcher.
// The matcher compares what the speech engine heard with the Mushaf words.
// It detects skipped, wrong and extra words. It does not judge tajweed.

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;

export function normalize(s) {
  return String(s || '')
    .replace(DIACRITICS, '')
    .replace(/[ٱآأإٲٳ]/g, 'ا') // alef forms -> ا
    .replace(/ى/g, 'ي')                                  // ى -> ي
    .replace(/ة/g, 'ه')                                  // ة -> ه
    .replace(/ؤ/g, 'و')                                  // ؤ -> و
    .replace(/ئ/g, 'ي')                                  // ئ -> ي
    .replace(/ء/g, '')                                        // ء dropped
    .replace(/[^ء-ي\s]/g, '')                            // keep Arabic letters only
    .replace(/\s+/g, ' ')
    .trim();
}

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function similar(heard, expected) {
  if (!heard || !expected) return false;
  if (heard === expected) return true;
  const len = Math.max(heard.length, expected.length);
  const ratio = 1 - lev(heard, expected) / len;
  return ratio >= (len <= 3 ? 0.66 : 0.75);
}

// Split Mushaf text into words; standalone pause marks attach to the previous word.
export function splitWords(text) {
  const out = [];
  for (const tok of String(text).split(/\s+/).filter(Boolean)) {
    const n = normalize(tok);
    if (!n) {
      if (out.length) out[out.length - 1].display += ' ' + tok;
      else out.push({ display: tok, norm: '', mark: true });
    } else {
      out.push({ display: tok, norm: n });
    }
  }
  return out.filter((w) => !w.mark);
}

const BASMALA = normalize('بسم الله الرحمن الرحيم');
export function stripBasmala(text) {
  const parts = String(text).split(/\s+/);
  if (parts.length > 4 && normalize(parts.slice(0, 4).join(' ')) === BASMALA) {
    return { basmala: parts.slice(0, 4).join(' '), text: parts.slice(4).join(' ') };
  }
  return { basmala: '', text };
}

/**
 * Matcher over a list of expected words.
 * words[i].status: 'pending' | 'ok' | 'wrong' | 'skipped'
 * onMark(mark) is called for each mistake: { index, type: 'wrong'|'skipped'|'extra', heard }
 */
export class Matcher {
  constructor(words, onMark = () => {}) {
    this.words = words.map((w) => ({ ...w, status: 'pending' }));
    this.cursor = 0;
    this.onMark = onMark;
    this.extras = 0;
  }

  get done() { return this.cursor >= this.words.length; }

  peek() {
    if (this.done) return -1;
    const i = this.cursor;
    this.words[i].peeked = true;
    return i;
  }

  feed(transcript) {
    const heard = normalize(transcript).split(' ').filter(Boolean);
    let k = 0;
    while (k < heard.length && !this.done) {
      const h = heard[k];
      const next = heard[k + 1];
      const c = this.cursor;
      const exp = this.words;

      if (similar(h, exp[c].norm)) { this.ok(c); k++; continue; }
      if (next && similar(h + next, exp[c].norm)) { this.ok(c); k += 2; continue; }
      if (c + 1 < exp.length && similar(h, exp[c].norm + exp[c + 1].norm)) { this.ok(c); this.ok(c + 1); k++; continue; }

      // Skipped one or two words?
      let skipped = false;
      for (let ahead = 1; ahead <= 2 && c + ahead < exp.length; ahead++) {
        if (similar(h, exp[c + ahead].norm) && (ahead === 1 || h.length >= 3)) {
          for (let j = c; j < c + ahead; j++) this.miss(j, 'skipped', '');
          this.ok(c + ahead);
          skipped = true;
          break;
        }
      }
      if (skipped) { k++; continue; }

      // Repeating the previous word is not a mistake.
      if (c > 0 && similar(h, exp[c - 1].norm)) { k++; continue; }

      // An extra word if the next heard word fits the expected one.
      if (next && similar(next, exp[c].norm)) { this.extras++; this.onMark({ index: c, type: 'extra', heard: h }); k++; continue; }

      // Otherwise the expected word was said wrongly.
      this.miss(c, 'wrong', h);
      k++;
    }
  }

  ok(i) {
    this.words[i].status = 'ok';
    this.cursor = Math.max(this.cursor, i + 1);
  }

  miss(i, type, heard) {
    this.words[i].status = type;
    this.cursor = Math.max(this.cursor, i + 1);
    this.onMark({ index: i, type, heard });
  }

  score() {
    const total = this.words.length || 1;
    const ok = this.words.filter((w) => w.status === 'ok' && !w.peeked).length;
    return Math.round((ok / total) * 100);
  }
}
