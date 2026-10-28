// Plays a list of ayahs one after another, with repeats and speed.

import { audioUrl } from './quran.js';

export class Player {
  constructor({ onAyah, onState, onError } = {}) {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.list = [];
    this.i = 0;
    this.rep = 0;
    this.repeat = 1;   // each ayah
    this.loops = 1;    // the whole list
    this.loop = 0;
    this.reciter = 'ar.husary';
    this.speed = 1;
    this.playing = false;
    this.onAyah = onAyah || (() => {});
    this.onState = onState || (() => {});
    this.onError = onError || (() => {});
    this.audio.addEventListener('ended', () => this._next());
    this.audio.addEventListener('error', () => {
      if (!this.playing) return;
      this.playing = false;
      this.onState(false);
      this.onError();
    });
  }

  load(ayahs) {
    this.stop();
    this.list = ayahs;
    this.i = 0;
  }

  _src() { return audioUrl(this.reciter, this.list[this.i].number); }

  _playCurrent() {
    if (!this.list.length) return;
    this.audio.src = this._src();
    this.audio.playbackRate = this.speed;
    this.onAyah(this.i);
    const p = this.audio.play();
    if (p && p.catch) p.catch(() => { this.playing = false; this.onState(false); });
    // Warm the next file.
    const n = this.list[this.i + 1];
    if (n) { const pre = new Audio(); pre.preload = 'auto'; pre.src = audioUrl(this.reciter, n.number); }
  }

  playFrom(i) {
    if (!this.list.length) return;
    this.i = Math.max(0, Math.min(i, this.list.length - 1));
    this.rep = 0;
    if (i === 0) this.loop = 0;
    this.playing = true;
    this.onState(true);
    this._playCurrent();
  }

  toggle() {
    if (this.playing) this.pause();
    else if (this.audio.src && this.audio.currentTime > 0 && !this.audio.ended) {
      this.playing = true; this.onState(true); this.audio.play().catch(() => {});
    } else this.playFrom(this.i);
  }

  pause() {
    this.playing = false;
    this.audio.pause();
    this.onState(false);
  }

  stop() {
    this.playing = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    try { this.audio.load(); } catch { /* ignore */ }
    this.onState(false);
    this.onAyah(-1);
  }

  next() { if (this.i < this.list.length - 1) this.playFrom(this.i + 1); }
  prev() { if (this.i > 0) this.playFrom(this.i - 1); }

  setSpeed(s) { this.speed = s; this.audio.playbackRate = s; }

  _next() {
    if (!this.playing) return;
    this.rep++;
    if (this.rep < this.repeat) { this._playCurrent(); return; }
    this.rep = 0;
    if (this.i < this.list.length - 1) { this.i++; this._playCurrent(); return; }
    this.loop++;
    if (this.loop < this.loops) { this.i = 0; this.onLoop && this.onLoop(this.loop); this._playCurrent(); return; }
    this.loop = 0;
    this.playing = false; this.onState(false); this.onAyah(-1); this.onEnd && this.onEnd();
  }
}
