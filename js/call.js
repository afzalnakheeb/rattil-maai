// One-to-one video call between teacher and student.
// Media flows directly between the two devices (WebRTC, encrypted end to end by DTLS-SRTP);
// the private realtime room carries the connection set-up and the live marks.
// The teacher always makes the offer; the student answers. Either side can ask to reconnect.

import * as cloud from './cloud.js';

export async function getMedia({ video = true } = {}) {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  if (video) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } });
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
      // No camera or camera busy: continue with audio only.
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio });
}

export class CallLink {
  constructor({ callId, role, onRemote = () => {}, onState = () => {} }) {
    this.callId = callId;
    this.role = role; // 'teacher' | 'student'
    this.onRemote = onRemote;
    this.onState = onState;
    this.pc = null;
    this.gen = 0;
    this.pendingIce = [];
    this.lastOffer = 0;
    this.closed = false;
    this.state = 'new';
    this.handlers = {};
    this.iceServers = null;
    this.discTimer = null;
  }

  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return this; }
  _emit(type, d) { if (this.closed) return; (this.handlers[type] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); }

  send(type, d) { if (this.room && !this.closed) this.room.send(type, d).catch?.(() => {}); }

  _setState(s) { if (this.state !== s) { this.state = s; this.onState(s); } }

  async start(localStream) {
    this.local = localStream;
    this._setState('joining');
    this.iceServers = await cloud.iceServers();
    // Join the private room; retry a few times (first use of the realtime service can take a moment).
    for (let attempt = 1; ; attempt++) {
      if (this.closed) return;
      this.room = cloud.room(this.callId);
      this.room.on('sig', (m) => this._sig(m).catch((e) => console.warn('signal', e)));
      ['progress', 'ai', 'cmd', 'marks', 'graded', 'state', 'sync', 'bye'].forEach((t) => this.room.on(t, (d) => this._emit(t, d)));
      try { await this.room.joined; break; } catch (e) {
        this.room.close();
        if (attempt >= 8) { this._setState('room-error'); throw e; }
        this._setState('joining');
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
    this.room.onStatus((st) => { if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') this._setState('reconnecting'); });
    this._setState('waiting');
    this._hello(false);
    // Keep knocking until the other side answers (they may open the page later).
    this.knock = setInterval(() => {
      if (this.closed) return;
      if (!this.pc || ['failed', 'closed'].includes(this.pc.connectionState)) this._hello(false);
    }, 5000);
  }

  _hello(reply) { this.room.send('sig', { k: 'hello', from: this.role, reply }); }

  _newPc() {
    if (this.pc) { try { this.pc.close(); } catch { /* ignore */ } }
    this.pendingIce = [];
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.local.getTracks().forEach((t) => pc.addTrack(t, this.local));
    const gen = this.gen;
    pc.onicecandidate = (e) => { if (e.candidate) this.room.send('sig', { k: 'ice', gen, c: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0] ? e.streams[0] : (this._remote = this._remote || new MediaStream());
      if (!e.streams || !e.streams[0]) stream.addTrack(e.track);
      this.onRemote(stream);
    };
    pc.onconnectionstatechange = () => this._pcState(pc);
    pc.oniceconnectionstatechange = () => this._pcState(pc);
    this.pc = pc;
    return pc;
  }

  _pcState(pc) {
    if (pc !== this.pc || this.closed) return;
    const s = pc.connectionState || pc.iceConnectionState;
    clearTimeout(this.discTimer);
    if (s === 'connected' || s === 'completed') this._setState('connected');
    else if (s === 'connecting' || s === 'checking' || s === 'new') this._setState(this.state === 'connected' ? 'reconnecting' : 'connecting');
    else if (s === 'disconnected') {
      this._setState('reconnecting');
      this.discTimer = setTimeout(() => this._recover(), 4000);
    } else if (s === 'failed') { this._setState('reconnecting'); this._recover(); }
  }

  _recover() {
    if (this.closed) return;
    if (this.role === 'teacher') this._offer(true);
    else this._hello(false);
  }

  async _offer(force = false) {
    if (!force && this.pc && Date.now() - this.lastOffer < 3000) return;
    this.lastOffer = Date.now();
    this.gen += 1;
    const gen = this.gen;
    const pc = this._newPc();
    this._setState('connecting');
    const offer = await pc.createOffer();
    if (gen !== this.gen) return;
    await pc.setLocalDescription(offer);
    this.room.send('sig', { k: 'offer', gen, sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
  }

  async _sig(m) {
    if (this.closed || !m || !m.k) return;
    if (m.k === 'hello') {
      if (m.from === this.role) return;
      if (this.role === 'teacher') { this._emit('peer-hello', m); await this._offer(); }
      else if (!m.reply) this._hello(true);
      return;
    }
    if (m.k === 'offer' && this.role === 'student') {
      if (m.gen < this.gen) return;
      this.gen = m.gen;
      const pc = this._newPc();
      this._setState('connecting');
      await pc.setRemoteDescription(m.sdp);
      await this._flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.room.send('sig', { k: 'answer', gen: m.gen, sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      return;
    }
    if (m.k === 'answer' && this.role === 'teacher') {
      if (m.gen !== this.gen || !this.pc || this.pc.signalingState !== 'have-local-offer') return;
      await this.pc.setRemoteDescription(m.sdp);
      await this._flushIce();
      return;
    }
    if (m.k === 'ice') {
      if (m.gen !== this.gen || !this.pc) return;
      if (!this.pc.remoteDescription) { this.pendingIce.push(m.c); return; }
      try { await this.pc.addIceCandidate(m.c); } catch { /* stale candidate */ }
    }
  }

  async _flushIce() {
    const list = this.pendingIce.splice(0);
    for (const c of list) { try { await this.pc.addIceCandidate(c); } catch { /* ignore */ } }
  }

  setMuted(kind, off) {
    (this.local?.getTracks() || []).filter((t) => t.kind === kind).forEach((t) => { t.enabled = !off; });
  }

  close() {
    if (this.closed) return;
    try { this.send('bye', { from: this.role }); } catch { /* ignore */ }
    this.closed = true;
    clearInterval(this.knock);
    clearTimeout(this.discTimer);
    if (this.pc) { try { this.pc.close(); } catch { /* ignore */ } }
    setTimeout(() => this.room?.close(), 300);
    this._setState('ended');
  }
}

// Mixes the teacher's microphone and the student's audio into one stream for the recording.
export class Mixer {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    this.dest = this.ctx ? this.ctx.createMediaStreamDestination() : null;
    this.sources = new Map();
  }

  get stream() { return this.dest ? this.dest.stream : null; }

  add(key, stream) {
    if (!this.ctx || !stream || !stream.getAudioTracks().length) return;
    const old = this.sources.get(key);
    if (old && old.stream === stream) return;
    if (old) { try { old.node.disconnect(); } catch { /* ignore */ } }
    const node = this.ctx.createMediaStreamSource(stream);
    node.connect(this.dest);
    this.sources.set(key, { node, stream });
  }

  async resume() { if (this.ctx && this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch { /* ignore */ } } }

  close() {
    this.sources.forEach(({ node }) => { try { node.disconnect(); } catch { /* ignore */ } });
    this.sources.clear();
    if (this.ctx) this.ctx.close().catch(() => {});
  }
}
