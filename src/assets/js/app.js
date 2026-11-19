/* WAVE GLOBAL · aplicação principal */
(function(){
'use strict';
const W = window.WAVE, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const SPR = 'assets/img/sprite.svg#';
const CFG = window.WAVE_CONFIG || {};
const DATA = W.DATA;

/* ---------- utilidades ---------- */
function el(tag, props, ...kids){
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})){
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v); else n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => { if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); });
  return n;
}
function icon(id, cls){
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', SPR + id); s.append(u); return s;
}
const live = $('#live');
function say(msg){ live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 50); }
const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'L' : 'O'}`;
const contName = id => (W.CONTINENTS.find(c => c.id === id) || {}).nome || '';
const flagUrl = (cc, w) => `https://flagcdn.com/w${w}/${cc.toLowerCase()}.png`;
const distKm = (a, b) => { const R = Math.PI/180, dLat = (b[1]-a[1])*R, dLon = (b[0]-a[0])*R, x = Math.sin(dLat/2)**2 + Math.cos(a[1]*R)*Math.cos(b[1]*R)*Math.sin(dLon/2)**2; return 12742*Math.asin(Math.min(1, Math.sqrt(x))); };
const prefs = Object.assign({auto:false, min:3, spin:true, vol:0.8}, W.store.get('wave.prefs', {}));
const savePrefs = () => W.store.set('wave.prefs', prefs);

/* ---------- altura do cabeçalho e do player (espaçamento sem sobreposição) ---------- */
const root = document.documentElement;
new ResizeObserver(() => root.style.setProperty('--player-h', $('#player').offsetHeight + 'px')).observe($('#player'));
new ResizeObserver(() => root.style.setProperty('--hdr-h', $('#top').offsetHeight + 'px')).observe($('#top'));
$('#year').textContent = new Date().getFullYear();

/* ---------- cabeçalho ---------- */
const btnMenu = $('#btnMenu'), menu = $('#menu'), btnSearch = $('#btnSearch'), searchForm = $('#searchForm'), q = $('#q');
btnMenu.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; btnMenu.setAttribute('aria-expanded', String(open)); btnMenu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); });
menu.addEventListener('click', e => { if (e.target.closest('a')){ menu.hidden = true; btnMenu.setAttribute('aria-expanded', 'false'); } });
btnSearch.addEventListener('click', () => { const open = searchForm.hidden; searchForm.hidden = !open; btnSearch.setAttribute('aria-expanded', String(open)); if (open) q.focus(); });
if (matchMedia('(min-width:768px)').matches) searchForm.hidden = false;

