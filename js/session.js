// One recitation session: words to recite, AI matching, recording and marks.
// Used by the student's practice screen and the teacher's live session.

import { getPortions, describePortions } from './quran.js';
import { Matcher } from './arabic.js';
import { Listener, Recorder, speechSupported } from './speech.js';
import * as store from './store.js';
import { uid } from './ui.js';

export const MARK_LABEL = {
  wrong: 'Wrong word',
  skipped: 'Skipped word',
  extra: 'Extra word',
  peek: 'Needed a peek',
  teacher: 'Marked by teacher',
  self: 'Marked by student',
};

export class RecitationSession {
  constructor({ portions, mode = 'practice', onUpdate = () => {}, onInterim = () => {}, onNotice = () => {}, onMistake = () => {} }) {
    this.onMistake = onMistake;
    this.portions = portions;
    this.mode = mode;
    this.onUpdate = onUpdate;
    this.onInterim = onInterim;
    this.onNotice = onNotice;
    this.items = [];
    this.words = [];
    this.marks = [];
    this.matcher = null;
    this.listener = null;
    this.recorder = new Recorder();
    this.running = false;
    this.started = 0;
    this.recording = false;
    this.title = describePortions(portions);
  }

  async load() {
    const ayahs = await getPortions(this.portions);
    this.ayahs = ayahs;
    const words = [];
    const items = [];
    for (const a of ayahs) {
      if (a.ayah === 1 && a.basmala) items.push({ kind: 'basmala', text: a.basmala, surah: a.surahName });
      if (a.ayah === 1) items.push({ kind: 'surah', text: a.surahName });
      a.words.forEach((w, pos) => {
        items.push({ kind: 'word', index: words.length });
        words.push({ ...w, surah: a.surah, ayah: a.ayah, surahEnglish: a.surahEnglish, number: a.number, pos: pos + 1 });
      });
      items.push({ kind: 'end', ayah: a.ayah });
    }
    this.items = items;
    this.matcher = new Matcher(words, (m) => this._aiMark(m));
    this.words = this.matcher.words;
    if (ayahs.length) this.title = `${ayahs[0].surahEnglish} ${ayahs[0].ayah}–${ayahs[ayahs.length - 1].surah === ayahs[0].surah ? '' : ayahs[ayahs.length - 1].surahEnglish + ' '}${ayahs[ayahs.length - 1].ayah} · ${describePortions(this.portions)}`;
    return this;
  }

  elapsed() { return this.started ? Date.now() - this.started : 0; }

  async start() {
    if (this.running) return;
    this.running = true;
    this.recording = await this.recorder.start();
    this.started = this.started || this.recorder.startedAt || Date.now();
    if (!this.recording) this.onNotice('Recording is not available on this device; marks are still saved.');
    if (speechSupported()) {
      this.listener = new Listener({
        onFinal: (t) => { this.matcher.feed(t); this.onUpdate(); },
        onInterim: (t) => this.onInterim(t),
        onError: (err) => {
          if (err === 'not-allowed' || err === 'service-not-allowed') this.onNotice('Microphone permission was blocked. Allow the microphone for this site and try again.');
          else if (err === 'audio-capture') this.onNotice('The AI check cannot listen while recording on this device. Recording continues; the teacher can still mark mistakes.');
          else if (err === 'network') this.onNotice('The AI check needs an internet connection.');
        },
      });
      this.listener.start();
    }
    this.onUpdate();
  }

  async stop() {
    this.running = false;
    if (this.listener) this.listener.stop();
    const blob = await this.recorder.stop();
    this.onUpdate();
    return blob;
  }

  _aiMark({ index, type, heard }) {
    const w = this.words[index];
    const mark = {
      id: uid(), index, type, heard,
      word: w.display, surah: w.surah, ayah: w.ayah,
      source: 'ai',
      status: this.mode === 'teacher' ? 'suggested' : 'final',
      t: this.elapsed(),
    };
    this.marks.push(mark);
    if (type !== 'extra') this.onMistake(mark);
  }

  // Pause and resume both the AI listening and the recording.
  pause() {
    if (!this.running) return false;
    this.running = false;
    if (this.listener) this.listener.stop();
    const mr = this.recorder.mr;
    if (mr && mr.state === 'recording') mr.pause();
    this.onUpdate();
    return true;
  }

  resume() {
    if (this.running || !this.started) return;
    this.running = true;
    const mr = this.recorder.mr;
    if (mr && mr.state === 'paused') mr.resume();
    if (this.listener) this.listener.start();
    this.onUpdate();
  }

  peek() {
    const i = this.matcher.peek();
    if (i < 0) return -1;
    const w = this.words[i];
    this.marks.push({ id: uid(), index: i, type: 'peek', word: w.display, surah: w.surah, ayah: w.ayah, source: 'ai', status: 'final', t: this.elapsed() });
    this.matcher.ok(i);
    this.onUpdate();
    return i;
  }

  // Teacher (or student in self-check) taps a word.
  tapWord(i, by = 'teacher') {
    const existing = this.marks.filter((m) => m.index === i && m.status !== 'dismissed');
    const suggested = existing.find((m) => m.status === 'suggested');
    const own = existing.find((m) => m.source === by || m.type === by);
    const w = this.words[i];
    if (suggested) suggested.status = 'confirmed';
    else if (own) this.marks = this.marks.filter((m) => m !== own);
    else this.marks.push({ id: uid(), index: i, type: by, word: w.display, surah: w.surah, ayah: w.ayah, source: by, status: 'final', t: this.elapsed() });
    this.onUpdate();
  }

  setMark(id, status) {
    const m = this.marks.find((x) => x.id === id);
    if (m) m.status = status;
    this.onUpdate();
  }

  wordState(i) {
    const w = this.words[i];
    const ms = this.marks.filter((m) => m.index === i && m.status !== 'dismissed');
    const has = (fn) => ms.some(fn);
    const firm = has((m) => m.status === 'final' && m.type !== 'peek') || has((m) => m.status === 'confirmed');
    const suggested = has((m) => m.status === 'suggested');
    const peeked = has((m) => m.type === 'peek');
    return {
      ok: w.status === 'ok',
      firm, suggested, peeked,
      current: this.running && i === this.matcher.cursor,
      reached: w.status !== 'pending',
    };
  }

  activeMarks() {
    return this.marks.filter((m) => m.status !== 'dismissed').sort((a, b) => a.index - b.index || a.t - b.t);
  }

  aiScore() { return this.matcher ? this.matcher.score() : 0; }

  progress() {
    const reached = this.words.filter((w) => w.status !== 'pending').length;
    return { reached, total: this.words.length };
  }

  async save({ kind, student, teacher, grade, comment, decision, planItem, blob }) {
    const id = uid();
    let audioId = null;
    if (blob) {
      audioId = 'clip-' + id;
      const ok = await store.putClip(audioId, blob);
      if (!ok) audioId = null;
    }
    const session = {
      id, kind, created: Date.now(), duration: this.elapsed(),
      title: this.title, portions: this.portions,
      student: student || '', teacher: teacher || '',
      aiScore: this.aiScore(), words: this.words.length,
      marks: this.marks.map(({ id: mid, index, type, word, surah, ayah, source, status, t, heard }) => ({ id: mid, index, type, word, surah, ayah, source, status, t, heard })),
      grade: grade || null, comment: comment || '', decision: decision || '', planItem: planItem || '',
      audioId,
    };
    store.addSession(session);
    return session;
  }
}
