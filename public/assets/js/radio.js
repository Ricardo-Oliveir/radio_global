// Cliente do diretório Radio Browser (dados reais). Nada aqui é inventado: o que não vem da API não aparece.
import { norm, shuffle } from './util.js';
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
const BASE = { hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true' };
export function station(s){
  const url = s.url_resolved || s.url || '';
  return {
    id: s.stationuuid, name: String(s.name || '').trim(), url, cc: s.countrycode || '', country: s.country || '', state: s.state || '',
    favicon: /^https:\/\//i.test(s.favicon || '') ? s.favicon : '', tags: String(s.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 5),
    codec: s.codec || '', bitrate: +s.bitrate || 0, hls: s.hls ? 1 : 0, lat: s.geo_lat ?? null, lon: s.geo_long ?? null, language: s.language || ''
  };
}
const ok = s => s && s.name && s.url_resolved && /^https:\/\//i.test(s.url_resolved) && s.lastcheckok !== 0;
const clean = list => { const seen = new Set(); return (list || []).filter(s => { if (!ok(s) || seen.has(s.url_resolved)) return false; seen.add(s.url_resolved); return true; }).map(station); };
const search = async (p, limit = 24) => clean(await getJSON('/json/stations/search?' + q({ ...BASE, ...p, limit })));
export const top = (n = 24) => search({}, n);
export const byCountry = (cc, tag, n = 30) => search({ countrycode: cc, tag, tagExact: tag ? 'true' : '' }, n);
export const byTag = (tag, n = 30) => search({ tag, tagExact: 'true' }, n);
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
