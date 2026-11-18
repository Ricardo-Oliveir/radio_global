// Busca de destinos: cidades da lista local (instantâneo) + geocodificação Open-Meteo (qualquer cidade do mundo).
import { norm } from './util.js';
const cache = new Map();
export async function geocode(q, signal){
  q = q.trim(); if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q);
  try {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=pt&format=json&name=' + encodeURIComponent(q), { signal });
    if (!r.ok) return [];
    const j = await r.json();
    const out = (j.results || []).filter(x => isFinite(x.latitude) && isFinite(x.longitude)).map(x => ({
      n: x.name, p: x.country || '', c: String(x.country_code || '').toUpperCase(), a: x.latitude, o: x.longitude, z: x.timezone || 'UTC', sub: [x.admin1, x.country].filter(Boolean).join(', '), dest: true
    }));
    cache.set(q, out); return out;
  } catch { return []; }
}
export function localMatches(cities, q, max = 5){
  const n = norm(q); if (n.length < 2) return [];
  const a = [], b = [];
  for (const c of cities){ const m = norm(c.n); if (m.startsWith(n)) a.push(c); else if (m.includes(n)) b.push(c); if (a.length >= max) break; }
  return a.concat(b).slice(0, max).map(c => ({ ...c, sub: c.p, dest: true }));
}
