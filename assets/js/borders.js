// Divisas desenhadas por cima do globo: fronteiras de países e limites de estados/províncias (só linhas, sem nomes).
// Dados: Natural Earth (domínio público). Procura primeiro um arquivo local em /assets/geo/<nome>.geojson e depois o CDN; se nada carregar, o globo segue sem as linhas.
const NE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/';
const SETS = {
  paises: 'ne_50m_admin_0_boundary_lines_land',
  estados: 'ne_50m_admin_1_states_provinces_lines',
  estadosHi: 'ne_10m_admin_1_states_provinces_lines'
};
const rad = Math.PI / 180;

function parse(gj){
  const out = [];
  const add = pts => {
    if (pts.length < 2) return; const n = pts.length, v = new Float32Array(n * 3); let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < n; i++){ const lo = pts[i][0] * rad, la = pts[i][1] * rad, c = Math.cos(la), x = c * Math.cos(lo), y = c * Math.sin(lo), z = Math.sin(la); v[i * 3] = x; v[i * 3 + 1] = y; v[i * 3 + 2] = z; sx += x; sy += y; sz += z; }
    const m = Math.hypot(sx, sy, sz) || 1; sx /= m; sy /= m; sz /= m; let r = 0;
    for (let i = 0; i < n; i++){ const d = Math.acos(Math.max(-1, Math.min(1, v[i * 3] * sx + v[i * 3 + 1] * sy + v[i * 3 + 2] * sz))); if (d > r) r = d; }
    out.push({ v, n, c: [sx, sy, sz], s: Math.sin(Math.min(r, Math.PI / 2)), wide: r > 1.5 });
  };
  for (const f of gj.features || []){ const g = f.geometry; if (!g) continue;
    if (g.type === 'LineString') add(g.coordinates); else if (g.type === 'MultiLineString') g.coordinates.forEach(add); }
  return out;
}

export class Borders {
  constructor(onLoad){ this.d = {}; this.st = {}; this.onLoad = onLoad; }
  async load(key){
    if (this.st[key]) return; this.st[key] = 1; const f = SETS[key];
    for (const u of [`/assets/geo/${f}.geojson`, NE + f + '.geojson']){
      try { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) continue; const gj = await r.json(); if (!gj || !gj.features) continue; this.d[key] = parse(gj); this.onLoad(); return; } catch {}
    }
  }
  // alpha de cada camada conforme o zoom; já dispara o carregamento quando a camada passa a aparecer
  draw(ctx, g, lite){
    const k = g.k, R = g.R, aP = Math.min(.55, .22 + Math.max(0, k - 1) * .1), aE = Math.max(0, Math.min(.5, (k - 1.5) * .22));
    this.load('paises'); if (aE > 0) this.load('estados');
    if (aE > 0 && k >= 8 && !lite && !(navigator.connection && navigator.connection.saveData)) this.load('estadosHi');
    const est = this.d.estadosHi && k >= 7 ? this.d.estadosHi : this.d.estados;
    const lo = g.lon * rad, la = g.lat * rad, cl = Math.cos(la), sl = Math.sin(la), cL = Math.cos(lo), sL = Math.sin(lo);
    const ex = -sL, ey = cL, nx = -sl * cL, ny = -sl * sL, nz = cl, vx = cl * cL, vy = cl * sL, vz = sl, cx = g.W / 2, cy = g.CY;
    const stride = R < 260 ? 3 : R < 700 ? 2 : 1;
    const pass = (lines, col, lw, a) => {
      if (!lines || a <= 0) return; ctx.beginPath();
      for (const L of lines){
        if (L.c[0] * vx + L.c[1] * vy + L.c[2] * vz < -L.s - .02) continue; const v = L.v; let pen = false;
        for (let i = 0; i < L.n; i += (i + stride >= L.n || stride === 1 ? 1 : stride)){
          const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
          if (x * vx + y * vy + z * vz <= 0){ pen = false; continue; }
          const sx = cx + R * (x * ex + y * ey), sy = cy - R * (x * nx + y * ny + z * nz);
          if (pen) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); pen = true; }
        }
      }
      ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.stroke(); ctx.globalAlpha = 1;
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    pass(est, '#ffffff', Math.max(.6, Math.min(1.2, R / 700)), aE);
    pass(this.d.paises, '#ffffff', Math.max(.8, Math.min(1.6, R / 500)), aP);
  }
}
