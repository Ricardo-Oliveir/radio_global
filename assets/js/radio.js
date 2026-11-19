import config from './config.js';
// Cliente do diretório Radio Browser (dados reais). Nada aqui é inventado: o que não vem da API não aparece.
import { norm, shuffle, distKm } from './util.js';
const HOSTS = ['https://all.api.radio-browser.info', 'https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
let hostI = 0;
const cache = new Map();
async function getJSON(path, ms = 9000){
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < 300000) return hit.v;
  for (let k = 0; k < HOSTS.length; k++){
    const i = (hostI + k) % HOSTS.length, ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(HOSTS[i] + path, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) continue;
      const v = await r.json(); hostI = i; cache.set(path, { t: Date.now(), v }); return v;
    } catch { clearTimeout(to); }
  }
  return null;
}
const q = o => Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
const PROXY = /^https:\/\//.test(config.streamProxy || '');
const BASE = { hidebroken: 'true', ...(PROXY ? {} : { is_https: 'true' }), order: 'clickcount', reverse: 'true' };
export function station(s){
  const url = s.url_resolved || s.url || '';
  return {
    id: s.stationuuid, name: String(s.name || '').trim(), url, cc: s.countrycode || '', country: s.country || '', state: s.state || '',
    favicon: /^https:\/\//i.test(s.favicon || '') ? s.favicon : '', tags: String(s.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 5),
    codec: s.codec || '', bitrate: +s.bitrate || 0, hls: s.hls ? 1 : 0, lat: s.geo_lat ?? null, lon: s.geo_long ?? null, language: s.language || ''
  };
}
const ok = s => s && s.name && s.url_resolved && (/^https:\/\//i.test(s.url_resolved) || (PROXY && /^http:\/\//i.test(s.url_resolved) && !/\.m3u8(\?|$)/i.test(s.url_resolved))) && s.lastcheckok !== 0;
const clean = list => { const seen = new Set(); return (list || []).filter(s => { if (!ok(s) || seen.has(s.url_resolved)) return false; seen.add(s.url_resolved); return true; }).map(station); };
const search = async (p, limit = 24) => clean(await getJSON('/json/stations/search?' + q({ ...BASE, ...p, limit })));
export const top = (n = 24) => search({}, n);
const merge = lists => { const seen = new Set(); return lists.flat().filter(s => !seen.has(s.id) && seen.add(s.id)); };
export const byCountry = async (cc, tag, n = 30) => { const tags = [].concat(tag || []); if (tags.length < 2) return search({ countrycode: cc, tag: tags[0] || '', tagExact: tags[0] ? 'true' : '' }, n); return merge(await Promise.all(tags.map(t => search({ countrycode: cc, tag: t, tagExact: 'true' }, n)))).slice(0, n); };
export const byTag = async (tag, n = 30) => { const tags = [].concat(tag); return merge(await Promise.all(tags.map(t => search({ tag: t, tagExact: 'true' }, n)))).slice(0, n); };
export const byName = (name, n = 8) => search({ name }, n);
export const byFilters = (f, n = 40) => search({ tag: (f.tags || [])[0] || '', tagExact: (f.tags || []).length ? 'true' : '', countrycode: f.countrycode || '', language: f.language || '', name: f.name || '' }, n);
export async function similar(st, n = 6){
  const tag = st.tags.find(t => t.length > 2); if (!tag) return [];
  return (await search({ tag, tagExact: 'true', countrycode: st.cc }, n + 4)).filter(s => s.id !== st.id).slice(0, n);
}
// Estações para uma cidade: nome da cidade → até 80 km → populares do país. O "modo" diz qual caso foi.
export async function forCity(city){
  const n = norm(city.n);
  const [byN, byS] = await Promise.all([
    getJSON('/json/stations/search?' + q({ ...BASE, countrycode: city.c, name: city.n, limit: 60 })),
    getJSON('/json/stations/search?' + q({ ...BASE, countrycode: city.c, state: city.n, limit: 60 }))
  ]);
  let list = clean([...(byN || []).filter(s => norm(s.name).includes(n) || norm(s.state) === n), ...(byS || []).filter(s => norm(s.state) === n)]);
  if (list.length) return { mode: 'city', cands: topShuffle(list) };
  list = await search({ has_geo_info: 'true', geo_lat: city.a, geo_long: city.o, geo_distance: 80000 }, 40);
  if (list.length) return { mode: 'near', cands: topShuffle(list) };
  list = await search({ countrycode: city.c }, 40);
  return { mode: list.length ? 'country' : 'none', cands: topShuffle(list) };
}
const topShuffle = list => shuffle(list.slice(0, 5)).concat(list.slice(5));

// Destino qualquer (viagem): nome da cidade no país → rádios por proximidade em 10/30/75/150 km. Nunca apresenta rádio vizinha como da cidade.
export async function forPlace(place){
  const withD = l => l.map(s => ({ ...s, dist: s.lat != null && s.lon != null ? distKm(place.o, place.a, +s.lon, +s.lat) : null }));
  if (place.c){
    const n = norm(place.n);
    const [byN, byS] = await Promise.all([
      getJSON('/json/stations/search?' + q({ ...BASE, countrycode: place.c, name: place.n, limit: 60 })),
      getJSON('/json/stations/search?' + q({ ...BASE, countrycode: place.c, state: place.n, limit: 60 }))
    ]);
    const l = withD(clean([...(byN || []).filter(s => norm(s.name).includes(n) || norm(s.state) === n), ...(byS || []).filter(s => norm(s.state) === n)]));
    if (l.length) return { mode: 'city', cands: topShuffle(l) };
  }
  const geo = d => search({ has_geo_info: 'true', geo_lat: place.a, geo_long: place.o, geo_distance: d * 1000 }, d > 40 ? 80 : 60);
  const [near, far] = await Promise.all([geo(30), geo(150)]);
  const seen = new Set(), all = withD([...near, ...far]).filter(s => s.dist != null && !seen.has(s.id) && seen.add(s.id)).sort((x, y) => x.dist - y.dist);
  for (const r of [10, 30, 75, 150]){
    const l = all.filter(s => s.dist <= r);
    if (l.length) return { mode: 'near', radius: r, min: Math.round(l[0].dist), cands: l.slice(0, 40) };
  }
  if (place.c){ const l = withD(await search({ countrycode: place.c }, 40)); if (l.length) return { mode: 'country', cands: topShuffle(l) }; }
  return { mode: 'none', cands: [] };
}

export async function byId(id){ const r = await getJSON('/json/stations/byuuid/' + encodeURIComponent(id)); return clean(r)[0] || null; }
