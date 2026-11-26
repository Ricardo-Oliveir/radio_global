import { initAdCarousel } from './adcarousel.js';
import { $, $$, h, icon, store, norm, debounce, flagUrl, shuffle, distKm } from './util.js';
import * as radio from './radio.js';
import { Player } from './player.js';
import { Globe } from './globe.js';
import { clockInfo } from './clock.js';
import { mountAds, applyConsent, adsEnabled } from './ads.js';
import config from './config.js';
import { Trip } from './trip.js';
import { geocode, localMatches } from './geo.js';
import { citySlugs } from './slug.js';
import { mergeCities } from './cities-merge.js';
import { initI18n, setLang, getLang, countryName } from './i18n.js';
import { Static, Meter } from './fx.js';
import { nearestCity } from './util.js';

const player = new Player();
const S = {
  cities: [], byCC: new Map(), countries: [], city: null, station: null, queue: [], qi: 0, sel: 0,
  nav: [], ni: -1, seen: new Set(), favs: store.get('favs', []), history: store.get('history', []),
  opts: Object.assign({ auto: false, mins: 5, spin: matchMedia('(hover:hover) and (pointer:fine)').matches }, store.get('opts', {})), reg: new Map(), tab: 'pop', tabArg: {}, autoT: 0
};
const E = {};
for (const id of ['menuBtn', 'nav', 'q', 'searchForm', 'searchPanel', 'globe', 'globeWrap', 'globePoster', 'globeHint', 'randomBtn', 'countrySel', 'fullBtn', 'locFlag', 'locCity', 'locCountry', 'clock', 'clockTime', 'clockDn', 'clockWeek', 'clockDate', 'clockTz', 'locStations', 'locNote', 'stList', 'similarBox', 'similarList', 'filters', 'grid', 'gridStatus', 'favGrid', 'favEmpty', 'favCount', 'pLogo', 'pName', 'pMeta', 'pLive', 'pPrev', 'pPlay', 'pNext', 'pOther', 'pFav', 'pMute', 'pVol', 'pQuality', 'pOpts', 'pStatus', 'optsDlg', 'optAuto', 'optMins', 'optSpin', 'optNight', 'optClear', 'consent', 'cYes', 'cNo', 'consentBtn', 'player', 'year', 'tripBtn', 'tripBar', 'tripTitle', 'tripStop', 'tripProg', 'tripPause', 'tripNext', 'tripEnd', 'tripFill', 'tripDlg', 'tripFrom', 'tripTo', 'tripDwell', 'tripGo', 'pageView', 'pageBody', 'optTrip', 'searchBtn', 'infoCard', 'infoFlag', 'infoCity', 'infoCountry', 'infoDn', 'infoTime', 'infoDate', 'infoRadio', 'pMore', 'loc', 'popBg', 'popBtn', 'adPanel', 'pVu', 'optNoise', 'nearBtn', 'geoCta', 'geoBtn', 'geoSkip', 'onAir', 'oaStation', 'oaPlace', 'oaTime', 'oaNext', 'oaHist', 'oaAuto', 'zIn2', 'zOut2', 'loc', 'locTime', 'sheetBtn', 'sheetTxt', 'showAll', 'navGlobe', 'adCar', 'updBar', 'updBtn', 'updX', 'bgPanel', 'bgExit', 'player', 'themeBtn', 'cityFilters', 'tripFromQ', 'tripToQ', 'tripSwap', 'tripMe', 'tripRes', 'tripSt', 'visList', 'visBox'])
  E[id] = document.getElementById(id);

const setIcon = (btn, id) => { btn.replaceChildren(icon(id)); };
const cityLabel = c => `${c.n}, ${c.p}`;
const status = (msg, warn) => { E.pStatus.textContent = msg || ''; E.pStatus.dataset.warn = warn ? '1' : ''; };

/* ---------- cabeçalho e menu ---------- */
E.menuBtn.addEventListener('click', () => {
  const open = E.nav.classList.toggle('open');
  E.menuBtn.setAttribute('aria-expanded', open); E.menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  setIcon(E.menuBtn, open ? 'close' : 'menu');
});
E.nav.addEventListener('click', e => { if (e.target.closest('a')) { E.nav.classList.remove('open'); E.menuBtn.setAttribute('aria-expanded', 'false'); setIcon(E.menuBtn, 'menu'); } });
E.year.textContent = new Date().getFullYear();
E.searchBtn.addEventListener('click', () => { const hd = document.querySelector('.hdr'), on = hd.classList.toggle('search-open'); E.searchBtn.setAttribute('aria-expanded', on); if (on) E.q.focus(); else E.searchPanel.hidden = true; });
document.querySelector('.p-info').addEventListener('click', e => { if (innerWidth < 768 && !e.target.closest('button')) E.pMore.click(); });
E.pMore.addEventListener('click', () => { const on = E.player.classList.toggle('open'); E.pMore.setAttribute('aria-expanded', on); E.pMore.setAttribute('aria-label', on ? 'Menos controles' : 'Mais controles'); setIcon(E.pMore, on ? 'close' : 'more'); });
const syncPlayerH = () => document.documentElement.style.setProperty('--player-h', Math.ceil(E.player.getBoundingClientRect().height) + 'px');
new ResizeObserver(syncPlayerH).observe(E.player);

