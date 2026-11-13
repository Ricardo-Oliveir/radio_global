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

export class Trip {
  constructor({ globe, onArrive, onChange }){
    Object.assign(this, { globe, onArrive, onChange, plan: null, i: 0, state: 'off', dwellMs: 60000, left: 0, tick: 0 });
  }
  get active(){ return this.state !== 'off'; }
  start(cities, A, B, dwellMs){
    this.stop(true); this.plan = planRoute(cities, A, B); this.dwellMs = dwellMs; this.i = 0;
    this.globe.setSpin(false); this.globe.setRoute({ pts: this.plan.pts, idx: this.plan.idx, done: 0, flying: false });
    this.arrive(); this.tick = setInterval(() => this.loop(), 250);
  }
  arrive(){
    const p = this.plan, c = p.stops[this.i], last = this.i === p.stops.length - 1;
    this.state = last ? 'done' : 'dwell'; this.left = this.dwellMs;
    this.globe.setRoute({ ...this.globe.route, done: this.i, flying: false });
    this.onArrive(c, this.i, p.stops.length); this.emit();
  }
  fly(){
    const p = this.plan, c = p.stops[this.i + 1], from = p.stops[this.i], km = distKm(from.o, from.a, c.o, c.a);
    this.state = 'flying'; this.globe.setRoute({ ...this.globe.route, flying: true });
    this.globe.flyTo(c, 1.6, Math.min(22000, 7000 + km * 4)); this.emit();
  }
  loop(){
    if (this.state === 'dwell'){ this.left -= 250; if (this.left <= 0) this.fly(); else this.emit(); }
    else if (this.state === 'flying'){
      const c = this.plan.stops[this.i + 1], g = this.globe;
      if (distKm(g.lon, g.lat, c.o, c.a) < 40){ this.i++; this.arrive(); }
      else if (!g.anim && !g.ptrs.size && performance.now() - g.lastTouch > 1500) this.fly(); // o usuário mexeu no globo: retoma o voo
    }
  }
  next(){ if (!this.plan || this.i >= this.plan.stops.length - 1) return; const c = this.plan.stops[this.i + 1]; this.state = 'flying'; this.globe.setRoute({ ...this.globe.route, flying: true }); this.globe.flyTo(c, 1.6, 1600); this.emit(); }
  togglePause(){ if (this.state === 'paused'){ this.state = this.resumeTo || 'dwell'; if (this.state === 'flying') this.fly(); } else if (this.state === 'dwell' || this.state === 'flying'){ this.resumeTo = this.state; this.state = 'paused'; this.globe.anim = null; } this.emit(); }
  pause(){ if (this.state === 'dwell' || this.state === 'flying'){ this.resumeTo = this.state; this.state = 'paused'; this.emit(); } }
  stop(silent){ clearInterval(this.tick); this.state = 'off'; this.globe.setRoute(null); if (!silent) this.emit(); }
  info(){
    const p = this.plan; if (!p) return null;
    const stopsLeft = p.legs.slice(this.i), g = this.globe, nxt = p.stops[Math.min(this.i + 1, p.stops.length - 1)];
    const kmLeft = this.state === 'flying' ? distKm(g.lon, g.lat, nxt.o, nxt.a) + p.legs.slice(this.i + 1).reduce((a, b) => a + b, 0) : stopsLeft.reduce((a, b) => a + b, 0);
    return { state: this.state, i: this.i, n: p.stops.length, city: p.stops[this.i], next: nxt, from: p.stops[0], to: p.stops[p.stops.length - 1], kmLeft: Math.round(kmLeft), pct: 1 - kmLeft / p.total, left: this.left };
  }
  emit(){ this.onChange(this.info()); }
}