/* ---------- globo ---------- */
const box = $('#globeBox'), canvas = $('#globe');
const globe = W.createGlobe({canvas, box, cities:DATA, spin:prefs.spin, onSelect:c => { selectCity(c, {play:false}); scrollToInfo(); }});
function scrollToInfo(){ if (matchMedia('(min-width:1024px)').matches) return; const t = $('.stage__info'); const r = t.getBoundingClientRect(); if (r.top > innerHeight*.6 || r.top < 0) t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block:'start'}); }
$('#gZin').addEventListener('click', () => globe.zoomBy(1.35));
$('#gZout').addEventListener('click', () => globe.zoomBy(1/1.35));
const gSpin = $('#gSpin');
const syncSpin = () => gSpin.setAttribute('aria-pressed', String(prefs.spin));
gSpin.addEventListener('click', () => { prefs.spin = !prefs.spin; globe.setSpin(prefs.spin); savePrefs(); syncSpin(); $('#prSpin').checked = prefs.spin; });
syncSpin();
const gFull = $('#gFull');
if (!box.requestFullscreen && !box.webkitRequestFullscreen) gFull.hidden = true;
gFull.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else (box.requestFullscreen || box.webkitRequestFullscreen).call(box).catch(() => {}); });
document.addEventListener('fullscreenchange', () => { gFull.setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Globo em tela cheia'); });

const selCountry = $('#selCountry');
W.COUNTRIES.forEach(c => selCountry.append(el('option', {value:c.cc, text:c.nome})));
selCountry.addEventListener('change', () => { if (selCountry.value) goCountry(selCountry.value); });

/* ---------- relógio global (Intl, fusos IANA) ---------- */
let clockTz = null; const fmts = {};
function fm(tz){
  if (fmts[tz]) return fmts[tz];
  try {
    return fmts[tz] = {
      t:new Intl.DateTimeFormat('pt-BR', {timeZone:tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}),
      d:new Intl.DateTimeFormat('pt-BR', {timeZone:tz, weekday:'long', day:'numeric', month:'long', year:'numeric'}),
      z:new Intl.DateTimeFormat('pt-BR', {timeZone:tz, timeZoneName:'short'}),
      h:new Intl.DateTimeFormat('en-GB', {timeZone:tz, hour:'numeric', hourCycle:'h23'})
    };
  } catch { return tz === 'UTC' ? null : fm('UTC'); }
}
function clockTick(){
  if (!clockTz) return; const f = fm(clockTz); if (!f) return; const now = new Date();
  $('#clkTime').textContent = f.t.format(now); $('#clkDate').textContent = f.d.format(now);
  const zp = f.z.formatToParts(now).find(p => p.type === 'timeZoneName');
  $('#clkTz').textContent = `${clockTz.replace(/_/g, ' ')}${zp ? ' · ' + zp.value : ''}`;
  const hour = parseInt(f.h.format(now), 10), day = hour >= 6 && hour < 18;
  $('#clkDn').hidden = false; $('#clkIcon').setAttribute('href', SPR + (day ? 'i-sun' : 'i-moon')); $('#clkDnTxt').textContent = day ? 'Dia' : 'Noite';
}
setInterval(clockTick, 1000);

/* ---------- localização, cidade e país ---------- */
let cur = null, curInfo = null, curIdx = 0, selTok = 0;
const visited = []; let vi = -1, order = W.buildOrder(), oi = 0;
function setFlag(cc){ const f = $('#locFlag'); if (!cc){ f.hidden = true; return; } f.hidden = false; f.src = flagUrl(cc, 40); f.srcset = `${flagUrl(cc, 40)} 1x, ${flagUrl(cc, 80)} 2x`; f.onerror = () => { f.hidden = true; }; }
function setLocation(city){
  $('#locTitle').textContent = city.nome; $('#locCountry').textContent = city.pais; setFlag(city.cc);
  const m = $('#locMeta'); m.replaceChildren(el('span', {text:contName(city.cont)}), el('span', {text:fmtCoord(city.lat, city.lon)}));
  clockTz = city.tz; clockTick(); globe.setSelected(city); globe.setCountry(city.cc); selCountry.value = city.cc;
}
function showHereLoading(){ $('#hereNote').textContent = 'Procurando rádios…'; $('#hereList').replaceChildren(el('li', {class:'skel'}), el('li', {class:'skel'})); }
function hereRow(st, i){
  const on = W.audio.station && W.audio.station.id === st.id;
  return el('li', {class:'row-st', dataset:{id:st.id, on:String(!!on)}},
    el('div', {class:'row-st__txt'}, el('p', {class:'row-st__name', text:st.name}), el('p', {class:'row-st__meta', text:[st.codec, st.bitrate ? st.bitrate + ' kbps' : '', st.tags[0]].filter(Boolean).join(' · ') || 'Transmissão ao vivo'})),
    el('button', {class:'btn btn--primary btn--sm', type:'button', 'aria-label':'Ouvir ' + st.name, onclick:() => playFromInfo(cur, curInfo, i, ++selTok, {tries:3})}, icon('i-play'), 'Ouvir'));
}
function renderHere(info, city){
  const note = {city:`Rádios de ${city.nome}.`, near:`Não achei rádio com o nome de ${city.nome}. Mostrando rádios a até 80 km.`, country:`Sem rádio cadastrada em ${city.nome}. Mostrando as mais ouvidas de ${city.pais}.`, none:'Nenhuma rádio com transmissão compatível foi encontrada aqui.'}[info.mode];
  $('#hereNote').textContent = note; $('#hereList').replaceChildren(...info.list.slice(0, 6).map(hereRow));
}
async function selectCity(city, o = {}){
  const tok = ++selTok; cur = city; curInfo = null;
  if (o.record !== false && visited[vi] !== city){ visited.length = vi + 1; visited.push(city); if (visited.length > 200) visited.shift(); vi = visited.length - 1; }
  setLocation(city);
  if (o.fly !== false) globe.flyTo(city.lon, city.lat, {k:Math.max(1.5, globe._s.k)});
  showHereLoading();
  const info = await W.api.forCity(city); if (tok !== selTok) return;
  curInfo = info; curIdx = 0; renderHere(info, city);
  if (o.play) await playFromInfo(city, info, 0, tok, {tries:5, retry:o.retry});
}
async function playFromInfo(city, info, start, tok, o = {}){
  if (!info || !info.list.length){ say(`Nenhuma rádio disponível em ${city.nome}.`); if (o.retry > 0 && tok === selTok) nextCity(o.retry - 1); return false; }
  const n = Math.min(info.list.length, o.tries || 5);
  for (let k = 0; k < n; k++){
    const i = (start + k) % info.list.length;
    if (await W.audio.play(info.list[i])){ if (tok !== selTok) return false; curIdx = i; renderHere(info, city); loadSimilar(info.list[i]); armAuto(); return true; }
    if (tok !== selTok) return false;
  }
  say(`Nenhuma rádio de ${city.nome} respondeu.`);
  if (o.retry > 0 && tok === selTok){ setMeta('Rádio indisponível. Indo para outra cidade…'); nextCity(o.retry - 1); }
  return false;
}
function nextCity(retry){
  let c;
  if (vi < visited.length - 1){ vi++; c = visited[vi]; selectCity(c, {play:true, record:false, retry}); return; }
  if (oi >= order.length){ order = W.buildOrder(); oi = 0; }
  c = order[oi++]; selectCity(c, {play:true, retry});
}
function prevCity(){ if (vi > 0){ vi--; selectCity(visited[vi], {play:true, record:false}); } else say('Esta é a primeira cidade da viagem.'); }
function goCountry(cc){
  const c = W.COUNTRIES.find(x => x.cc === cc); if (!c) return;
  const tok = ++selTok; cur = null; curInfo = null; selCountry.value = cc;
  const first = DATA.filter(x => x.cc === cc).sort((a, b) => distKm([a.lon, a.lat], [c.lon, c.lat]) - distKm([b.lon, b.lat], [c.lon, c.lat]))[0];
  $('#locTitle').textContent = c.nome; $('#locCountry').textContent = `${c.n} ${c.n === 1 ? 'cidade' : 'cidades'} no mapa`; setFlag(cc);
  $('#locMeta').replaceChildren(el('span', {text:contName(c.cont)}));
  clockTz = first.tz; clockTick(); globe.setSelected(null); globe.setCountry(cc); globe.flyTo(c.lon, c.lat, {k:c.n > 12 ? 1.7 : 2.4});
  showHereLoading();
  W.api.byCountry(cc, 12).then(list => {
    if (tok !== selTok) return;
    const info = {mode:'country', list:list || []}; curInfo = info; curIdx = 0;
    $('#hereNote').textContent = list && list.length ? `Mais ouvidas em ${c.nome}. Escolha uma cidade no globo para rádios locais.` : 'Não foi possível carregar as rádios deste país agora.';
    $('#hereList').replaceChildren(...(list || []).slice(0, 6).map((st, i) => hereRow(st, i)));
    cur = first;
  });
  scrollToInfo();
}
const cityForStation = st => {
  const pool = DATA.filter(c => c.cc === st.cc); if (!pool.length) return null;
  if (st.lat != null && st.lon != null) return pool.sort((a, b) => distKm([a.lon, a.lat], [st.lon, st.lat]) - distKm([b.lon, b.lat], [st.lon, st.lat]))[0];
  const ns = W.norm(st.state); const byState = ns && pool.find(c => W.norm(c.nome) === ns); if (byState) return byState;
  if (cur && cur.cc === st.cc) return cur;
  const ct = W.COUNTRIES.find(c => c.cc === st.cc); return pool.sort((a, b) => distKm([a.lon, a.lat], [ct.lon, ct.lat]) - distKm([b.lon, b.lat], [ct.lon, ct.lat]))[0];
};
async function playStation(st){
  const tok = ++selTok, city = cityForStation(st);
  if (city && city !== cur){ cur = city; setLocation(city); globe.flyTo(city.lon, city.lat, {k:Math.max(1.5, globe._s.k)}); W.api.forCity(city).then(info => { if (tok !== selTok) return; curInfo = info; curIdx = Math.max(0, info.list.findIndex(s => s.id === st.id)); renderHere(info, city); }); }
  if (!(await W.audio.play(st)) && tok === selTok){ setMeta('Estação indisponível agora. Tente outra.'); say(`Não foi possível tocar ${st.name}.`); return; }
  if (tok === selTok){ armAuto(); loadSimilar(st); }
}
async function otherStation(){
  if (!cur){ say('Escolha uma cidade primeiro.'); return; }
  if (!curInfo){ curInfo = await W.api.forCity(cur); }
  const list = curInfo.list; if (list.length < 2){ say('Só há uma estação disponível aqui.'); return; }
  const curId = W.audio.station && W.audio.station.id;
  const start = ((list.findIndex(s => s.id === curId) + 1) || curIdx + 1) % list.length;
  playFromInfo(cur, curInfo, start, ++selTok, {tries:list.length});
}
W.on('fail', st => {
  if (curInfo && cur && curInfo.list.some(s => s.id === st.id)){ const i = curInfo.list.findIndex(s => s.id === st.id); playFromInfo(cur, curInfo, i + 1, ++selTok, {tries:3}); }
  else setMeta('A transmissão caiu. Tente outra estação.');
});

/* ---------- troca automática (opcional) ---------- */
let autoT = null;
function armAuto(){ clearTimeout(autoT); if (prefs.auto) autoT = setTimeout(() => nextCity(2), Math.max(1, prefs.min)*60000); }

/* ---------- player ---------- */
const plName = $('#plName'), plMeta = $('#plMeta'), plStatus = $('#plStatus'), plLogo = $('#plLogo'), plLogoPh = $('#plLogoPh');
const STATUS = {idle:'Parado', loading:'Conectando', live:'Ao vivo', paused:'Pausado', error:'Erro', reconnecting:'Reconectando'};
let metaOverride = '';
function setMeta(t){ metaOverride = t; plMeta.textContent = t; }
function renderPlayer(){
  const {state, station} = {state:W.audio.state, station:W.audio.station};
  plStatus.dataset.s = state === 'reconnecting' ? 'loading' : state; plStatus.textContent = STATUS[state];
  const playing = state === 'live' || state === 'loading' || state === 'reconnecting';
  $('#plPlayIcon').setAttribute('href', SPR + (playing ? 'i-pause' : 'i-play')); $('#plPlay').setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir');
  if (station){
    plName.textContent = station.name;
    if (state === 'error' && metaOverride) plMeta.textContent = metaOverride;
    else { metaOverride = ''; plMeta.textContent = [cur ? cur.nome : '', station.country || (cur && cur.pais) || '', station.codec ? `${station.codec}${station.bitrate ? ' ' + station.bitrate + ' kbps' : ''}` : ''].filter(Boolean).join(' · '); }
    if (station.favicon){ if (plLogo.getAttribute('src') !== station.favicon){ plLogo.src = station.favicon; } plLogo.hidden = false; plLogoPh.hidden = true; plLogo.onerror = () => { plLogo.hidden = true; plLogoPh.hidden = false; }; }
    else { plLogo.hidden = true; plLogoPh.hidden = false; }
  }
  syncFav(); $$('[data-id]').forEach(n => n.dataset.on = String(!!(station && n.dataset.id === station.id && playing)));
}
W.on('audio', ({state, station}) => {
  renderPlayer();
  if (state === 'live') say(`Tocando ${station.name}`); else if (state === 'error') say('Não foi possível tocar esta estação');
  if ('mediaSession' in navigator && station){
    try {
      navigator.mediaSession.metadata = new MediaMetadata({title:station.name, artist:[cur && cur.nome, station.country].filter(Boolean).join(' · ') || 'WAVE GLOBAL', album:'WAVE GLOBAL', artwork:station.favicon ? [{src:station.favicon}] : []});
      navigator.mediaSession.playbackState = state === 'live' ? 'playing' : 'paused';
    } catch {}
  }
});
if ('mediaSession' in navigator){
  const ms = navigator.mediaSession, set = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
  set('play', () => W.audio.resume()); set('pause', () => W.audio.pause()); set('nexttrack', () => nextCity()); set('previoustrack', prevCity);
}
$('#plPlay').addEventListener('click', () => { if (!W.audio.station) start(); else W.audio.toggle(); });
$('#plSkip').addEventListener('click', () => { W.audio.unlock(); nextCity(3); });
$('#plPrev').addEventListener('click', prevCity);
$('#plOther').addEventListener('click', otherStation);
const plVol = $('#plVol'), plMute = $('#plMute');
function syncVol(){ W.audio.setVolume(prefs.vol); W.audio.setMuted(!!prefs.muted); plVol.value = prefs.vol; plMute.setAttribute('aria-pressed', String(!!prefs.muted || prefs.vol === 0)); plMute.setAttribute('aria-label', prefs.muted ? 'Ativar som' : 'Silenciar'); $('#plMuteIcon').setAttribute('href', SPR + (prefs.muted || prefs.vol === 0 ? 'i-mute' : 'i-vol')); }
plVol.addEventListener('input', () => { prefs.vol = +plVol.value; prefs.muted = false; savePrefs(); syncVol(); });
plMute.addEventListener('click', () => { prefs.muted = !prefs.muted; savePrefs(); syncVol(); });
syncVol();
$('#plFav').addEventListener('click', () => { const s = W.audio.station; if (s) W.fav.toggle(s); else say('Toque em uma estação primeiro.'); });
function start(){
  W.audio.unlock();
  if (W.audio.station && W.audio.state === 'paused'){ W.audio.resume(); return; }
  nextCity(3);
}
$('#btnStart').addEventListener('click', start);
$('#btnRandom').addEventListener('click', () => { W.audio.unlock(); nextCity(3); });
document.addEventListener('pointerdown', () => W.audio.unlock(), {once:true, passive:true});

/* ---------- cartões de estação ---------- */
function stationCard(st, why){
  const logo = st.favicon ? el('img', {class:'st__logo', src:st.favicon, alt:'', loading:'lazy', width:48, height:48, referrerpolicy:'no-referrer', onerror:e => { const ph = el('span', {class:'st__logo'}, icon('i-radio')); e.target.replaceWith(ph); }}) : el('span', {class:'st__logo'}, icon('i-radio'));
  const meta = [st.country, st.tags.slice(0, 2).join(', '), st.codec ? `${st.codec}${st.bitrate ? ' ' + st.bitrate + 'k' : ''}` : ''].filter(Boolean).join(' · ');
  const on = W.audio.station && W.audio.station.id === st.id && ['live', 'loading', 'reconnecting'].includes(W.audio.state);
  return el('article', {class:'st', dataset:{id:st.id, on:String(!!on)}},
    logo,
    el('div', {class:'st__txt'}, el('p', {class:'st__name', text:st.name}), el('p', {class:'st__meta', text:meta}), why ? el('p', {class:'st__why', text:why}) : null),
    el('div', {class:'st__act'},
      el('button', {class:'icon-btn', type:'button', 'aria-pressed':String(W.fav.has(st.id)), 'aria-label':'Favoritar ' + st.name, dataset:{fav:st.id}, onclick:() => W.fav.toggle(st)}, icon('i-heart')),
      el('button', {class:'icon-btn icon-btn--play', type:'button', 'aria-label':'Ouvir ' + st.name, onclick:() => { W.audio.unlock(); playStation(st); }}, icon('i-play'))));
}
function fill(grid, list, why){ grid.replaceChildren(...list.map(s => stationCard(s, why && why[s.id]))); }

/* ---------- favoritos e histórico ---------- */
function syncFav(){
  const s = W.audio.station, on = !!(s && W.fav.has(s.id)), b = $('#plFav');
  b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Remover dos favoritos' : 'Favoritar estação');
  $$('[data-fav]').forEach(n => n.setAttribute('aria-pressed', String(W.fav.has(n.dataset.fav))));
  const n = W.fav.list().length, c = $('#favCount'); c.hidden = !n; c.textContent = n;
}
function renderFavs(){ const l = W.fav.list(); $('#favEmpty').hidden = !!l.length; fill($('#favGrid'), l); syncFav(); }
function renderHist(){ const l = W.hist.list(); $('#hisEmpty').hidden = !!l.length; $('#hisClear').hidden = !l.length; fill($('#hisGrid'), l); syncFav(); }
W.on('favs', renderFavs); W.on('hist', renderHist);
$('#hisClear').addEventListener('click', () => W.hist.clear());
renderFavs(); renderHist();

/* ---------- descobrir ---------- */
let tab = 'pop', discTok = 0, discState = {pais:null, cont:null, cat:'music'};
const chips = $('#chips'), grid = $('#stGrid'), gridNote = $('#gridNote');
function chip(label, on, fn, ic){ return el('button', {class:'chip', type:'button', 'aria-pressed':String(on), onclick:fn}, ic ? icon(ic) : null, label); }
async function loadTab(){
  const tok = ++discTok, t = tab; let list = null, note = '';
  grid.replaceChildren(...[1, 2, 3, 4].map(() => el('div', {class:'skel'}))); chips.replaceChildren();
  if (t === 'pop'){ note = 'As mais ouvidas do diretório Radio Browser, por número de cliques.'; list = await W.api.popular(36); }
  else if (t === 'pais'){
    const cc = discState.pais || (cur && cur.cc) || 'BR'; discState.pais = cc;
    const s = el('select', {'aria-label':'País', onchange:e => { discState.pais = e.target.value; loadTab(); }}, W.COUNTRIES.map(c => el('option', {value:c.cc, text:c.nome, selected:c.cc === cc})));
    chips.replaceChildren(s); note = `Mais ouvidas em ${W.countryName(cc)}.`; list = await W.api.byCountry(cc, 36);
  } else if (t === 'cont'){
    const cid = discState.cont || (cur && cur.cont) || 'sa'; discState.cont = cid;
    chips.replaceChildren(...W.CONTINENTS.map(c => chip(c.nome, c.id === cid, () => { discState.cont = c.id; loadTab(); })));
    note = `Estações dos países com mais cidades em ${contName(cid)}.`; list = await W.api.byContinent(cid, 36);
  } else {
    const cats = [...W.api.CATEGORIES, ...W.api.GENRES], cat = cats.find(c => c.id === discState.cat) || cats[0];
    chips.replaceChildren(...cats.map(c => chip(c.nome, c.id === cat.id, () => { discState.cat = c.id; loadTab(); }, c.icon)));
    note = `Estações marcadas como “${cat.nome}” no diretório.`; list = await W.api.byTags(cat.tags, {}, 36);
  }
  if (tok !== discTok) return;
  gridNote.textContent = list && list.length ? note : '';
  if (!list){ grid.replaceChildren(el('div', {}, el('p', {class:'empty', text:'Não foi possível carregar agora.'}), el('button', {class:'btn btn--ghost btn--sm', type:'button', onclick:loadTab, text:'Tentar de novo'}))); return; }
  if (!list.length){ grid.replaceChildren(el('p', {class:'empty', text:'Nenhuma estação encontrada para esta escolha.'})); return; }
  fill(grid, list);
}
const tabs = $$('[role=tab]');
function selectTab(t, focus){ tab = t.dataset.tab; tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }); $('#panel').setAttribute('aria-labelledby', t.id); if (focus) t.focus(); loadTab(); }
tabs.forEach((b, i) => { b.addEventListener('click', () => selectTab(b)); b.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d){ e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); } else if (e.key === 'Home'){ e.preventDefault(); selectTab(tabs[0], true); } else if (e.key === 'End'){ e.preventDefault(); selectTab(tabs[tabs.length - 1], true); } }); });
let discLoaded = false;
new IntersectionObserver((es, ob) => { if (es[0].isIntersecting && !discLoaded){ discLoaded = true; loadTab(); ob.disconnect(); } }, {rootMargin:'400px'}).observe($('#descobrir'));
let simTok = 0;
async function loadSimilar(st){
  const tok = ++simTok, list = await W.api.similar(st, 8); if (tok !== simTok) return;
  const sec = $('#similar'); if (!list || !list.length){ sec.hidden = true; return; }
  fill($('#simGrid'), list); sec.hidden = false;
}

