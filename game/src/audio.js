// All sound is synthesised with WebAudio — no audio files. One engine hum and one siren
// run as loops while they are needed; everything else is a short one-shot burst.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineNodes = null;
    this.sirenNodes = null;
  }

  /** Must be called from a user gesture at least once. Safe to call again. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.03);
    }
  }

  tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.3, freq = 1200, q = 0.8, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shot() {
    this.noise(0.14, 0.5, 900, 0.5);
    this.tone(160, 0.1, 'square', 0.25, 60);
  }

  enemyShot() {
    this.noise(0.11, 0.28, 700, 0.6);
    this.tone(130, 0.09, 'square', 0.14, 55);
  }

  dryFire() {
    this.tone(1200, 0.04, 'square', 0.12);
  }

  reload() {
    this.tone(500, 0.05, 'square', 0.15);
    this.tone(340, 0.05, 'square', 0.15, null, 0.16);
    this.tone(720, 0.05, 'square', 0.15, null, 0.3);
  }

  crash(intensity = 1) {
    this.noise(0.28, 0.4 * intensity, 300, 0.4);
    this.tone(90, 0.25, 'triangle', 0.3 * intensity, 40);
  }

  skid() {
    this.noise(0.22, 0.1, 2400, 2.5);
  }

  pickup() {
    this.tone(880, 0.09, 'sine', 0.22);
    this.tone(1320, 0.14, 'sine', 0.22, null, 0.08);
  }

  cash() {
    this.tone(1040, 0.07, 'triangle', 0.2);
    this.tone(1560, 0.1, 'triangle', 0.2, null, 0.06);
  }

  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => this.tone(freq, 0.22, 'triangle', 0.22, null, i * 0.11));
  }

  failSting() {
    this.tone(392, 0.25, 'sawtooth', 0.16);
    this.tone(311, 0.3, 'sawtooth', 0.16, null, 0.2);
    this.tone(233, 0.5, 'sawtooth', 0.16, null, 0.42);
  }

  phoneBuzz() {
    this.tone(440, 0.07, 'square', 0.1);
    this.tone(440, 0.07, 'square', 0.1, null, 0.12);
  }

  doorSlam() {
    this.noise(0.09, 0.3, 240, 1);
    this.tone(120, 0.08, 'triangle', 0.2, 70);
  }

  splash() {
    this.noise(0.4, 0.25, 600, 0.7);
  }

  /** Start (or keep) the driving engine loop; pitch follows speed 0..1. */
  engine(ratio, dt) {
    if (!this.ctx) return;
    if (!this.engineNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const sub = this.ctx.createOscillator();
      sub.type = 'triangle';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start();
      sub.start();
      this.engineNodes = { osc, sub, filter, gain };
    }
    const n = this.engineNodes;
    const t = this.ctx.currentTime;
    const freq = 55 + ratio * 165;
    n.osc.frequency.setTargetAtTime(freq, t, 0.06);
    n.sub.frequency.setTargetAtTime(freq * 0.5, t, 0.06);
    n.filter.frequency.setTargetAtTime(320 + ratio * 900, t, 0.1);
    n.gain.gain.setTargetAtTime(0.05 + ratio * 0.1, t, 0.1);
    this._engineHold = 0.25;
    if (dt) this._engineHold -= 0; // hold timer handled in update()
  }

  /** Police siren loop while any unit is close. */
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const gain = this.ctx.createGain();
      gain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.65;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.frequency.value = 840;
      osc.connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, gain, lfo };
    } else if (!on && this.sirenNodes) {
      const n = this.sirenNodes;
      this.sirenNodes = null;
      try {
        n.osc.stop();
        n.lfo.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  /** Fade the engine out when the caller stops feeding it. */
  update(dt) {
    if (!this.ctx || !this.engineNodes) return;
    this._engineHold = (this._engineHold ?? 0) - dt;
    if (this._engineHold <= 0) {
      this.engineNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }
}