/* ---------- estações: cartões, favoritos, histórico ---------- */
const isFav = st => S.favs.some(f => f.id === st.id);
const reg = st => { S.reg.set(st.id, st); return st; };
function logo(st, cls = 'logo'){
  const d = h('div', { class: cls, 'aria-hidden': 'true' }, (st.name || '?').trim().charAt(0).toUpperCase());
  if (st.favicon){ const im = h('img', { src: st.favicon, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' }); im.onerror = () => im.remove(); im.onload = () => d.firstChild && d.firstChild.nodeType === 3 && d.firstChild.remove(); d.append(im); }
  return d;
}
const subline = st => [st.state && st.state !== st.country ? st.state : '', st.country, st.codec && st.bitrate ? `${st.codec} ${st.bitrate} kbps` : st.codec].filter(Boolean).join(' · ');
function card(st, extra){
  reg(st);
  return h('article', { class: 'card' },
    h('div', { class: 'card-top' }, logo(st), h('div', { class: 't' }, h('h3', { text: st.name, title: st.name }), h('p', { class: 'sub', text: subline(st) || 'Dados não informados' }))),
    st.tags.length ? h('div', { class: 'tags' }, st.tags.slice(0, 3).map(t => h('span', { class: 'tag', text: t }))) : null,
    extra ? h('p', { class: 'why', text: extra }) : null,
    h('div', { class: 'card-act' },
      h('button', { class: 'btn btn-primary', type: 'button', dataset: { act: 'play', id: st.id }, 'aria-label': 'Ouvir ' + st.name }, icon('play'), h('span', { text: 'Ouvir' })),
      h('button', { class: 'icon-btn', type: 'button', dataset: { act: 'fav', id: st.id }, 'aria-pressed': String(isFav(st)), 'aria-label': (isFav(st) ? 'Remover dos favoritos: ' : 'Favoritar: ') + st.name }, icon(isFav(st) ? 'heart-f' : 'heart'))));
}
const place = st => [st.state && st.state !== st.country ? st.state : '', st.country].filter(Boolean).join(', ');
const tech = st => [st.codec, st.bitrate ? st.bitrate + ' kbps' : ''].filter(Boolean).join(' ');
function row(st, current){
  reg(st);
  const genre = [].concat(st.tags || [])[0] || '';
  const where = st.dist != null && S.city && S.city.dest ? `${place(st) || 'Local não informado'} · ${Math.round(st.dist)} km do destino` : (place(st) || 'Local não informado');
  return h('li', {}, h('button', { class: 'st-row', type: 'button', dataset: { act: 'play', id: st.id }, 'aria-current': current ? 'true' : null },
    logo(st), h('span', { class: 't' }, h('b', { text: st.name }), h('small', { text: [where, genre].filter(Boolean).join(' · ') }), tech(st) ? h('em', { class: 'tech', text: tech(st) }) : null), h('span', { class: 'row-play', 'aria-hidden': 'true' }, icon('play'))));
}
function refreshFavUI(){
  E.favCount.hidden = !S.favs.length; E.favCount.textContent = S.favs.length;
  E.favGrid.replaceChildren(...S.favs.map(s => card(s))); E.favEmpty.hidden = !!S.favs.length;
  const st = S.station;
  E.pFav.setAttribute('aria-pressed', st ? isFav(st) : false); E.pFav.setAttribute('aria-label', st && isFav(st) ? 'Remover dos favoritos' : 'Favoritar'); setIcon(E.pFav, st && isFav(st) ? 'heart-f' : 'heart');
  $$('[data-act="fav"]').forEach(b => { const s = S.reg.get(b.dataset.id); if (!s) return; const f = isFav(s); b.setAttribute('aria-pressed', f); b.replaceChildren(icon(f ? 'heart-f' : 'heart')); b.setAttribute('aria-label', (f ? 'Remover dos favoritos: ' : 'Favoritar: ') + s.name); });
}
function toggleFav(st){
  if (!st) return;
  S.favs = isFav(st) ? S.favs.filter(f => f.id !== st.id) : [st, ...S.favs].slice(0, 200);
  store.set('favs', S.favs); refreshFavUI();
}
function paintVisited(){
  const v = store.get('visited', []); E.visBox.hidden = !v.length;
  E.visList.replaceChildren(...v.map(c => h('button', { class: 'chip', type: 'button', onclick: () => { globe.setSpin(false); selectCity(c, { play: true }); } }, `${c.n}${c.p ? ' · ' + c.p : ''}`)));
}
// Filtro de categorias das estações da cidade (só mostra categorias que existem ali).
function paintCityList(){
  const all = S.cityAll || [], f = S.cityF && FBY[S.cityF] ? FBY[S.cityF] : null, list = f ? all.filter(st => matchF(st, f)) : all;
  const avail = FILTERS.filter(x => all.some(st => matchF(st, x))).slice(0, 8);
  E.cityFilters.hidden = all.length < 5 || !avail.length;
  E.cityFilters.replaceChildren(...[['', 'Todas'], ...avail.map(x => [x.k, x.l])].map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String((S.cityF || '') === k), onclick: () => { S.cityF = k; paintCityList(); } }, l)));
  S.queue = list.length ? list : all; S.qi = Math.max(0, S.queue.findIndex(s => S.station && s.id === S.station.id));
  E.stList.replaceChildren(...list.slice(0, f ? 14 : 8).map(s => row(s, S.station && S.station.id === s.id)));
}
function pushVisited(c){
  if (!c || !isFinite(c.a)) return; const o = { n: c.n, p: c.p, c: c.c, a: c.a, o: c.o, z: c.z, t: c.t, dest: !!c.dest };
  store.set('visited', [o, ...store.get('visited', []).filter(x => !(x.n === o.n && x.c === o.c))].slice(0, 12)); paintVisited();
}
function pushHistory(st){
  S.history = [st, ...S.history.filter(h => h.id !== st.id)].slice(0, 30); store.set('history', S.history);
  if (S.tab === 'hist') renderTab();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const st = S.reg.get(b.dataset.id); if (!st) return;
  if (b.dataset.act === 'play') playStation(st); else if (b.dataset.act === 'fav') toggleFav(st);
});

