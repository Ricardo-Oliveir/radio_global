// Converte o arquivo cities15000.txt (ou cities5000.txt) do GeoNames em assets/cities-extra.json.
// Uso: node scripts/importar-geonames.mjs caminho/cities15000.txt
// Fonte: https://download.geonames.org/export/dump/ (licença CC BY 4.0: cite "GeoNames" na página Sobre).
import { readFileSync, writeFileSync } from 'node:fs';
import { mergeCities } from '../assets/js/cities-merge.js';
const file = process.argv[2]; if (!file){ console.error('Informe o arquivo cities15000.txt do GeoNames.'); process.exit(1); }
const base = JSON.parse(readFileSync('assets/cities.json', 'utf8')), pais = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const cont = {}; for (const c of base){ cont[c.c] = cont[c.c] || c.t; }
const tOf = (cc, tz) => cont[cc] || ({ America: 'na', Europe: 'eu', Africa: 'af', Asia: 'as', Australia: 'oc', Pacific: 'oc', Atlantic: 'eu', Indian: 'as' }[String(tz).split('/')[0]] || '');
const extra = [];
for (const ln of readFileSync(file, 'utf8').split('\n')){
  const f = ln.split('\t'); if (f.length < 18) continue; const cc = f[8];
  let p = ''; try { p = pais.of(cc) || ''; } catch {}
  extra.push({ n: f[1], p, c: cc, a: +f[4], o: +f[5], z: f[17] || 'UTC', t: tOf(cc, f[17]), pop: +f[14] || 0 });
}
extra.sort((x, y) => y.pop - x.pop);
const novos = mergeCities(base, extra).slice(base.length);
writeFileSync('assets/cities-extra.json', JSON.stringify(novos.map(({ n, p, c, a, o, z, t }) => ({ n, p, c, a: +a.toFixed(3), o: +o.toFixed(3), z, t }))) + '\n');
console.log(`Base: ${base.length} cidades · novas: ${novos.length} · total: ${base.length + novos.length}`);
