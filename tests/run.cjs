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
      if (p === '/api/assistant'){
        rs.setHeader('content-type', 'application/json');
        if (req.method === 'GET') return rs.end(JSON.stringify({ enabled: true }));
        let b = ''; req.on('data', d => b += d); req.on('end', () => { const j = JSON.parse(b); rs.end(JSON.stringify({ picks: j.candidates.slice(0, 2).map(c => ({ id: c.id, reason: 'Combina com o pedido: ' + c.name })).concat([{ id: 'inventado', reason: 'x' }]) })); }); return;
      }
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
async function newPage(browser, w, base, seedStorage){
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 }, deviceScaleFactor: 1, hasTouch: w < 768, isMobile: w < 768 });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.addInitScript(() => { window.__audios = 0; const A = window.Audio; window.Audio = function (...a) { window.__audios++; return new A(...a); }; window.Audio.prototype = A.prototype; });
  if (seedStorage) await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seedStorage);
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(base) || u.startsWith('data:')) return r.continue();
    if (u.includes('radio-browser.info')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(api(u)) });
    if (u.startsWith('https://good.example')) return r.fulfill({ contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV });
    if (u.startsWith('https://bad.example')) return r.fulfill({ status: 404, body: 'x' });
    if (u.includes('d3-array')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MODS + '/d3-array/dist/d3-array.min.js') });
    if (u.includes('d3-geo')) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(MODS + '/d3-geo/dist/d3-geo.min.js') });
    if (u.includes('topojson-client')) return r.fulfill({ contentType: 'text/javascript', body: "window.topojson={feature:()=>({type:'MultiPolygon',coordinates:[[[[-85,-35],[-85,12],[-30,12],[-30,-35],[-85,-35]]],[[[-10,35],[-10,70],[40,70],[40,35],[-10,35]]],[[[10,-35],[10,30],[50,30],[50,-35],[10,-35]]]]})};" });
    if (u.includes('land-110m')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"objects":{"land":{}}}' });
    if (u.includes('flagcdn.com')) return r.fulfill({ contentType: 'image/png', body: PNG });
    if (u.includes('pagead2.googlesyndication.com')) return r.fulfill({ contentType: 'text/javascript', body: 'window.adsbygoogle=window.adsbygoogle||[];window.__adsScripts=(window.__adsScripts||0)+1;' });
    if (u.includes('logos.example')) return r.fulfill({ contentType: 'image/png', body: PNG });
    return r.abort();
  });
  return { ctx, page, errs };
}
const layoutChecks = () => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const out = { hscroll: document.documentElement.scrollWidth - innerWidth, off: [], overlaps: [], clipped: [] };
  const groupOf = e => e.closest('header,.player,.gtools,.cta,.stage__info,#panel,#chips,.notice,footer,.tabs,.st,.row-st,.search,dialog') || document.body;
  const els = [...document.querySelectorAll('button,a[href],input,select,[role=tab]')].filter(vis).filter(e => !e.closest('[hidden]') && !e.classList.contains('skip'));
  els.forEach(e => { const r = e.getBoundingClientRect(); if (r.right > innerWidth + .5 || r.left < -.5) { const sc = e.closest('.tabs'); if (!sc) out.off.push((e.id || e.textContent.trim().slice(0, 20) || e.tagName)); } });
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a) || groupOf(a) !== groupOf(b)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 1 && h > 1) out.overlaps.push((a.id || a.textContent.trim().slice(0, 14) || a.tagName) + ' x ' + (b.id || b.textContent.trim().slice(0, 14) || b.tagName));
  }
  document.querySelectorAll('.pl-name,.pl-meta,.card__title,.stage h1,.btn,.chip,.tabs button,.badge,.brand__txt,.clock__time').forEach(e => { if (vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis') out.clipped.push(e.className + ':' + e.textContent.trim().slice(0, 20)); });
  document.querySelectorAll('button,a.btn,.icon-btn').forEach(e => { if (vis(e)) { const r = e.getBoundingClientRect(); if ((r.width < 38 || r.height < 38) && !e.closest('.skip') && !e.classList.contains('icon-btn--bare')) out.clipped.push('toque pequeno:' + (e.id || e.textContent.trim().slice(0, 14)) + Math.round(r.width) + 'x' + Math.round(r.height)); } });
  return out;
};

(async () => {
  const A = await serve('dist'), B = await serve('dist-ads'); const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  // 1) layout em todas as larguras (antes e depois de tocar)
  for (const w of WIDTHS) {
    const { ctx, page, errs } = await newPage(browser, w, A.url);
    await page.goto(A.url + '/?teste'); await page.waitForTimeout(1200);
    let c = await page.evaluate(layoutChecks);
    ok(`${w}px · sem rolagem horizontal (inicial)`, c.hscroll <= 0, c.hscroll);
    ok(`${w}px · nada fora da tela (inicial)`, c.off.length === 0, c.off);
    ok(`${w}px · nenhum botão sobreposto (inicial)`, c.overlaps.length === 0, c.overlaps);
    ok(`${w}px · textos sem corte e botões com área de toque (inicial)`, c.clipped.length === 0, c.clipped);
    await page.click('#btnStart'); await page.waitForFunction(() => window.__w.cityState().state === 'live', null, { timeout: 25000 }).catch(() => {}); await page.waitForTimeout(900);
    c = await page.evaluate(layoutChecks);
    ok(`${w}px · sem rolagem horizontal (tocando)`, c.hscroll <= 0, c.hscroll);
    ok(`${w}px · nada fora da tela (tocando)`, c.off.length === 0, c.off);
    ok(`${w}px · nenhum botão sobreposto (tocando)`, c.overlaps.length === 0, c.overlaps);
    ok(`${w}px · textos sem corte e botões com área de toque (tocando)`, c.clipped.length === 0, c.clipped);
    // o player não cobre o fim da página
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
    const cover = await page.evaluate(() => { const pl = document.getElementById('player').getBoundingClientRect(), last = document.querySelector('.ftr__legal p').getBoundingClientRect(); return last.bottom - pl.top; });
    ok(`${w}px · player não cobre o fim da página`, cover <= 1, cover);
    ok(`${w}px · sem erros de JavaScript`, errs.length === 0, errs);
    if (w === 375 || w === 1366) await page.screenshot({ path: path.join(ROOT, 'tests', `tela-${w}.png`) });
    await ctx.close();
  }
  // 2) funcionalidades (390 e 1366)
  for (const w of [390, 1366]) {
    const { ctx, page, errs } = await newPage(browser, w, A.url); const st = () => page.evaluate(() => window.__w.cityState());
    await page.goto(A.url + '/?teste'); await page.waitForTimeout(800);
    await page.click('#btnStart'); await page.waitForFunction(() => window.__w.cityState().state === 'live', null, { timeout: 25000 });
    let s = await st();
    ok(`${w}px · começar a ouvir toca uma rádio (com estação quebrada na frente)`, s.state === 'live' && !!s.station, s);
    ok(`${w}px · apenas um player de áudio criado`, (await page.evaluate(() => window.__audios)) === 1);
    ok(`${w}px · relógio local preenchido`, /^\d\d:\d\d:\d\d$/.test(await page.textContent('#clkTime')) && (await page.textContent('#clkDn')).length > 2);
    ok(`${w}px · status Ao vivo no player`, (await page.textContent('#plStatus')) === 'Ao vivo');
    const c1 = s.cur; await page.click('#plSkip'); await page.waitForFunction(n => window.__w.cityState().cur !== n && window.__w.cityState().state === 'live', c1, { timeout: 25000 });
    s = await st(); ok(`${w}px · pular troca de cidade e toca de novo`, s.cur !== c1 && s.state === 'live', s);
    await page.click('#plPrev'); await page.waitForFunction(n => window.__w.cityState().cur === n, c1, { timeout: 25000 }).catch(() => {});
    ok(`${w}px · anterior volta à cidade anterior`, (await st()).cur === c1);
    const before = (await st()).station; await page.click('#plOther'); await page.waitForTimeout(2500);
    ok(`${w}px · outra estação troca a rádio da região`, (await st()).station !== before, await st());
    await page.click('#plPlay'); await page.waitForTimeout(300); ok(`${w}px · pausar`, (await st()).state === 'paused');
    await page.click('#plPlay'); await page.waitForFunction(() => window.__w.cityState().state === 'live', null, { timeout: 15000 }); ok(`${w}px · retomar`, true);
    await page.click('#plMute'); ok(`${w}px · silenciar`, (await page.getAttribute('#plMute', 'aria-pressed')) === 'true');
    await page.click('#plFav'); ok(`${w}px · favoritar (contador e lista)`, (await page.textContent('#favCount')) === '1' && (await page.locator('#favGrid .st').count()) === 1);
    ok(`${w}px · histórico registra estações`, (await page.locator('#hisGrid .st').count()) >= 1);
    // globo: tocar num ponto seleciona a cidade
    await page.evaluate(() => { document.getElementById('globeBox').scrollIntoView(); window.__w.globe.setSpin(false); });
    const target = await page.evaluate(() => { const g = window.__w.globe, S = g._s; const d = window.WAVE.DATA.find(c => c.nome === 'Lima'); g.flyTo(d.lon, d.lat, { k: 1.4 }); return d.nome; });
    await page.waitForTimeout(2600);
    const pos = await page.evaluate(() => { const d = window.WAVE.DATA.find(c => c.nome === 'Lima'); const p = window.__w.globe.project(d.lon, d.lat); const r = document.getElementById('globe').getBoundingClientRect(); return p && { x: r.left + p.x, y: r.top + p.y }; });
    if (pos) { await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(600); }
    ok(`${w}px · tocar num ponto do globo seleciona a cidade`, (await page.textContent('#locTitle')) === 'Lima', await page.textContent('#locTitle'));
    ok(`${w}px · cartão da cidade mostra país, bandeira e rádios`, (await page.textContent('#locCountry')) === 'Peru' && (await page.locator('#hereList li').count()) >= 1);
    await page.selectOption('#selCountry', 'JP'); await page.waitForTimeout(1500);
    ok(`${w}px · navegar por país`, (await page.textContent('#locTitle')) === 'Japão' && /Tóquio|Asia\/Tokyo/.test(await page.textContent('#clkTz') + (await page.textContent('#clkTz'))));
    // busca
    if (w < 768) await page.click('#btnSearch'); await page.fill('#q', 'paris'); await page.waitForTimeout(900);
    ok(`${w}px · busca mostra cidades e rádios`, (await page.locator('#resBody .chip').count()) >= 1 && (await page.locator('#resBody .st').count()) >= 1, await page.locator('#resBody .chip').count());
    await page.click('#resClear');
    // descobrir: abas com teclado
    await page.locator('#descobrir').scrollIntoView(); await page.waitForTimeout(700);
    ok(`${w}px · descobrir lista populares`, (await page.locator('#stGrid .st').count()) >= 6);
    await page.focus('#tab-pop'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
    ok(`${w}px · abas por teclado (Por país)`, (await page.getAttribute('#tab-pais', 'aria-selected')) === 'true' && (await page.locator('#stGrid .st').count()) >= 6);
    await page.click('#tab-cat'); await page.waitForTimeout(500); await page.click('.chip:has-text("Notícias")'); await page.waitForTimeout(500);
    ok(`${w}px · categorias`, (await page.locator('#stGrid .st').count()) >= 4);
    await page.click('#tab-cont'); await page.waitForTimeout(500); ok(`${w}px · continentes`, (await page.locator('#stGrid .st').count()) >= 4);
    await page.locator('#stGrid .st .icon-btn--play').first().click(); await page.waitForFunction(() => window.__w.cityState().state === 'live', null, { timeout: 15000 }).catch(() => {});
    ok(`${w}px · tocar uma estação do descobrir`, (await st()).state === 'live', await st()); await page.waitForTimeout(800);
    ok(`${w}px · semelhantes aparecem`, !(await page.locator('#similar').isHidden()));
    // assistente
    await page.locator('#assistente').scrollIntoView(); ok(`${w}px · assistente aparece quando o servidor responde`, !(await page.locator('#assistente').isHidden()));
    await page.fill('#aiQ', 'jazz calmo'); await page.click('#aiForm button'); await page.waitForTimeout(2500);
    ok(`${w}px · assistente mostra só estações reais (descarta ids inventados)`, (await page.locator('#aiGrid .st').count()) === 2 && /Combina/.test(await page.textContent('#aiGrid')), await page.locator('#aiGrid .st').count());
    // preferências
    await page.click('#btnPrefs'); await page.waitForTimeout(300); ok(`${w}px · preferências abrem`, await page.locator('#dlgPrefs').evaluate(d => d.open)); await page.keyboard.press('Escape');
    // persistência de favoritos
    await page.reload(); await page.waitForTimeout(800); ok(`${w}px · favoritos persistem após recarregar`, (await page.textContent('#favCount')) === '1');
    ok(`${w}px · sem erros de JavaScript (funcional)`, errs.length === 0, errs);
    await ctx.close();
  }
  // 3) anúncios (com ID de teste e consentimento)
  for (const w of [375, 1366, 1920]) {
    const { ctx, page, errs } = await newPage(browser, w, B.url, { 'wave.consent': JSON.stringify('all') });
    await page.goto(B.url + '/?teste'); await page.waitForTimeout(1800);
    const info = await page.evaluate(() => {
      const ads = [...document.querySelectorAll('.ad[data-ad]')].filter(a => !a.hidden && a.offsetWidth).map(a => ({ place: a.dataset.ad, rect: a.getBoundingClientRect().toJSON(), ins: a.querySelectorAll('ins.adsbygoogle').length }));
      const g = document.getElementById('globeBox').getBoundingClientRect(), pl = document.getElementById('player').getBoundingClientRect();
      const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      return { ads: ads.map(a => a.place + ':' + a.ins), overGlobe: ads.some(a => inter(a.rect, g)), scripts: document.querySelectorAll('script[data-wave-ads]').length, loaded: window.__adsScripts, hscroll: document.documentElement.scrollWidth - innerWidth, consentHidden: document.getElementById('consent').hidden };
    });
    const expected = w < 768 ? ['mid:1', 'bottom:1'] : w < 1280 ? ['top:1', 'mid:1', 'bottom:1'] : ['top:1', 'mid:1', 'side:1', 'bottom:1'];
    ok(`${w}px · anúncios nos lugares previstos`, JSON.stringify(info.ads.sort()) === JSON.stringify(expected.sort()), info.ads);
    ok(`${w}px · anúncios não ficam sobre o globo`, !info.overGlobe);
    ok(`${w}px · script do AdSense carregado uma única vez`, info.scripts === 1 && info.loaded === 1, info);
    ok(`${w}px · anúncios sem rolagem horizontal`, info.hscroll <= 0, info.hscroll);
    const lay = await page.evaluate(layoutChecks); ok(`${w}px · anúncios sem botões sobrepostos`, lay.overlaps.length === 0 && lay.off.length === 0, lay);
    ok(`${w}px · sem erros de JavaScript (anúncios)`, errs.length === 0, errs);
    await ctx.close();
  }
  { // sem consentimento: aviso aparece e nenhum anúncio é carregado
    const { ctx, page } = await newPage(browser, 390, B.url); await page.goto(B.url + '/'); await page.waitForTimeout(1200);
    ok('aviso de cookies aparece e nenhum anúncio carrega antes do consentimento', !(await page.locator('#consent').isHidden()) && (await page.evaluate(() => document.querySelectorAll('script[data-wave-ads],ins.adsbygoogle').length)) === 0);
    await page.click('#consentYes'); await page.waitForTimeout(1500);
    ok('aceitar cookies carrega os anúncios', (await page.locator('ins.adsbygoogle').count()) >= 1);
    await ctx.close();
    const { ctx: c2, page: p2 } = await newPage(browser, 390, A.url); await p2.goto(A.url + '/'); await p2.waitForTimeout(800);
    ok('sem AdSense configurado: sem aviso e sem espaço de anúncio', (await p2.locator('#consent').isHidden()) && (await p2.locator('.ad:not([hidden])').count()) === 0);
    await c2.close();
  }
  { // arquivos públicos
    const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok('ads.txt gerado com o ID', /google\.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0/.test(read('dist-ads/ads.txt')));
    ok('sitemap e robots usam o domínio configurado', /https:\/\/teste\.wave\/sitemap\.xml/.test(read('dist/robots.txt')) && /<loc>https:\/\/teste\.wave\/<\/loc>/.test(read('dist/sitemap.xml')));
    ok('OG e canonical com o domínio', /og:image" content="https:\/\/teste\.wave\/assets\/img\/og-image\.png"/.test(read('dist/index.html')) && /rel="canonical" href="https:\/\/teste\.wave\/"/.test(read('dist/index.html')));
    const all = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(html|js|css|json|webmanifest|svg|txt|xml)$/.test(f.name)) all.push(p); } })(path.join(ROOT, 'dist'));
    const old = all.filter(f => /dio\s*global/i.test(fs.readFileSync(f, 'utf8')));
    ok('nenhum arquivo público cita o nome antigo', old.length === 0, old);
    ok('página de contato mostra o e-mail só quando configurado', /contato@exemplo\.com/.test(read('dist-ads/contato.html')) && !/mailto:/.test(read('dist/contato.html')));
  }
  await browser.close(); A.srv.close(); B.srv.close();
  fs.writeFileSync(path.join(ROOT, 'tests', 'resultado.json'), JSON.stringify({ total: results.length, falhas: failed, results }, null, 1));
  console.log(`\n${results.length - failed}/${results.length} verificações passaram`); process.exit(failed ? 1 : 0);
})();