/* ---------- player (interface) ---------- */
const labels = { idle: 'Reproduzir', paused: 'Reproduzir', error: 'Reproduzir', blocked: 'Reproduzir', loading: 'Pausar', playing: 'Pausar' };
function paintPlayer(){
  const st = S.station, ps = player.state;
  E.pName.textContent = st ? st.name : 'Nada tocando'; E.infoRadio.textContent = st ? st.name : 'Nada tocando';
  E.pMeta.textContent = st ? ([S.city ? cityLabel(S.city) : '', st.codec && st.bitrate ? `${st.codec} ${st.bitrate} kbps` : ''].filter(Boolean).join(' · ') || subline(st)) : 'Toque em ▶ para uma cidade ao acaso';
  const lg = logo(st || { name: '♪' }, 'logo'); E.pLogo.replaceChildren(...lg.childNodes);
  if (!st) E.pLogo.replaceChildren(icon('play'));
  const playing = ps === 'playing' || ps === 'loading';
  setIcon(E.pPlay, playing ? 'pause' : 'play'); E.pPlay.setAttribute('aria-label', labels[ps] || 'Reproduzir');
  E.pLive.hidden = !st || ps === 'idle' || ps === 'paused' || ps === 'error' || ps === 'blocked';
  E.pLive.className = 'live' + (ps === 'loading' ? ' load' : ''); E.pLive.lastChild.textContent = ps === 'loading' ? 'CARREGANDO' : 'AO VIVO';
  E.pQuality.hidden = !(st && st.codec); if (st && st.codec) E.pQuality.textContent = st.bitrate ? `${st.codec} · ${st.bitrate}k` : st.codec;
  refreshFavUI();
  $$('.st-row').forEach(r => r.setAttribute('aria-current', st && S.reg.get(r.dataset.id) && S.reg.get(r.dataset.id).id === st.id ? 'true' : 'false'));
  if ('mediaSession' in navigator && st){
    navigator.mediaSession.metadata = new MediaMetadata({ title: st.name, artist: S.city ? cityLabel(S.city) : st.country, album: 'WAVE GLOBAL', artwork: [{ src: st.favicon || '/assets/img/icon-192.png', sizes: '192x192' }] });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
}
const staticFx = new Static(player); new Meter(E.pVu, player);
player.addEventListener('state', e => { const d = e.detail; if (d.state === 'loading' && d.station && S.opts.noise !== false) staticFx.start(); else if (d.state !== 'loading') staticFx.stop(); });
player.addEventListener('state', e => {
  const { state, retry, final } = e.detail;
  if (state === 'loading' && retry) status(`Reconectando (tentativa ${retry} de 3)…`, true);
  else if (state === 'error') status(final ? 'A transmissão caiu e não voltou. Tente outra estação.' : 'Esta estação não respondeu.', true);
  else if (state === 'blocked') status('O navegador bloqueou o som. Toque em reproduzir.', true);
  else if (state === 'playing' || state === 'paused') status('');
  paintPlayer();
});
E.pPlay.addEventListener('click', () => { player.unlock(); if (!S.station) return randomCity(); player.toggle(); });
E.pVol.addEventListener('input', () => { player.setVolume(+E.pVol.value); player.setMuted(false); store.set('vol', +E.pVol.value); store.set('muted', false); paintMute(); });
E.pMute.addEventListener('click', () => { const m = !player.audio.muted; player.setMuted(m); store.set('muted', m); paintMute(); });
function paintMute(){ const m = player.audio.muted || player.audio.volume === 0; setIcon(E.pMute, m ? 'mute' : 'vol'); E.pMute.setAttribute('aria-label', m ? 'Ativar o som' : 'Silenciar'); }
E.pFav.addEventListener('click', () => toggleFav(S.station));
E.pNext.addEventListener('click', () => nextStation());
E.pPrev.addEventListener('click', () => prevStation());
E.pOther.addEventListener('click', () => otherStation());

async function tryQueue(cands, from = 0, max = 6, ms){
  for (let k = 0; k < Math.min(max, cands.length); k++){
    const i = (from + k) % cands.length, st = cands[i];
    S.station = reg(st); paintPlayer(); status(`Sintonizando ${st.name}…`);
    const ok = await player.load(st, ms);
    if (S.station !== st) return false;
    if (ok){ S.qi = i; onStarted(st); return true; }
  }
  status('Nenhuma estação respondeu agora. Tente outra cidade.', true);
  return false;
}
function syncUrl(c, st){
  try {
    const sl = S.slugs && c && !c.dest ? S.slugs.get(c) : null; const p = new URLSearchParams(location.search);
    ['c', 'r', 'pais'].forEach(k => p.delete(k)); if (sl) p.set('c', sl); if (st && st.id) p.set('r', st.id);
    const qs = p.toString(); history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch {}
}
function markAudio(st){
  syncUrl(S.city, st);
  const c = S.city; const far = c && c.dest && st.lat != null && st.lon != null && distKm(st.lon, st.lat, c.o, c.a) > 4;
  globe.setAudioPoint(far ? { o: +st.lon, a: +st.lat } : null);
}
function onStarted(st){
  status(''); markAudio(st); pushHistory(st); paintPlayer(); armAuto();
  if (!S.navMove){ S.nav = S.nav.slice(0, S.ni + 1); S.nav.push({ city: S.city, st }); S.ni = S.nav.length - 1; }
  loadSimilar(st);
}
async function playStation(st, opts){
  player.unlock(); S.navMove = false;
  S.station = reg(st); paintPlayer(); status(`Sintonizando ${st.name}…`);
  const inList = S.queue.findIndex(s => s.id === st.id); if (inList >= 0) S.qi = inList;
  if (inList < 0){ const c = locate(st); if (c && c !== S.city) selectCity(c, { play: false }); }
  const ok = await player.load(st);
  if (S.station !== st) return;
  if (ok) { onStarted(st); return; }
  // não respondeu: tenta rapidamente outra da mesma lista (até 3 vezes), sem deixar o usuário esperando
  const tried = (opts && opts.tried) || [st.id]; const alt = S.queue.find(s => !tried.includes(s.id));
  if (alt && tried.length < 4){ status(`${st.name} está fora do ar. Tentando ${alt.name}…`, true); return playStation(alt, { tried: [...tried, alt.id] }); }
  status('Esta estação não respondeu. Tente outra.', true);
}
function locate(st){
  const list = S.byCC.get(st.cc) || [];
  if (st.lat != null && st.lon != null && Math.abs(st.lat) + Math.abs(st.lon) > 0.01){
    let best = null, bd = list.length ? Infinity : 400;
    for (const c of (list.length ? list : S.cities)){ const d = distKm(st.lon, st.lat, c.o, c.a); if (d < bd){ bd = d; best = c; } }
    if (best) return best;
  }
  const n = norm(st.state); return list.find(c => norm(c.n) === n) || list[0] || null;
}
async function otherStation(){
  if (!S.queue.length){ status('Escolha uma cidade para ver outras estações.', true); return; }
  S.navMove = false; await tryQueue(S.queue, S.qi + 1, S.queue.length);
}
// Celular: "Pular" tenta as próximas estações da cidade atual e, se falharem (ou não houver mais), vai em silêncio para uma cidade aleatória que tenha estação no ar.
const MOB = matchMedia('(max-width:767px)');
let skipTok = 0;
async function skipMobile(){
  const tok = ++skipTok, q = S.queue.slice(), cur = S.qi;
  for (let k = 1; k < q.length && k <= 3; k++){
    const i = (cur + k) % q.length, st = q[i]; if (S.station && st.id === S.station.id) continue;
    S.station = reg(st); paintPlayer(); const ok = await player.load(st, 4000);
    if (tok !== skipTok || S.station !== st) return; if (ok){ S.qi = i; onStarted(st); return; }
  }
  const pool = S.cities.slice(0, S.baseN || S.cities.length).filter(c => !S.city || c !== S.city);
  for (let n = 0; n < 6 && pool.length; n++){
    const c = pool[Math.floor(Math.random() * pool.length)]; S.seen.add(c);
    const ok = await selectCity(c, { max: 2, ms: 4000 }); if (tok !== skipTok) return; if (ok) return;
  }
}
async function nextStation(){
  player.unlock();
  if (S.ni < S.nav.length - 1){ S.ni++; return replay(S.nav[S.ni]); }
  if (MOB.matches) return skipMobile();
  randomCity();
}
async function prevStation(){
  if (S.ni <= 0){ status('Não há estação anterior nesta sessão.'); return; }
  S.ni--; replay(S.nav[S.ni]);
}
async function replay(entry){
  S.navMove = true; if (entry.city && entry.city !== S.city) await selectCity(entry.city, { play: false });
  await playStation(entry.st); S.navMove = false;
}

/* ---------- cidade, relógio e lista local ---------- */
// Celular: o painel da cidade vira uma gaveta compacta acima do player; toque para abrir a lista de estações.
// Informações da cidade e lista de estações viram um pop-up: abre ao tocar numa cidade, fecha e volta pelo botão "Estações".
function measureSheet(){ document.documentElement.style.setProperty('--sheet-h', '0px'); }
function setSnap(n){ const on = n > 0; S.snap = on ? 1 : 0; E.loc.dataset.snap = on ? 'mid' : 'peek'; E.loc.classList.toggle('open', on); E.popBg.hidden = !on; document.body.classList.toggle('pop-open', on); E.sheetBtn.setAttribute('aria-expanded', on); E.popBtn.setAttribute('aria-expanded', on); if (on) E.sheetBtn.focus({ preventScroll: true }); }
function setSheet(on){ setSnap(on ? 1 : 0); }
E.loc.dataset.snap = 'peek';
E.sheetBtn.addEventListener('click', () => setSnap(0)); E.popBg.addEventListener('click', () => setSnap(0)); E.popBtn.addEventListener('click', () => setSnap(1));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && E.loc.classList.contains('open')) setSheet(false); });
// Painel de publicidade: duas "páginas" (AdSense e carrossel de imagens) que se alternam a cada 30 s só trocando a visibilidade, sem recarregar nem atualizar o anúncio (a política do AdSense proíbe atualização forçada).
{ const PG = 30000; let t = 0;
  const pages = () => [...E.adPanel.querySelectorAll('.pg')].filter(p => !p.hidden);
  const show = p => E.adPanel.querySelectorAll('.pg').forEach(x => x.classList.toggle('on', x === p));
  const tick = () => { const ps = pages(); if (!ps.length || document.hidden) return; const k = ps.findIndex(p => p.classList.contains('on')); if (ps.length > 1) show(ps[(k + 1) % ps.length]); else show(ps[0]); };
  setInterval(tick, PG); new MutationObserver(() => { const ps = pages(); if (ps.length && !ps.some(p => p.classList.contains('on'))) show(ps[0]); }).observe(E.adPanel, { attributes: true, subtree: true, attributeFilter: ['hidden'] }); }