/* ---------- busca ---------- */
let searchTok = 0, searchT = null;
function runSearch(raw){
  const text = raw.trim(), n = W.norm(text), sec = $('#resultados'), body = $('#resBody');
  if (n.length < 2){ sec.hidden = true; return; }
  const tok = ++searchTok; sec.hidden = false;
  const cities = DATA.filter(c => W.norm(c.nome).includes(n)).sort((a, b) => (W.norm(b.nome).startsWith(n) - W.norm(a.nome).startsWith(n)) || a.nome.localeCompare(b.nome, 'pt')).slice(0, 8);
  const countries = W.COUNTRIES.filter(c => W.norm(c.nome).includes(n)).slice(0, 6);
  const grp = (title, ...kids) => el('div', {class:'grp'}, el('h3', {class:'label', text:title}), ...kids);
  const parts = [];
  if (cities.length) parts.push(grp('Cidades', el('div', {class:'chips'}, cities.map(c => el('button', {class:'chip', type:'button', onclick:() => { selectCity(c, {play:false}); $('#globo').scrollIntoView({behavior:'smooth'}); }}, icon('i-pin'), `${c.nome} · ${c.pais}`)))));
  if (countries.length) parts.push(grp('Países', el('div', {class:'chips'}, countries.map(c => el('button', {class:'chip', type:'button', onclick:() => { goCountry(c.cc); $('#globo').scrollIntoView({behavior:'smooth'}); }}, icon('i-flag'), c.nome)))));
  const rg = el('div', {class:'grid'}, el('div', {class:'skel'}), el('div', {class:'skel'}));
  parts.push(grp('Rádios', rg)); body.replaceChildren(...parts);
  W.api.byName(text, 24).then(list => { if (tok !== searchTok) return; if (!list) rg.replaceChildren(el('p', {class:'empty', text:'Não foi possível buscar rádios agora.'})); else if (!list.length) rg.replaceChildren(el('p', {class:'empty', text:'Nenhuma rádio encontrada com esse nome.'})); else fill(rg, list); });
}
q.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => runSearch(q.value), 350); });
searchForm.addEventListener('submit', e => { e.preventDefault(); clearTimeout(searchT); runSearch(q.value); const r = $('#resultados'); if (!r.hidden) r.scrollIntoView({behavior:'smooth'}); });
q.addEventListener('keydown', e => { if (e.key === 'Escape'){ q.value = ''; runSearch(''); } });
$('#resClear').addEventListener('click', () => { q.value = ''; runSearch(''); });

