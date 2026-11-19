/* WAVE GLOBAL · globo interativo (canvas 2D, projeção ortográfica) */
(function(){
'use strict';
const W = window.WAVE;
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
const toVec = (lon, lat) => { const l = lon*DEG, f = lat*DEG; return [Math.cos(f)*Math.cos(l), Math.cos(f)*Math.sin(l), Math.sin(f)]; };
const toLL = v => [Math.atan2(v[1], v[0])/DEG, Math.asin(Math.max(-1, Math.min(1, v[2])))/DEG];
function slerp(a, b, t){
  const A = toVec(a[0], a[1]), B = toVec(b[0], b[1]);
  const d = Math.acos(Math.max(-1, Math.min(1, A[0]*B[0] + A[1]*B[1] + A[2]*B[2])));
  if (d < 1e-6) return a;
  const s = Math.sin(d), k1 = Math.sin((1-t)*d)/s, k2 = Math.sin(t*d)/s;
  return toLL([A[0]*k1 + B[0]*k2, A[1]*k1 + B[1]*k2, A[2]*k1 + B[2]*k2]);
}
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
const wrapLon = l => ((l + 540) % 360) - 180;

W.createGlobe = function(opts){
  const canvas = opts.canvas, box = opts.box, cities = opts.cities, ctx = canvas.getContext('2d');
  const S = {lon:-45, lat:18, k:1, w:0, h:0, dpr:1, dirty:true, spin:opts.spin !== false, idle:performance.now(), visible:true, running:false,
    selected:null, country:null, hover:null, fly:null, vLon:0, vLat:0, last:performance.now(), lastDraw:0};
  let LAND = null, d3ok = false;

  // pré-cálculo das cidades: seno e cosseno de latitude e longitude
  const N = cities.length, sinF = new Float32Array(N), cosF = new Float32Array(N), sinL = new Float32Array(N), cosL = new Float32Array(N);
  cities.forEach((c, i) => { sinF[i] = Math.sin(c.lat*DEG); cosF[i] = Math.cos(c.lat*DEG); sinL[i] = Math.sin(c.lon*DEG); cosL[i] = Math.cos(c.lon*DEG); });

  const R = () => Math.min(S.w, S.h) * .43 * S.k;
  function project(i, R_, cx, cy, sl0, cl0, sf0, cf0){
    const dc = cosL[i]*cl0 + sinL[i]*sl0, ds = sinL[i]*cl0 - cosL[i]*sl0;
    const c = sf0*sinF[i] + cf0*cosF[i]*dc;
    return c > 0 ? [cx + R_*cosF[i]*ds, cy - R_*(cf0*sinF[i] - sf0*cosF[i]*dc)] : null;
  }
  function P(lon, lat, R_, cx, cy){
    const l = (lon - S.lon)*DEG, f = lat*DEG, f0 = S.lat*DEG;
    const c = Math.sin(f0)*Math.sin(f) + Math.cos(f0)*Math.cos(f)*Math.cos(l);
    return {x:cx + R_*Math.cos(f)*Math.sin(l), y:cy - R_*(Math.cos(f0)*Math.sin(f) - Math.sin(f0)*Math.cos(f)*Math.cos(l)), v:c > 0};
  }

  /* ---------- desenho ---------- */
  function subsolar(){
    const d = new Date(), doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0))/864e5;
    const lat = -23.44*Math.cos(TAU*(doy + 10)/365), h = d.getUTCHours() + d.getUTCMinutes()/60;
    return [wrapLon(-(h - 12)*15), lat];
  }
  function draw(){
    const w = S.w, h = S.h; if (!w || !h) return;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const r = R(), cx = w/2, cy = h/2;
    // atmosfera
    const atm = ctx.createRadialGradient(cx, cy, r*.98, cx, cy, r*1.18);
    atm.addColorStop(0, 'rgba(92,160,255,.5)'); atm.addColorStop(.35, 'rgba(61,123,255,.18)'); atm.addColorStop(1, 'rgba(61,123,255,0)');
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, r*1.18, 0, TAU); ctx.fill();
    // oceano
    const sea = ctx.createRadialGradient(cx - r*.35, cy - r*.4, r*.05, cx, cy, r*1.05);
    sea.addColorStop(0, '#2f78e0'); sea.addColorStop(.55, '#123f93'); sea.addColorStop(1, '#06173c');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = sea; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    let path = null;
    if (LAND && d3ok){
      const pr = d3.geoOrthographic().translate([cx, cy]).scale(r).rotate([-S.lon, -S.lat]).clipAngle(90);
      path = d3.geoPath(pr, ctx);
      const lg = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      [[0, '#eef4f8'], [.14, '#c9dccb'], [.32, '#4f9161'], [.5, '#8fa65e'], [.62, '#c4ab6c'], [.78, '#5b9a66'], [.92, '#d6e5de'], [1, '#f1f6f9']].forEach(([t, c]) => lg.addColorStop(t, c));
      ctx.beginPath(); path(LAND); ctx.fillStyle = lg; ctx.fill();
      ctx.lineWidth = Math.max(.6, r*.0022); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
      ctx.beginPath(); path(d3.geoGraticule10()); ctx.lineWidth = .5; ctx.strokeStyle = 'rgba(190,220,255,.14)'; ctx.stroke();
      // noite: círculo de 90° em volta do ponto oposto ao Sol
      const sun = subsolar(), anti = [wrapLon(sun[0] + 180), -sun[1]];
      ctx.beginPath(); path(d3.geoCircle().center(anti).radius(96).precision(3)()); ctx.fillStyle = 'rgba(2,6,22,.14)'; ctx.fill();
      ctx.beginPath(); path(d3.geoCircle().center(anti).radius(90).precision(3)()); ctx.fillStyle = 'rgba(2,6,22,.26)'; ctx.fill();
    } else {
      ctx.lineWidth = .6; ctx.strokeStyle = 'rgba(190,220,255,.18)';
      for (let lo = -180; lo < 180; lo += 30){ ctx.beginPath(); let pen = false; for (let la = -90; la <= 90; la += 4){ const q = P(lo, la, r, cx, cy); if (q.v){ pen ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); pen = true; } else pen = false; } ctx.stroke(); }
      for (let la = -60; la <= 60; la += 30){ ctx.beginPath(); let pen = false; for (let lo = -180; lo <= 180; lo += 4){ const q = P(lo, la, r, cx, cy); if (q.v){ pen ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); pen = true; } else pen = false; } ctx.stroke(); }
    }
    // marcadores
    const sl0 = Math.sin(S.lon*DEG), cl0 = Math.cos(S.lon*DEG), sf0 = Math.sin(S.lat*DEG), cf0 = Math.cos(S.lat*DEG);
    const dr = Math.max(1.5, Math.min(3.4, r*.0072)), hi = [];
    ctx.fillStyle = 'rgba(214,232,255,.92)'; ctx.beginPath();
    for (let i = 0; i < N; i++){
      const p = project(i, r, cx, cy, sl0, cl0, sf0, cf0); if (!p) continue;
      if (S.country && cities[i].cc === S.country){ hi.push(p); continue; }
      ctx.moveTo(p[0] + dr, p[1]); ctx.arc(p[0], p[1], dr, 0, TAU);
    }
    ctx.fill();
    if (hi.length){ ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); for (const p of hi){ ctx.moveTo(p[0] + dr*1.7, p[1]); ctx.arc(p[0], p[1], dr*1.7, 0, TAU); } ctx.fill(); }
    // sombra de borda e brilho
    const limb = ctx.createRadialGradient(cx, cy, r*.62, cx, cy, r);
    limb.addColorStop(0, 'rgba(0,8,28,0)'); limb.addColorStop(1, 'rgba(0,8,28,.5)');
    ctx.fillStyle = limb; ctx.fillRect(cx - r, cy - r, r*2, r*2);
    const spec = ctx.createRadialGradient(cx - r*.4, cy - r*.45, 0, cx - r*.4, cy - r*.45, r*.8);
    spec.addColorStop(0, 'rgba(255,255,255,.14)'); spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec; ctx.fillRect(cx - r, cy - r, r*2, r*2);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(150,190,255,.35)'; ctx.stroke();
    // seleção e passagem do mouse
    const mark = (c, ring) => {
      const q = P(c.lon, c.lat, r, cx, cy); if (!q.v) return null;
      if (ring){
        ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, TAU); ctx.strokeStyle = 'rgba(255,90,110,.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(q.x, q.y, 5.2, 0, TAU); ctx.fillStyle = '#ff5a6e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, TAU); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      return q;
    };
    const label = (c, q) => {
      if (!q) return;
      const t = c.nome, fs = 13; ctx.font = `600 ${fs}px ui-sans-serif,system-ui,sans-serif`;
      const tw = ctx.measureText(t).width + 16, th = 24;
      let x = Math.max(6, Math.min(w - tw - 6, q.x - tw/2)), y = q.y - 40; if (y < 4) y = q.y + 18;
      ctx.fillStyle = 'rgba(6,12,28,.92)'; ctx.strokeStyle = 'rgba(121,166,255,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, tw, th, 8); else ctx.rect(x, y, tw, th); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8eefc'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 8, y + th/2 + .5);
    };
    if (S.hover && S.hover !== S.selected) label(S.hover, mark(S.hover, false));
    if (S.selected) label(S.selected, mark(S.selected, true));
    S.dirty = false;
  }

  /* ---------- laço de animação ---------- */
  function frame(ts){
    S.running = false;
    if (!S.visible || document.hidden) return;
    const dt = Math.min(.1, (ts - S.last)/1000); S.last = ts;
    let active = false;
    if (S.fly){
      const f = S.fly, t = Math.min(1, (ts - f.t0)/f.dur), e = ease(t), c = slerp(f.a, f.b, e);
      S.lon = c[0]; S.lat = c[1]; S.k = f.k0 + (f.k1 - f.k0)*e - f.dip*Math.sin(Math.PI*t);
      if (t >= 1){ S.fly = null; if (f.done) f.done(); } active = true; S.dirty = true;
    } else if (Math.abs(S.vLon) > .02 || Math.abs(S.vLat) > .02){
      S.lon = wrapLon(S.lon + S.vLon*dt); S.lat = Math.max(-80, Math.min(80, S.lat + S.vLat*dt));
      const f = Math.pow(.04, dt); S.vLon *= f; S.vLat *= f; active = true; S.dirty = true;
    } else if (S.spin && !reduce() && ts - S.idle > 3000 && !S.drag){
      if (ts - S.lastDraw > 33){ S.lon = wrapLon(S.lon + 3.2*(ts - S.lastDraw)/1000); S.dirty = true; }
      active = true;
    } else if (S.drag) active = true;
    if (S.dirty && (!S.spin || ts - S.lastDraw > 30 || S.fly || S.drag)){ draw(); S.lastDraw = ts; }
    if (active || S.dirty) kick();
  }
  function kick(){ if (!S.running){ S.running = true; requestAnimationFrame(frame); } }
  const invalidate = () => { S.dirty = true; kick(); };

  function resize(){
    const r = box.getBoundingClientRect(); if (!r.width) return;
    S.dpr = Math.min(2, window.devicePixelRatio || 1);
    S.w = r.width; S.h = r.height;
    canvas.width = Math.round(S.w*S.dpr); canvas.height = Math.round(S.h*S.dpr);
    invalidate();
  }
  new ResizeObserver(resize).observe(box);
  new IntersectionObserver(es => { S.visible = es[0].isIntersecting; if (S.visible){ S.last = performance.now(); invalidate(); } }, {threshold:0}).observe(box);
  document.addEventListener('visibilitychange', () => { if (!document.hidden){ S.last = performance.now(); invalidate(); } });

  /* ---------- interação ---------- */
  function nearest(x, y, rad){
    const r = R(), cx = S.w/2, cy = S.h/2, sl0 = Math.sin(S.lon*DEG), cl0 = Math.cos(S.lon*DEG), sf0 = Math.sin(S.lat*DEG), cf0 = Math.cos(S.lat*DEG);
    let best = -1, bd = rad*rad;
    for (let i = 0; i < N; i++){ const p = project(i, r, cx, cy, sl0, cl0, sf0, cf0); if (!p) continue; const d = (p[0] - x)**2 + (p[1] - y)**2; if (d < bd){ bd = d; best = i; } }
    return best < 0 ? null : cities[best];
  }
  const ptrs = new Map(); let pinch0 = 0, k0 = 1, down = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    S.idle = performance.now(); S.fly = null; S.vLon = S.vLat = 0;
    if (ptrs.size === 1){ down = {x:e.clientX, y:e.clientY, t:performance.now(), moved:false, lx:e.clientX, ly:e.clientY, lt:performance.now()}; S.drag = true; }
    if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); k0 = S.k; down = null; }
    kick();
  });
  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect(), lx = e.clientX - rect.left, ly = e.clientY - rect.top;
    if (!ptrs.has(e.pointerId)){ if (e.pointerType === 'mouse'){ const c = nearest(lx, ly, 12); if (c !== S.hover){ S.hover = c; canvas.style.cursor = c ? 'pointer' : ''; invalidate(); } } return; }
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); S.idle = performance.now();
    if (ptrs.size === 2 && pinch0){ const [a, b] = [...ptrs.values()]; S.k = Math.max(.7, Math.min(6, k0*Math.hypot(a.x - b.x, a.y - b.y)/pinch0)); invalidate(); return; }
    if (down){
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (down.moved){
        const r = R(), now = performance.now(), dtm = Math.max(1, now - down.lt);
        const dLon = -dx/r/Math.max(.35, Math.cos(S.lat*DEG))/DEG, dLat = dy/r/DEG;
        S.lon = wrapLon(S.lon + dLon); S.lat = Math.max(-80, Math.min(80, S.lat + dLat));
        S.vLon = dLon/dtm*1000; S.vLat = dLat/dtm*1000; down.lx = e.clientX; down.ly = e.clientY; down.lt = now; invalidate();
      }
    }
  });
  const up = e => {
    const had = ptrs.delete(e.pointerId); if (!had) return;
    if (ptrs.size < 2) pinch0 = 0;
    S.idle = performance.now();
    if (down && ptrs.size === 0){
      S.drag = false;
      if (!down.moved && performance.now() - down.t < 600){
        const rect = canvas.getBoundingClientRect(), c = nearest(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === 'mouse' ? 14 : 26);
        S.vLon = S.vLat = 0;
        if (c && opts.onSelect) opts.onSelect(c);
      } else if (performance.now() - down.lt > 90){ S.vLon = S.vLat = 0; }
      down = null;
    }
    if (ptrs.size === 0) S.drag = false;
    kick();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); API.zoomBy(e.deltaY < 0 ? 1.14 : .88); }, {passive:false});
  canvas.addEventListener('keydown', e => {
    const step = 8/S.k; let used = true;
    if (e.key === 'ArrowLeft') S.lon = wrapLon(S.lon - step);
    else if (e.key === 'ArrowRight') S.lon = wrapLon(S.lon + step);
    else if (e.key === 'ArrowUp') S.lat = Math.min(80, S.lat + step);
    else if (e.key === 'ArrowDown') S.lat = Math.max(-80, S.lat - step);
    else if (e.key === '+' || e.key === '=') API.zoomBy(1.2);
    else if (e.key === '-' || e.key === '_') API.zoomBy(1/1.2);
    else if (e.key === 'Enter' || e.key === ' '){ const c = nearest(S.w/2, S.h/2, Math.min(S.w, S.h)*.3); if (c && opts.onSelect) opts.onSelect(c); }
    else used = false;
    if (used){ e.preventDefault(); S.idle = performance.now(); invalidate(); }
  });
  canvas.addEventListener('pointerleave', () => { if (S.hover){ S.hover = null; canvas.style.cursor = ''; invalidate(); } });

  /* ---------- API ---------- */
  const API = {
    flyTo(lon, lat, o = {}){
      const k1 = o.k || S.k;
      if (reduce()){ S.lon = lon; S.lat = lat; S.k = k1; S.fly = null; invalidate(); return; }
      const a = [S.lon, S.lat], b = [lon, lat], dx = Math.hypot(wrapLon(lon - S.lon), lat - S.lat);
      S.fly = {a, b, t0:performance.now(), dur:Math.max(700, Math.min(2200, 500 + dx*14)), k0:S.k, k1, dip:Math.min(.18, dx/400), done:o.done};
      S.vLon = S.vLat = 0; S.idle = performance.now(); kick();
    },
    zoomBy(f){ S.k = Math.max(.7, Math.min(6, S.k*f)); S.idle = performance.now(); invalidate(); },
    setSpin(v){ S.spin = !!v; S.idle = performance.now(); invalidate(); },
    get spin(){ return S.spin; },
    setSelected(c){ S.selected = c; invalidate(); },
    setCountry(cc){ S.country = cc || null; invalidate(); },
    center: () => [S.lon, S.lat],
    pick: nearest, invalidate,
    get _s(){ return S; }, project: (lon, lat) => { const q = P(lon, lat, R(), S.w/2, S.h/2); return q.v ? {x:q.x, y:q.y} : null; }
  };

  // mapa (d3-geo + topojson) só depois que o conteúdo essencial já apareceu
  function loadMap(){
    const ok = () => { d3ok = !!(window.d3 && d3.geoOrthographic && d3.geoCircle); };
    loadScript('https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js'))
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'))
      .then(() => fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json'))
      .then(r => r.json())
      .then(t => { ok(); LAND = topojson.feature(t, t.objects.land); box.classList.add('ready'); invalidate(); })
      .catch(() => {});
  }
  resize();
  box.classList.add('ready');
  (window.requestIdleCallback || (f => setTimeout(f, 300)))(loadMap, {timeout:1500});
  return API;
};
})();