let clockT = 0;
function paintClock(){
  const c = S.city; if (!c) return;
  const k = clockInfo(c.z, c.a, c.o);
  E.locTime.textContent = k.time.slice(0, 5); E.clockTime.textContent = k.time; E.clockWeek.textContent = k.weekday.charAt(0).toUpperCase() + k.weekday.slice(1); E.clockDate.textContent = k.date; E.clockTz.textContent = k.tzLabel;
  E.infoTime.textContent = k.time; E.infoDate.textContent = `${k.weekday.charAt(0).toUpperCase() + k.weekday.slice(1)} · ${k.date} · ${k.tzLabel}`; E.infoDn.textContent = k.isDay ? '☀ Dia' : '☾ Noite'; E.infoDn.dataset.night = k.isDay ? '' : '1';
  E.clockDn.classList.toggle('night', !k.isDay); E.clockDn.replaceChildren(icon(k.isDay ? 'sun' : 'moon'), h('span', { text: k.isDay ? 'Dia' : 'Noite' }));
}
setInterval(paintClock, 1000);
const noteFor = (c, i) => !c.dest ? NOTES[i.mode] : i.mode === 'city' ? `Estações de ${c.n}.` : i.mode === 'near' ? `Nenhuma estação cadastrada exatamente em ${c.n}. Encontramos rádios a partir de ${i.min} km do destino (busca até ${i.radius} km).` : i.mode === 'country' ? `Nenhuma estação perto de ${c.n}. Mostrando as mais ouvidas do país.` : NOTES.none;
const NOTES = { city: 'Estações com o nome desta cidade.', near: 'Estações cadastradas até 80 km daqui.', country: 'Sem estação cadastrada na cidade. Mostrando as mais ouvidas do país.', none: 'Nenhuma estação cadastrada para este local.' };
async function selectCity(c, { play = true, fly = true, keepList = false, pop = false, max, ms } = {}){
  if (fly && trip && trip.active) trip.pause();
  S.city = c; const tok = ++S.sel; S.seen.add(c); document.body.classList.add('has-city'); E.popBtn.hidden = false; if (pop) setSheet(true); else if (fly) setSheet(false);
  syncUrl(c); globe && (globe.setSelected(c), globe.setAudioPoint(null), fly && globe.flyTo(c));
  E.locFlag.hidden = false; E.locFlag.src = flagUrl(c.c); E.locCity.textContent = c.n; E.locCountry.textContent = c.p;
  E.infoCard.hidden = false; E.infoFlag.src = flagUrl(c.c); E.infoCity.textContent = c.n; E.infoCountry.textContent = c.p;
  E.clock.hidden = false; paintClock(); store.set('city', c.n + '|' + c.c); pushVisited(c);
  E.globeHint.textContent = `${c.n}, ${c.p}. ${play ? 'Buscando a rádio…' : ''}`;
  if (!keepList){ E.locStations.hidden = false; E.locNote.textContent = 'Buscando estações…'; E.stList.replaceChildren(); E.cityFilters.hidden = true; }
  const info = c.dest ? await radio.forPlace(c) : await radio.forCity(c); if (tok !== S.sel) return;
  if (!keepList){
    S.cityAll = info.cands; S.cityF = '';
    E.popBtn.lastElementChild.textContent = info.cands.length ? `Estações (${info.cands.length})` : 'Estações'; E.locNote.textContent = noteFor(c, info); paintCityList();
  }
  E.globeHint.textContent = `${c.n}, ${c.p}.`;
  if (play){ if (!info.cands.length){ status('Nenhuma estação cadastrada para este local.', true); S.station = null; player.stop(); paintPlayer(); return false; } S.navMove = false; const ok = await tryQueue(info.cands, 0, max, ms); paintPlayer(); return ok; }
  paintPlayer();
}
function randomCity(){
  const pool = S.cities.filter(c => !S.seen.has(c) && (!S.city || c.c !== S.city.c));
  if (!pool.length){ S.seen.clear(); return randomCity(); }
  selectCity(pool[Math.floor(Math.random() * pool.length)]);
}
E.randomBtn.addEventListener('click', () => { player.unlock(); randomCity(); });
async function loadSimilar(st){
  const list = await radio.similar(st); if (S.station !== st) return;
  E.similarBox.hidden = !list.length; E.similarList.replaceChildren(...list.map(s => row(s)));
}

/* ---------- troca automática (opcional) ---------- */
function armAuto(){
  clearTimeout(S.autoT); if (!S.opts.auto) return;
  S.autoAt = Date.now() + S.opts.mins * 60000; S.autoT = setTimeout(() => { if (player.state === 'playing') randomCity(); else armAuto(); }, S.opts.mins * 60000);
}

/* ---------- globo ---------- */
let globe = null;
function initGlobe(){
  globe = new Globe(E.globe, E.globeWrap, S.cities, {
    onZoomed: z => { E.showAll.hidden = !z; },
    onSelect: c => { player.unlock(); if (trip && trip.active) trip.pause(); selectCity(c, { pop: !MOB.matches }); },
    onHover: c => { if (c) E.globeHint.textContent = `${c.n}, ${c.p}. Toque para ouvir.`; else if (S.city) E.globeHint.textContent = `${S.city.n}, ${S.city.p}.`; },
    onMiss: () => { E.globeHint.textContent = 'Nenhuma cidade perto desse ponto. Gire o globo ou aproxime.'; },
    onFirstDraw: () => E.globePoster.classList.add('off')
  });
  globe.setSpin(S.opts.spin);
  if (S.city) { globe.setSelected(S.city); globe.flyTo(S.city, 1, 1); }
  const idle = window.requestIdleCallback || (f => setTimeout(f, 600));
  idle(() => globe.loadMap(), { timeout: 2500 });
}
E.zIn2.addEventListener('click', () => globe && globe.zoom(1.5));
E.zOut2.addEventListener('click', () => globe && globe.zoom(1 / 1.5));
E.showAll.addEventListener('click', () => globe && globe.showAll());
E.navGlobe.addEventListener('click', () => globe && globe.showAll());
// Globo grande: aumenta o globo, mostra o "no ar" e deixa só um mini player (não usa a tela cheia do navegador).
let bigT = 0;
const fitBig = () => { const hd = document.querySelector('.site-header'); document.documentElement.style.setProperty('--big-top', Math.ceil(hd.getBoundingClientRect().bottom) + 'px'); };
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function paintOnAir(){
  const st = S.station, c = S.city;
  E.oaStation.textContent = st ? st.name : 'Nada tocando'; E.oaPlace.textContent = c ? `${c.n}, ${c.p}` : 'Toque numa cidade do globo';
  E.oaTime.textContent = c ? clockInfo(c.z, c.a, c.o).time : '';
  const li = t => h('li', { text: t });
  const nxt = st ? S.queue.slice(S.qi + 1, S.qi + 4) : [], past = S.history.filter(x => !st || x.id !== st.id).slice(0, 3);
  E.oaNext.replaceChildren(...(nxt.length ? nxt.map(x => li(x.name)) : [li('—')])); E.oaHist.replaceChildren(...(past.length ? past.map(x => li(x.name)) : [li('—')]));
  E.oaAuto.textContent = S.opts.auto && S.autoAt ? `Próxima cidade automática em ${mmss(S.autoAt - Date.now())}` : '';
}
function setPanel(on){ document.body.classList.toggle('bgpanel', on); E.bgPanel.setAttribute('aria-expanded', on); E.bgPanel.querySelector('span').textContent = on ? 'Fechar painel' : 'Painel'; requestAnimationFrame(() => globe && globe.resize()); }
function setBigGlobe(on){
  document.body.classList.toggle('bigglobe', on); setPanel(false); E.onAir.hidden = !on; E.fullBtn.setAttribute('aria-pressed', on); clearInterval(bigT);
  E.fullBtn.querySelector('span').textContent = on ? 'Sair do globo grande' : 'Globo grande';
  if (on){ fitBig(); scrollTo(0, 0); paintOnAir(); bigT = setInterval(paintOnAir, 1000); }
  requestAnimationFrame(() => globe && globe.resize());
}
E.fullBtn.addEventListener('click', () => setBigGlobe(!document.body.classList.contains('bigglobe')));
E.bgExit.addEventListener('click', () => setBigGlobe(false));
E.bgPanel.addEventListener('click', () => setPanel(!document.body.classList.contains('bgpanel')));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('bigglobe') && !document.querySelector('dialog[open]')) setBigGlobe(false); });
addEventListener('resize', () => { if (document.body.classList.contains('bigglobe')) fitBig(); });
player.addEventListener('state', () => { if (document.body.classList.contains('bigglobe')) paintOnAir(); });
E.countrySel.addEventListener('change', () => { const cc = E.countrySel.value; if (!cc) return; goCountry(cc, true); E.countrySel.value = ''; });
function centroidCity(cc){
  const l = S.byCC.get(cc) || []; if (!l.length) return null;
  const a = l.reduce((s, c) => s + c.a, 0) / l.length, o = l.reduce((s, c) => s + c.o, 0) / l.length;
  return l.reduce((b, c) => (distKm(o, a, c.o, c.a) < distKm(o, a, b.o, b.a) ? c : b), l[0]);
}
function goCountry(cc, play){ const c = centroidCity(cc); if (!c) return; player.unlock(); if (play) selectCity(c); else globe && globe.flyTo(c, 2); }

