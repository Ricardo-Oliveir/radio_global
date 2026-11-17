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
    Object.assign(this, { canvas, wrap, cities, cb, ctx: canvas.getContext('2d'), lon: -30, lat: 18, k: 1, sel: null, hover: null, land: null, grat: null, W: 0, H: 0, padT: 0, padB: 0, dpr: 1, raf: 0, anim: null, visible: true, spin: false, lastTouch: 0, ptrs: new Map(), reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, ready: false });
    new ResizeObserver(() => this.resize()).observe(wrap);
    new IntersectionObserver(e => { this.visible = e[0].isIntersecting; if (this.visible) this.draw(); }, { threshold: 0 }).observe(wrap);
    this.glc = document.createElement('canvas'); this.glc.className = 'gl'; this.glc.setAttribute('aria-hidden', 'true'); wrap.insertBefore(this.glc, canvas);
    this.bind(); this.resize();
  }
  get R(){ return Math.min(this.W, this.H - this.padT - this.padB) / 2 * .86 * this.k; }
  get CY(){ return this.padT + (this.H - this.padT - this.padB) / 2; }
  // reserva as faixas do globo que ficam cobertas (cabeçalho, player, avisos) para ele caber inteiro na parte visível
  setPad(t, b){ t = Math.max(0, Math.round(t)); b = Math.max(0, Math.round(b)); if (t !== this.padT || b !== this.padB){ this.padT = t; this.padB = b; this.invalidate(); } }
  resize(){
    const r = this.wrap.getBoundingClientRect(); if (!r.width) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.W = r.width; this.H = r.height;
    this.canvas.width = this.glc.width = Math.round(r.width * this.dpr); this.canvas.height = this.glc.height = Math.round(r.height * this.dpr); this.invalidate();
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
    const glOk = !window.__WG_NOGL && this.initGL();
    for (const u of (window.__WG_TEX || TEX)){
      try {
        const im = await loadImg(u);
        if (im.naturalWidth < 256 || Math.abs(im.naturalWidth / im.naturalHeight - 2) > .08) continue;
        if (glOk){ try { this.uploadTex(im); this.tex = { gl: true }; return true; } catch { this.G = null; } }
        const w = Math.min(im.naturalWidth, 1536), hh = Math.round(w / 2), c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0, w, hh); this.tex = { w, h: hh, d: x.getImageData(0, 0, w, hh).data }; return true;
      } catch {}
    }
    return false;
  }
  // Esfera na placa de vídeo (WebGL2): cada pixel do disco lê a textura da Terra. Muito mais suave que fazer na CPU.
  initGL(){
    try {
      const gl = this.glc.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true }); if (!gl) return false;
      const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
