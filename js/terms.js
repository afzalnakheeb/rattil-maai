// Names for the three daily parts. Arab tahfiz circles say الحفظ الجديد and المراجعة; South Asian
// madrasas say sabaq, sabqi and manzil. The app follows the user's language unless they choose in Settings.
import * as store from './store.js';

const SETS = {
  arabic: { sabaq: ['New lesson', 'الحفظ الجديد'], sabqi: ['Recent revision', 'المراجعة القريبة'], manzil: ['Older revision', 'المراجعة البعيدة'] },
  classic: { sabaq: ['New lesson', 'Sabaq'], sabqi: ['Recent revision', 'Sabqi'], manzil: ['Old revision', 'Manzil'] },
};

export const TERM_CHOICES = [['auto', 'Automatic (follows your language)'], ['arabic', 'Arabic: الحفظ الجديد · المراجعة'], ['classic', 'South Asian: sabaq · sabqi · manzil']];

export function termStyle() {
  const s = store.get().settings || {};
  if (s.planTerms === 'arabic' || s.planTerms === 'classic') return s.planTerms;
  if (s.homeLang) return s.homeLang === 'ar' ? 'arabic' : 'classic';
  let first = '';
  try { first = String((navigator.languages && navigator.languages[0]) || navigator.language || ''); } catch { /* ignore */ }
  return first.toLowerCase().startsWith('ar') ? 'arabic' : 'classic';
}

// Plain text, e.g. "Recent revision · المراجعة القريبة"
export function planLabel(key) {
  const [en, term] = SETS[termStyle()][key] || [key, ''];
  return term ? `${en} · ${term}` : en;
}
// For HTML: the Arabic term isolated so it reads correctly inside an English line.
export function planLabelHtml(key) {
  const [en, term] = SETS[termStyle()][key] || [key, ''];
  if (!term) return en;
  return termStyle() === 'arabic' ? `${en} · <bdi lang="ar" dir="rtl">${term}</bdi>` : `${en} · ${term}`;
}