/* ---------- descoberta ---------- */
// Categorias: tags do diretório (busca) + padrão de texto (filtro das estações já carregadas de uma cidade).
const FILTERS = [
  { k: 'evangelica', l: 'Evangélica', tags: ['evangelical', 'evangélica', 'evangelica', 'gospel'], re: /evang[eé]l|gospel|crist[aã]o|crist[aã]|christian|jesus|louvor|adora[cç][aã]o/i },
  { k: 'catolica', l: 'Católica', tags: ['catholic', 'católica', 'catolica'], re: /cat[oó]lic|catholic|aparecida|santu[aá]rio|can[cç][aã]o nova|rosário|padre/i },
  { k: 'religion', l: 'Religião', tags: ['religion', 'religious'], re: /relig|igreja|church|deus|god|fé\b|faith/i },
  { k: 'islamic', l: 'Islâmica', tags: ['islamic', 'quran', 'islam'], re: /islam|quran|cor[aã]o|koran/i },
  { k: 'spirit', l: 'Espírita', tags: ['spiritist', 'espírita', 'espirita'], re: /esp[ií]rit|kardec|spirit/i },
  { k: 'jewish', l: 'Judaica', tags: ['jewish', 'judaica'], re: /jew|judai|juda|israel/i },
  { k: 'buddhist', l: 'Budista', tags: ['buddhist', 'buddhism'], re: /buddh|budis/i },
  { k: 'news', l: 'Notícias', tags: ['news'], re: /news|not[ií]cia|jornal|informa/i },
  { k: 'sports', l: 'Esportes', tags: ['sports', 'sport'], re: /sport|esporte|deport|futebol|football|soccer/i },
  { k: 'sertanejo', l: 'Sertaneja', tags: ['sertanejo'], re: /sertanej|modão|moda de viola/i },
  { k: 'forro', l: 'Forró', tags: ['forró', 'forro'], re: /forr[oó]|piseiro|xote/i },
  { k: 'mpb', l: 'MPB', tags: ['mpb'], re: /\bmpb\b|bossa/i },
  { k: 'samba', l: 'Samba e pagode', tags: ['samba', 'pagode'], re: /samba|pagode/i },
  { k: 'funk', l: 'Funk', tags: ['funk'], re: /\bfunk/i },
  { k: 'pop', l: 'Pop', tags: ['pop'], re: /\bpop\b|top 40|hits/i },
  { k: 'rock', l: 'Rock', tags: ['rock'], re: /\brock\b/i },
  { k: 'metal', l: 'Metal', tags: ['metal'], re: /\bmetal\b/i },
  { k: 'hiphop', l: 'Hip hop e rap', tags: ['hip hop', 'rap'], re: /hip.?hop|\brap\b/i },
  { k: 'electronic', l: 'Eletrônica', tags: ['electronic', 'dance', 'house', 'techno'], re: /electro|eletr[oô]n|dance|house|techno|\bedm\b/i },
  { k: 'jazz', l: 'Jazz e blues', tags: ['jazz', 'blues'], re: /jazz|blues/i },
  { k: 'classical', l: 'Clássica', tags: ['classical'], re: /classic|cl[aá]ssic|orquestra|opera|ópera/i },
  { k: 'reggae', l: 'Reggae', tags: ['reggae'], re: /reggae/i },
  { k: 'latin', l: 'Latina', tags: ['latin', 'salsa', 'reggaeton'], re: /latin|salsa|reggaeton|bachata|cumbia/i },
  { k: 'country', l: 'Country e folk', tags: ['country', 'folk'], re: /country|folk/i },
  { k: 'oldies', l: 'Anos 70, 80 e 90', tags: ['oldies', '80s', '90s', '70s'], re: /oldies|\b(70|80|90)s?\b|retro|flashback/i },
  { k: 'kids', l: 'Infantil', tags: ['kids', 'children'], re: /kids|crian[cç]|infantil|children/i },
  { k: 'kpop', l: 'K-pop e J-pop', tags: ['k-pop', 'kpop', 'j-pop'], re: /k-?pop|j-?pop/i },
  { k: 'talk', l: 'Conversa', tags: ['talk'], re: /talk|conversa|debate/i },
  { k: 'culture', l: 'Cultura', tags: ['culture'], re: /cultur/i },
  { k: 'romantic', l: 'Romântica', tags: ['romantic', 'love songs', 'romantica'], re: /rom[aâ]ntic|romantic|love/i },
  { k: 'axe', l: 'Axé', tags: ['axé', 'axe'], re: /\bax[eé]\b/i },
  { k: 'chill', l: 'Chill e lo-fi', tags: ['chillout', 'lofi', 'lo-fi', 'chill'], re: /chill|lo-?fi/i },
  { k: 'ambient', l: 'Ambiente e relax', tags: ['ambient', 'relax', 'lounge', 'easy listening'], re: /ambient|relax|lounge|easy listening/i },
  { k: 'soul', l: 'Soul e R&B', tags: ['soul', 'r&b', 'rnb'], re: /\bsoul\b|r&b|rnb/i },
  { k: 'indie', l: 'Indie e alternativa', tags: ['indie', 'alternative'], re: /indie|alternativ/i },
  { k: 'folkloric', l: 'Tradicional e folclore', tags: ['traditional', 'folklore', 'folclore'], re: /tradition|tradicion|folclor|folklor/i },
  { k: 'community', l: 'Comunitária', tags: ['community'], re: /comunit|community|comunidad/i },
  { k: 'university', l: 'Universitária', tags: ['university', 'college'], re: /universit|college|campus/i },
  { k: 'instrumental', l: 'Instrumental', tags: ['instrumental'], re: /instrumental/i },
  { k: 'arabic', l: 'Árabe', tags: ['arabic', 'arab'], re: /arab|árab|عرب/i },
  { k: 'french', l: 'Francesa', tags: ['french', 'chanson'], re: /fran[cç]a|french|chanson|fran[cç]ais/i },
  { k: 'music', l: 'Música', tags: ['music'], re: /music|m[uú]sica/i }
];
const FBY = Object.fromEntries(FILTERS.map(f => [f.k, f]));
const matchF = (st, f) => f.re.test([].concat(st.tags || []).join(' ') + ' ' + st.name);
const CATS = FILTERS.slice(0, 13).map(f => [f.k, f.l]), GENRES = FILTERS.slice(13).map(f => [f.k, f.l]);
const CONTS = [['sa', 'América do Sul'], ['na', 'América do Norte e Central'], ['eu', 'Europa'], ['af', 'África'], ['as', 'Ásia'], ['oc', 'Oceania']];
const chips = (items, cur, onPick) => items.map(([v, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v === cur), onclick: () => onPick(v) }, l));
const countryOptions = cur => [h('option', { value: '', text: 'Escolha um país' }), ...S.countries.map(c => h('option', { value: c.c, text: countryName(c.c, c.p), selected: c.c === cur }))];
let loadTok = 0;
async function showStations(promise, emptyMsg){
  const tok = ++loadTok; E.gridStatus.textContent = 'Carregando…'; E.grid.replaceChildren();
  const list = await promise; if (tok !== loadTok) return;
  E.gridStatus.textContent = list.length ? '' : emptyMsg || 'Nenhuma estação encontrada.'; E.grid.replaceChildren(...list.map(s => card(s)));
}
function renderTab(){
  const t = S.tab, a = S.tabArg; E.filters.replaceChildren(); loadTok++;
  $$('[data-tab]').forEach(b => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  document.getElementById('panel').setAttribute('aria-labelledby', 'tab-' + t);
  if (t === 'pop') showStations(radio.top(24), 'Não consegui carregar o diretório agora.');
  else if (t === 'cat'){
    const cur = a.tag || 'evangelica';
    E.filters.append(h('div', { class: 'filters', style: 'margin:0;width:100%' }, chips([...CATS, ...GENRES], cur, v => { S.tabArg = { tag: v }; renderTab(); })));
    showStations(radio.byTag((FBY[cur] || { tags: [cur] }).tags), 'Sem estações para esta categoria.');
  } else if (t === 'country'){
    const sel = h('select', { 'aria-label': 'País', onchange: e => { S.tabArg = { cc: e.target.value, tag: S.tabArg.tag }; renderTab(); } }, countryOptions(a.cc));
    const tag = h('select', { 'aria-label': 'Categoria', onchange: e => { S.tabArg = { cc: S.tabArg.cc, tag: e.target.value }; renderTab(); } }, h('option', { value: '', text: 'Todas as categorias' }), [...CATS, ...GENRES].map(([v, l]) => h('option', { value: v, text: l, selected: v === a.tag })));
    E.filters.append(sel, tag);
    if (a.cc){ const c = centroidCity(a.cc); if (c && globe) globe.flyTo(c, 2); showStations(radio.byCountry(a.cc, a.tag && (FBY[a.tag] || { tags: [a.tag] }).tags), 'Sem estações para este filtro.'); } else { E.gridStatus.textContent = 'Escolha um país para ver as estações.'; E.grid.replaceChildren(); }
  } else if (t === 'cont'){
    const cur = a.ct || 'sa';
    E.filters.append(h('div', { class: 'filters', style: 'margin:0;width:100%' }, chips(CONTS, cur, v => { S.tabArg = { ct: v }; renderTab(); })));
    const list = S.countries.filter(c => c.t === cur);
    E.gridStatus.textContent = `${list.length} países. Escolha um para ver as estações.`;
    E.grid.replaceChildren(...list.map(c => h('div', { class: 'card cont-card' }, h('button', { class: 'btn', type: 'button', onclick: () => { S.tab = 'country'; S.tabArg = { cc: c.c }; renderTab(); } }, h('img', { class: 'flag', src: flagUrl(c.c), alt: '', width: 24, height: 18, loading: 'lazy' }), h('span', { text: `${c.p} · ${c.count} ${c.count === 1 ? 'cidade' : 'cidades'}` })))));
  } else if (t === 'hist'){
    E.gridStatus.textContent = S.history.length ? '' : 'O histórico aparece aqui depois que você ouvir uma estação.';
    E.grid.replaceChildren(...S.history.map(s => card(s)));
  }
}
$$('[data-tab]').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.tab; S.tabArg = {}; renderTab(); }));
$('[role="tablist"]').addEventListener('keydown', e => {
  const tabs = $$('[data-tab]'), i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
  if (n >= 0){ e.preventDefault(); tabs[n].focus(); tabs[n].click(); }
});