/* ---------- preferências ---------- */
const dlg = $('#dlgPrefs');
$('#btnPrefs').addEventListener('click', () => { $('#prAuto').checked = prefs.auto; $('#prMin').value = prefs.min; $('#prSpin').checked = prefs.spin; dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); });
$('#prAuto').addEventListener('change', e => { prefs.auto = e.target.checked; savePrefs(); armAuto(); });
$('#prMin').addEventListener('change', e => { prefs.min = Math.max(1, Math.min(120, Math.round(+e.target.value || 3))); e.target.value = prefs.min; savePrefs(); armAuto(); });
$('#prSpin').addEventListener('change', e => { prefs.spin = e.target.checked; globe.setSpin(prefs.spin); savePrefs(); syncSpin(); });

/* ---------- consentimento e anúncios ---------- */
const consent = W.store.get('wave.consent', null), cEl = $('#consent');
if (W.ads.enabled){
  if (consent === 'all') (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => W.ads.allow());
  else if (!consent) cEl.hidden = false;
}
$('#consentYes').addEventListener('click', () => { W.store.set('wave.consent', 'all'); cEl.hidden = true; W.ads.allow(); });
$('#consentNo').addEventListener('click', () => { W.store.set('wave.consent', 'ess'); cEl.hidden = true; });

