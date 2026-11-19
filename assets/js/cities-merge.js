// Junta a base de cidades principal com um arquivo opcional (cities-extra.json), sem duplicar o mesmo lugar.
const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function mergeCities(base, extra){
  if (!Array.isArray(extra) || !extra.length) return base;
  const key = c => c.c + '|' + nrm(c.n), seen = new Map();
  for (const c of base){ const k = key(c); (seen.get(k) || seen.set(k, []).get(k)).push(c); }
  const out = base.slice();
  for (const e of extra){
    if (!e || !isFinite(e.a) || !isFinite(e.o) || !e.n || !/^[A-Z]{2}$/.test(e.c || '')) continue;
    const same = seen.get(key(e)); if (same && same.some(c => Math.abs(c.a - e.a) < .35 && Math.abs(c.o - e.o) < .35)) continue;
    const c = { n: e.n, p: e.p || '', c: e.c, a: +e.a, o: +e.o, z: e.z || 'UTC', t: e.t || '' }; out.push(c); (seen.get(key(c)) || seen.set(key(c), []).get(key(c))).push(c);
  }
  return out;
}