/* ---------- busca ---------- */
const closeSearch = full => { E.searchPanel.hidden = true; if (full){ document.querySelector('.hdr').classList.remove('search-open'); E.searchBtn.setAttribute('aria-expanded', 'false'); E.q.blur(); } };
const doSearch = debounce(async () => {
  const raw = E.q.value.trim(), q = norm(raw);
  if (q.length < 2){ closeSearch(); return; }
  const cities = S.cities.filter(c => norm(c.n).includes(q)).sort((a, b) => (norm(a.n).startsWith(q) ? 0 : 1) - (norm(b.n).startsWith(q) ? 0 : 1)).slice(0, 5);
  const countries = S.countries.filter(c => norm(c.p).includes(q)).slice(0, 3);
  E.searchPanel.hidden = false; E.searchPanel.replaceChildren(...sections(cities, countries, null));
  const sts = await radio.byName(raw, 8);
  if (E.q.value.trim() !== raw) return;
  E.searchPanel.replaceChildren(...sections(cities, countries, sts));
}, 250);
function sections(cities, countries, sts){
  const out = [];
  if (cities.length){ out.push(h('h3', { text: 'Cidades' })); cities.forEach(c => out.push(h('button', { class: 'sp-item', type: 'button', onclick: () => { closeSearch(true); player.unlock(); selectCity(c); document.getElementById('globo').scrollIntoView({ behavior: 'smooth' }); } }, h('img', { class: 'flag', src: flagUrl(c.c), alt: '', width: 24, height: 18 }), h('span', {}, c.n, h('small', { text: c.p }))))); }
  if (countries.length){ out.push(h('h3', { text: 'Países' })); countries.forEach(c => out.push(h('button', { class: 'sp-item', type: 'button', onclick: () => { closeSearch(true); S.tab = 'country'; S.tabArg = { cc: c.c }; renderTab(); goCountry(c.c, false); document.getElementById('descobrir').scrollIntoView({ behavior: 'smooth' }); } }, h('img', { class: 'flag', src: flagUrl(c.c), alt: '', width: 24, height: 18 }), h('span', {}, c.p, h('small', { text: `${c.count} cidades` }))))); }
  if (sts === null) out.push(h('p', { class: 'sp-empty', text: 'Buscando estações…' }));
  else if (sts.length){ out.push(h('h3', { text: 'Estações' })); sts.forEach(s => { reg(s); out.push(h('button', { class: 'sp-item', type: 'button', onclick: () => { closeSearch(true); playStation(s); } }, logo(s), h('span', {}, s.name, h('small', { text: subline(s) })))); }); }
  if (!out.length || (sts && !sts.length && !cities.length && !countries.length)) return [h('p', { class: 'sp-empty', text: 'Nada encontrado. Tente outro nome.' })];
  return out;
}
E.q.addEventListener('input', doSearch);
E.searchForm.addEventListener('submit', e => { e.preventDefault(); const b = E.searchPanel.querySelector('.sp-item'); if (b) b.click(); else doSearch(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
document.addEventListener('click', e => { if (!e.target.closest('.search-panel, .search, .search-btn')) closeSearch(true); });

/* ---------- opções e consentimento ---------- */
E.optTrip && E.optTrip.addEventListener('click', () => { E.optsDlg.close(); E.tripBtn.click(); });
E.pOpts.addEventListener('click', () => { E.optAuto.checked = S.opts.auto; E.optMins.value = String(S.opts.mins); E.optSpin.checked = S.opts.spin; E.optNoise.checked = S.opts.noise !== false; E.optNight.checked = S.opts.night !== false; E.optsDlg.showModal(); });
const saveOpts = () => { S.opts = { auto: E.optAuto.checked, mins: +E.optMins.value, spin: E.optSpin.checked, noise: E.optNoise.checked, night: E.optNight.checked }; store.set('opts', S.opts); globe && (globe.setSpin(S.opts.spin), globe.setNight(S.opts.night !== false)); armAuto(); };
[E.optAuto, E.optMins, E.optSpin, E.optNoise, E.optNight].forEach(el => el.addEventListener('change', saveOpts));
E.optClear.addEventListener('click', () => { store.clear(); paintVisited(); S.favs = []; S.history = []; refreshFavUI(); renderTab(); E.optClear.textContent = 'Dados apagados'; });
const consentOpen = () => { E.consent.hidden = false; scrollTo({ top: 0 }); E.cNo.focus({ preventScroll: true }); };
E.consentBtn.addEventListener('click', consentOpen);
const consentSet = v => { store.set('consent', v); E.consent.hidden = true; applyConsent(); };
E.cYes.addEventListener('click', () => consentSet('yes')); E.cNo.addEventListener('click', () => consentSet('no'));

/* ---------- teclado global ---------- */
document.addEventListener('keydown', e => {
  const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable) return;
  if (e.key === ' ' && t === document.body){ e.preventDefault(); player.toggle(); }
  else if (e.key.toLowerCase() === 'm') E.pMute.click();
  else if (e.key.toLowerCase() === 'n') nextStation();
});
if ('mediaSession' in navigator){
  navigator.mediaSession.setActionHandler('play', () => player.play()); navigator.mediaSession.setActionHandler('pause', () => player.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => nextStation()); navigator.mediaSession.setActionHandler('previoustrack', () => prevStation());
}
document.addEventListener('pointerdown', () => player.unlock(), { once: true, capture: true });
document.addEventListener('keydown', () => player.unlock(), { once: true, capture: true });


/* ---------- viagem ---------- */
let trip = null;
const km = n => n.toLocaleString('pt-BR') + ' km';
function paintTrip(i){
  E.tripBar.hidden = !i || (i.state === 'off');
  if (!i || i.state === 'off') return;
  const done = i.state === 'done';
  E.tripTitle.textContent = `${i.from.n} → ${i.to.n}`;
  E.tripStop.textContent = done ? `Chegamos a ${i.city.n}, ${i.city.p}.` : i.flyingNow ? `Voando para ${i.next.n}, ${i.next.p}…` : `Parada ${i.i + 1} de ${i.n}: ${i.city.n}, ${i.city.p}`;
  E.tripProg.textContent = done ? 'Viagem concluída.' : `${km(i.kmLeft)} restantes${i.state === 'dwell' ? ` · segue em ${Math.ceil(i.left / 1000)} s` : i.state === 'paused' ? ' · em pausa' : ''}`;
  E.tripFill.style.width = Math.round(Math.max(0, Math.min(1, done ? 1 : i.pct)) * 100) + '%';
  const paused = i.state === 'paused';
  setIcon(E.tripPause, paused ? 'play' : 'pause'); E.tripPause.setAttribute('aria-label', paused ? 'Continuar a viagem' : 'Pausar a viagem'); E.tripPause.disabled = done; E.tripNext.disabled = done;
}
function initTrip(){
  trip = new Trip({ globe, onChange: paintTrip, onArrive: c => { selectCity(c, { fly: false }); } });
  // Estilo mapa: "De" e "Para" com busca de qualquer cidade do mundo; sem "De" vai direto ao destino.
  const P = { from: null, to: null }, IN = { from: E.tripFromQ, to: E.tripToQ };
  let active = 'to', tctl = null, tt = 0, shown = [];
  const label = c => c ? (c.p ? `${c.n}, ${c.p}` : c.n) : '';
  const paintRes = (list, msg) => {
    shown = list; E.tripSt.textContent = msg || '';
    E.tripRes.replaceChildren(...list.map(c => h('li', {}, h('button', { class: 'st-row', type: 'button', onclick: () => choose(c) }, h('span', { class: 't' }, h('b', { text: c.n }), h('small', { text: c.sub || c.p }))))));
  };
  const choose = c => { P[active] = c; IN[active].value = label(c); paintRes([], ''); const other = active === 'to' ? 'from' : 'to'; if (!P[other]) { active = other; IN[other].focus(); } };
  const nearestCity = (lat, lon) => { let b = null, bd = 1e9; for (const c of S.cities){ const d = distKm(lon, lat, c.o, c.a); if (d < bd){ bd = d; b = c; } } return b; };
  const onType = which => {
    active = which; P[which] = null; const v = IN[which].value; clearTimeout(tt); if (tctl) tctl.abort();
    const loc = localMatches(S.cities, v); paintRes(loc, v.trim().length < 2 ? '' : 'Buscando…'); if (v.trim().length < 2) return;
    tt = setTimeout(async () => {
      tctl = new AbortController(); const r = await geocode(v, tctl.signal); if (IN[which].value !== v) return;
      const seen = new Set(), all = [...loc, ...r].filter(c => { const k = norm(c.n) + (c.c || '') + Math.round(c.a); return seen.has(k) ? false : seen.add(k); }).slice(0, 8);
      paintRes(all, all.length ? '' : 'Nenhum lugar encontrado.');
    }, 250);
  };
  for (const w of ['from', 'to']){
    IN[w].addEventListener('input', () => onType(w));
    IN[w].addEventListener('focus', () => { active = w; });
    IN[w].addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); if (shown[0] && !P[w]) choose(shown[0]); else if (P.to) E.tripGo.click(); } });
  }
  E.tripSwap.addEventListener('click', () => { [P.from, P.to] = [P.to, P.from]; E.tripFromQ.value = label(P.from); E.tripToQ.value = label(P.to); paintRes([], ''); });
  E.tripMe.addEventListener('click', () => {
    if (!navigator.geolocation){ E.tripSt.textContent = 'Seu navegador não informa a localização.'; return; }
    E.tripSt.textContent = 'Buscando sua localização…';
    navigator.geolocation.getCurrentPosition(pos => {
      const n = nearestCity(pos.coords.latitude, pos.coords.longitude) || {};
      active = 'from'; choose({ n: 'Minha localização', p: n.p || '', c: n.c || '', z: n.z, t: n.t, a: pos.coords.latitude, o: pos.coords.longitude, dest: true }); E.tripSt.textContent = '';
    }, () => { E.tripSt.textContent = 'Não consegui sua localização. Digite o ponto de partida.'; }, { timeout: 10000, maximumAge: 600000 });
  });
  E.tripBtn.addEventListener('click', () => {
    P.from = S.city || null; P.to = null; E.tripFromQ.value = label(P.from); E.tripToQ.value = ''; paintRes([], ''); active = 'to';
    E.tripDlg.showModal(); E.tripToQ.focus();
  });
  E.tripGo.addEventListener('click', e => {
    const A = P.from, B = P.to;
    if (!B){ e.preventDefault(); E.tripSt.textContent = 'Escolha o destino na lista de sugestões.'; E.tripToQ.focus(); return; }
    if (!A){ trip.active && trip.stop(); player.unlock(); globe.setSpin(false); selectCity(B, { play: true }); return; } // sem partida: viaja direto
    if (A.a === B.a && A.o === B.o){ e.preventDefault(); E.tripSt.textContent = 'Partida e destino são o mesmo lugar.'; return; }
    player.unlock(); trip.start(S.cities, A, B, +E.tripDwell.value);
  });
  E.tripPause.addEventListener('click', () => trip.togglePause());
  E.tripNext.addEventListener('click', () => trip.next());
  E.tripEnd.addEventListener('click', () => { trip.stop(); globe.setSpin(S.opts.spin); });
}

