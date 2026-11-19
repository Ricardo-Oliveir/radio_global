/* WAVE GLOBAL · diretório de rádios (Radio Browser), motor de áudio e armazenamento local */
(function(){
'use strict';
const W = window.WAVE = window.WAVE || {};

/* ---------- Eventos simples ---------- */
const handlers = {};
W.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
W.emit = (ev, ...a) => (handlers[ev] || []).forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } });

/* ---------- Armazenamento local ---------- */
W.store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ---------- API do diretório ---------- */
const HOSTS = ['https://all.api.radio-browser.info', 'https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
let hostI = 0;
async function getJSON(path, ms = 9000){
  for (let k = 0; k < HOSTS.length; k++){
    const i = (hostI + k) % HOSTS.length, ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(HOSTS[i] + path, {signal:ctl.signal}); clearTimeout(to);
      if (!r.ok) continue;
      hostI = i; return await r.json();
    } catch { clearTimeout(to); }
  }
  return null;
}
const qstr = o => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const BASE = {hidebroken:'true', is_https:'true', order:'clickcount', reverse:'true'};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
W.norm = norm;

const okRaw = s => s && s.name && s.stationuuid && s.url_resolved && /^https:\/\//i.test(s.url_resolved) && s.lastcheckok !== 0;
function toStation(s){
  return {
    id:s.stationuuid, name:String(s.name).trim().replace(/\s+/g, ' '), url:s.url_resolved,
    favicon:/^https:\/\//i.test(s.favicon || '') ? s.favicon : '',
    cc:String(s.countrycode || '').toUpperCase(), country:s.country || '', state:s.state || '',
    tags:String(s.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 6),
    codec:s.codec || '', bitrate:+s.bitrate || 0, hls:s.hls === 1,
    lat:typeof s.geo_lat === 'number' ? s.geo_lat : null, lon:typeof s.geo_long === 'number' ? s.geo_long : null
  };
}
function uniq(list){ const seen = new Set(); return list.filter(s => { if (!okRaw(s) || seen.has(s.url_resolved)) return false; seen.add(s.url_resolved); return true; }); }
async function search(params, limit = 36){
  const raw = await getJSON('/json/stations/search?' + qstr({...BASE, ...params, limit}));
  return raw ? uniq(raw).map(toStation) : null;
}
const topShuffle = (list, n = 5) => W.shuffle(list.slice(0, n)).concat(list.slice(n));

/* Rádios de uma cidade: nome da cidade → até 80 km → populares do país */
const cityCache = new Map();
async function findForCity(city){
  const n = norm(city.nome), cc = city.cc;
  const [byName, byState] = await Promise.all([
    getJSON('/json/stations/search?' + qstr({...BASE, countrycode:cc, name:city.nome, limit:60})),
    getJSON('/json/stations/search?' + qstr({...BASE, countrycode:cc, state:city.nome, limit:60}))
  ]);
  let list = uniq([...(byName || []).filter(s => norm(s.name).includes(n) || norm(s.state) === n), ...(byState || []).filter(s => norm(s.state) === n)]);
  if (list.length) return {mode:'city', list:topShuffle(list.map(toStation))};
  const geo = await getJSON('/json/stations/search?' + qstr({...BASE, has_geo_info:'true', geo_lat:city.lat, geo_long:city.lon, geo_distance:80000, limit:40}));
  list = uniq(geo || []);
  if (list.length) return {mode:'near', list:topShuffle(list.map(toStation))};
  const top = await getJSON('/json/stations/search?' + qstr({...BASE, countrycode:cc, limit:40}));
  list = uniq(top || []);
  return {mode:list.length ? 'country' : 'none', list:topShuffle(list.map(toStation))};
}
const stationsForCity = city => { if (!cityCache.has(city)) cityCache.set(city, findForCity(city)); return cityCache.get(city); };

