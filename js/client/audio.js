// Tiny WebAudio synth: sound effects and a bouncy procedural party loop.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.musicOn = false; this.step = 0; this.tempo = 128; this.key = 0; }
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
      this.mus = this.ctx.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
      const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.next = this.ctx.currentTime + 0.1;
      setInterval(() => this.schedule(), 50);
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }
  tone(f, dur, { type = 'sine', vol = 0.3, slide = 0, at = 0, dest } = {}) {
    if (!this.ctx) return; const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  hiss(dur, { vol = 0.4, freq = 800, q = 0.7, at = 0, sweep = 0.3, dest } = {}) {
    if (!this.ctx) return; const t = this.ctx.currentTime + at;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur); f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t); s.stop(t + dur + 0.05);
  }
  play(id) {
    switch (id) {
      case 'pop': this.tone(520, 0.12, { type: 'triangle', slide: 2.2, vol: 0.25 }); break;
      case 'boom': this.hiss(0.9, { vol: 0.9, freq: 1400, sweep: 0.05 }); this.tone(110, 0.6, { type: 'sine', slide: 0.3, vol: 0.6 }); break;
      case 'bigboom': this.hiss(1.4, { vol: 1, freq: 2000, sweep: 0.04 }); this.tone(80, 1, { type: 'sine', slide: 0.3, vol: 0.8 }); this.tone(160, 0.4, { type: 'square', slide: 0.3, vol: 0.12 }); break;
      case 'splat': this.hiss(0.25, { vol: 0.5, freq: 900, sweep: 0.3 }); this.tone(220, 0.15, { type: 'sine', slide: 0.5, vol: 0.3 }); break;
      case 'throw': this.tone(300, 0.35, { type: 'triangle', slide: 3, vol: 0.18 }); this.hiss(0.3, { vol: 0.15, freq: 3000, sweep: 0.5 }); break;
      case 'shoot': this.tone(180, 0.18, { type: 'square', slide: 0.6, vol: 0.12 }); this.hiss(0.15, { vol: 0.25, freq: 1200 }); break;
      case 'zap': this.tone(900, 0.15, { type: 'sawtooth', slide: 0.4, vol: 0.08 }); break;
      case 'out': this.tone(440, 0.18, { type: 'square', vol: 0.12 }); this.tone(330, 0.18, { type: 'square', vol: 0.12, at: 0.16 }); this.tone(220, 0.35, { type: 'square', vol: 0.12, at: 0.32 }); break;
      case 'ding': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.2, at: i * 0.08 })); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'square', vol: 0.12, at: i * 0.12 })); break;
      case 'draw': [440, 415, 392, 370].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, at: i * 0.18 })); break;
      case 'new': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.2, at: i * 0.07 })); break;
      case 'red': this.tone(220, 0.4, { type: 'square', vol: 0.12 }); this.tone(233, 0.4, { type: 'square', vol: 0.08 }); break;
      case 'yellow': this.tone(660, 0.12, { type: 'triangle', vol: 0.2 }); this.tone(660, 0.12, { type: 'triangle', vol: 0.2, at: 0.2 }); break;
      case 'green': this.tone(523, 0.12, { type: 'triangle', vol: 0.2 }); this.tone(784, 0.25, { type: 'triangle', vol: 0.2, at: 0.1 }); break;
      case 'freeze': this.tone(1400, 0.4, { type: 'sine', slide: 0.3, vol: 0.2 }); this.hiss(0.4, { vol: 0.2, freq: 6000, sweep: 0.5 }); break;
      case 'click': this.tone(880, 0.05, { type: 'triangle', vol: 0.12 }); break;
      case 'fuse': this.hiss(0.6, { vol: 0.2, freq: 5000, sweep: 0.9 }); break;
      case 'tick': this.tone(1200, 0.04, { type: 'square', vol: 0.06 }); break;
    }
  }
  setMusic(on, mood = 'party') { this.musicOn = on; this.mood = mood; this.tempo = { party: 128, tense: 140, night: 112, menu: 118 }[mood] || 128; }
  schedule() {
    if (!this.ctx || !this.musicOn) { if (this.ctx) this.next = this.ctx.currentTime + 0.05; return; }
    const spb = 60 / this.tempo / 2;
    while (this.next < this.ctx.currentTime + 0.2) {
      const s = this.step++, bar = Math.floor(s / 16) % 4, i = s % 16, at = this.next - this.ctx.currentTime;
      const roots = this.mood === 'night' ? [57, 53, 55, 52] : this.mood === 'tense' ? [52, 52, 55, 50] : [60, 57, 53, 55];
      const root = roots[bar];
      const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
      const minor = this.mood === 'night' || this.mood === 'tense';
      const ch = minor ? [0, 3, 7] : [0, 4, 7];
      if (i % 4 === 0) this.tone(hz(root - 24), spb * 1.6, { type: 'triangle', vol: 0.5, at, dest: this.mus });
      if (i % 4 === 2) this.tone(hz(root - 12), spb * 0.8, { type: 'triangle', vol: 0.3, at, dest: this.mus });
      if (i % 8 === 4) this.hiss(0.12, { vol: 0.3, freq: 3500, at, dest: this.mus });
      if (i % 2 === 1) this.hiss(0.04, { vol: 0.12, freq: 9000, at, dest: this.mus });
      if (i % 8 === 0) for (const c of ch) this.tone(hz(root + c), spb * 3, { type: 'sine', vol: 0.08, at, dest: this.mus });
      const mel = [0, 2, 4, 7, 4, 2, 7, 9, 12, 9, 7, 4, 2, 4, 0, -1];
      const scale = minor ? [0, 2, 3, 5, 7, 8, 10, 12, 14] : [0, 2, 4, 5, 7, 9, 11, 12, 14];
      if ((s * 7 + bar * 3) % 3 !== 0) { const n = mel[(i + bar * 5) % 16]; const deg = scale[Math.abs(n) % scale.length] + (n >= 12 ? 12 : 0); this.tone(hz(root + 12 + deg), spb * 0.9, { type: 'square', vol: 0.05, at, dest: this.mus }); }
      this.next += spb;
    }
  }
}
