// Procedural underwater audio — ambient drone, collect chimes (pitch rises with combo),
// hit stings, and a danger heartbeat that swells as a predator closes in. No audio files.
export class SeaAudio {
  constructor() { this.ctx = null; this.started = false; }

  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);

    // gentle ambient drone
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.06; this.ambGain.connect(this.master);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400; lp.connect(this.ambGain);
    const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = 64;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = 96.5;
    o1.connect(lp); o2.connect(lp); o1.start(); o2.start();

    // danger heartbeat bed
    this.dangerGain = ctx.createGain(); this.dangerGain.gain.value = 0; this.dangerGain.connect(this.master);
    const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 220; dlp.connect(this.dangerGain);
    const d1 = ctx.createOscillator(); d1.type = "sawtooth"; d1.frequency.value = 44; d1.connect(dlp); d1.start();
    this.dlfo = ctx.createOscillator(); this.dlfo.type = "sine"; this.dlfo.frequency.value = 1.6;
    this.dlfoGain = ctx.createGain(); this.dlfoGain.gain.value = 0; this.dlfo.connect(this.dlfoGain);
    this.dlfoGain.connect(this.dangerGain.gain); this.dlfo.start();

    // eerie jellyfish shimmer — high, detuned, wavering
    this.jellyGain = ctx.createGain(); this.jellyGain.gain.value = 0; this.jellyGain.connect(this.master);
    const jbp = ctx.createBiquadFilter(); jbp.type = "bandpass"; jbp.frequency.value = 1400; jbp.Q.value = 5; jbp.connect(this.jellyGain);
    const j1 = ctx.createOscillator(); j1.type = "sine"; j1.frequency.value = 720;
    const j2 = ctx.createOscillator(); j2.type = "sine"; j2.frequency.value = 731;
    j1.connect(jbp); j2.connect(jbp); j1.start(); j2.start();
    this.jlfo = ctx.createOscillator(); this.jlfo.type = "sine"; this.jlfo.frequency.value = 6;
    this.jlfoGain = ctx.createGain(); this.jlfoGain.gain.value = 60; this.jlfo.connect(this.jlfoGain);
    this.jlfoGain.connect(j1.frequency); this.jlfo.start();

    this.started = true;
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  // low ominous drone — sharks / octopuses nearby
  setDanger(x) {
    if (!this.started) return;
    const t = this.ctx.currentTime, k = Math.max(0, Math.min(1, x));
    this.dlfoGain.gain.setTargetAtTime(k * 0.16, t, 0.2);
    this.dlfo.frequency.setTargetAtTime(1.2 + k * 2.4, t, 0.2);
  }

  // eerie high shimmer — jellyfish nearby
  setJelly(x) {
    if (!this.started) return;
    const t = this.ctx.currentTime, k = Math.max(0, Math.min(1, x));
    this.jellyGain.gain.setTargetAtTime(k * 0.05, t, 0.25);
  }

  // rising chime; higher pitch for bigger combos
  collect(combo = 1) {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const base = 520 * Math.pow(1.06, Math.min(combo, 12));
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.25);
  }

  hit(kind = "shark") {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(kind === "octopus" ? 320 : 240, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.5);
  }

  win() {
    if (!this.started) return;
    const ctx = this.ctx; let t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.2, t + i * 0.12 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.4);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.45);
    });
  }
}
