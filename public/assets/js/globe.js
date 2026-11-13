// Globo ortográfico em canvas. Desenha só quando algo muda (poupa bateria). Mapa carregado depois do conteúdo essencial.
import { loadScript, rad, distKm } from './util.js';
const LIBS = ['https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js', 'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js', 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'];
const LAND = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
const TEX = ['/assets/img/earth.jpg', 'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg', 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg', 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'];
const loadImg = u => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = u; });
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const vec = (lon, lat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
const unvec = v => [Math.atan2(v[1], v[0]) / rad, Math.asin(Math.max(-1, Math.min(1, v[2]))) / rad];
export function slerp(a, b, t){
  const A = vec(...a), B = vec(...b), d = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), w = Math.acos(d);
  if (w < 1e-6) return b;
  const s = Math.sin(w), x = Math.sin((1 - t) * w) / s, y = Math.sin(t * w) / s;
  return unvec([x * A[0] + y * B[0], x * A[1] + y * B[1], x * A[2] + y * B[2]]);
}
export class Globe {
  constructor(canvas, wrap, cities, cb){
    Object.assign(this, { canvas, wrap, cities, cb, ctx: canvas.getContext('2d'), lon: -30, lat: 18, k: 1, sel: null, hover: null, land: null, grat: null, W: 0, H: 0, dpr: 1, raf: 0, anim: null, visible: true, spin: false, lastTouch: 0, ptrs: new Map(), reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, ready: false });
    new ResizeObserver(() => this.resize()).observe(wrap);
    new IntersectionObserver(e => { this.visible = e[0].isIntersecting; if (this.visible) this.draw(); }, { threshold: 0 }).observe(wrap);
    this.bind(); this.resize();
  }
  get R(){ return Math.min(this.W, this.H * 1.04) / 2 * .96 * this.k; }
  resize(){
    const r = this.wrap.getBoundingClientRect(); if (!r.width) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr); this.canvas.height = Math.round(r.height * this.dpr); this.invalidate();
  }
  async loadMap(){
    // 1) textura real da Terra (imagem de satélite); 2) se falhar, mapa vetorial estilizado
    if (await this.loadTexture()){ this.ready = true; this.invalidate(); return; }
    try {
      for (const s of LIBS) await loadScript(s);
      const topo = await (await fetch(LAND)).json();
      this.land = window.topojson.feature(topo, topo.objects.land);
      this.proj = window.d3.geoOrthographic().clipAngle(90).precision(.7);
      this.path = window.d3.geoPath(this.proj, this.ctx);
      this.grat = window.d3.geoGraticule10();
    } catch { this.mapFailed = true; }
    this.ready = true; this.invalidate();
  }
  async loadTexture(){
    for (const u of (window.__WG_TEX || TEX)){
      try {
        const im = await loadImg(u), w = Math.min(im.naturalWidth, 2048), hh = Math.round(w / 2);
        if (im.naturalWidth < 256 || Math.abs(im.naturalWidth / im.naturalHeight - 2) > .08) continue;
        const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0, w, hh); this.tex = { w, h: hh, d: x.getImageData(0, 0, w, hh).data }; return true;
      } catch {}
    }
    return false;
  }
  // Esfera com a textura: para cada pixel do disco, acha longitude/latitude (projeção ortográfica inversa) e lê a cor da imagem.
  drawTex(R, cx, cy, q){
    const { tex, ctx } = this, S = Math.max(8, Math.round(2 * R * this.dpr * q));
    if (!this.off || this.off.width !== S){ this.off = document.createElement('canvas'); this.off.width = this.off.height = S; this.offCtx = this.off.getContext('2d'); this.img = this.offCtx.createImageData(S, S); }
    const d = this.img.data, T = tex.d, tw = tex.w, th = tex.h, φ0 = this.lat * rad, s0 = Math.sin(φ0), c0 = Math.cos(φ0), λ0 = this.lon * rad, TAU = Math.PI * 2;
    for (let j = 0; j < S; j++){
      const y = 1 - 2 * (j + .5) / S;
      for (let i = 0; i < S; i++){
        const x = 2 * (i + .5) / S - 1, r2 = x * x + y * y, k = (j * S + i) * 4;
        if (r2 >= 1){ d[k + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2), φ = Math.asin(y * c0 + z * s0), λ = λ0 + Math.atan2(x, z * c0 - y * s0);
        let u = (λ / TAU + .5) % 1; if (u < 0) u += 1;
        let tx = (u * tw) | 0, ty = ((.5 - φ / Math.PI) * th) | 0; if (ty < 0) ty = 0; else if (ty >= th) ty = th - 1; if (tx >= tw) tx = tw - 1;
        const t = (ty * tw + tx) * 4, l = Math.min(1.1, .42 + .78 * (-.26 * x + .32 * y + .91 * z)), rim = (1 - z) ** 3 * 70;
        d[k] = Math.min(255, T[t] * l + rim * .35); d[k + 1] = Math.min(255, T[t + 1] * l + rim * .6); d[k + 2] = Math.min(255, T[t + 2] * l + rim); d[k + 3] = 255;
      }
    }
    this.offCtx.putImageData(this.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.off, cx - R, cy - R, 2 * R, 2 * R);
  }
  setRoute(r){ this.route = r; this.invalidate(); }
  project(lon, lat){
    const φ = lat * rad, dl = (lon - this.lon) * rad, φ0 = this.lat * rad, R = this.R, cx = this.W / 2, cy = this.H / 2;
    const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(dl);
    return { x: cx + R * Math.cos(φ) * Math.sin(dl), y: cy - R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(dl)), v: cosc > 0 };
  }
  inverse(x, y){
    const R = this.R, px = (x - this.W / 2) / R, py = (this.H / 2 - y) / R, ρ = Math.hypot(px, py); if (ρ > 1) return null;
    const c = Math.asin(ρ), φ0 = this.lat * rad;
    const φ = Math.asin(Math.cos(c) * Math.sin(φ0) + (ρ ? py * Math.sin(c) * Math.cos(φ0) / ρ : 0));
    const λ = this.lon * rad + Math.atan2(px * Math.sin(c), ρ * Math.cos(φ0) * Math.cos(c) - py * Math.sin(φ0) * Math.sin(c));
    return { lon: ((λ / rad + 540) % 360) - 180, lat: φ / rad };
  }
  nearest(lon, lat, maxKm = Infinity){
    let best = null, bd = maxKm;
    for (const c of this.cities){ const d = distKm(lon, lat, c.o, c.a); if (d < bd){ bd = d; best = c; } }
    return best;
  }
  hit(x, y, rpx){
    let best = null, bd = rpx * rpx;
    for (const c of this.cities){ const p = this.project(c.o, c.a); if (!p.v) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd){ bd = d; best = c; } }
    return best;
  }
  setSelected(c){ this.sel = c; this.selT = performance.now(); this.invalidate(); }
  zoom(f){ this.k = Math.max(.85, Math.min(7, this.k * f)); this.invalidate(); }
  flyTo(c, k = null, ms = null){
    const to = [c.o, c.a], from = [this.lon, this.lat], k0 = this.k, k1 = k ?? Math.max(1.35, Math.min(this.k, 1.8));
    const km = distKm(from[0], from[1], to[0], to[1]);
    ms = ms ?? Math.min(2600, 700 + km * .22);
    if (this.reduce || km < 1){ this.lon = to[0]; this.lat = to[1]; this.k = k1; this.anim = null; this.invalidate(); return; }
    this.anim = { t0: performance.now(), ms, from, to, k0, k1, lift: Math.min(.35, km / 18000) };
    this.invalidate();
  }
  step(now){
    const a = this.anim; if (!a) return false;
    const t = Math.min(1, (now - a.t0) / a.ms), e = ease(t), p = slerp(a.from, a.to, e);
    this.lon = p[0]; this.lat = p[1]; this.k = a.k0 + (a.k1 - a.k0) * e - a.lift * Math.sin(Math.PI * t);
    if (t >= 1){ this.anim = null; this.k = a.k1; }
    return true;
  }
  setSpin(on){ this.spin = on && !this.reduce; if (this.spin) this.invalidate(); }
  invalidate(){ if (!this.raf) this.raf = requestAnimationFrame(t => this.draw(t)); }
  draw(now = performance.now()){
    this.raf = 0; if (!this.W || !this.visible) return;
    const dt = Math.min(50, now - (this.lastT || now)); this.lastT = now;
    let more = this.step(now);
    if (this.spin && !more && now - this.lastTouch > 6000 && !this.ptrs.size){ this.lon += .004 * dt; more = true; }
    const { ctx, W, H, dpr } = this, R = this.R, cx = W / 2, cy = H / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(cx, cy, R * .98, cx, cy, R * 1.16);
    glow.addColorStop(0, 'rgba(80,140,255,.38)'); glow.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, 6.2832); ctx.fill();
    const sea = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    sea.addColorStop(0, '#2a67d8'); sea.addColorStop(.55, '#123a96'); sea.addColorStop(1, '#091f5b');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip(); ctx.fillStyle = sea; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    if (this.tex){
      const moving = !!(this.anim || this.ptrs.size || (this.spin && now - this.lastTouch > 6000)); this.drawTex(R, cx, cy, moving ? .55 : 1);
    } else if (this.path){
      this.proj.rotate([-this.lon, -this.lat]).scale(R).translate([cx, cy]);
      ctx.beginPath(); this.path(this.grat); ctx.strokeStyle = 'rgba(170,205,255,.13)'; ctx.lineWidth = .6; ctx.stroke();
      const lg = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
      lg.addColorStop(0, '#dbe7ef'); lg.addColorStop(.14, '#78b394'); lg.addColorStop(.5, '#3f9174'); lg.addColorStop(.86, '#78b394'); lg.addColorStop(1, '#dbe7ef');
      ctx.beginPath(); this.path(this.land); ctx.fillStyle = lg; ctx.fill(); ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(220,240,255,.45)'; ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(170,205,255,.16)'; ctx.lineWidth = .7;
      for (let la = -60; la <= 60; la += 30){ ctx.beginPath(); let m = true; for (let lo = -180; lo <= 180; lo += 6){ const p = this.project(lo, la); if (p.v){ m ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); m = false; } else m = true; } ctx.stroke(); }
      for (let lo = -180; lo < 180; lo += 30){ ctx.beginPath(); let m = true; for (let la = -90; la <= 90; la += 6){ const p = this.project(lo, la); if (p.v){ m ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); m = false; } else m = true; } ctx.stroke(); }
    }
    const shade = ctx.createRadialGradient(cx - R * .25, cy - R * .3, R * .4, cx, cy, R);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, this.tex ? 'rgba(2,8,30,.28)' : 'rgba(2,8,30,.55)'); ctx.fillStyle = shade; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    const r = Math.max(1.3, Math.min(3, R * .0058)); ctx.beginPath();
    for (const c of this.cities){ const p = this.project(c.o, c.a); if (p.v){ ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, 6.2832); } }
    ctx.fillStyle = 'rgba(190,220,255,.9)'; ctx.fill();
    if (R > 110){ ctx.beginPath(); for (const c of this.cities){ const p = this.project(c.o, c.a); if (p.v){ ctx.moveTo(p.x + r * 2.6, p.y); ctx.arc(p.x, p.y, r * 2.6, 0, 6.2832); } } ctx.fillStyle = 'rgba(120,180,255,.13)'; ctx.fill(); }
    if (this.route){
      const { pts, idx, done, flying } = this.route, line = (a, b, col, lw, dash) => { ctx.beginPath(); let m = true; for (let i = a; i <= b; i++){ const p = this.project(pts[i][0], pts[i][1]); if (p.v){ m ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); m = false; } else m = true; } ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]); };
      line(idx[Math.min(done, idx.length - 1)], pts.length - 1, 'rgba(255,255,255,.7)', 2, [2, 7]);
      line(0, idx[Math.min(done, idx.length - 1)], '#ff5d73', 3.2, []);
      ctx.beginPath(); idx.forEach((i, n) => { const p = this.project(pts[i][0], pts[i][1]); if (p.v){ ctx.moveTo(p.x + 4.5, p.y); ctx.arc(p.x, p.y, 4.5, 0, 6.2832); } }); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ff5d73'; ctx.stroke();
      if (flying){ const p = this.project(this.lon, this.lat); ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 6.2832); ctx.fillStyle = 'rgba(255,93,115,.35)'; ctx.fill(); ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff5d73'; ctx.stroke(); }
    }
    for (const [c, col, rr] of [[this.hover, '#ffffff', 5], [this.sel, '#ff5d73', 6]]){
      if (!c) continue; const p = this.project(c.o, c.a); if (!p.v) continue;
      if (c === this.sel && !this.reduce && now - this.selT < 2600){ const t = (now - this.selT) / 2600; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 6 + t * 30, 0, 6.2832); ctx.strokeStyle = col; ctx.globalAlpha = .6 * (1 - t); ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; more = true; }
      ctx.beginPath(); ctx.arc(p.x, p.y, rr + 5, 0, 6.2832); ctx.strokeStyle = col; ctx.globalAlpha = .45; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
      ctx.font = '600 13px Inter,system-ui,sans-serif'; const w = ctx.measureText(c.n).width + 16, lx = Math.max(4, Math.min(W - w - 4, p.x - w / 2)), ly = p.y - 34 < 4 ? p.y + 16 : p.y - 34;
      ctx.fillStyle = 'rgba(7,11,23,.92)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, w, 22, 8) : ctx.rect(lx, ly, w, 22); ctx.fill();
      ctx.fillStyle = '#e8edf7'; ctx.textBaseline = 'middle'; ctx.fillText(c.n, lx + 8, ly + 11);
    }
    if (!this.canvas.classList.contains('on')) { this.canvas.classList.add('on'); this.cb.onFirstDraw && this.cb.onFirstDraw(); }
    if (more) this.invalidate();
  }
  bind(){
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }); this.lastTouch = performance.now(); this.anim = null; if (this.ptrs.size === 2) this.pinch = { d: this.pd(), k: this.k }; });
    cv.addEventListener('pointermove', e => {
      const p = this.ptrs.get(e.pointerId), box = cv.getBoundingClientRect();
      if (!p){ if (e.pointerType === 'mouse'){ const c = this.hit(e.clientX - box.left, e.clientY - box.top, 12); if (c !== this.hover){ this.hover = c; this.cb.onHover && this.cb.onHover(c); this.invalidate(); cv.style.cursor = c ? 'pointer' : 'grab'; } } return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
      if (this.ptrs.size === 2 && this.pinch){ this.k = Math.max(.85, Math.min(7, this.pinch.k * this.pd() / this.pinch.d)); this.invalidate(); return; }
      if (p.moved){
        this.lon -= dx / this.R * (180 / Math.PI) / Math.max(.35, Math.cos(this.lat * rad)); this.lat = Math.max(-82, Math.min(82, this.lat + dy / this.R * (180 / Math.PI)));
        this.invalidate();
      }
    });
    const up = e => {
      const p = this.ptrs.get(e.pointerId); this.ptrs.delete(e.pointerId); this.pinch = null; this.lastTouch = performance.now(); this.invalidate();
      if (!p || p.moved || e.type === 'pointercancel') return;
      const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      let c = this.hit(x, y, e.pointerType === 'mouse' ? 13 : 24);
      if (!c){ const g = this.inverse(x, y); if (g) c = this.nearest(g.lon, g.lat, 900); }
      if (c) this.cb.onSelect(c); else this.cb.onMiss && this.cb.onMiss();
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (this.hover){ this.hover = null; this.cb.onHover && this.cb.onHover(null); this.invalidate(); } });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.12 : .89); }, { passive: false });
    cv.addEventListener('keydown', e => {
      const s = 8 / this.k, key = e.key; let used = true;
      if (key === 'ArrowLeft') this.lon -= s; else if (key === 'ArrowRight') this.lon += s;
      else if (key === 'ArrowUp') this.lat = Math.min(82, this.lat + s); else if (key === 'ArrowDown') this.lat = Math.max(-82, this.lat - s);
      else if (key === '+' || key === '=') this.zoom(1.25); else if (key === '-') this.zoom(.8);
      else if (key === 'Enter' || key === ' '){ const c = this.nearest(this.lon, this.lat); if (c) this.cb.onSelect(c); }
      else used = false;
      if (used){ e.preventDefault(); this.anim = null; this.invalidate(); }
    });
  }
  pd(){ const a = [...this.ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; }
}
