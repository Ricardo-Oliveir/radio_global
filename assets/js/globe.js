import { Borders } from './borders.js';
// Globo ortográfico em canvas. Desenha só quando algo muda (poupa bateria). Mapa carregado depois do conteúdo essencial.
import { loadScript, rad, distKm } from './util.js';
import config from './config.js';
const LIBS = ['https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js', 'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js', 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'];
const LAND = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
const TEX = ['/assets/img/earth.jpg', 'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg', 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg', 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'];
const TEX_HI = ['https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg', 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/planets/earth_atmos_2048.jpg'];
// Mapa em blocos (tiles): perto do zoom máximo a imagem única fica borrada, então um mosaico de blocos NASA GIBS (domínio público, sem chave) é colado sobre ela.
// Para usar outro provedor (mais detalhe): window.__WG_TILES = { url: 'https://.../{z}/{x}/{y}.jpg', maxZ: 18 } (ou TILE_URL/TILE_MAXZ no build).
// Camada de detalhe (ruas): entra quando o zoom passa do que a NASA oferece (nível 8). OpenStreetMap exige crédito visível. Sem efeito se você definir TILE_URL (provedor próprio).
const DETAIL = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZ: 17 };
const TILES = { url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', maxZ: 8 };
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
const KMAX = 3000; // zoom estilo mapa: dá para chegar bem perto de uma cidade grande
export class Globe {
  constructor(canvas, wrap, cities, cb){
    this.credit = Object.assign(document.createElement('a'), { className: 'map-credit', href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener', textContent: '© Colaboradores do OpenStreetMap', hidden: true }); wrap.append(this.credit);
    this.borders = new Borders(() => this.invalidate());
    Object.assign(this, { canvas, wrap, cities, cb, ctx: canvas.getContext('2d'), lon: -30, lat: 18, k: 1, sel: null, hover: null, land: null, grat: null, W: 0, H: 0, padT: 0, padB: 0, dpr: 1, raf: 0, anim: null, visible: true, spin: false, lastTouch: 0, ptrs: new Map(), reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, ready: false });
    new ResizeObserver(() => this.resize()).observe(wrap);
    new IntersectionObserver(e => { this.visible = e[0].isIntersecting; if (this.visible) this.draw(); }, { threshold: 0 }).observe(wrap);
    this.glc = document.createElement('canvas'); this.glc.className = 'gl'; this.glc.setAttribute('aria-hidden', 'true'); wrap.insertBefore(this.glc, canvas);
    this.nightOn = true; this.ambient = !this.lite && matchMedia('(hover:hover) and (pointer:fine)').matches; this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bind(); this.resize();
  }
  get R(){ return Math.min(this.W, this.H - this.padT - this.padB) / 2 * (this.W < 768 ? .97 : .86) * this.k; }
  get CY(){ return this.padT + (this.H - this.padT - this.padB) / 2; }
  // reserva as faixas do globo que ficam cobertas (cabeçalho, player, avisos) para ele caber inteiro na parte visível
  setPad(t, b){ t = Math.max(0, Math.round(t)); b = Math.max(0, Math.round(b)); if (t !== this.padT || b !== this.padB){ this.padT = t; this.padB = b; this.invalidate(); } }
  resize(){
    const r = this.wrap.getBoundingClientRect(); if (!r.width) return;
    this.lite = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || /[?&]lite\b/.test(location.search); this.dpr = Math.min(window.devicePixelRatio || 1, this.lite ? 1.5 : 2); this.W = r.width; this.H = r.height;
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
        if (glOk){ try { this.uploadTex(im); this.tex = { gl: true }; this.texV = (this.texV || 0) + 1; if (!this.lite && !window.__WG_TEX) this.upgradeTex(im.naturalWidth); return true; } catch { this.G = null; } }
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
uniform vec2 uC;uniform float uR,uLon,uLat,uSL,uSO,uNight,uTm,uCl;uniform sampler2D uT,uP;uniform vec4 uPB;uniform float uPO;out vec4 o;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int k=0;k<4;k++){s+=a*vn(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
void main(){
  vec2 q=(gl_FragCoord.xy-uC)/uR;float r2=dot(q,q);
  if(r2>=1.){o=vec4(0.);return;}
  float z=sqrt(1.-r2),x=q.x,y=q.y,s0=sin(uLat),c0=cos(uLat);
  float phi=asin(clamp(y*c0+z*s0,-1.,1.)),lam=uLon+atan(x,z*c0-y*s0);
  vec2 uv=vec2(lam/6.2831853+.5,.5-phi/3.1415927);
  vec3 c=textureGrad(uT,vec2(fract(uv.x),uv.y),dFdx(uv),dFdy(uv)).rgb;
  float pm=0.;
  if(uPO>.5){float ym=.5-log(tan(.7853982+phi*.5))/6.2831853;vec2 pp=vec2(fract(uv.x-uPB.x)/uPB.z,(ym-uPB.y)/uPB.w);
    vec4 pc=texture(uP,clamp(pp,0.,1.));vec2 e2=min(pp,1.-pp);pm=pc.a*smoothstep(0.,.07,min(e2.x,e2.y));c=mix(c,pc.rgb,pm);}
  float lu=dot(c,vec3(.3,.59,.11));c=mix(vec3(lu),c,1.16);c=clamp((c-.5)*1.08+.5+.015,0.,1.);
  float wat=clamp((c.b-c.r)*4.5-.12,0.,1.)*(1.-smoothstep(.5,.72,lu));
  vec3 L=normalize(vec3(-.26,.32,.91));
  float l=min(1.12,.40+.80*dot(vec3(x,y,z),L)),rim=pow(1.-z,3.)*.28;
  float dd=cos(phi)*cos(uSL)*cos(lam-uSO)+sin(phi)*sin(uSL);
  float day=smoothstep(-.14,.2,dd);
  float cl=0.;
  if(uCl>.5){vec3 sp=vec3(cos(phi)*cos(lam+uTm),cos(phi)*sin(lam+uTm),sin(phi));cl=smoothstep(.54,.8,fbm(sp*3.2)*.75+fbm(sp*8.)*.35);}
  c=mix(c,vec3(.97,.98,1.),cl*.6*(1.-pm));
  c=c*l+vec3(rim*.35,rim*.6,rim);c*=1.-.24*pow(r2,1.5);
  vec3 Hh=normalize(L+vec3(0.,0.,1.));float sp2=pow(max(dot(vec3(x,y,z),Hh),0.),48.)*wat*(1.-cl)*(1.-pm)*.7;
  c+=vec3(.75,.88,1.)*sp2*day;
  float fr=pow(1.-z,2.2);c+=vec3(.20,.42,.95)*fr*.5*mix(.35,1.,day);
  vec3 nt=c*vec3(.2,.28,.5)+vec3(.0,.012,.04);
  c=mix(c,mix(nt,c,day),uNight);
  float tw=smoothstep(.0,.55,1.-day)*uNight;c+=vec3(.12,.2,.38)*rim*2.5*tw;
  float a=smoothstep(1.,.994,sqrt(r2));o=vec4(c*a,a);
}`));
      gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.G = { gl, u: { c: gl.getUniformLocation(pr, 'uC'), r: gl.getUniformLocation(pr, 'uR'), lon: gl.getUniformLocation(pr, 'uLon'), lat: gl.getUniformLocation(pr, 'uLat'), sl: gl.getUniformLocation(pr, 'uSL'), so: gl.getUniformLocation(pr, 'uSO'), night: gl.getUniformLocation(pr, 'uNight'), tm: gl.getUniformLocation(pr, 'uTm'), po: gl.getUniformLocation(pr, 'uPO'), pb: gl.getUniformLocation(pr, 'uPB'), cl: gl.getUniformLocation(pr, 'uCl') } };
      gl.activeTexture(gl.TEXTURE1); const pt = this.G.pt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, pt); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.uniform1i(gl.getUniformLocation(pr, 'uP'), 1); gl.activeTexture(gl.TEXTURE0);
      return true;
    } catch { this.G = null; return false; }
  }
  async upgradeTex(cur){ // troca por imagem de maior resolução em segundo plano, sem travar a primeira exibição
    for (const u of TEX_HI){ try {
      const im = await loadImg(u); if (im.naturalWidth <= cur * 1.2 || Math.abs(im.naturalWidth / im.naturalHeight - 2) > .08) continue;
      const old = this.G.tex; this.uploadTex(im); if (old) this.G.gl.deleteTexture(old); this.texV++; this.invalidate(); return;
    } catch {} }
  }
  uploadTex(im){
    const { gl } = this.G, max = gl.getParameter(gl.MAX_TEXTURE_SIZE), w = Math.min(im.naturalWidth, 4096, max); this.texW = w;
    let src = im; if (w < im.naturalWidth){ const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w / 2); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); src = c; }
    const t = this.G.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.uniform1i(gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'uT'), 0);
  }
  // ---- mapa em blocos ----
  tcfg(){ return window.__WG_TILES || (config.tileUrl ? { url: config.tileUrl, maxZ: config.tileMaxZ || 8 } : TILES); }
  patchOn(R){ return !!(this.patch && this.texW && 2 * Math.PI * R > this.texW * 1.15); }
  det(){ return !window.__WG_TILES && !config.tileUrl && this.tcfg().maxZ < DETAIL.maxZ ? DETAIL : null; }
  tileZ(R){ const b = this.tcfg(), d = this.det(), z = Math.round(Math.log2(2 * Math.PI * R * Math.min(this.dpr, 1.5) / 256));
    if (d && z > b.maxZ) return Math.max(b.maxZ + 1, Math.min(d.maxZ, Math.round(Math.log2(2 * Math.PI * R / 256)))); return Math.max(3, Math.min(b.maxZ, z)); }
  patchTick(R){
    if (!this.G || !this.texW || this.anim || this.ptrs.size || this.kT != null || 2 * Math.PI * R <= this.texW * 1.15) return;
    clearTimeout(this._pt); this._pt = setTimeout(() => this.buildPatch(this.tileZ(this.R)), 220);
  }
  tileXY(z){ const n = 2 ** z, f = this.lat * rad; return [(((this.lon + 180) / 360) % 1 + 1) % 1 * n, (.5 - Math.log(Math.tan(Math.PI / 4 + Math.max(-1.48, Math.min(1.48, f)) / 2)) / (2 * Math.PI)) * n]; }
  async buildPatch(z){
    const N = this.lite ? 6 : 8, n = 2 ** z, [fx, fy] = this.tileXY(z), p = this.patch;
    if (p && p.z === z && Math.abs(fx - (p.x0 + N / 2)) < N * .22 && Math.abs(fy - (p.y0 + N / 2)) < N * .22) return;
    const x0 = Math.floor(fx - N / 2), y0 = Math.max(0, Math.min(n - N, Math.floor(fy - N / 2))), tok = this._ptok = (this._ptok || 0) + 1, cfg = z > this.tcfg().maxZ && this.det() ? DETAIL : this.tcfg();
    const cv = document.createElement('canvas'); cv.width = cv.height = N * 256; const x = cv.getContext('2d'), cache = this.tileCache || (this.tileCache = new Map());
    let t = 0; const flush = () => { clearTimeout(t); t = setTimeout(() => { if (tok === this._ptok) this.uploadPatch(cv, { z, x0, y0, N, detail: cfg === DETAIL }); }, 120); };
    const jobs = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) jobs.push([i, j]);
    jobs.sort((a, b) => Math.hypot(a[0] - N / 2 + .5, a[1] - N / 2 + .5) - Math.hypot(b[0] - N / 2 + .5, b[1] - N / 2 + .5));
    await Promise.all(jobs.map(async ([i, j]) => {
      const tx = ((x0 + i) % n + n) % n, ty = y0 + j, url = cfg.url.replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
      try { let im = cache.get(url); if (!im){ im = await loadImg(url); cache.set(url, im); if (cache.size > 220) cache.delete(cache.keys().next().value); }
        if (tok !== this._ptok) return; x.drawImage(im, i * 256, j * 256, 256, 256); flush(); } catch {}
    }));
  }
  uploadPatch(cv, meta){
    const { gl } = this.G; gl.activeTexture(gl.TEXTURE1); const old = this.G.pt, t = this.G.pt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.activeTexture(gl.TEXTURE0); if (old) gl.deleteTexture(old);
    this.patch = meta; this.patchV = (this.patchV || 0) + 1; this.invalidate();
  }
  renderGL(R, cx, cy){
    const key = [R, cx, cy, this.lon, this.lat, this.glc.width, this.glc.height, this.nightOn, Math.round(Date.now() / 30000), this.texV || 0, this.patchOn(R) ? this.patchV : 0].join(); if (key === this._glKey) return; this._glKey = key;
    const { gl, u } = this.G, d = this.dpr; gl.viewport(0, 0, this.glc.width, this.glc.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.c, cx * d, (this.H - cy) * d); gl.uniform1f(u.r, R * d); gl.uniform1f(u.lon, this.lon * rad); gl.uniform1f(u.lat, this.lat * rad); const sn = this.sun(); gl.uniform1f(u.sl, sn.lat); gl.uniform1f(u.so, sn.lon); gl.uniform1f(u.night, this.nightOn ? 1 : 0); gl.uniform1f(u.tm, (Date.now() / 1000 % 86400) * 4e-5); gl.uniform1f(u.cl, this.lite ? 0 : 1);
    const P = this.patchOn(R) ? this.patch : null; gl.uniform1f(u.po, P ? 1 : 0); if (P){ const n = 2 ** P.z; gl.uniform4f(u.pb, P.x0 / n, P.y0 / n, P.N / n, P.N / n); } gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // Plano B sem WebGL: para cada pixel do disco, acha longitude/latitude (projeção ortográfica inversa) e lê a cor da imagem.
  drawTex(R, cx, cy, q){
    const { tex, ctx } = this, S = Math.max(8, Math.min(720, Math.round(2 * R * this.dpr * q)));
    if (!this.off || this.off.width !== S){ this.off = document.createElement('canvas'); this.off.width = this.off.height = S; this.offCtx = this.off.getContext('2d'); this.img = this.offCtx.createImageData(S, S); }
    const sn = this.sun(), sCl = Math.cos(sn.lat), sSl = Math.sin(sn.lat), d = this.img.data, T = tex.d, tw = tex.w, th = tex.h, φ0 = this.lat * rad, s0 = Math.sin(φ0), c0 = Math.cos(φ0), λ0 = this.lon * rad, TAU = Math.PI * 2;
    for (let j = 0; j < S; j++){
      const y = 1 - 2 * (j + .5) / S;
      for (let i = 0; i < S; i++){
        const x = 2 * (i + .5) / S - 1, r2 = x * x + y * y, k = (j * S + i) * 4;
        if (r2 >= 1){ d[k + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2), φ = Math.asin(y * c0 + z * s0), λ = λ0 + Math.atan2(x, z * c0 - y * s0);
        let u = (λ / TAU + .5) % 1; if (u < 0) u += 1;
        let tx = (u * tw) | 0, ty = ((.5 - φ / Math.PI) * th) | 0; if (ty < 0) ty = 0; else if (ty >= th) ty = th - 1; if (tx >= tw) tx = tw - 1;
        const t = (ty * tw + tx) * 4, l = Math.min(1.1, .42 + .78 * (-.26 * x + .32 * y + .91 * z)), rim = (1 - z) ** 3 * 70;
        let dn = 1; if (this.nightOn){ const dd = Math.cos(φ) * sCl * Math.cos(λ - sn.lon) + Math.sin(φ) * sSl, ty2 = Math.max(0, Math.min(1, (dd + .14) / .34)), day = ty2 * ty2 * (3 - 2 * ty2); dn = .22 + .78 * day; }
        d[k] = Math.min(255, (T[t] * l + rim * .35) * dn); d[k + 1] = Math.min(255, (T[t + 1] * l + rim * .6) * dn); d[k + 2] = Math.min(255, (T[t + 2] * l + rim) * (dn + (1 - dn) * .5)); d[k + 3] = 255;
      }
    }
    this.offCtx.putImageData(this.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.off, cx - R, cy - R, 2 * R, 2 * R);
  }
  // posição do Sol (aprox.): declinação pelo dia do ano, longitude pela hora UTC
  sun(){ const n = Date.now(); if (this._sunT && n - this._sunT < 30000) return this._sun; const d = new Date(n), doy = (n - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5, h = d.getUTCHours() + d.getUTCMinutes() / 60;
    this._sunT = n; return this._sun = { lat: -23.44 * rad * Math.cos(2 * Math.PI * (doy + 10) / 365), lon: (12 - h) * 15 * rad }; }
  setNight(on){ this.nightOn = !!on; this.invalidate(); }
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
    if (this.drawn && this.drawn.length){ for (const d of this.drawn){ const e = (d.x - x) ** 2 + (d.y - y) ** 2; if (e < bd){ bd = e; best = d.c; } } return best; }
    for (const c of this.cities){ const p = this.project(c.o, c.a); if (!p.v) continue; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd){ bd = d; best = c; } }
    return best;
  }
  setAudioPoint(p){ this.audioPt = p; this.audioT = performance.now(); this.invalidate(); }
  setSelected(c){ this.sel = c; this.selT = performance.now(); this.invalidate(); }
  zoom(f){ this.kT = Math.max(.85, Math.min(KMAX, (this.kT ?? (this.anim ? this.anim.k1 : this.k)) * f)); this.invalidate(); }
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
    let more = this.step(now), pingMore = false;
    if (this.kT != null && !this.anim){ const dk = this.kT - this.k; if (Math.abs(dk) < .002){ this.k = this.kT; this.kT = null; } else { this.k += dk * (1 - Math.exp(-dt / 110)); more = true; } }
    if (this.follow && this.plane && !this.anim && !this.ptrs.size && now - this.lastTouch > 1500){ const c = slerp([this.lon, this.lat], [this.plane.lon, this.plane.lat], 1 - Math.exp(-dt / 650)); this.lon = c[0]; this.lat = c[1]; more = true; }
    if (this.plane && this.follow) more = true;
    if (this.spin && !more && now - this.lastTouch > this.idleMs && !this.ptrs.size){ this.lon += .004 * dt; more = true; }
    else if (this.spin && !more && !this.ptrs.size && isFinite(this.idleMs)){ clearTimeout(this._st); this._st = setTimeout(() => this.invalidate(), Math.max(200, this.idleMs - (now - this.lastTouch)) + 60); }
    const { ctx, W, H, dpr } = this, R = this.R, cx = W / 2, cy = this.CY, useGL = !!(this.G && this.tex && this.tex.gl);
    if (useGL){ this.renderGL(R, cx, cy); this.patchTick(R); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!this.stars){ let sd = 7; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647; this.stars = Array.from({ length: this.lite ? 70 : 150 }, () => ({ x: rn(), y: rn(), r: .4 + rn() * 1.1, p: rn() * 6.28, s: .4 + rn() * 1.4 })); }
    {
      const light = document.documentElement.dataset.theme === 'light', off = (this.lon * .0016) % 1; ctx.fillStyle = light ? '#ffffff' : '#dfe9ff';
      for (const st of this.stars){ const x = ((st.x - off) % 1 + 1) % 1 * W, y = st.y * H; if (Math.hypot(x - cx, y - cy) < R * 1.08) continue; ctx.globalAlpha = (light ? .45 : .25) + (light ? .5 : .6) * (this.reduce ? .6 : .5 + .5 * Math.sin(now / 900 * st.s + st.p)); ctx.beginPath(); ctx.arc(x, y, st.r * (light ? 1.4 : 1), 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    const glow = ctx.createRadialGradient(cx, cy, R * .97, cx, cy, R * 1.22);
    const lt = document.documentElement.dataset.theme === 'light'; glow.addColorStop(0, lt ? 'rgba(110,150,235,.34)' : 'rgba(90,150,255,.5)'); glow.addColorStop(.35, lt ? 'rgba(90,130,230,.12)' : 'rgba(70,120,255,.2)'); glow.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, 6.2832); ctx.fill();
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
    if (this.tex || useGL) this.borders.draw(ctx, this, this.lite);
    { const det = this.patchOn(R) && this.patch.detail; if (this.credit.hidden === det) this.credit.hidden = !det; }
    ctx.restore();
    const r = Math.max(1.3, Math.min(3.6, R * .0058)); ctx.beginPath();
    const stp = this.lite ? (this.k < 1.8 ? 2 : 1) : 1, cs = this.cities, sn = this.sun(), sCl = Math.cos(sn.lat), sSl = Math.sin(sn.lat), nOn = this.nightOn;
    const warm = new Path2D(), cold = new Path2D(), cell = this.lite ? 11 : 8, occ = new Set(), drawn = []; // 1 ponto por célula da tela: perto do zoom máximo todos aparecem, de longe só os principais
    for (let i = 0; i < cs.length; i += stp){ const c = cs[i], p = this.project(c.o, c.a); if (!p.v) continue;
      if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
      const key = ((p.x / cell) | 0) * 4096 + ((p.y / cell) | 0); if (occ.has(key)) continue; occ.add(key); drawn.push({ c, x: p.x, y: p.y });
      let night = false; if (nOn){ if (c._ca === undefined){ c._ca = Math.cos(c.a * rad); c._sa = Math.sin(c.a * rad); } night = c._ca * sCl * Math.cos((c.o * rad) - sn.lon) + c._sa * sSl < -.04; }
      (night ? warm : cold).moveTo(p.x + r, p.y); (night ? warm : cold).arc(p.x, p.y, night ? r * 1.15 : r, 0, 6.2832); }
    this.drawn = drawn;
    ctx.fillStyle = 'rgba(190,220,255,.9)'; ctx.fill(cold); ctx.fillStyle = 'rgba(255,214,140,.98)'; ctx.fill(warm);
    if (nOn && R > 90){ ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,70,.16)'; ctx.shadowColor = 'rgba(255,170,60,.9)'; ctx.shadowBlur = 6; ctx.fill(warm); ctx.restore(); }
    if (R > 110 && !this.lite && cs.length < 9000){ ctx.beginPath(); for (const c of cs){ const p = this.project(c.o, c.a); if (p.v){ ctx.moveTo(p.x + r * 2.6, p.y); ctx.arc(p.x, p.y, r * 2.6, 0, 6.2832); } } ctx.fillStyle = 'rgba(120,180,255,.13)'; ctx.fill(); }
    if (R > 330){ // nomes das cidades (estilo mapa), sem sobreposição
      const light = document.documentElement.dataset.theme === 'light', boxes = []; ctx.font = '600 11.5px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.2;
      ctx.strokeStyle = light ? 'rgba(255,255,255,.85)' : 'rgba(6,10,24,.85)'; ctx.fillStyle = light ? '#14161c' : '#eaf2ff';
      for (let i = 0, n = 0; i < drawn.length && i < 700 && n < 90; i++){ const d = drawn[i]; if (Math.hypot(d.x - cx, d.y - cy) > R * .985) continue; const w = ctx.measureText(d.c.n).width, bx = d.x + r + 4, by = d.y - 8;
        if (bx + w > W || by < 0 || by > H) continue; let hit = false; for (const b of boxes){ if (bx < b[2] && bx + w > b[0] && by < b[3] && by + 16 > b[1]){ hit = true; break; } } if (hit) continue;
        boxes.push([bx - 2, by, bx + w + 2, by + 16]); ctx.strokeText(d.c.n, bx, d.y); ctx.fillText(d.c.n, bx, d.y); n++; }
    }
    if (this.ambient && !this.reduce && R > 90){ // pulsos de atividade: cidades visíveis piscam de leve (só PC, desliga no modo leve)
      if (!this.pings) this.pings = [];
      if (now - (this.pingT || 0) > 700 && this.pings.length < 7){ this.pingT = now; for (let n = 0; n < 12; n++){ const c = cs[(Math.random() * cs.length) | 0], p = this.project(c.o, c.a); if (p.v){ this.pings.push({ c, t: now }); break; } } }
      this.pings = this.pings.filter(g => now - g.t < 2200);
      for (const g of this.pings){ const p = this.project(g.c.o, g.c.a); if (!p.v) continue; const t = (now - g.t) / 2200; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + t * 16, 0, 6.2832); ctx.strokeStyle = '#6fe3ff'; ctx.globalAlpha = .65 * (1 - t); ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1; }
      pingMore = true;
    }
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
    if (this.audioPt){ const q = this.project(this.audioPt.o, this.audioPt.a); if (q.v){ const ph = this.reduce ? 0 : ((now - this.audioT) % 1800) / 1800; ctx.beginPath(); ctx.arc(q.x, q.y, 4 + ph * 14, 0, 6.2832); ctx.strokeStyle = '#7fe0b0'; ctx.globalAlpha = .7 * (1 - ph); ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(q.x, q.y, 3.4, 0, 6.2832); ctx.fillStyle = '#7fe0b0'; ctx.fill(); if (!this.reduce) more = true; } }
    for (const [c, col, rr] of [[this.hover, '#ffffff', 5], [this.sel, '#ff5d73', 6]]){
      if (!c) continue; const p = this.project(c.o, c.a); if (!p.v) continue;
      if (c === this.sel && !this.reduce && now - this.selT < 2600){ const t = (now - this.selT) / 2600; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 6 + t * 30, 0, 6.2832); ctx.strokeStyle = col; ctx.globalAlpha = .6 * (1 - t); ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; more = true; }
      if (c === this.sel){ const dx = (p.x - cx) / R, dy = (p.y - cy) / R, L = Math.max(14, R * .16), ex = p.x + dx * L, ey = p.y + dy * L - L * .55, g = ctx.createLinearGradient(p.x, p.y, ex, ey); g.addColorStop(0, 'rgba(255,93,115,.9)'); g.addColorStop(1, 'rgba(255,93,115,0)'); ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, rr + 5, 0, 6.2832); ctx.strokeStyle = col; ctx.globalAlpha = .45; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
      ctx.font = '500 12.5px "IBM Plex Mono",ui-monospace,monospace'; const w = ctx.measureText(c.n).width + 16, lx = Math.max(4, Math.min(W - w - 4, p.x - w / 2)), ly = p.y - 34 < 4 ? p.y + 16 : p.y - 34;
      ctx.fillStyle = 'rgba(10,10,10,.92)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, w, 22, 8) : ctx.rect(lx, ly, w, 22); ctx.fill();
      ctx.fillStyle = '#ece8e1'; ctx.textBaseline = 'middle'; ctx.fillText(c.n, lx + 8, ly + 11);
    }
    if (!this.canvas.classList.contains('on')) { this.canvas.classList.add('on'); this.cb.onFirstDraw && this.cb.onFirstDraw(); }
    const zoomed = this.k > 1.15; if (zoomed !== this._zoomed){ this._zoomed = zoomed; this.cb.onZoomed && this.cb.onZoomed(zoomed); }
    if (more) this.invalidate(); else if (pingMore && !this._pt) this._pt = setTimeout(() => { this._pt = 0; this.invalidate(); }, 45);
  }
  bind(){
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }); this.lastTouch = performance.now(); this.anim = null; if (this.ptrs.size === 2) this.pinch = { d: this.pd(), k: this.k }; });
    cv.addEventListener('pointermove', e => {
      const p = this.ptrs.get(e.pointerId), box = cv.getBoundingClientRect();
      if (!p){ if (e.pointerType === 'mouse'){ const c = this.hit(e.clientX - box.left, e.clientY - box.top, 12); if (c !== this.hover){ this.hover = c; this.cb.onHover && this.cb.onHover(c); this.invalidate(); cv.style.cursor = c ? 'pointer' : 'grab'; } } return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
      if (this.ptrs.size === 2 && this.pinch){ this.k = this.kT = Math.max(.85, Math.min(KMAX, this.pinch.k * this.pd() / this.pinch.d)); this.kT = null; this.invalidate(); return; }
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
      if (!c){ const g = this.inverse(x, y); if (g) c = this.nearest(g.lon, g.lat, Math.max(12, 900 / Math.pow(this.k, 1.7))); }
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