const CATEGORIES = [
  {id:'music', nome:'Música', icon:'i-music', tags:['music']},
  {id:'news', nome:'Notícias', icon:'i-news', tags:['news']},
  {id:'sports', nome:'Esportes', icon:'i-sport', tags:['sports']},
  {id:'culture', nome:'Cultura', icon:'i-culture', tags:['culture']},
  {id:'entertainment', nome:'Entretenimento', icon:'i-mic', tags:['entertainment', 'talk']},
  {id:'religion', nome:'Religião', icon:'i-pray', tags:['religion', 'christian']}
];
const GENRES = [
  {id:'pop', nome:'Pop', tags:['pop']}, {id:'rock', nome:'Rock', tags:['rock']}, {id:'jazz', nome:'Jazz', tags:['jazz']},
  {id:'classical', nome:'Clássica', tags:['classical']}, {id:'electronic', nome:'Eletrônica', tags:['electronic', 'dance']},
  {id:'hiphop', nome:'Hip hop', tags:['hip hop', 'rap']}, {id:'reggae', nome:'Reggae', tags:['reggae']},
  {id:'latin', nome:'Latina', tags:['latin']}, {id:'country', nome:'Country', tags:['country']}, {id:'sertanejo', nome:'Sertanejo', tags:['sertanejo']}
];
function mergeInterleave(lists, max){
  const out = [], seen = new Set(); let i = 0;
  while (out.length < max && lists.some(l => i < l.length)){ for (const l of lists){ const s = l[i]; if (s && !seen.has(s.id)){ seen.add(s.id); out.push(s); } } i++; }
  return out.slice(0, max);
}
W.api = {
  popular: (n = 36) => search({}, n),
  byCountry: (cc, n = 36) => search({countrycode:cc}, n),
  byTags: async (tags, extra = {}, n = 36) => { const r = await Promise.all(tags.map(t => search({tag:t, tagExact:'true', ...extra}, n))); return r.every(x => x === null) ? null : mergeInterleave(r.map(x => x || []), n); },
  byContinent: async (cont, n = 36) => {
    const ccs = W.COUNTRIES.filter(c => c.cont === cont).sort((a, b) => b.n - a.n).slice(0, 10);
    const r = await Promise.all(ccs.map(c => search({countrycode:c.cc}, 6)));
    return r.every(x => x === null) ? null : mergeInterleave(r.map(x => x || []), n);
  },
  byName: (q, n = 24) => search({name:q}, n),
  similar: async (st, n = 8) => {
    const tag = st.tags.find(t => t.length > 2); if (!tag) return [];
    let r = await search({tag, tagExact:'true', countrycode:st.cc}, n + 2) || [];
    r = r.filter(s => s.id !== st.id);
    if (r.length < 4){ const more = (await search({tag, tagExact:'true'}, n + 2) || []).filter(s => s.id !== st.id); r = mergeInterleave([r, more], n); }
    return r.slice(0, n);
  },
  forCity: stationsForCity, CATEGORIES, GENRES
};

/* ---------- Favoritos e histórico ---------- */
const lite = s => ({id:s.id, name:s.name, url:s.url, favicon:s.favicon, cc:s.cc, country:s.country, state:s.state, tags:s.tags, codec:s.codec, bitrate:s.bitrate, hls:s.hls, lat:s.lat, lon:s.lon});
let favs = W.store.get('wave.fav', []), hist = W.store.get('wave.hist', []);
W.fav = {
  list: () => favs.slice(), has: id => favs.some(s => s.id === id),
  toggle(s){ if (W.fav.has(s.id)) favs = favs.filter(x => x.id !== s.id); else favs = [lite(s), ...favs].slice(0, 200); W.store.set('wave.fav', favs); W.emit('favs'); return W.fav.has(s.id); }
};
W.hist = {
  list: () => hist.slice(),
  add(s){ hist = [lite(s), ...hist.filter(x => x.id !== s.id)].slice(0, 30); W.store.set('wave.hist', hist); W.emit('hist'); },
  clear(){ hist = []; W.store.set('wave.hist', hist); W.emit('hist'); }
};