uniform vec2 uC;uniform float uR,uLon,uLat;uniform sampler2D uT;out vec4 o;
void main(){
  vec2 q=(gl_FragCoord.xy-uC)/uR;float r2=dot(q,q);
  if(r2>=1.){o=vec4(0.);return;}
  float z=sqrt(1.-r2),x=q.x,y=q.y,s0=sin(uLat),c0=cos(uLat);
  float phi=asin(clamp(y*c0+z*s0,-1.,1.)),lam=uLon+atan(x,z*c0-y*s0);
  vec2 uv=vec2(lam/6.2831853+.5,.5-phi/3.1415927);
  vec3 c=textureGrad(uT,vec2(fract(uv.x),uv.y),dFdx(uv),dFdy(uv)).rgb;
  float l=min(1.1,.42+.78*(-.26*x+.32*y+.91*z)),rim=pow(1.-z,3.)*.28;
  c=c*l+vec3(rim*.35,rim*.6,rim);c*=1.-.28*pow(r2,1.5);
  float a=smoothstep(1.,.994,sqrt(r2));o=vec4(c*a,a);
}`));
      gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.G = { gl, u: { c: gl.getUniformLocation(pr, 'uC'), r: gl.getUniformLocation(pr, 'uR'), lon: gl.getUniformLocation(pr, 'uLon'), lat: gl.getUniformLocation(pr, 'uLat') } };
      return true;
    } catch { this.G = null; return false; }
  }
  uploadTex(im){
    const { gl } = this.G, max = gl.getParameter(gl.MAX_TEXTURE_SIZE), w = Math.min(im.naturalWidth, 4096, max);
    let src = im; if (w < im.naturalWidth){ const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w / 2); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); src = c; }
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.uniform1i(gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'uT'), 0);
  }
  renderGL(R, cx, cy){
    const { gl, u } = this.G, d = this.dpr; gl.viewport(0, 0, this.glc.width, this.glc.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.c, cx * d, (this.H - cy) * d); gl.uniform1f(u.r, R * d); gl.uniform1f(u.lon, this.lon * rad); gl.uniform1f(u.lat, this.lat * rad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // Plano B sem WebGL: para cada pixel do disco, acha longitude/latitude (projeção ortográfica inversa) e lê a cor da imagem.
  drawTex(R, cx, cy, q){
    const { tex, ctx } = this, S = Math.max(8, Math.min(720, Math.round(2 * R * this.dpr * q)));
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
  setPlane(p, follow = true){ this.plane = p; this.follow = !!p && follow; this.invalidate(); }
  project(lon, lat){
    const φ = lat * rad, dl = (lon - this.lon) * rad, φ0 = this.lat * rad, R = this.R, cx = this.W / 2, cy = this.CY;
    const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(dl);
    return { x: cx + R * Math.cos(φ) * Math.sin(dl), y: cy - R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(dl)), v: cosc > 0 };
  }
  inverse(x, y){
    const R = this.R, px = (x - this.W / 2) / R, py = (this.CY - y) / R, ρ = Math.hypot(px, py); if (ρ > 1) return null;
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
  zoom(f){ this.kT = Math.max(.85, Math.min(7, (this.kT ?? (this.anim ? this.anim.k1 : this.k)) * f)); this.invalidate(); }
  flyTo(c, k = null, ms = null){
    const to = [c.o, c.a], from = [this.lon, this.lat], k0 = this.k, k1 = k ?? Math.max(1, this.kT ?? this.k);
    const km = distKm(from[0], from[1], to[0], to[1]);
    ms = ms ?? Math.min(2600, 700 + km * .22);
    if (this.reduce || km < 1){ this.lastTouch = performance.now(); this.lon = to[0]; this.lat = to[1]; this.k = k1; this.anim = null; this.invalidate(); return; }
    this.lastTouch = performance.now(); this.kT = null; this.anim = { t0: performance.now(), ms, from, to, k0, k1, lift: Math.min(.35, km / 18000) };
    this.invalidate();
  }
  step(now){
    const a = this.anim; if (!a) return false;
    const t = Math.min(1, (now - a.t0) / a.ms), e = ease(t), p = slerp(a.from, a.to, e);
    this.lon = p[0]; this.lat = p[1]; this.k = a.k0 + (a.k1 - a.k0) * e - a.lift * Math.sin(Math.PI * t);
    if (t >= 1){ this.anim = null; this.k = a.k1; }
    return true;
  }
  // com uma cidade em foco o globo fica parado por 1 minuto antes de voltar a girar; com zoom aproximado nunca gira sozinho
  get idleMs(){ return this.k > 1.25 ? Infinity : this.sel ? 60000 : 6000; }
  // volta a mostrar o globo inteiro (sem mudar a direção)
  showAll(){ this.kT = 1; this.lastTouch = performance.now(); this.invalidate(); }
  setSpin(on){ this.spin = on && !this.reduce; if (this.spin) this.invalidate(); }
  invalidate(){ if (!this.raf) this.raf = requestAnimationFrame(t => this.draw(t)); }
  draw(now = performance.now()){
    this.raf = 0; if (!this.W || !this.visible) return;
    const dt = Math.min(50, now - (this.lastT || now)); this.lastT = now;
    let more = this.step(now);
    if (this.kT != null && !this.anim){ const dk = this.kT - this.k; if (Math.abs(dk) < .002){ this.k = this.kT; this.kT = null; } else { this.k += dk * (1 - Math.exp(-dt / 110)); more = true; } }
    if (this.follow && this.plane && !this.anim && !this.ptrs.size && now - this.lastTouch > 1500){ const c = slerp([this.lon, this.lat], [this.plane.lon, this.plane.lat], 1 - Math.exp(-dt / 650)); this.lon = c[0]; this.lat = c[1]; more = true; }
    if (this.plane && this.follow) more = true;
    if (this.spin && !more && now - this.lastTouch > this.idleMs && !this.ptrs.size){ this.lon += .004 * dt; more = true; }
    else if (this.spin && !more && !this.ptrs.size && isFinite(this.idleMs)){ clearTimeout(this._st); this._st = setTimeout(() => this.invalidate(), Math.max(200, this.idleMs - (now - this.lastTouch)) + 60); }
    const { ctx, W, H, dpr } = this, R = this.R, cx = W / 2, cy = this.CY, useGL = !!(this.G && this.tex && this.tex.gl);
    if (useGL) this.renderGL(R, cx, cy);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(cx, cy, R * .98, cx, cy, R * 1.16);
    glow.addColorStop(0, 'rgba(80,140,255,.38)'); glow.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, 6.2832); ctx.fill();
    const sea = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    sea.addColorStop(0, '#2a67d8'); sea.addColorStop(.55, '#123a96'); sea.addColorStop(1, '#091f5b');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip(); if (!useGL){ ctx.fillStyle = sea; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
    if (useGL){ /* esfera já desenhada pela placa de vídeo */ } else if (this.tex){
      const moving = !!(this.anim || this.ptrs.size || (this.spin && now - this.lastTouch > this.idleMs)); this.drawTex(R, cx, cy, moving ? .55 : 1);
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
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, this.tex ? 'rgba(2,8,30,.28)' : 'rgba(2,8,30,.55)'); if (!useGL){ ctx.fillStyle = shade; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
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
    }
    if (this.plane && this.route){
      const pl = this.plane, p = this.project(pl.lon, pl.lat);
      // rastro desde a última parada até o avião
      ctx.beginPath(); let m = true; for (let i = 0; i <= 24; i++){ const g = slerp(pl.from, [pl.lon, pl.lat], i / 24), q = this.project(g[0], g[1]); if (q.v){ m ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); m = false; } else m = true; }
      ctx.strokeStyle = '#ff5d73'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.stroke();
      if (p.v){
        const q = this.project(pl.lon2, pl.lat2), ang = Math.atan2(q.y - p.y, q.x - p.x), sc = Math.max(.9, Math.min(1.5, R / 260));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(sc, sc);
        ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.fillStyle = 'rgba(255,93,115,.28)'; ctx.fill();
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(4, -2.6); ctx.lineTo(-3, -13); ctx.lineTo(-6.5, -13); ctx.lineTo(-3.6, -2.6); ctx.lineTo(-9, -2.2); ctx.lineTo(-11.5, -6); ctx.lineTo(-14, -6); ctx.lineTo(-12, 0); ctx.lineTo(-14, 6); ctx.lineTo(-11.5, 6); ctx.lineTo(-9, 2.2); ctx.lineTo(-3.6, 2.6); ctx.lineTo(-6.5, 13); ctx.lineTo(-3, 13); ctx.lineTo(4, 2.6); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.lineWidth = 1.6; ctx.strokeStyle = '#ff5d73'; ctx.stroke(); ctx.restore();
      }
    }
    for (const [c, col, rr] of [[this.hover, '#ffffff', 5], [this.sel, '#ff5d73', 6]]){
      if (!c) continue; const p = this.project(c.o, c.a); if (!p.v) continue;
      if (c === this.sel && !this.reduce && now - this.selT < 2600){ const t = (now - this.selT) / 2600; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 6 + t * 30, 0, 6.2832); ctx.strokeStyle = col; ctx.globalAlpha = .6 * (1 - t); ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; more = true; }
      ctx.beginPath(); ctx.arc(p.x, p.y, rr + 5, 0, 6.2832); ctx.strokeStyle = col; ctx.globalAlpha = .45; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
      ctx.font = '500 12.5px "IBM Plex Mono",ui-monospace,monospace'; const w = ctx.measureText(c.n).width + 16, lx = Math.max(4, Math.min(W - w - 4, p.x - w / 2)), ly = p.y - 34 < 4 ? p.y + 16 : p.y - 34;
      ctx.fillStyle = 'rgba(10,10,10,.92)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, w, 22, 8) : ctx.rect(lx, ly, w, 22); ctx.fill();
      ctx.fillStyle = '#ece8e1'; ctx.textBaseline = 'middle'; ctx.fillText(c.n, lx + 8, ly + 11);
    }
    if (!this.canvas.classList.contains('on')) { this.canvas.classList.add('on'); this.cb.onFirstDraw && this.cb.onFirstDraw(); }
    const zoomed = this.k > 1.15; if (zoomed !== this._zoomed){ this._zoomed = zoomed; this.cb.onZoomed && this.cb.onZoomed(zoomed); }
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
      if (this.ptrs.size === 2 && this.pinch){ this.k = this.kT = Math.max(.85, Math.min(7, this.pinch.k * this.pd() / this.pinch.d)); this.kT = null; this.invalidate(); return; }
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
    // zoom proporcional ao movimento: o touchpad manda muitos eventos pequenos, o mouse manda poucos grandes; pinça no touchpad vem com ctrlKey
    cv.addEventListener('wheel', e => { e.preventDefault(); const u = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1; const dy = Math.max(-120, Math.min(120, e.deltaY * u)); this.zoom(Math.exp(-dy * (e.ctrlKey ? .01 : .0016))); }, { passive: false });
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
