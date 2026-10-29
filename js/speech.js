// Speech recognition (the browser's built-in engine, Arabic) and audio recording.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = () => !!SR;
export const recordingSupported = () => !!(navigator.mediaDevices && window.MediaRecorder);

export class Listener {
  constructor({ onFinal, onInterim, onError, onState } = {}) {
    this.onFinal = onFinal || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onError = onError || (() => {});
    this.onState = onState || (() => {});
    this.active = false;
    this.rec = null;
  }

  start() {
    if (!SR) { this.onError('unsupported'); return false; }
    this.active = true;
    this._spawn();
    this.onState(true);
    return true;
  }

  _spawn() {
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.onFinal(r[0].transcript);
        else interim += r[0].transcript + ' ';
      }
      this.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') this.active = false;
      this.onError(e.error);
    };
    rec.onend = () => {
      if (this.active) {
        try { this._spawn(); } catch { this.active = false; this.onState(false); }
      } else {
        this.onState(false);
      }
    };
    this.rec = rec;
    try { rec.start(); } catch { /* already started */ }
  }

  stop() {
    this.active = false;
    try { this.rec && this.rec.stop(); } catch { /* ignore */ }
    this.onInterim('');
  }
}

export class Recorder {
  constructor() {
    this.stream = null;
    this.mr = null;
    this.chunks = [];
    this.startedAt = 0;
  }

  // stream: record an existing stream (e.g. the mixed call audio) instead of opening the microphone.
  async start(stream = null) {
    this.startedAt = Date.now();
    if (!window.MediaRecorder || (!stream && !recordingSupported())) return false;
    try {
      this.external = !!stream;
      this.stream = stream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      const opts = { audioBitsPerSecond: 40000 };
      if (type) opts.mimeType = type;
      this.mr = new MediaRecorder(this.stream, opts);
      this.chunks = [];
      this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.mr.start(1000);
      this.startedAt = Date.now();
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  elapsed() { return Date.now() - this.startedAt; }

  stop() {
    return new Promise((resolve) => {
      const done = () => {
        if (this.stream && !this.external) this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.chunks[0].type || 'audio/webm' }) : null;
        this.chunks = [];
        resolve(blob);
      };
      if (this.mr && this.mr.state !== 'inactive') {
        this.mr.onstop = done;
        try { this.mr.stop(); } catch { done(); }
      } else {
        done();
      }
    });
  }
}