/* ---------- Áudio: um único elemento, nunca duas rádios ao mesmo tempo ---------- */
const audio = new Audio(); audio.preload = 'none';
let seq = 0, state = 'idle', station = null, hlsLib = null, hlsObj = null, vol = 0.8, muted = false, watchT = null;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
function loadHls(){
  return hlsLib || (hlsLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
}
function setState(s){ state = s; W.emit('audio', {state, station}); }
function applyVol(){ audio.volume = vol; audio.muted = muted; }
function halt(){
  clearTimeout(watchT); audio.onerror = audio.onended = audio.onwaiting = audio.onstalled = audio.onplaying = null; audio.pause();
  if (hlsObj){ try { hlsObj.destroy(); } catch {} hlsObj = null; }
  audio.removeAttribute('src'); try { audio.load(); } catch {}
}
/* tenta tocar a estação: resolve true quando o som começa, false em erro ou depois do tempo limite */
function attempt(st, my, ms){
  return new Promise(res => {
    halt(); applyVol();
    let done = false;
    const fin = ok => { if (done) return; done = true; clearTimeout(tm); audio.onplaying = audio.onerror = null; res(ok && my === seq); };
    const tm = setTimeout(() => fin(false), ms);
    audio.onplaying = () => fin(true); audio.onerror = () => fin(false);
    if ((st.hls || /\.m3u8(\?|$)/i.test(st.url)) && !audio.canPlayType('application/vnd.apple.mpegurl')){
      loadHls().then(() => {
        if (done || my !== seq) return;
        if (window.Hls && Hls.isSupported()){ hlsObj = new Hls(); hlsObj.loadSource(st.url); hlsObj.attachMedia(audio); hlsObj.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) fin(false); }); audio.play().catch(() => {}); }
        else fin(false);
      }).catch(() => fin(false));
    } else { audio.src = st.url; audio.play().catch(() => {}); }
  });
}
function watch(st, my){
  const trouble = () => {
    if (my !== seq || state !== 'live') return;
    clearTimeout(watchT);
    watchT = setTimeout(() => { if (my === seq && (audio.paused || audio.readyState < 3)) reconnect(st, my); }, 12000);
  };
  audio.onwaiting = audio.onstalled = trouble;
  audio.onplaying = () => { clearTimeout(watchT); if (my === seq && state === 'reconnecting') setState('live'); };
  audio.onerror = audio.onended = () => reconnect(st, my);
}
async function reconnect(st, my){
  if (my !== seq || state === 'reconnecting') return;
  setState('reconnecting');
  for (let i = 0; i < 2; i++){
    await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    if (my !== seq) return;
    if (await attempt(st, my, 9000)){ if (my === seq){ setState('live'); watch(st, my); } return; }
  }
  if (my === seq){ halt(); setState('error'); W.emit('fail', st); }
}
W.audio = {
  get state(){ return state; }, get station(){ return station; }, get volume(){ return vol; }, get muted(){ return muted; },
  unlock(){ if (state === 'idle'){ try { audio.src = SILENT; audio.play().catch(() => {}); } catch {} } },
  async play(st){
    const my = ++seq; station = st; setState('loading');
    const ok = await attempt(st, my, 9000);
    if (my !== seq) return false;
    if (ok){ setState('live'); watch(st, my); W.hist.add(st); return true; }
    halt(); setState('error'); return false;
  },
  pause(){ if (!station) return; seq++; halt(); setState('paused'); },
  resume(){ return station ? W.audio.play(station) : false; },
  toggle(){ return (state === 'live' || state === 'loading' || state === 'reconnecting') ? W.audio.pause() : W.audio.resume(); },
  stop(){ seq++; halt(); station = null; setState('idle'); },
  setVolume(v){ vol = Math.max(0, Math.min(1, v)); applyVol(); },
  setMuted(m){ muted = !!m; applyVol(); }
};
})();
