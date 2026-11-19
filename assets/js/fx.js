// Efeitos de rádio: chiado de estática entre estações e medidor (VU) com o áudio de verdade.
export class Static {
  constructor(player){ this.p = player; this.g = null; this.src = null; this.t = 0; }
  start(){
    const c = this.p.ctx(); if (!c || this.src) return;
    if (!this.buf){ const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.buf = b; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.buf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = .35;
    const vol = this.p.audio.muted ? 0 : this.p.audio.volume; g.gain.value = 0; s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    g.gain.linearRampToValueAtTime(.045 * vol, c.currentTime + .05); this.src = s; this.g = g;
    clearTimeout(this.t); this.t = setTimeout(() => this.stop(), 2500);
  }
  stop(){
    clearTimeout(this.t); const s = this.src, g = this.g, c = this.p.ac; if (!s) return; this.src = this.g = null;
    try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0, c.currentTime + .15); s.stop(c.currentTime + .2); } catch {}
  }
}
export class Meter {
  constructor(canvas, player){
    this.cv = canvas; this.p = player; this.raf = 0; this.on = false;
    player.addEventListener('analyser', () => this.sync()); player.addEventListener('state', () => this.sync());
    document.addEventListener('visibilitychange', () => this.sync());
  }
  sync(){
    const want = !!this.p.analyser && this.p.state === 'playing' && !document.hidden;
    this.cv.classList.toggle('on', !!this.p.analyser && this.p.state === 'playing');
    if (want && !this.raf) this.loop(); else if (!want && this.raf){ cancelAnimationFrame(this.raf); this.raf = 0; }
  }
  loop(){
    const cv = this.cv, x = cv.getContext('2d'), an = this.p.analyser, d = new Uint8Array(an.frequencyBinCount), W = cv.width, H = cv.height, N = 16, bw = W / N;
    const draw = () => {
      an.getByteFrequencyData(d); x.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++){
        const v = d[Math.min(d.length - 1, 1 + Math.round(i * 2.4))] / 255, segs = Math.round(v * 8);
        for (let k = 0; k < 8; k++){ x.fillStyle = k < segs ? (k > 5 ? '#ff5d73' : k > 3 ? '#ffb86b' : '#e9e2d6') : 'rgba(236,228,214,.08)'; x.fillRect(i * bw + 1, H - (k + 1) * (H / 8) + 1, bw - 3, H / 8 - 2); }
      }
      this.raf = requestAnimationFrame(draw);
    };
    this.raf = requestAnimationFrame(draw);
  }
}
