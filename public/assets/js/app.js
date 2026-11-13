import { $, $$, h, icon, store, norm, debounce, flagUrl, shuffle, distKm } from './util.js';
import * as radio from './radio.js';
import { Player } from './player.js';
import { Globe } from './globe.js';
import { clockInfo } from './clock.js';
import { mountAds, applyConsent, adsEnabled } from './ads.js';
import config from './config.js';

const player = new Player();
const S = {
  cities: [], byCC: new Map(), countries: [], city: null, station: null, queue: [], qi: 0, sel: 0,
  nav: [], ni: -1, seen: new Set(), favs: store.get('favs', []), history: store.get('history', []),
  opts: Object.assign({ auto: false, mins: 5, spin: matchMedia('(hover:hover) and (pointer:fine)').matches }, store.get('opts', {})), reg: new Map(), tab: 'pop', tabArg: {}, autoT: 0
};
const E = {};
for (const id of ['menuBtn', 'nav', 'q', 'searchForm', 'searchPanel', 'globe', 'globeWrap', 'globePoster', 'globeHint', 'zIn', 'zOut', 'randomBtn', 'countrySel', 'fullBtn', 'locFlag', 'locCity', 'locCountry', 'clock', 'clockTime', 'clockDn', 'clockWeek', 'clockDate', 'clockTz', 'locStations', 'locNote', 'stList', 'otherBtn', 'similarBox', 'similarList', 'filters', 'grid', 'gridStatus', 'favGrid', 'favEmpty', 'favCount', 'assistente', 'aiForm', 'aiQ', 'aiStatus', 'aiGrid', 'pLogo', 'pName', 'pMeta', 'pLive', 'pPrev', 'pPlay', 'pNext', 'pOther', 'pFav', 'pMute', 'pVol', 'pQuality', 'pOpts', 'pStatus', 'optsDlg', 'optAuto', 'optMins', 'optSpin', 'optClear', 'consent', 'cYes', 'cNo', 'consentBtn', 'player', 'year'])
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
function row(st, current){
  reg(st);
  return h('li', {}, h('button', { class: 'st-row', type: 'button', dataset: { act: 'play', id: st.id }, 'aria-current': current ? 'true' : null },
    logo(st), h('span', { class: 't' }, h('b', { text: st.name }), h('small', { text: subline(st) || 'Dados não informados' }))));
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
  E.pName.textContent = st ? st.name : 'Escolha uma estação';
  E.pMeta.textContent = st ? ([S.city ? cityLabel(S.city) : '', st.codec && st.bitrate ? `${st.codec} ${st.bitrate} kbps` : ''].filter(Boolean).join(' · ') || subline(st)) : 'Toque no globo ou na lista de descoberta';
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
E.otherBtn.addEventListener('click', () => otherStation());

async function tryQueue(cands, from = 0, max = 6){
  for (let k = 0; k < Math.min(max, cands.length); k++){
    const i = (from + k) % cands.length, st = cands[i];
    S.station = reg(st); paintPlayer(); status(`Sintonizando ${st.name}…`);
    const ok = await player.load(st);
    if (S.station !== st) return false;
    if (ok){ S.qi = i; onStarted(st); return true; }
  }
  status('Nenhuma estação respondeu agora. Tente outra cidade.', true);
  return false;
}
function onStarted(st){
  status(''); pushHistory(st); paintPlayer(); armAuto();
  if (!S.navMove){ S.nav = S.nav.slice(0, S.ni + 1); S.nav.push({ city: S.city, st }); S.ni = S.nav.length - 1; }
  loadSimilar(st);
}
async function playStation(st){
  player.unlock(); S.navMove = false;
  S.station = reg(st); paintPlayer(); status(`Sintonizando ${st.name}…`);
  const inList = S.queue.findIndex(s => s.id === st.id); if (inList >= 0) S.qi = inList;
  if (inList < 0){ const c = locate(st); if (c && c !== S.city) selectCity(c, { play: false }); }
  const ok = await player.load(st);
  if (S.station !== st) return;
  if (ok) onStarted(st); else status('Esta estação não respondeu. Tente outra.', true);
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
async function nextStation(){
  player.unlock();
  if (S.ni < S.nav.length - 1){ S.ni++; return replay(S.nav[S.ni]); }
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
let clockT = 0;
function paintClock(){
  const c = S.city; if (!c) return;
  const k = clockInfo(c.z, c.a, c.o);
  E.clockTime.textContent = k.time; E.clockWeek.textContent = k.weekday.charAt(0).toUpperCase() + k.weekday.slice(1); E.clockDate.textContent = k.date; E.clockTz.textContent = k.tzLabel;
  E.clockDn.classList.toggle('night', !k.isDay); E.clockDn.replaceChildren(icon(k.isDay ? 'sun' : 'moon'), h('span', { text: k.isDay ? 'Dia' : 'Noite' }));
}
setInterval(paintClock, 1000);
const NOTES = { city: 'Estações com o nome desta cidade.', near: 'Estações cadastradas até 80 km daqui.', country: 'Sem estação cadastrada na cidade. Mostrando as mais ouvidas do país.', none: 'Nenhuma estação cadastrada para este local.' };
async function selectCity(c, { play = true, fly = true, keepList = false } = {}){
  S.city = c; const tok = ++S.sel; S.seen.add(c);
  globe && (globe.setSelected(c), fly && globe.flyTo(c));
  E.locFlag.hidden = false; E.locFlag.src = flagUrl(c.c); E.locCity.textContent = c.n; E.locCountry.textContent = c.p;
  E.clock.hidden = false; paintClock(); store.set('city', c.n + '|' + c.c);
  E.globeHint.textContent = `${c.n}, ${c.p}. ${play ? 'Buscando a rádio…' : ''}`;
  if (!keepList){ E.locStations.hidden = false; E.locNote.textContent = 'Buscando estações…'; E.stList.replaceChildren(); }
  const info = await radio.forCity(c); if (tok !== S.sel) return;
  if (!keepList){
    S.queue = info.cands; S.qi = Math.max(0, info.cands.findIndex(s => S.station && s.id === S.station.id));
    E.locNote.textContent = NOTES[info.mode]; E.stList.replaceChildren(...info.cands.slice(0, 8).map(s => row(s, S.station && S.station.id === s.id)));
    E.otherBtn.hidden = info.cands.length < 2;
  }
  E.globeHint.textContent = `${c.n}, ${c.p}.`;
  if (play){ if (!info.cands.length){ status('Nenhuma estação cadastrada para este local.', true); S.station = null; player.stop(); paintPlayer(); return; } S.navMove = false; await tryQueue(info.cands, 0); }
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
  S.autoT = setTimeout(() => { if (player.state === 'playing') randomCity(); else armAuto(); }, S.opts.mins * 60000);
}

/* ---------- globo ---------- */
let globe = null;
function initGlobe(){
  globe = new Globe(E.globe, E.globeWrap, S.cities, {
    onSelect: c => { player.unlock(); selectCity(c); },
    onHover: c => { if (c) E.globeHint.textContent = `${c.n}, ${c.p}. Toque para ouvir.`; else if (S.city) E.globeHint.textContent = `${S.city.n}, ${S.city.p}.`; },
    onMiss: () => { E.globeHint.textContent = 'Nenhuma cidade perto desse ponto. Gire o globo ou aproxime.'; },
    onFirstDraw: () => E.globePoster.classList.add('off')
  });
  globe.setSpin(S.opts.spin);
  if (S.city) { globe.setSelected(S.city); globe.flyTo(S.city, 1.5, 1); }
  const idle = window.requestIdleCallback || (f => setTimeout(f, 600));
  idle(() => globe.loadMap(), { timeout: 2500 });
}
E.zIn.addEventListener('click', () => globe && globe.zoom(1.3));
E.zOut.addEventListener('click', () => globe && globe.zoom(.77));
E.fullBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); });
document.addEventListener('fullscreenchange', () => { const f = !!document.fullscreenElement; E.fullBtn.setAttribute('aria-label', f ? 'Sair da tela cheia' : 'Tela cheia'); });
E.countrySel.addEventListener('change', () => { const cc = E.countrySel.value; if (!cc) return; goCountry(cc, true); E.countrySel.value = ''; });
function centroidCity(cc){
  const l = S.byCC.get(cc) || []; if (!l.length) return null;
  const a = l.reduce((s, c) => s + c.a, 0) / l.length, o = l.reduce((s, c) => s + c.o, 0) / l.length;
  return l.reduce((b, c) => (distKm(o, a, c.o, c.a) < distKm(o, a, b.o, b.a) ? c : b), l[0]);
}
function goCountry(cc, play){ const c = centroidCity(cc); if (!c) return; player.unlock(); if (play) selectCity(c); else globe && globe.flyTo(c, 2); }

