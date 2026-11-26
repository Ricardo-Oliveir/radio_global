// Testes de interface do WAVE GLOBAL (Playwright). Uso: node tests/run.cjs
// Sobe o site de dist/ (e dist-ads/ para o teste de anúncios) em um servidor local, simula a API de rádios e o áudio.
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');
let chromium; try { ({ chromium } = require('playwright')); } catch { console.error('Instale o Playwright: npm i -D playwright'); process.exit(1); }
const ROOT = path.resolve(__dirname, '..');
const MODS = process.env.NODE_MODULES_DIR || '/opt/npm-tools/node_modules';
const WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024, 1366, 1920];
const results = []; let failed = 0;
const ok = (name, pass, info) => { results.push({ name, pass, info }); if (!pass) failed++; console.log((pass ? 'ok   ' : 'FALHA ') + name + (info && !pass ? '  → ' + JSON.stringify(info) : '')); };

function build(dir, env){ execSync('node scripts/build.mjs', { cwd: ROOT, env: { ...process.env, BUILD_DIR: dir, SITE_URL: 'https://teste.wave', ...env }, stdio: 'pipe' }); }
build('dist', {});
build('dist-ads', { GOOGLE_ADSENSE_CLIENT: 'ca-pub-1234567890123456', GOOGLE_ADSENSE_SLOT: '1234567890', CONTACT_EMAIL: 'contato@exemplo.com' });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };
function serve(dir){
  return new Promise(res => {
    const srv = http.createServer((req, rs) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      let f = path.join(ROOT, dir, p); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
      if (!f.startsWith(path.join(ROOT, dir)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ rs.statusCode = 404; return rs.end('nao'); }
      rs.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); rs.end(fs.readFileSync(f));
    }).listen(0, '127.0.0.1', () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}
// áudio silencioso de 60 s
const WAV = (() => { const sr = 8000, n = sr * 60, b = Buffer.alloc(44 + n, 128); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); return b; })();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==', 'base64');
const mk = (id, name, cc, extra = {}) => ({ stationuuid: id, name, url_resolved: 'https://good.example/' + id + '.wav', lastcheckok: 1, tags: 'pop,hits', codec: 'MP3', bitrate: 128, state: '', countrycode: cc, country: cc, favicon: '', ...extra });
function api(u){
  const url = new URL(u), p = url.searchParams, cc = p.get('countrycode') || 'BR', name = p.get('name'), tag = p.get('tag');
  if (p.get('state') || p.get('geo_lat')) return [];
  if (name && p.get('countrycode')) return [mk('bad-' + cc + name, 'Radio ' + name + ' Quebrada', cc, { url_resolved: 'https://bad.example/x.mp3' }), mk('g1-' + cc + name, 'Radio ' + name + ' FM', cc), mk('g2-' + cc + name, 'Radio ' + name + ' Hits', cc)];
  if (name) return [1, 2, 3, 4, 5].map(i => mk('n' + i + name, name + ' Radio ' + i, 'FR'));
  if (tag) return [1, 2, 3, 4, 5, 6].map(i => mk('t' + i + tag + cc, tag + ' ' + i, p.get('countrycode') || 'US', { tags: tag + ',music' }));
  if (p.get('countrycode')) return [1, 2, 3, 4, 5, 6].map(i => mk('c' + i + cc, 'Top ' + cc + ' ' + i, cc));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => mk('p' + i, 'Popular ' + i, ['US', 'BR', 'DE', 'JP', 'FR'][i % 5], { favicon: 'https://logos.example/' + i + '.png' }));
}
async function newPage(browser, w, base, seedStorage, ctxOpts){
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 }, deviceScaleFactor: 1, locale: 'pt-BR', hasTouch: w < 768, isMobile: w < 768, ...(ctxOpts || {}) });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.addInitScript(() => { window.__audios = 0; const A = window.Audio; window.Audio = function (...a) { window.__audios++; return new A(...a); }; window.Audio.prototype = A.prototype; });
  if (seedStorage) await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seedStorage);
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(base) || u.startsWith('data:')) return r.continue();
    if (u.includes('radio-browser.info')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(api(u)) });
    if (u.startsWith('https://proxy.test')) return r.fulfill({ contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV });
    if (u.startsWith('https://good.example')) return r.fulfill({ contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV });
    if (u.startsWith('https://bad.example')) return r.fulfill({ status: 404, body: 'x' });
    if (u.includes('d3-array')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MODS + '/d3-array/dist/d3-array.min.js') });
    if (u.includes('d3-geo')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MODS + '/d3-geo/dist/d3-geo.min.js') });
    if (u.includes('topojson-client')) return r.fulfill({ contentType: 'text/javascript', body: "window.topojson={feature:()=>({type:'MultiPolygon',coordinates:[[[[-85,-35],[-85,12],[-30,12],[-30,-35],[-85,-35]]],[[[-10,35],[-10,70],[40,70],[40,35],[-10,35]]],[[[10,-35],[10,30],[50,30],[50,-35],[10,-35]]]]})};" });
    if (u.includes('land-110m')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"objects":{"land":{}}}' });
    if (u.includes('earth-blue-marble')) return r.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(__dirname, 'fixtures/earth-test.png')) });
    if (u.includes('flagcdn.com')) return r.fulfill({ contentType: 'image/png', body: PNG });
    if (u.includes('pagead2.googlesyndication.com')) return r.fulfill({ contentType: 'text/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];window.__adsScripts=(window.__adsScripts||0)+1;' });
    if (u.includes('logos.example')) return r.fulfill({ contentType: 'image/png', body: PNG });
    return r.abort();
  });
  return { ctx, page, errs };
}
// ---- Verificação da versão atual (ids de index.html). Uso: node tests/smoke.cjs
const layoutChecks = () => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); if (!(r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden],[inert]'))) return false;
    // ignora o que está escondido por rolagem interna (ex.: lista dentro do painel do local)
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(o.overflowY + o.overflowX)) { const c = a.getBoundingClientRect(); if (r.bottom <= c.top + 1 || r.top >= c.bottom - 1 || r.right <= c.left + 1 || r.left >= c.right - 1) return false; } }
    return true; };
  const name = e => e.id || (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 22) || e.tagName;
  const out = { hscroll: document.documentElement.scrollWidth - innerWidth, off: [], overlaps: [], small: [], clipped: [] };
  const els = [...document.querySelectorAll('button,a[href],input,select,summary,[role=tab]')].filter(vis).filter(e => !e.classList.contains('skip') && !e.closest('dialog:not([open])'));
  els.forEach(e => { const r = e.getBoundingClientRect(); if ((r.right > innerWidth + .5 || r.left < -.5) && !e.closest('.tabs,[role=tablist]')) out.off.push(name(e)); });
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
    const zone = e => e.closest('#player') ? 'p' : (e.closest('#loc') && getComputedStyle(document.getElementById('loc')).position === 'fixed') ? 'l' : '';
    if (zone(a) !== zone(b)) continue; // o player e a gaveta da cidade são fixos e o conteúdo rola por baixo deles
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 1 && h > 1) out.overlaps.push(name(a) + ' x ' + name(b) + ' ' + [ra, rb].map(r => [r.left, r.top, r.right, r.bottom].map(Math.round)).join('|'));
  }
  els.forEach(e => { const r = e.getBoundingClientRect(); if ((r.width < 40 || r.height < 40) && e.tagName !== 'A' && e.type !== 'range' && !e.classList.contains('chip') && !e.classList.contains('tag')) out.small.push(name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  document.querySelectorAll('h1,h2,h3,.btn,.chip,button,.brand,#pName,#pMeta').forEach(e => { if (vis(e) && e.scrollWidth > e.clientWidth + 1 && !['ellipsis'].includes(getComputedStyle(e).textOverflow) && getComputedStyle(e).overflow !== 'visible') out.clipped.push(name(e)); });
  const p = document.getElementById('player').getBoundingClientRect();
  out.playerBottom = Math.round(innerHeight - p.bottom); out.playerH = Math.round(p.height);
  return out;
};
const WIDTHS_ = process.env.W ? process.env.W.split(',').map(Number) : WIDTHS;
(async () => {
  const A = await serve(process.env.DIR || 'dist'); const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const w of WIDTHS_) {
    const { ctx, page, errs } = await newPage(browser, w, A.url);
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    let c = await page.evaluate(layoutChecks);
    ok(`${w}px · sem rolagem horizontal (inicial)`, c.hscroll <= 0, c.hscroll);
    ok(`${w}px · nada fora da tela (inicial)`, !c.off.length, c.off);
    ok(`${w}px · nenhum botão sobreposto (inicial)`, !c.overlaps.length, c.overlaps);
    ok(`${w}px · áreas de toque ≥ 40px (inicial)`, !c.small.length, c.small);
    ok(`${w}px · textos sem corte (inicial)`, !c.clipped.length, c.clipped);
    await page.evaluate(() => window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')));
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({ state: window.__wg.player.state, name: document.getElementById('pName').textContent, audios: window.__audios, locCity: document.getElementById('locCity').textContent, clock: document.getElementById('clockTime').textContent, tz: document.getElementById('clockTz').textContent }));
    ok(`${w}px · player tocando após escolher cidade`, st.state === 'playing', st);
    ok(`${w}px · um único Audio()`, st.audios === 1, st.audios);
    ok(`${w}px · relógio local`, /^\d{2}:\d{2}/.test(st.clock) && !!st.tz, st);
    c = await page.evaluate(layoutChecks);
    ok(`${w}px · sem rolagem horizontal (tocando)`, c.hscroll <= 0, c.hscroll);
    ok(`${w}px · nada fora da tela (tocando)`, !c.off.length, c.off);
    ok(`${w}px · nenhum botão sobreposto (tocando)`, !c.overlaps.length, c.overlaps);
    ok(`${w}px · áreas de toque ≥ 40px (tocando)`, !c.small.length, c.small);
    ok(`${w}px · textos sem corte (tocando)`, !c.clipped.length, c.clipped);
    // rodapé não fica atrás do player
    const cov = await page.evaluate(async () => { scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); await new Promise(r => setTimeout(r, 500)); const l = [...document.querySelectorAll('footer a')].pop().getBoundingClientRect(), p = document.getElementById('player').getBoundingClientRect(); return { linkBottom: Math.round(l.bottom), playerTop: Math.round(p.top) }; });
    ok(`${w}px · rodapé livre do player`, cov.linkBottom <= cov.playerTop + 1, cov);
    ok(`${w}px · sem erros no console`, !errs.length, errs);
    if (process.env.SHOT && [390, 1366].includes(w)) { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT + `/wave-${w}.png` }); }
    await ctx.close();
  }

  // ---- globo real, viagem, páginas dentro do app e redes
  for (const w of [1366]) {
    const { ctx, page, errs } = await newPage(browser, w, A.url);
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900 && window.__wg.globe.ready, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const g = await page.evaluate(() => { const gl = window.__wg.globe, cv = gl.glc, t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const c2 = t.getContext('2d'); c2.drawImage(cv, 0, 0); const x = (gl.G ? c2 : gl.canvas.getContext('2d')).getImageData(cv.width / 2 - 20, cv.height / 2 - 20, 40, 40).data; let col = 0; for (let i = 0; i < x.length; i += 4) col += x[i + 1]; return { tex: !!gl.tex, webgl: !!gl.G, painted: col > 0 }; });
    ok(`${w}px · globo usa a textura da Terra`, g.tex && g.painted, g);
    // viagem Jacutinga -> Tóquio
    await page.evaluate(() => window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Jacutinga'), { play: false })); await page.click('#tripBtn'); await page.waitForSelector('#tripDlg[open]');
    const dv = await page.evaluate(() => document.getElementById('tripFromQ').value);
    ok(`${w}px · viagem: partida já vem com a cidade atual`, /^Jacutinga/.test(dv), dv);
    await page.fill('#tripToQ', 'Tóquio'); await page.waitForSelector('#tripRes button'); await page.click('#tripRes button'); await page.selectOption('#tripDwell', '60000'); await page.click('#tripGo');
    const plan = await page.evaluate(() => { const S = window.__wg.S, p = window.__wg.trip.plan; return p ? { n: p.stops.length, names: p.stops.map(c => c.n), real: p.stops.every(c => S.cities.includes(c)), total: Math.round(p.total) } : {}; });
    ok(`${w}px · viagem planejada com cidades reais`, plan.n >= 5 && plan.real && plan.names[0] === 'Jacutinga' && plan.names.at(-1) === 'Tóquio', plan);
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    const t0 = await page.evaluate(() => ({ bar: !document.getElementById('tripBar').hidden, city: document.getElementById('locCity').textContent, st: window.__wg.player.state }));
    ok(`${w}px · viagem mostra o painel e toca a rádio da saída`, t0.bar && t0.city === 'Jacutinga' && t0.st === 'playing', t0);
    let c = await page.evaluate(layoutChecks);
    ok(`${w}px · viagem sem sobreposição/sobra`, !c.overlaps.length && !c.off.length && c.hscroll <= 0, c);
    await page.evaluate(() => window.__wg.trip.next()); await page.waitForFunction(() => window.__wg.trip.i === 1 && document.getElementById('locCity').textContent !== 'Jacutinga', null, { timeout: 30000 }).catch(() => {});
    const t1 = await page.evaluate(() => ({ i: window.__wg.trip.i, city: document.getElementById('locCity').textContent, st: window.__wg.player.state, audios: window.__audios, expected: window.__wg.trip.plan.stops[1].n, names: window.__wg.trip.plan.stops.map(c => c.n).join(' > ') }));
    ok(`${w}px · viagem avançou e trocou de rádio`, t1.i === 1 && t1.city === t1.expected && t1.audios === 1, t1);
    await page.waitForFunction(() => window.__wg.player.state === 'playing' && /Radio/.test(document.getElementById('pName').textContent), null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => window.__wg.trip.next()); await page.waitForTimeout(500);
    const pa = await page.evaluate(() => { const p = window.__wg.globe.plane; return p && [p.lon, p.lat]; }); await page.waitForTimeout(500);
    const pb = await page.evaluate(() => { const p = window.__wg.globe.plane; return { pos: p && [p.lon, p.lat], st: window.__wg.trip.state }; });
    ok(`${w}px · avião se move ao longo da rota`, !!pa && !!pb.pos && (pa[0] !== pb.pos[0] || pa[1] !== pb.pos[1]) && pb.st === 'flying', { pa, pb });
    // pausa e encerra
    await page.click('#tripPause'); const ps = await page.evaluate(() => window.__wg.trip.state); ok(`${w}px · pausar viagem`, ps === 'paused', ps);
    await page.click('#tripEnd'); const ended = await page.evaluate(() => ({ off: window.__wg.trip.state, hidden: document.getElementById('tripBar').hidden })); ok(`${w}px · encerrar viagem`, ended.off === 'off' && ended.hidden, ended);
    // página Sobre/Contato dentro do app: o player segue tocando
    const before = await page.evaluate(() => ({ st: window.__wg.player.state, name: document.getElementById('pName').textContent }));
    await page.evaluate(() => { scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); });
    await page.click('footer a[href="/contato.html"]'); await page.waitForSelector('#pageView:not([hidden]) h1', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const d = await page.evaluate(() => ({ path: location.pathname, h1: (document.querySelector('#pageBody h1') || {}).textContent, st: window.__wg.player.state, name: document.getElementById('pName').textContent, audios: window.__audios, links: [...document.querySelectorAll('#pageBody a[href*="linkedin"],#pageBody a[href*="github"]')].length, player: document.getElementById('player').getBoundingClientRect().bottom <= innerHeight + 1 }));
    ok(`${w}px · Contato abre dentro do app com o player tocando`, d.path === '/contato.html' && d.h1 === 'Contato' && d.st === 'playing' && d.name === before.name && d.audios === 1 && d.links === 2, d);
    c = await page.evaluate(layoutChecks); ok(`${w}px · página dentro do app sem sobreposição`, !c.overlaps.length && c.hscroll <= 0, c);
    await page.goBack(); await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({ hidden: document.getElementById('pageView').hidden, st: window.__wg.player.state, path: location.pathname })); ok(`${w}px · voltar fecha a página e o som continua`, back.hidden && back.st === 'playing' && back.path === '/', back);
    ok(`${w}px · globo/viagem sem erros no console`, !errs.length, errs);
    if (process.env.SHOT) { await page.evaluate(() => { const S = window.__wg.S; window.__wg.trip.start(S.cities, S.cities.find(c => c.n === 'Jacutinga'), S.cities.find(c => c.n === 'Tóquio'), 60000); scrollTo(0, 0); window.__wg.trip.next(); }); await page.waitForTimeout(900); await page.screenshot({ path: process.env.SHOT + `/trip-${w}.png` }); }
    await ctx.close();
  }


  { // perto de mim: permissão já dada abre na cidade mais próxima e toca; sem permissão mostra o botão
    const t = await newPage(browser, 390, A.url, null, { geolocation: { latitude: -22.29, longitude: -46.62 }, permissions: ['geolocation'] });
    await t.page.goto(A.url + '/?teste'); await t.page.waitForFunction(() => window.__wg && document.getElementById('locCity').textContent === 'Jacutinga', null, { timeout: 15000 }).catch(() => {});
    await t.page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    const g1 = await t.page.evaluate(() => ({ city: document.getElementById('locCity').textContent, st: window.__wg.player.state, cta: document.getElementById('geoCta').hidden, hint: document.getElementById('globeHint').textContent }));
    ok('perto de mim: com permissão, abre em Jacutinga e toca', g1.city === 'Jacutinga' && g1.st === 'playing' && g1.cta, g1); await t.ctx.close();
    const u = await newPage(browser, 390, A.url, null, { geolocation: { latitude: 35.68, longitude: 139.69 } });
    await u.page.goto(A.url + '/?teste'); await u.page.waitForTimeout(1200);
    const g2 = await u.page.evaluate(() => ({ cta: !document.getElementById('geoCta').hidden, loc: document.getElementById('locCity').textContent }));
    ok('perto de mim: sem permissão ainda, mostra o botão e não escolhe cidade sozinho', g2.cta, g2);
    await u.ctx.grantPermissions(['geolocation']); await u.page.evaluate(() => document.getElementById('geoBtn').click());
    await u.page.waitForFunction(() => document.getElementById('locCity').textContent !== 'Nenhuma cidade escolhida' && document.getElementById('locCity').textContent !== '', null, { timeout: 15000 }).catch(() => {});
    await u.page.waitForTimeout(800);
    const g3 = await u.page.evaluate(() => ({ city: document.getElementById('locCity').textContent, country: document.getElementById('locCountry').textContent, cta: document.getElementById('geoCta').hidden, st: window.__wg.player.state }));
    ok('perto de mim: o toque no botão acha a cidade mais próxima (Tóquio) e toca', g3.cta && (/Tóquio|Tokyo/.test(g3.city) || g3.country === 'Japão') && g3.st === 'playing', g3);
    await u.ctx.close();
  }
  { // chiado de estática ao sintonizar (e opção para desligar)
    const { ctx, page } = await newPage(browser, 390, A.url);
    await page.addInitScript(() => { window.__noise = 0; const C = window.AudioContext; if (C) { const o = C.prototype.createBufferSource; C.prototype.createBufferSource = function () { window.__noise++; return o.call(this); }; } });
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.player.unlock(); window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')); });
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    const n1 = await page.evaluate(() => window.__noise);
    ok('chiado de estática toca ao sintonizar', n1 >= 1, n1);
    const vu = await page.evaluate(() => ({ cls: document.getElementById('pVu').className, an: !!window.__wg.player.analyser, opt: !!document.getElementById('optNoise') }));
    ok('sem proxy: medidor escondido e analisador desligado (nada de barras falsas)', !vu.an && !/\bon\b/.test(vu.cls) && vu.opt, vu);
    await page.evaluate(() => { const o = document.getElementById('optNoise'); o.checked = false; o.dispatchEvent(new Event('change')); });
    await page.evaluate(() => window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Cusco' || c.n === 'Quito') || window.__wg.S.cities[5]));
    await page.waitForTimeout(1500); const n2 = await page.evaluate(() => window.__noise);
    ok('chiado desligado nas opções não toca mais', n2 === n1, [n1, n2]);
    await ctx.close();
  }
  { // zoom: escolher cidade mantém o foco; "Globo inteiro" volta ao globo todo
    const { ctx, page, errs } = await newPage(browser, 1280, A.url);
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { const w = window.__wg; w.selectCity(w.S.cities.find(c => c.n === 'Lima'), { play: false }); });
    await page.waitForTimeout(2200); await page.evaluate(() => { const w = window.__wg; w.globe.zoom(1.3); w.globe.zoom(1.3); w.globe.zoom(1.3); w.globe.zoom(1.3); }); await page.waitForTimeout(1500);
    const k1 = await page.evaluate(() => window.__wg.globe.k); const vis1 = await page.evaluate(() => !document.getElementById('showAll').hidden);
    await page.evaluate(() => { const w = window.__wg; w.selectCity(w.S.cities.find(c => c.n === 'Quito') || w.S.cities[5], { play: false }); }); await page.waitForTimeout(2500);
    const k2 = await page.evaluate(() => window.__wg.globe.k);
    ok('zoom: escolher outra cidade mantém o zoom aproximado', k1 > 2 && k2 > 2 && Math.abs(k2 - k1) < .5, { k1, k2 });
    ok('zoom: botão "Globo inteiro" aparece com zoom', vis1, vis1);
    await page.click('#showAll'); await page.waitForTimeout(1500); const k3 = await page.evaluate(() => ({ k: window.__wg.globe.k, hid: document.getElementById('showAll').hidden }));
    ok('zoom: "Globo inteiro" volta ao globo todo e some', k3.k < 1.1 && k3.hid, k3);
    await page.evaluate(() => window.__wg.globe.zoom(2)); await page.waitForTimeout(800); await page.click('#navGlobe'); await page.waitForTimeout(1500); const k4 = await page.evaluate(() => window.__wg.globe.k);
    ok('zoom: item "Globo" do menu também volta ao globo todo', k4 < 1.1, k4);
    ok('zoom: sem erros no console', !errs.length, errs); await ctx.close();
  }
  { // zoom suave no touchpad (muitos eventos pequenos) e no mouse (poucos grandes) + botões sobre o globo
    const { ctx, page, errs } = await newPage(browser, 1280, A.url);
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.globe, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800);
    const box = await page.locator('#globeCanvas, .globe-wrap canvas').first().boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -4); await page.waitForTimeout(900);
    const kp = await page.evaluate(() => window.__wg.globe.k);
    ok('zoom: touchpad (30 eventos pequenos) aproxima de forma suave', kp > 1.05 && kp < 1.4, kp);
    await page.evaluate(() => window.__wg.globe.showAll()); await page.waitForTimeout(900);
    await page.mouse.wheel(0, -100); await page.waitForTimeout(700); const km = await page.evaluate(() => window.__wg.globe.k);
    ok('zoom: um clique de roda do mouse aproxima um pouco', km > 1.08 && km < 1.3, km);
    await page.mouse.wheel(0, 8000); await page.waitForTimeout(900); const kmin = await page.evaluate(() => window.__wg.globe.k);
    ok('zoom: rolar muito afastando respeita o mínimo', kmin >= .84, kmin);
    const v = await page.evaluate(() => getComputedStyle(document.querySelector('.zoom-fab')).display); await page.click('#zIn2'); await page.waitForTimeout(700); const kb = await page.evaluate(() => window.__wg.globe.kT ?? window.__wg.globe.k);
    ok('zoom: botões + e − sobre o globo (PC)', v === 'flex' && kb > kmin + .1, { v, kb, kmin });
    ok('zoom: sem erros no console', !errs.length, errs); await ctx.close();
  }
  for (const w of [1280]) { // sem botão "Voltar ao globo": os links do topo fecham a página interna e a rádio continua
    const { ctx, page, errs } = await newPage(browser, w, A.url, { 'wg.consent': '"no"' });
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.player.unlock(); window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')); });
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    const nav = async sel => { if (w < 768) await page.click('#menuBtn'); await page.click(sel); await page.waitForTimeout(600); };
    const res = {}; res.noBtn = await page.evaluate(() => !document.getElementById('pageBack'));
    for (const [nome, sel] of [['Globo', '#nav a#navGlobe'], ['Descobrir', '#nav a[href="#descobrir"]'], ['Favoritos', '#nav a[href="#favoritos"]']]) {
      await nav('#nav a[href="/sobre.html"]'); const aberta = await page.evaluate(() => !document.getElementById('pageView').hidden);
      await nav(sel); res[nome] = { aberta, fechou: await page.evaluate(() => document.getElementById('pageView').hidden), som: await page.evaluate(() => window.__wg.player.state) };
    }
    ok(`${w}px · links do topo fecham a página interna (sem botão Voltar) e a rádio segue tocando`, res.noBtn && Object.values(res).slice(1).every(r => r.aberta && r.fechou && r.som === 'playing'), res);
    ok(`${w}px · links do topo: sem erros no console`, !errs.length, errs); await ctx.close();
  }
  { // tema claro cobre o site inteiro
    const { ctx, page, errs } = await newPage(browser, 1280, A.url, { 'wg.theme': '"light"', 'wg.consent': '"no"' });
    await page.goto(A.url + '/?teste'); await page.waitForTimeout(800);
    const c = await page.evaluate(() => { const lum = el => { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number); return m[0] * .3 + m[1] * .59 + m[2] * .11; }; return { body: lum(document.body), player: lum(document.getElementById('player')), hint: lum(document.getElementById('globeHint')), theme: document.documentElement.dataset.theme }; });
    ok('tema claro: corpo e player ficam claros', c.theme === 'light' && c.body > 200 && c.player > 200 && c.hint > 200, c);
    ok('tema claro: sem erros no console', !errs.length, errs); await ctx.close();
  }
  { // celular: tela cheia só com globo, lupa, play e pular
    const { ctx, page, errs } = await newPage(browser, 390, A.url, { 'wg.consent': '"no"' });
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(900);
    const vis = ids => page.evaluate(ids => ids.filter(i => { const e = document.querySelector(i); return e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }), ids);
    const sh = await vis(['#searchBtn', '#pPlay', '#pNext', '#pName', '#globe']);
    ok('390px · celular: lupa, play, pular, nome e globo visíveis', sh.length === 5, sh);
    const hid = await vis(['#menuBtn', '#langSel', '#themeBtn', '#randomBtn', '#tripBtn', '#zIn2', '#zOut2', '#pVol', '#pMore', '#pPrev', '#pFav', '#pOther', '#pStatus', '#adTop', '#popBtn', '#countrySel', '#nearBtn', '#globeHint', '.stage-intro h1', '#loc', '#descobrir', '.site-footer', '#geoCta']);
    ok('390px · celular: todo o resto escondido', hid.length === 0, hid);
    const lay = await page.evaluate(() => { const w = document.getElementById('globeWrap').getBoundingClientRect(); return { ww: Math.round(w.width), wh: Math.round(w.height), vw: innerWidth, vh: innerHeight, sy: document.documentElement.scrollHeight - innerHeight, sx: document.documentElement.scrollWidth - innerWidth, ov: getComputedStyle(document.body).overflow, ta: getComputedStyle(document.getElementById('globe')).touchAction, R: Math.round(window.__wg.globe.R), W: window.__wg.globe.W }; });
    ok('390px · celular: globo ocupa a tela toda, sem rolagem, com touch-action none', lay.ww === lay.vw && lay.wh === lay.vh && lay.sy <= 0 && lay.sx <= 0 && lay.ov === 'hidden' && lay.ta === 'none', lay);
    ok('390px · celular: globo grande (ocupa quase toda a largura)', lay.R * 2 >= lay.W * .9, lay);
    await page.click('#searchBtn'); await page.waitForTimeout(250);
    const o1 = await page.evaluate(() => ({ q: document.getElementById('q').getClientRects().length > 0, foc: document.activeElement === document.getElementById('q') }));
    ok('390px · celular: lupa abre o campo de busca em overlay com foco', o1.q && o1.foc, o1);
    await page.fill('#q', 'Lima'); await page.waitForTimeout(500);
    await page.locator('#searchPanel .sp-item').first().click(); await page.waitForTimeout(800);
    const o2 = await page.evaluate(() => ({ open: document.querySelector('.hdr').classList.contains('search-open'), pan: document.getElementById('searchPanel').hidden, city: window.__wg.S.city && window.__wg.S.city.n, pop: document.getElementById('loc').classList.contains('open') }));
    ok('390px · celular: escolher na busca fecha o overlay e vai para a cidade (sem pop-up)', !o2.open && o2.pan && /Lima/.test(o2.city) && !o2.pop, o2);
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    // pular: a outra estação da cidade falha -> vai em silêncio para outra cidade e toca
    const r = await page.evaluate(() => { const w = window.__wg, q = w.S.queue; w.S.queue = [q[0], { ...q[0], id: 'zz-bad', name: 'Fora do Ar', url: 'https://bad.example/x.mp3', url_resolved: 'https://bad.example/x.mp3', urlResolved: 'https://bad.example/x.mp3' }]; w.S.qi = 0; return { n: q.length }; });
    await page.click('#pNext'); await page.waitForTimeout(500);
    await page.waitForFunction(() => window.__wg.player.state === 'playing' && window.__wg.S.station && window.__wg.S.station.id !== 'zz-bad' && window.__wg.S.city && window.__wg.S.city.n !== 'Lima', null, { timeout: 40000 }).catch(() => {});
    const o3 = await page.evaluate(() => ({ st: window.__wg.player.state, city: window.__wg.S.city && window.__wg.S.city.n, sid: window.__wg.S.station && window.__wg.S.station.id, msg: getComputedStyle(document.getElementById('pStatus')).display }));
    ok('390px · celular: Pular troca de estação/cidade e toca sem mostrar erro', o3.st === 'playing' && o3.sid !== 'zz-bad' && o3.msg === 'none', o3);
    ok('390px · celular: sem erros no console', !errs.length, errs); await ctx.close();
  }
  { // divisas (países e estados) carregadas dos dados Natural Earth e desenhadas sem erro
    const { ctx, page, errs } = await newPage(browser, 1280, A.url, { 'wg.consent': '"no"' });
    const gj = JSON.stringify({ features: [{ geometry: { type: 'LineString', coordinates: [[-50, -10], [-40, -10], [-40, -20]] } }, { geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [10, 0]], [[0, 5], [10, 5]]] } }] });
    await page.route(/natural-earth-vector/, r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: gj }));
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.globe && window.__wg.globe.ready, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { const g = window.__wg.globe; g.lon = -45; g.lat = -12; g.k = 3; g.invalidate(); }); await page.waitForTimeout(1200);
    const d = await page.evaluate(() => { const b = window.__wg.globe.borders.d; return { p: b.paises && b.paises.length, e: b.estados && b.estados.length }; });
    ok('divisas: países e estados carregam (3 linhas) e o globo segue sem erros', d.p === 3 && d.e === 3 && !errs.length, { d, errs }); await ctx.close();
  }
  { // carrossel de propaganda (imagens da pasta anuncios) e gaveta da cidade no celular
    build('dist-car'); const fs = require('fs'); const png = PNG;
    for (const n of ['a.png', 'b.png', 'c.png']) fs.writeFileSync(`dist-car/anuncios/${n}`, png);
    fs.writeFileSync('dist-car/anuncios/lista.json', JSON.stringify({ itens: [{ src: '/anuncios/a.png', link: 'https://exemplo.com' }, { src: '/anuncios/b.png', link: '' }, { src: '/anuncios/c.png', link: 'http://inseguro.com' }, { src: '/anuncios/../x.png', link: '' }] }));
    const C = await serve('dist-car');
    for (const w of [1280]) {
      const { ctx, page, errs } = await newPage(browser, w, C.url, { 'wg.consent': '"no"' });
      await page.goto(C.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima'), { play: false })); await page.waitForTimeout(800);
      const s = await page.evaluate(() => { const r = document.getElementById('adCar'), sl = [...r.querySelectorAll('.car-slide')]; return { shown: r.getClientRects().length > 0, n: sl.length, on: sl.filter(x => x.classList.contains('on')).length, dots: r.querySelectorAll('.car-dot').length, rel: [...r.querySelectorAll('a')].map(a => a.rel + '|' + a.getAttribute('href')), label: !!r.querySelector('.ad-label') }; });
      if (w >= 768) ok(`${w}px · carrossel: mostra só imagens válidas (3 de 4), uma ativa e rótulo "Publicidade"`, s.shown && s.n === 3 && s.on === 1 && s.dots === 3 && s.label, s);
      if (w >= 768) ok(`${w}px · carrossel: só links https, marcados como patrocinados`, s.rel.length === 1 && /sponsored/.test(s.rel[0]) && /https:\/\/exemplo/.test(s.rel[0]), s.rel);
      if (w < 768) ok('390px · carrossel de imagens não aparece no celular', await page.evaluate(() => document.getElementById('adCar').getClientRects().length === 0), null);
      const before = w < 768 ? -1 : await page.evaluate(() => [...document.querySelectorAll('.car-slide')].findIndex(x => x.classList.contains('on'))); if (w >= 768) await page.locator('.car-dot').nth(1).dispatchEvent('click'); await page.waitForTimeout(200);
      const after = await page.evaluate(() => [...document.querySelectorAll('.car-slide')].findIndex(x => x.classList.contains('on')));
      if (w >= 768) ok(`${w}px · carrossel: bolinhas trocam a propaganda`, after === 1 && before !== 1 || after === 1, { before, after });
      ok(`${w}px · carrossel: sem erros no console`, !errs.length, errs);
      { // pop-up da cidade (celular e PC): fechado ao selecionar sem tocar; botão Estações abre; fechar, fundo e Esc fecham
        const st = () => page.evaluate(() => { const l = document.getElementById('loc'), r = l.getBoundingClientRect(), b = document.getElementById('popBtn'); return { open: l.classList.contains('open'), vis: l.getClientRects().length > 0, pos: getComputedStyle(l).position, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, hs: document.documentElement.scrollWidth - innerWidth, st: getComputedStyle(document.getElementById('locStations')).display, btn: b.getClientRects().length > 0 }; });
        const c0 = await st(); ok(`${w}px · pop-up da cidade: começa fechado e o botão Estações aparece`, !c0.open && !c0.vis && c0.btn && c0.hs <= 0, c0);
        await page.click('#popBtn'); await page.waitForTimeout(250); const c1 = await st();
        ok(`${w}px · pop-up da cidade: abre centralizado, dentro da tela, com a lista de estações`, c1.open && c1.pos === 'fixed' && c1.l >= 0 && c1.r <= c1.vw && c1.t >= 0 && c1.b <= c1.vh && c1.st !== 'none', c1);
        await page.click('#sheetBtn'); await page.waitForTimeout(200); const c2 = await st(); ok(`${w}px · pop-up da cidade: botão Fechar fecha`, !c2.open && !c2.vis, c2);
        await page.click('#popBtn'); await page.waitForTimeout(150); await page.mouse.click(8, 450); await page.waitForTimeout(200); const c3 = await st(); ok(`${w}px · pop-up da cidade: clicar fora fecha`, !c3.open, c3);
        await page.click('#popBtn'); await page.waitForTimeout(150); await page.keyboard.press('Escape'); await page.waitForTimeout(200); const c4 = await st(); ok(`${w}px · pop-up da cidade: Esc fecha e o botão volta a abrir`, !c4.open && c4.btn, c4);
      }
      await ctx.close();
    }
    C.srv.close();
  }
  for (const [w, h] of [[1325, 757], [1366, 768], [1920, 1080], [1024, 700], [768, 1024], [390, 844], [360, 640], [412, 915], [375, 667]]) { // globo inteiro na tela inicial (com o aviso de cookies aberto)
    const { ctx, page, errs } = await newPage(browser, w, A.url, null, { viewport: { width: w, height: h } });
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.globe && window.__wg.globe.ready, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(900);
    const g = await page.evaluate(() => { const gl = window.__wg.globe, wr = document.getElementById('globeWrap').getBoundingClientRect(), hd = document.querySelector('.site-header').getBoundingClientRect().bottom, pl = document.getElementById('player').getBoundingClientRect().top;
      const cy = wr.top + gl.CY, top = cy - gl.R, bot = cy + gl.R, cx = wr.left + wr.width / 2; return { top: Math.round(top), bot: Math.round(bot), hd: Math.round(hd), pl: Math.round(pl), left: Math.round(cx - gl.R), right: Math.round(cx + gl.R), vw: innerWidth, k: gl.k, wr: [Math.round(wr.top), Math.round(wr.height)], pad: [gl.padT, gl.padB], stage: Math.round(document.querySelector('.stage').getBoundingClientRect().height), intro: Math.round(document.querySelector('.stage-intro').getBoundingClientRect().height), bar: Math.round(document.querySelector('.globe-bar').getBoundingClientRect().height), banner: getComputedStyle(document.documentElement).getPropertyValue('--banner-h') }; });
    ok(`${w}x${h} · globo inteiro na tela inicial (entre cabeçalho e player)`, g.top >= (w < 768 ? 0 : g.hd) - 1 && g.bot <= g.pl + 1 && g.left >= 0 && g.right <= g.vw, g);
    ok(`${w}x${h} · globo não é minúsculo`, g.bot - g.top >= Math.min(160, w * .4), g);
    await ctx.close();
  }
  for (const w of [1280]) { // tema claro/escuro e duas janelas de anúncio no painel lateral
    const { ctx, page, errs } = await newPage(browser, w, A.url);
    if (w >= 768) { await page.route('**/anuncios/lista.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ itens: [{ src: '/anuncios/a.png', link: '' }, { src: '/anuncios/b.png', link: '' }] }) })); await page.route('**/anuncios/*.png', r => r.fulfill({ contentType: 'image/png', body: PNG })); }
    await page.goto(A.url + '/?teste&adpreview'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')); }); await page.waitForTimeout(1500);
    const d = await page.evaluate(() => ({ other: !!document.getElementById('otherBtn'), ads: [...document.querySelectorAll('#adPanel [data-ad^="loc"]')].map(e => e.dataset.ad), car: !!document.querySelector('#adPanel #adCar'), th: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
    ok(`${w}px · painel lateral: sem "Outra estação"; AdSense na primeira janela e carrossel na segunda`, !d.other && d.ads.length === 1 && d.ads[0] === 'loc' && d.car, d);
    if (w >= 768) { const on = () => page.evaluate(() => [...document.querySelectorAll('#adPanel .pg')].filter(p => p.classList.contains('on') && !p.hidden).map(p => p.id || p.dataset.ad)); await page.waitForFunction(() => [...document.querySelectorAll('#adPanel .pg')].some(p => p.classList.contains('on') && !p.hidden), null, { timeout: 8000 }).catch(() => {}); const a = await on(); await page.waitForTimeout(31000); const b2 = await on();
      ok('1280px · painel de publicidade: troca de página sozinho a cada 30 s (só visibilidade, sem recarregar o anúncio)', a.length === 1 && b2.length === 1 && a[0] !== b2[0], { a, b2 }); }
    await page.click('#themeBtn'); await page.waitForTimeout(300);
    const l = await page.evaluate(() => ({ th: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, stage: getComputedStyle(document.querySelector('.stage')).getPropertyValue('--bg').trim(), pressed: document.getElementById('themeBtn').getAttribute('aria-pressed'), saved: localStorage.getItem('wg.theme'), meta: document.querySelector('meta[name=theme-color]').content, hs: document.documentElement.scrollWidth - innerWidth }));
    ok(`${w}px · tema claro: muda o fundo, salva a escolha e vale para o site todo`, l.th === 'light' && l.bg !== d.bg && l.stage === '#ece8e0' && l.pressed === 'true' && l.saved === '"light"' && l.meta === '#ece8e0' && l.hs <= 0, l);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + `/wave-claro-${w}.png` });
    await page.reload(); await page.waitForFunction(() => window.__wg, null, { timeout: 15000 }).catch(() => {});
    const r = await page.evaluate(() => document.documentElement.dataset.theme); ok(`${w}px · tema claro: continua depois de recarregar`, r === 'light', r);
    await page.click('#themeBtn'); const b2 = await page.evaluate(() => document.documentElement.dataset.theme); ok(`${w}px · tema escuro: volta ao clicar de novo`, b2 === 'dark', b2);
    ok(`${w}px · tema: sem erros no console`, !errs.length, errs); await ctx.close();
  }
  for (const w of [1280]) { // Globo grande: globo maior + "no ar" + mini player, som continua
    const { ctx, page, errs } = await newPage(browser, w, A.url);
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.player.unlock(); window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')); });
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    const before = await page.evaluate(() => document.querySelector('.globe-wrap').getBoundingClientRect().height);
    await page.click('#fullBtn'); await page.waitForTimeout(400);
    const hid = await page.evaluate(() => ({ oa: document.getElementById('onAir').getClientRects().length, bar: document.querySelector('.globe-bar').getClientRects().length, gh: document.querySelector('.globe-wrap').getBoundingClientRect().height }));
    ok(`${w}px · globo grande: painel só aparece quando solicitado`, !hid.oa && !hid.bar, hid);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + `/wave-globo-fechado-${w}.png` });
    await page.click('#bgPanel'); await page.waitForTimeout(400);
    const b = await page.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }; const r = document.querySelector('.globe-wrap').getBoundingClientRect(), pl = document.getElementById('player').getBoundingClientRect(), oa = document.getElementById('onAir').getBoundingClientRect();
      return { on: document.body.classList.contains('bigglobe'), h: r.height, st: window.__wg.player.state, audios: window.__audios, play: vis('pPlay'), next: vis('pNext'), mute: vis('pMute'), hidden: ['pPrev', 'pOther', 'pFav', 'pVol', 'pQuality', 'pOpts', 'pMore'].filter(vis), txt: document.getElementById('oaStation').textContent, oaIn: oa.top >= r.top - 1 && oa.bottom <= pl.top + 1, glBottom: r.bottom <= pl.top + 1, pressed: document.getElementById('fullBtn').getAttribute('aria-pressed'), hs: document.documentElement.scrollWidth - innerWidth }; });
    ok(`${w}px · globo grande: ativa, globo maior e som continua`, b.on && b.h > before && b.st === 'playing' && b.audios === 1 && b.pressed === 'true', { b, before });
    ok(`${w}px · globo grande: mini player só com tocar/pausar, trocar rádio e mudo`, b.play && b.next && b.mute && !b.hidden.length, b);
    ok(`${w}px · globo grande: "no ar" mostra a rádio e cabe entre globo e player`, b.txt !== 'Nada tocando' && b.oaIn && b.glBottom && b.hs <= 0, b);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + `/wave-globo-grande-${w}.png` });
    const t1 = await page.evaluate(() => document.getElementById('oaTime').textContent); await page.waitForTimeout(2300); const t2 = await page.evaluate(() => document.getElementById('oaTime').textContent);
    ok(`${w}px · globo grande: horário atualiza sozinho`, /\d{2}:\d{2}:\d{2}/.test(t2) && t1 !== t2, [t1, t2]);
    await page.click('#pNext'); await page.waitForTimeout(800); const nx = await page.evaluate(() => ({ st: window.__wg.player.state, audios: window.__audios })); ok(`${w}px · globo grande: trocar de rádio funciona`, nx.audios === 1 && nx.st !== 'idle', nx);
    await page.click('#bgPanel'); await page.waitForTimeout(200); const closed = await page.evaluate(() => document.getElementById('onAir').getClientRects().length); ok(`${w}px · globo grande: fechar painel`, !closed, closed);
    await page.click('#bgExit'); await page.waitForTimeout(300); const ex = await page.evaluate(() => document.body.classList.contains('bigglobe')); ok(`${w}px · globo grande: botão × sai`, !ex, ex);
    await page.click('#fullBtn'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const x = await page.evaluate(() => ({ on: document.body.classList.contains('bigglobe'), oa: document.getElementById('onAir').hidden, st: window.__wg.player.state, label: document.querySelector('#fullBtn span').textContent }));
    ok(`${w}px · globo grande: Esc sai e o som continua`, !x.on && x.oa && x.st !== 'idle' && x.label === 'Globo grande', x);
    ok(`${w}px · globo grande: sem erros no console`, !errs.length, errs);
    await ctx.close();
  }
  { // aviso de versão nova: aparece, não recarrega sozinho, a rádio segue tocando
    const { ctx, page, errs } = await newPage(browser, 390, A.url); let ver = null;
    await page.route('**/version.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ v: ver || 'x' }) }));
    await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.player.unlock(); window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')); });
    await page.waitForFunction(() => window.__wg.player.state === 'playing', null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { window.__nav = 0; document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(600);
    const u = await page.evaluate(() => ({ bar: !document.getElementById('updBar').hidden, st: window.__wg.player.state, t: performance.timeOrigin }));
    ok('versão nova: mostra o aviso, sem recarregar e a rádio continua', u.bar && u.st === 'playing', u);
    await page.click('#updX'); const x = await page.evaluate(() => document.getElementById('updBar').hidden); ok('versão nova: "agora não" fecha o aviso', x, x);
    ok('versão nova: sem erros no console', !errs.length, errs); await ctx.close();
  }
  { // com proxy configurado: streams passam pelo proxy, http entra e o medidor usa o áudio de verdade
    build('dist-proxy', { STREAM_PROXY_URL: 'https://proxy.test' });
    const P = await serve('dist-proxy'); const { ctx, page, errs } = await newPage(browser, 390, P.url);
    await page.goto(P.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.player.unlock(); window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima')); });
    await page.waitForFunction(() => window.__wg.player.state === 'playing' && window.__wg.player.analyser, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const p = window.__wg.player; return { src: p.audio.src.slice(0, 40), cors: p.audio.crossOrigin, an: !!p.analyser, vu: document.getElementById('pVu').className, st: p.state, audios: window.__audios }; });
    ok('com proxy: stream via proxy, CORS e analisador ligados, medidor visível', /^https:\/\/proxy\.test\/\?u=/.test(r.src) && r.cors === 'anonymous' && r.an && /\bon\b/.test(r.vu) && r.st === 'playing' && r.audios === 1, r);
    ok('com proxy: sem erros no console', !errs.length, errs);
    await ctx.close(); P.srv.close();
  }
  { // páginas estáticas: redes só com ícones, sem o nome no rodapé
    const { ctx, page } = await newPage(browser, 390, A.url);
    await page.goto(A.url + '/contato.html'); const r = await page.evaluate(() => ({ foot: document.querySelector('.dev') && document.querySelector('.dev').textContent.trim(), icons: document.querySelectorAll('.dev a.soc svg').length, h1: document.querySelector('h1').textContent, cards: document.querySelectorAll('.soc-card').length, name: document.querySelector('main').textContent.includes('Luiz Ricardo') }));
    ok('Contato estático: rodapé só com ícones (sem nome) e cartões de redes', r.foot === 'Desenvolvido por' && r.icons === 2 && r.cards === 2 && r.name, r);
    await ctx.close();
  }
  { // Viagem por qualquer cidade: geocodificação + rádios por proximidade com distância
    for (const w of [1280]){
      const { ctx, page, errs } = await newPage(browser, w, A.url);
      await page.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results: [{ name: 'Vilaquieta', latitude: -22.0, longitude: -46.0, country: 'Brasil', country_code: 'BR', admin1: 'Minas Gerais', timezone: 'America/Sao_Paulo' }] }) }));
      await page.route(/radio-browser\.info/, r => { const u = r.request().url(); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(!/geo_lat/.test(u) ? (/name=Vilaquieta|state=Vilaquieta/.test(u) ? [] : api(u)) : /geo_distance=30000/.test(u) ? [] : [mk('far1', 'Radio Longe', 'BR', { geo_lat: -22.24, geo_long: -46.0 })]) }); });
      await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
      await page.click('#tripBtn'); await page.fill('#tripToQ', 'Vilaquieta');
      await page.waitForSelector('#tripRes button', { timeout: 5000 });
      await page.click('#tripRes button'); await page.fill('#tripFromQ', ''); await page.click('#tripGo'); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ dlg: document.getElementById('tripDlg').open, city: document.getElementById('locCity').textContent, note: document.getElementById('locNote').textContent, rows: document.querySelectorAll('#stList .st-row').length, sub: (document.querySelector('#stList small') || {}).textContent }));
      ok(`${w}px · viagem: qualquer cidade vira destino e acha rádio próxima com distância`, !r.dlg && r.city === 'Vilaquieta' && /27 km/.test(r.note + r.sub) && /não cadastrada|Nenhuma estação cadastrada exatamente/.test(r.note) && /km do destino/.test(r.sub) && r.rows >= 1, r);
      ok(`${w}px · viagem: sem erros no console`, !errs.length, errs); await ctx.close();
    }
  }
  { // rádio fora do ar: troca sozinha para outra da lista; globo leve; marcador de áudio
    const { ctx, page, errs } = await newPage(browser, 390, A.url);
    await page.goto(A.url + '/?teste&lite'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__wg.player.unlock(); window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima'), { play: false }); });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => { const w = window.__wg; const q = w.S.queue; const bad = { ...q[0], id: 'zz-bad', name: 'Fora do Ar', url: 'https://bad.example/x.mp3', urlResolved: 'https://bad.example/x.mp3', url_resolved: 'https://bad.example/x.mp3' }; w.S.queue = [bad, ...q]; await w.playStation(bad); await new Promise(r => setTimeout(r, 1500)); return { st: w.player.state, name: w.S.station && w.S.station.name, lite: w.globe.lite, n: q.length }; });
    ok('rádio fora do ar: troca sozinha para outra e toca', r.st === 'playing' && r.name !== 'Fora do Ar', r);
    ok('globo leve ativo com ?lite', r.lite === true, r);
    ok('rádio fora do ar: sem erros no console', !errs.length, errs); await ctx.close();
  }
  { // SEO e links compartilháveis
    const fs = require('fs');
    const { default: handler } = await import('../api/radios.js'), { citySlugs } = await import('../assets/js/slug.js'), { citySlugs: apiSlugs } = await import('../api/_lib/radios.js');
    const call = p => { const r = { h: {}, code: 200, body: '' }; handler({ query: { p } }, { setHeader: (k, v) => { r.h[k] = v; }, status(c) { r.code = c; return this; }, send(b) { r.body = b; return this; } }); return r; };
    const base = JSON.parse(fs.readFileSync('assets/cities.json', 'utf8')), sm = fs.readFileSync('dist/sitemap.xml', 'utf8');
    const pg = call('br/jacutinga'), ct = call('br'), nf = call('zz/nada');
    ok('SEO: página de cidade com título, canonical e link para o globo', pg.code === 200 && /<title>Rádios ao vivo de Jacutinga/.test(pg.body) && /rel="canonical" href="https:\/\/[^"]+\/radios\/br\/jacutinga\/"/.test(pg.body) && /href="\/\?c=br\/jacutinga"/.test(pg.body) && /s-maxage/.test(pg.h['Cache-Control']), pg.body.slice(0, 200));
    ok('SEO: página de país, 404 e sitemap com cidades', ct.code === 200 && /Jacutinga/.test(ct.body) && nf.code === 404 && /\/radios\/br\/jacutinga\//.test(sm) && (sm.match(/<loc>/g) || []).length > 4000, null);
    { const A1 = citySlugs(base), A2 = apiSlugs(base); ok('SEO: slugs do app e da página são idênticos', base.every(c => A1.get(c) === A2.get(c)), null); }
    ok('repositório enxuto: poucos arquivos no deploy', (function n(d){ return fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? n(d + '/' + e.name) : 1), 0); })('dist') < 200, null);
    const { ctx, page, errs } = await newPage(browser, 390, A.url);
    await page.goto(A.url + '/?teste&c=br/jacutinga'); await page.waitForFunction(() => window.__wg && window.__wg.S.city && window.__wg.S.city.n === 'Jacutinga', null, { timeout: 15000 }).catch(() => {});
    const r = await page.evaluate(() => ({ city: window.__wg.S.city && window.__wg.S.city.n, url: location.search }));
    ok('link compartilhado ?c= abre a cidade', r.city === 'Jacutinga' && /c=br%2Fjacutinga/.test(r.url), r);
    await page.evaluate(() => window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima'), { play: false }));
    const u = await page.evaluate(() => location.search); ok('endereço acompanha a cidade escolhida', /c=pe%2Flima/.test(u), u);
    ok('SEO/links: sem erros no console', !errs.length, errs); await ctx.close();
  }
  { // idiomas
    for (const w of [1280]){
      const { ctx, page, errs } = await newPage(browser, w, A.url);
      await page.goto(A.url + '/?teste'); await page.waitForFunction(() => window.__wg && window.__wg.S.cities.length > 1900, null, { timeout: 15000 }).catch(() => {});
      const pt = await page.evaluate(() => ({ h: document.querySelector('.hero h1, h1') && document.querySelector('.hero h1, h1').textContent, lang: document.documentElement.lang }));
      await page.selectOption('#langSel', 'en'); await page.waitForTimeout(300);
      const en = await page.evaluate(() => ({ h: document.querySelector('.hero h1, h1').textContent, ph: document.getElementById('q').placeholder, br: [...document.querySelectorAll('#countrySel option')].find(o => o.value === 'BR').textContent, lang: document.documentElement.lang }));
      await page.evaluate(() => window.__wg.selectCity(window.__wg.S.cities.find(c => c.n === 'Lima'), { play: false })); await page.waitForTimeout(800);
      const dyn = await page.evaluate(() => document.getElementById('locNote').textContent);
      await page.selectOption('#langSel', 'es'); await page.waitForTimeout(300);
      const es = await page.evaluate(() => ({ ph: document.getElementById('q').placeholder, br: [...document.querySelectorAll('#countrySel option')].find(o => o.value === 'BR').textContent }));
      await page.selectOption('#langSel', 'pt'); await page.waitForTimeout(300);
      const back = await page.evaluate(() => ({ ph: document.getElementById('q').placeholder, br: [...document.querySelectorAll('#countrySel option')].find(o => o.value === 'BR').textContent }));
      ok(`${w}px · idiomas: inglês, espanhol e volta ao português`, /Tap a point/.test(en.h) && /Search radio/.test(en.ph) && en.br === 'Brazil' && en.lang === 'en' && /Busca/.test(es.ph) && es.br === 'Brasil' && back.ph === 'Buscar rádio, cidade ou país' && back.br === 'Brasil' && /Toque num ponto/.test(pt.h), { pt, en, es, back, dyn });
      ok(`${w}px · idiomas: textos novos do app também são traduzidos`, /No station|Stations|Looking|registered/.test(dyn) || dyn === '', dyn);
      ok(`${w}px · idiomas: sem erros no console`, !errs.length, errs); await ctx.close();
    }
  }
  await browser.close(); A.srv.close();
  console.log(`\n${results.length - failed} ok, ${failed} falhas`); process.exit(failed ? 1 : 0);
})();