/* ---------- assistente de descoberta (IA no servidor) ---------- */
(window.requestIdleCallback || (f => setTimeout(f, 2000)))(() => {
  if (CFG.ai === false) return;
  fetch('/api/assistant', {method:'GET'}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.enabled) $('#assistente').hidden = false; }).catch(() => {});
});
$('#aiForm').addEventListener('submit', async e => {
  e.preventDefault(); const text = $('#aiQ').value.trim(), note = $('#aiNote'), g = $('#aiGrid'); if (text.length < 3) return;
  note.textContent = 'Procurando e escolhendo estações…'; g.replaceChildren();
  const words = [...new Set(W.norm(text).split(/[^a-z0-9]+/).filter(w => w.length > 2))].slice(0, 4);
  const ccs = W.COUNTRIES.filter(c => W.norm(text).includes(W.norm(c.nome))).slice(0, 2);
  const lists = await Promise.all([W.api.popular(30), W.api.byName(text, 20), ...words.map(w => W.api.byTags([w], {}, 15)), ...ccs.map(c => W.api.byCountry(c.cc, 20))]);
  const cand = []; const seen = new Set(); lists.forEach(l => (l || []).forEach(s => { if (!seen.has(s.id) && cand.length < 80){ seen.add(s.id); cand.push(s); } }));
  if (!cand.length){ note.textContent = 'Não consegui buscar estações agora.'; return; }
  try {
    const r = await fetch('/api/assistant', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({query:text, candidates:cand.map(s => ({id:s.id, name:s.name, country:s.country, tags:s.tags, codec:s.codec, bitrate:s.bitrate}))})});
    const j = await r.json(); if (!r.ok) throw new Error(j.error || 'erro');
    const byId = new Map(cand.map(s => [s.id, s])), picks = (j.picks || []).filter(p => byId.has(p.id)).slice(0, 6);
    if (!picks.length){ note.textContent = 'Nenhuma das estações encontradas combina bem com o pedido. Tente outras palavras.'; return; }
    note.textContent = 'Sugestões geradas por IA a partir dos dados de cada estação. Confirme ouvindo: a transmissão pode estar fora do ar.';
    fill(g, picks.map(p => byId.get(p.id)), Object.fromEntries(picks.map(p => [p.id, String(p.reason || '').slice(0, 160)])));
  } catch (err){ note.textContent = 'O assistente não respondeu agora. Tente de novo em instantes.'; }
});

/* ---------- gancho de testes ---------- */
if (new URLSearchParams(location.search).has('teste')) window.__w = {globe, selectCity, goCountry, nextCity, cityState:() => ({cur:cur && cur.nome, vi, n:visited.length, state:W.audio.state, station:W.audio.station && W.audio.station.name})};
})();