/* ---------- páginas (Sobre, Contato…) dentro do app, para o player continuar tocando ---------- */
const DOC = /^\/(sobre|privacidade|cookies|termos|contato)\.html$/;
const underDoc = () => [document.getElementById('main'), document.querySelector('.site-footer'), E.consent.parentElement, E.consent.parentElement.nextElementSibling].filter(Boolean);
const fitDoc = () => { E.pageView.style.top = Math.ceil(document.querySelector('.site-header').getBoundingClientRect().bottom) + 'px'; };
function setDocOpen(on){ E.pageView.hidden = !on; underDoc().forEach(el => el.toggleAttribute('inert', on)); if (on) fitDoc(); }
addEventListener('resize', () => { if (!E.pageView.hidden) fitDoc(); });
async function openDoc(url, push = true){
  try {
    const u = new URL(url, location.origin), html = await (await fetch(u.pathname)).text(), d = new DOMParser().parseFromString(html, 'text/html'), m = d.querySelector('main.doc');
    if (!m) throw new Error('doc');
    E.pageBody.replaceChildren(document.importNode(m, true)); E.pageBody.firstChild.removeAttribute('id'); document.title = d.title;
    setDocOpen(true); E.pageView.scrollTop = 0; if (push) history.pushState({ doc: u.pathname }, '', u.pathname + u.hash);
    const t = E.pageBody.querySelector('h1'); if (t){ t.tabIndex = -1; t.focus({ preventScroll: true }); }
    if (u.hash){ const el = E.pageBody.querySelector(u.hash); el && el.scrollIntoView(); }
  } catch { location.href = url; }
}
function closeDoc(push = true){
  if (E.pageView.hidden) return;
  setDocOpen(false); E.pageBody.replaceChildren(); document.title = 'WAVE GLOBAL · The world. One frequency.';
  if (push && DOC.test(location.pathname)) history.pushState({}, '', '/');
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const raw = a.getAttribute('href');
  if (raw.startsWith('#') && !E.pageView.hidden){ e.preventDefault(); closeDoc(); const el = raw.length > 1 && document.querySelector(raw); if (el) el.scrollIntoView(); else scrollTo({ top: 0 }); return; }
  const u = new URL(a.href, location.href); if (u.origin !== location.origin) return;
  if (DOC.test(u.pathname)){ e.preventDefault(); openDoc(u.pathname + u.hash); }
  else if (!E.pageView.hidden && (u.pathname === '/' || u.pathname === '/index.html')){ e.preventDefault(); closeDoc(); if (u.hash){ const el = document.querySelector(u.hash); el && el.scrollIntoView(); } else scrollTo({ top: 0 }); }
});
addEventListener('popstate', () => { if (DOC.test(location.pathname)) openDoc(location.pathname + location.hash, false); else closeDoc(false); });


