// Páginas indexáveis /radios/<pais>/ e /radios/<pais>/<cidade>/, geradas na hora (a Vercel guarda em cache).
// Assim o repositório não precisa de milhares de arquivos. Só usa dados reais do catálogo de cidades.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'local';
export function citySlugs(cities){
  const seen = new Map(), out = new Map();
  for (const c of cities){ const base = c.c.toLowerCase() + '/' + slugify(c.n); const n = (seen.get(base) || 0) + 1; seen.set(base, n); out.set(c, n > 1 ? `${base}-${n}` : base); }
  return out;
}
const km = (a, b) => { const r = Math.PI / 180, dx = (b.o - a.o) * r * Math.cos((a.a + b.a) * r / 2), dy = (b.a - a.a) * r; return Math.hypot(dx, dy) * 6371; };
const css = 'body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#0b0c10;color:#ece8e1}main{max-width:760px;margin:0 auto;padding:28px 20px 60px}a{color:#ff7a90}h1{font-size:28px;line-height:1.2;margin:.4em 0}.btn{display:inline-block;margin:14px 0 22px;padding:14px 22px;border-radius:12px;background:#ff5d73;color:#fff;text-decoration:none;font-weight:700}.brand{font-weight:800;letter-spacing:.06em;text-decoration:none;color:#ece8e1}ul{padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px}li a{display:block;padding:10px 14px;border:1px solid #2a2c34;border-radius:999px;text-decoration:none;color:#ece8e1}nav{font-size:14px;opacity:.8}';
const page = (SITE, { path, title, desc, h1, lead, openUrl, crumbs, links, linksTitle }) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${SITE}/assets/img/og-image.png">
<meta name="theme-color" content="#0b0c10"><link rel="icon" href="/favicon.ico">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) })}</script>
<style>${css}</style></head><body><main>
<a class="brand" href="/">WAVE GLOBAL</a>
<nav aria-label="Navegação">${crumbs.map(([n, u]) => `<a href="${u}">${esc(n)}</a>`).join(' › ')}</nav>
<h1>${esc(h1)}</h1><p>${esc(lead)}</p>
<a class="btn" href="${openUrl}">Abrir no globo e ouvir</a>
<h2>${esc(linksTitle)}</h2><ul>${links.map(([n, u]) => `<li><a href="${u}">${esc(n)}</a></li>`).join('')}</ul>
<p><small>As estações vêm do diretório aberto Radio Browser e podem variar com o tempo. WAVE GLOBAL — THE WORLD. ONE FREQUENCY.</small></p>
</main></body></html>
`;

export function index(cities){ // cities: base do catálogo (mesma ordem usada no app)
  const slugs = citySlugs(cities), byCC = new Map(), bySlug = new Map();
  for (const c of cities){ if (!byCC.has(c.c)) byCC.set(c.c, []); byCC.get(c.c).push(c); bySlug.set(slugs.get(c), c); }
  return { slugs, byCC, bySlug };
}
export const urls = ix => [...ix.byCC.keys()].flatMap(cc => [`/radios/${cc.toLowerCase()}/`, ...ix.byCC.get(cc).map(c => `/radios/${ix.slugs.get(c)}/`)]);
export function render(ix, p, SITE){ // p: "br" ou "br/jacutinga"
  p = String(p || '').toLowerCase().replace(/^\/+|\/+$/g, '');
  if (/^[a-z]{2}$/.test(p)){
    const list = ix.byCC.get(p.toUpperCase()); if (!list) return null; const pais = list[0].p, base = `/radios/${p}/`;
    return page(SITE, { path: base, title: `Rádios ao vivo – ${pais} | WAVE GLOBAL`, desc: `Ouça rádios ao vivo de ${pais} no globo interativo do WAVE GLOBAL. Escolha uma das ${list.length} cidades listadas e sintonize.`, h1: `Rádios ao vivo – ${pais}`, lead: `Explore ${pais} pelo globo e ouça a rádio local. Listamos ${list.length} ${list.length === 1 ? 'cidade' : 'cidades'} do país; as estações de cada lugar são carregadas na hora.`, openUrl: `/?pais=${p.toUpperCase()}`, crumbs: [['WAVE GLOBAL', '/'], [pais, base]], links: list.map(c => [c.n, '/radios/' + ix.slugs.get(c) + '/']), linksTitle: `Cidades de ${pais}` });
  }
  const c = ix.bySlug.get(p); if (!c) return null; const list = ix.byCC.get(c.c), base = `/radios/${c.c.toLowerCase()}/`, sl = `/radios/${p}/`;
  const near = list.filter(x => x !== c).map(x => [km(c, x), x]).sort((a, b) => a[0] - b[0]).slice(0, 12).map(([, x]) => [x.n, '/radios/' + ix.slugs.get(x) + '/']);
  return page(SITE, { path: sl, title: `Rádios ao vivo de ${c.n}, ${c.p} | WAVE GLOBAL`, desc: `Ouça as rádios de ${c.n}, ${c.p} ao vivo. O globo do WAVE GLOBAL leva você até lá e sintoniza a rádio local ou as mais próximas.`, h1: `Rádios de ${c.n}, ${c.p}`, lead: `Viaje até ${c.n} (${c.p}) pelo globo e ouça a rádio local ao vivo. Se não houver estação exatamente na cidade, mostramos as mais próximas e a distância.`, openUrl: `/?c=${p}`, crumbs: [['WAVE GLOBAL', '/'], [c.p, base], [c.n, sl]], links: near, linksTitle: `Outras cidades de ${c.p}` });
}
