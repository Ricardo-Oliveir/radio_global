// Viagem: rota em círculo máximo entre duas cidades da lista, com paradas em cidades reais perto do caminho.
// A cada parada o app sintoniza uma rádio de lá. Só usa cidades do arquivo cities.json.
import { distKm } from './util.js';
import { slerp } from './globe.js';

export function planRoute(cities, A, B, maxStops = 14){
  const total = distKm(A.o, A.a, B.o, B.a), n = Math.max(2, Math.min(maxStops, Math.round(total / 1500))), reach = Math.max(450, total / n * .42);
  const stops = [A];
  for (let i = 1; i < n; i++){
    const p = slerp([A.o, A.a], [B.o, B.a], i / n); let best = null, bd = reach;
    for (const c of cities){ if (c === A || c === B || stops.includes(c)) continue; const d = distKm(p[0], p[1], c.o, c.a); if (d < bd && distKm(c.o, c.a, stops[stops.length - 1].o, stops[stops.length - 1].a) > 300 && distKm(c.o, c.a, B.o, B.a) > 300){ bd = d; best = c; } }
    if (best) stops.push(best);
  }
  stops.push(B);
  const pts = [], idx = [];
  for (let s = 0; s < stops.length - 1; s++){
    const a = stops[s], b = stops[s + 1], km = distKm(a.o, a.a, b.o, b.a), steps = Math.max(2, Math.ceil(km / 120));
    idx.push(pts.length);
    for (let k = 0; k < steps; k++) pts.push(slerp([a.o, a.a], [b.o, b.a], k / steps));
  }
  idx.push(pts.length); pts.push([B.o, B.a]);
  const legs = stops.slice(1).map((c, i) => distKm(stops[i].o, stops[i].a, c.o, c.a));
  return { stops, pts, idx, legs, total: legs.reduce((a, b) => a + b, 0) };
}

const smooth = t => t * t * (3 - 2 * t);
export class Trip {
  constructor({ globe, onArrive, onChange }){
    Object.assign(this, { globe, onArrive, onChange, plan: null, i: 0, state: 'off', dwellMs: 60000, left: 0, tick: 0, raf: 0, leg: null, last: 0 });
  }
  get active(){ return this.state !== 'off'; }
  start(cities, A, B, dwellMs){
    this.stop(true); this.plan = planRoute(cities, A, B); this.dwellMs = dwellMs; this.i = 0;
    this.globe.setSpin(false); this.globe.setRoute({ pts: this.plan.pts, idx: this.plan.idx, done: 0 });
    this.globe.flyTo(A, 1.7, 1500); this.place(A.o, A.a, A.o, A.a, [A.o, A.a]);
    this.arrive(); this.tick = setInterval(() => this.loop(), 250);
  }
  place(lon, lat, lon2, lat2, from, follow = true){ this.globe.setPlane({ lon, lat, lon2, lat2, from }, follow); }
  arrive(){
    const p = this.plan, c = p.stops[this.i], last = this.i === p.stops.length - 1;
    cancelAnimationFrame(this.raf); this.state = last ? 'done' : 'dwell'; this.left = this.dwellMs;
    this.globe.setRoute({ ...this.globe.route, done: this.i }); this.place(c.o, c.a, c.o, c.a, [c.o, c.a]); this.globe.kT = 1.7;
    this.onArrive(c, this.i, p.stops.length); this.emit();
  }
  frac(now){ const l = this.leg; return l.f0 + (1 - l.f0) * smooth(Math.min(1, (now - l.t0) / l.ms)); }
  fly(f0 = 0, ms = null){
    const p = this.plan, a = p.stops[this.i], b = p.stops[this.i + 1], km = distKm(a.o, a.a, b.o, b.a);
    this.leg = { a, b, f0, t0: performance.now(), ms: ms ?? Math.min(24000, 8000 + km * 4) }; this.state = 'flying'; this.globe.kT = 1.15; this.globe.setPlane(this.globe.plane, true);
    cancelAnimationFrame(this.raf); const step = now => {
      if (this.state !== 'flying') return;
      const f = this.frac(now), A = [a.o, a.a], B = [b.o, b.a], pos = slerp(A, B, f), ahead = slerp(A, B, Math.min(1, f + .03));
      this.place(pos[0], pos[1], ahead[0], ahead[1], A);
      if (now - this.last > 400){ this.last = now; this.emit(); }
      if (now - this.leg.t0 >= this.leg.ms){ this.i++; this.arrive(); return; }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step); this.emit();
  }
  loop(){ if (this.state === 'dwell'){ this.left -= 250; if (this.left <= 0) this.fly(); else this.emit(); } }
  next(){
    if (!this.plan || this.i >= this.plan.stops.length - 1) return;
    const f0 = this.state === 'flying' ? this.frac(performance.now()) : 0; this.fly(f0, 1800);
  }
  togglePause(){
    if (this.state === 'paused'){ if (this.resumeTo === 'flying') this.fly(this.pausedF || 0); else this.state = 'dwell'; this.globe.setPlane(this.globe.plane, true); }
    else if (this.state === 'dwell' || this.state === 'flying') this.pause();
    this.emit();
  }
  pause(){
    if (this.state !== 'dwell' && this.state !== 'flying') return;
    this.resumeTo = this.state; if (this.state === 'flying') this.pausedF = this.frac(performance.now());
    cancelAnimationFrame(this.raf); this.state = 'paused'; this.globe.setPlane(this.globe.plane, false); this.emit();
  }
  stop(silent){ clearInterval(this.tick); cancelAnimationFrame(this.raf); this.state = 'off'; this.globe.setRoute(null); this.globe.setPlane(null); if (!silent) this.emit(); }
  info(){
    const p = this.plan; if (!p) return null;
    const nxt = p.stops[Math.min(this.i + 1, p.stops.length - 1)], rest = p.legs.slice(this.i + 1).reduce((a, b) => a + b, 0), leg = p.legs[this.i] || 0;
    const f = this.state === 'flying' ? this.frac(performance.now()) : this.state === 'paused' && this.resumeTo === 'flying' ? this.pausedF : 0;
    const kmLeft = (this.state === 'done' ? 0 : leg * (1 - f) + rest);
    return { state: this.state, i: this.i, n: p.stops.length, city: p.stops[this.i], next: nxt, from: p.stops[0], to: p.stops[p.stops.length - 1], kmLeft: Math.round(kmLeft), pct: 1 - kmLeft / p.total, left: this.left, flyingNow: this.state === 'flying' || (this.state === 'paused' && this.resumeTo === 'flying') };
  }
  emit(){ this.onChange(this.info()); }
}