/* ---------- perto de mim ---------- */
// A posição só é lida no navegador, para achar a cidade da lista mais próxima. Nada é enviado nem guardado.
function whereAmI(){ return new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => res(p.coords), rej, { timeout: 12000, maximumAge: 600000 }) : rej(new Error('sem suporte'))); }
async function goNearMe({ play = true } = {}){
  E.geoCta.hidden = true; E.nearBtn.disabled = true; E.globeHint.textContent = 'Procurando você…';
  try {
    const p = await whereAmI(), n = nearestCity(S.cities, p.latitude, p.longitude);
    if (!n) throw new Error('sem cidade');
    store.set('geo', '1'); await selectCity(n.city, { play });
    E.globeHint.textContent = n.km > 60 ? `Cidade da lista mais perto de você: ${n.city.n}, ${n.city.p} (a ${n.km} km).` : `Você está perto de ${n.city.n}, ${n.city.p}.`;
  } catch (e) {
    E.globeHint.textContent = e && e.code === 1 ? 'Sem permissão de localização. Escolha uma cidade no globo.' : 'Não consegui descobrir sua posição. Escolha uma cidade no globo.';
  } finally { E.nearBtn.disabled = false; }
}
// Avisa quando há versão nova, sem recarregar sozinho (recarregar cortaria a rádio). Só atualiza quando a pessoa toca.
function initUpdate(){
  if (!config.version) return;
  let dismissed = false;
  const check = async () => {
    if (dismissed || document.hidden || !E.updBar.hidden) return;
    try { const r = await fetch('/version.json', { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (j && j.v && j.v !== config.version) E.updBar.hidden = false; } catch {}
  };
  E.updBtn.addEventListener('click', () => location.reload());
  E.updX.addEventListener('click', () => { dismissed = true; E.updBar.hidden = true; });
  setInterval(check, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
// Tema claro/escuro (escolha salva neste aparelho; padrão escuro). O globo, o player e a área do globo mantêm o visual escuro.
function setTheme(t, save = true){
  const light = t === 'light'; document.documentElement.dataset.theme = light ? 'light' : 'dark'; if (save) store.set('theme', light ? 'light' : 'dark');
  E.themeBtn.setAttribute('aria-pressed', light); E.themeBtn.setAttribute('aria-label', light ? 'Mudar para tema escuro' : 'Mudar para tema claro'); E.themeBtn.title = E.themeBtn.getAttribute('aria-label');
  E.themeBtn.querySelector('use').setAttribute('href', light ? '#i-moon' : '#i-sun');
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? '#ece8e0' : '#0a0a0a';
}
setTheme(store.get('theme') === 'light' ? 'light' : 'dark', false);
E.themeBtn.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
// Faz o globo caber inteiro na parte realmente visível da tela (entre o cabeçalho e o player), no PC e no celular.
let fitDone = false;
// Banner do AdSense no topo do celular: espaço reservado e altura descontada do globo.
{ const top = document.getElementById('adTop'); if (top && adsEnabled()){ document.documentElement.classList.add('ads-on'); new ResizeObserver(() => document.documentElement.style.setProperty('--adtop-h', Math.ceil(top.getBoundingClientRect().height) + 'px')).observe(top); } }
const setBanner = () => { const w = E.consent.parentElement; document.documentElement.style.setProperty('--banner-h', E.consent.hidden ? '0px' : Math.ceil(w.getBoundingClientRect().height) + 'px'); };
new ResizeObserver(setBanner).observe(E.consent.parentElement); new MutationObserver(setBanner).observe(E.consent, { attributes: true, attributeFilter: ['hidden'] }); setBanner();
const syncPad = () => {
  if (!globe || document.body.classList.contains('bigglobe')) return;
  if (fitDone && scrollY > 2) return;
  if (innerWidth < 768){ const pl0 = E.player ? E.player.getBoundingClientRect().top : innerHeight; globe.setPad(Math.round(innerHeight * .04), Math.max(0, Math.round(innerHeight - pl0)) + 6); fitDone = true; return; }
  const wr = E.globeWrap.getBoundingClientRect(), hd = document.querySelector('.site-header').getBoundingClientRect().bottom, pl = E.player ? E.player.getBoundingClientRect().top : innerHeight;
  const peek = innerWidth < 768 && document.body.classList.contains('has-city') ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h')) || 80) : 0;
  const cta = !E.geoCta.hidden && innerWidth < 1024 && !peek ? E.geoCta.offsetHeight + 56 : 0;
  let t = Math.max(0, hd - wr.top) + 6, b = Math.max(0, wr.bottom - pl) + 30 + cta + peek;
  const room = wr.height - 180; if (t + b > room){ const f = room / (t + b); t *= f; b *= f; }
  globe.setPad(t, b); fitDone = true;
};
async function initGeo(){
  new MutationObserver(syncPad).observe(E.geoCta, { attributes: true, attributeFilter: ['hidden'] }); new MutationObserver(syncPad).observe(document.body, { attributes: true, attributeFilter: ['class'] }); addEventListener('resize', syncPad); addEventListener('load', syncPad); new ResizeObserver(syncPad).observe(document.body); syncPad();
  if (!navigator.geolocation) { E.nearBtn.hidden = true; return; }
  E.nearBtn.addEventListener('click', () => { player.unlock(); goNearMe(); });
  E.geoBtn.addEventListener('click', () => { player.unlock(); goNearMe(); });
  E.geoSkip.addEventListener('click', () => { E.geoCta.hidden = true; store.set('geoNo', '1'); });
  let st = 'prompt'; try { st = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch {}
  if (new URLSearchParams(location.search).get('q')) return;
  if (st === 'granted') goNearMe();
  else if (st === 'prompt' && !store.get('geoNo')) E.geoCta.hidden = false;
}

/* ---------- início ---------- */
async function boot(){
  initI18n();
  const vol = store.get('vol', 0.8); E.pVol.value = vol; player.setVolume(vol); player.setMuted(store.get('muted', false)); paintMute(); paintPlayer(); refreshFavUI();
  let raw = await (await fetch('/assets/cities.json')).json(); const base0 = raw.length;
  try { const r = await fetch('/assets/cities-extra.json'); if (r.ok) raw = mergeCities(raw, await r.json()); } catch {}
  S.baseN = base0; S.cities = raw; for (const c of raw){ if (!S.byCC.has(c.c)) S.byCC.set(c.c, []); S.byCC.get(c.c).push(c); }
  const names = new Map(); for (const c of raw){ const k = names.get(c.c) || { c: c.c, p: c.p, t: c.t, count: 0 }; k.count++; names.set(c.c, k); }
  S.countries = [...names.values()].sort((a, b) => a.p.localeCompare(b.p, 'pt'));
  E.countrySel.append(...S.countries.map(c => h('option', { value: c.c, text: c.p }))); setLang(getLang());
  paintVisited(); const last = store.get('city'); if (last){ const [n, cc] = String(last).split('|'); S.city = (S.byCC.get(cc) || []).find(c => c.n === n) || null; }
  if (S.city){ E.locFlag.hidden = false; E.locFlag.src = flagUrl(S.city.c); E.locCity.textContent = S.city.n; E.locCountry.textContent = S.city.p; E.clock.hidden = false; paintClock(); }
  initGlobe(); globe && globe.setNight(S.opts.night !== false); initTrip(); initGeo(); initUpdate(); if (matchMedia('(min-width:768px)').matches) initAdCarousel(E.adCar);
  S.slugs = citySlugs(raw); S.bySlug = new Map([...S.slugs].map(([c, sl]) => [sl, c]));
  const qp = new URLSearchParams(location.search), q = qp.get('q'); if (q){ E.q.value = q; doSearch(); }
  const dc = S.bySlug.get(String(qp.get('c') || '').toLowerCase()), dr = qp.get('r'), dp = String(qp.get('pais') || '').toUpperCase();
  if (dr && /^[0-9a-f-]{20,40}$/i.test(dr)) radio.byId(dr).then(st => { if (st) { const c = locate(st); if (c) selectCity(c, { play: false }); playStation(st); } else if (dc) selectCity(dc, { play: true }); });
  else if (dc) setTimeout(() => selectCity(dc, { play: true }), 400);
  else if (dp && S.byCC.has(dp)) setTimeout(() => goCountry(dp, true), 400);
  // descoberta só quando a seção se aproxima da tela
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting){ io.disconnect(); renderTab(); } }, { rootMargin: '400px' });
  io.observe(document.getElementById('descobrir'));
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1200));
  idle(() => { mountAds(); if (!store.get('consent') && (adsEnabled() || new URLSearchParams(location.search).has('adpreview'))) consentOpen(); }, { timeout: 4000 });
  if (new URLSearchParams(location.search).has('teste')) window.__wg = { S, player, globe, trip, goNearMe, selectCity, playStation, randomCity, renderTab, radio };
}
boot().catch(e => { E.gridStatus.textContent = 'Não foi possível carregar os dados do site. Recarregue a página.'; console.error(e); });
