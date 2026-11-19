// Slugs estáveis de cidades (usados no build para gerar páginas e no app para abrir links compartilhados).
export const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'local';
export function citySlugs(cities){
  const seen = new Map(), out = new Map();
  for (const c of cities){ const base = c.c.toLowerCase() + '/' + slugify(c.n); const n = (seen.get(base) || 0) + 1; seen.set(base, n); out.set(c, n > 1 ? `${base}-${n}` : base); }
  return out;
}