/* ---------- descoberta ---------- */
const CATS = [['news', 'Notícias'], ['sports', 'Esportes'], ['music', 'Música'], ['culture', 'Cultura'], ['entertainment', 'Entretenimento'], ['religion', 'Religião']];
const GENRES = [['pop', 'Pop'], ['rock', 'Rock'], ['jazz', 'Jazz'], ['classical', 'Clássica'], ['hip hop', 'Hip hop'], ['electronic', 'Eletrônica'], ['reggae', 'Reggae'], ['latin', 'Latina'], ['country', 'Country'], ['talk', 'Conversa']];
const CONTS = [['sa', 'América do Sul'], ['na', 'América do Norte e Central'], ['eu', 'Europa'], ['af', 'África'], ['as', 'Ásia'], ['oc', 'Oceania']];
const chips = (items, cur, onPick) => items.map(([v, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v === cur), onclick: () => onPick(v) }, l));
const countryOptions = cur => [h('option', { value: '', text: 'Escolha um país' }), ...S.countries.map(c => h('option', { value: c.c, text: c.p, selected: c.c === cur }))];
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
    const cur = a.tag || 'news';
    E.filters.append(h('div', { class: 'filters', style: 'margin:0;width:100%' }, chips([...CATS, ...GENRES], cur, v => { S.tabArg = { tag: v }; renderTab(); })));
    showStations(radio.byTag(cur), 'Sem estações para esta categoria.');
  } else if (t === 'country'){
    const sel = h('select', { 'aria-label': 'País', onchange: e => { S.tabArg = { cc: e.target.value, tag: S.tabArg.tag }; renderTab(); } }, countryOptions(a.cc));
    const tag = h('select', { 'aria-label': 'Categoria', onchange: e => { S.tabArg = { cc: S.tabArg.cc, tag: e.target.value }; renderTab(); } }, h('option', { value: '', text: 'Todas as categorias' }), [...CATS, ...GENRES].map(([v, l]) => h('option', { value: v, text: l, selected: v === a.tag })));
    E.filters.append(sel, tag);
    if (a.cc){ const c = centroidCity(a.cc); if (c && globe) globe.flyTo(c, 2); showStations(radio.byCountry(a.cc, a.tag), 'Sem estações para este filtro.'); } else { E.gridStatus.textContent = 'Escolha um país para ver as estações.'; E.grid.replaceChildren(); }
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
const closeSearch = () => { E.searchPanel.hidden = true; };
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
  if (cities.length){ out.push(h('h3', { text: 'Cidades' })); cities.forEach(c => out.push(h('button', { class: 'sp-item', type: 'button', onclick: () => { closeSearch(); player.unlock(); selectCity(c); document.getElementById('globo').scrollIntoView({ behavior: 'smooth' }); } }, h('img', { class: 'flag', src: flagUrl(c.c), alt: '', width: 24, height: 18 }), h('span', {}, c.n, h('small', { text: c.p }))))); }
  if (countries.length){ out.push(h('h3', { text: 'Países' })); countries.forEach(c => out.push(h('button', { class: 'sp-item', type: 'button', onclick: () => { closeSearch(); S.tab = 'country'; S.tabArg = { cc: c.c }; renderTab(); goCountry(c.c, false); document.getElementById('descobrir').scrollIntoView({ behavior: 'smooth' }); } }, h('img', { class: 'flag', src: flagUrl(c.c), alt: '', width: 24, height: 18 }), h('span', {}, c.p, h('small', { text: `${c.count} cidades` }))))); }
  if (sts === null) out.push(h('p', { class: 'sp-empty', text: 'Buscando estações…' }));
  else if (sts.length){ out.push(h('h3', { text: 'Estações' })); sts.forEach(s => { reg(s); out.push(h('button', { class: 'sp-item', type: 'button', onclick: () => { closeSearch(); playStation(s); } }, logo(s), h('span', {}, s.name, h('small', { text: subline(s) })))); }); }
  if (!out.length || (sts && !sts.length && !cities.length && !countries.length)) return [h('p', { class: 'sp-empty', text: 'Nada encontrado. Tente outro nome.' })];
  return out;
}
E.q.addEventListener('input', doSearch);
E.searchForm.addEventListener('submit', e => { e.preventDefault(); const b = E.searchPanel.querySelector('.sp-item'); if (b) b.click(); else doSearch(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
document.addEventListener('click', e => { if (!e.target.closest('.search-panel, .search')) closeSearch(); });

/* ---------- assistente (somente se o servidor tiver IA configurada) ---------- */
async function initAI(){
  const { aiEnabled, suggest } = await import('./ai.js');
  if (!(await aiEnabled())) return;
  E.assistente.hidden = false;
  E.aiForm.addEventListener('submit', async e => {
    e.preventDefault(); const p = E.aiQ.value.trim(); if (p.length < 3) return;
    E.aiStatus.textContent = 'Procurando estações reais para o seu pedido…'; E.aiGrid.replaceChildren();
    try {
      const r = await suggest(p);
      E.aiStatus.textContent = r.picks.length ? 'Sugestões baseadas só nos dados das estações:' : (r.note || 'Não encontrei boas opções. Tente descrever de outro jeito.');
      E.aiGrid.replaceChildren(...r.picks.map(x => card(x.station, x.why)));
    } catch { E.aiStatus.textContent = 'O assistente não respondeu agora. Tente de novo em instantes.'; }
  });
}

/* ---------- opções e consentimento ---------- */
E.pOpts.addEventListener('click', () => { E.optAuto.checked = S.opts.auto; E.optMins.value = String(S.opts.mins); E.optSpin.checked = S.opts.spin; E.optsDlg.showModal(); });
const saveOpts = () => { S.opts = { auto: E.optAuto.checked, mins: +E.optMins.value, spin: E.optSpin.checked }; store.set('opts', S.opts); globe && globe.setSpin(S.opts.spin); armAuto(); };
[E.optAuto, E.optMins, E.optSpin].forEach(el => el.addEventListener('change', saveOpts));
E.optClear.addEventListener('click', () => { store.clear(); S.favs = []; S.history = []; refreshFavUI(); renderTab(); E.optClear.textContent = 'Dados apagados'; });
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

/* ---------- início ---------- */
async function boot(){
  const vol = store.get('vol', 0.8); E.pVol.value = vol; player.setVolume(vol); player.setMuted(store.get('muted', false)); paintMute(); paintPlayer(); refreshFavUI();
  const raw = await (await fetch('/assets/cities.json')).json();
  S.cities = raw; for (const c of raw){ if (!S.byCC.has(c.c)) S.byCC.set(c.c, []); S.byCC.get(c.c).push(c); }
  const names = new Map(); for (const c of raw){ const k = names.get(c.c) || { c: c.c, p: c.p, t: c.t, count: 0 }; k.count++; names.set(c.c, k); }
  S.countries = [...names.values()].sort((a, b) => a.p.localeCompare(b.p, 'pt'));
  E.countrySel.append(...S.countries.map(c => h('option', { value: c.c, text: c.p })));
  const last = store.get('city'); if (last){ const [n, cc] = String(last).split('|'); S.city = (S.byCC.get(cc) || []).find(c => c.n === n) || null; }
  if (S.city){ E.locFlag.hidden = false; E.locFlag.src = flagUrl(S.city.c); E.locCity.textContent = S.city.n; E.locCountry.textContent = S.city.p; E.clock.hidden = false; paintClock(); }
  initGlobe();
  const q = new URLSearchParams(location.search).get('q'); if (q){ E.q.value = q; doSearch(); }
  // descoberta só quando a seção se aproxima da tela
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting){ io.disconnect(); renderTab(); } }, { rootMargin: '400px' });
  io.observe(document.getElementById('descobrir'));
  initAI();
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1200));
  idle(() => { mountAds(); if (!store.get('consent') && (adsEnabled() || new URLSearchParams(location.search).has('adpreview'))) consentOpen(); }, { timeout: 4000 });
  if (new URLSearchParams(location.search).has('teste')) window.__wg = { S, player, globe, selectCity, playStation, randomCity, renderTab, radio };
}
boot().catch(e => { E.gridStatus.textContent = 'Não foi possível carregar os dados do site. Recarregue a página.'; console.error(e); });
