// Build estático sem dependências: copia o projeto para dist/, injeta variáveis de ambiente e gera robots, sitemap e ads.txt.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { listar } from '../api/anuncios.js';
const env = process.env;
// Configuração do site: site.config.json (versionado) e variáveis de ambiente (têm prioridade).
const cfg = (() => { try { return JSON.parse(readFileSync('site.config.json', 'utf8')); } catch { return {}; } })();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OUT = env.BUILD_DIR || 'dist';
const SITE = (env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : 'https://radioglobal-phi.vercel.app')).replace(/\/$/, '');
const client = (env.GOOGLE_ADSENSE_CLIENT || cfg.adsClient || '').trim(), slot = (env.GOOGLE_ADSENSE_SLOT || cfg.adsSlot || '').trim();
const streamProxy = (/^https:\/\/[^\s"'<>]+$/.test((env.STREAM_PROXY_URL || cfg.streamProxy || '').trim()) ? (env.STREAM_PROXY_URL || cfg.streamProxy).trim() : '');
const slots = Object.fromEntries(['header', 'between', 'side', 'content', 'footer', 'loc', 'loc2', 'mtop', 'locResp'].map(k => [k, env['GOOGLE_ADSENSE_SLOT_' + k.toUpperCase()] || (cfg.adsSlots || {})[k]]));
for (const k of Object.keys(slots)) if (!/^\d+$/.test(slots[k] || '')) delete slots[k];
const tileUrl = /^https:\/\/[^\s"'<>]+\{z\}[^\s"'<>]*$/.test((env.TILE_URL || '').trim()) ? env.TILE_URL.trim() : '', tileMaxZ = Math.max(3, Math.min(20, +env.TILE_MAXZ || 8));
const contact = (env.CONTACT_EMAIL || '').trim();
const okClient = /^ca-pub-\d{8,20}$/.test(client);
// Bloco "Desenvolvido por": só aparece se houver nome ou links https válidos.
const dev = cfg.dev || {};
const devName = (env.DEV_NAME || dev.name || '').trim();
const devLinks = [['LinkedIn', env.LINKEDIN_URL], ['GitHub', env.GITHUB_URL]].map(([l, u], i) => [l, (u || (dev.links || []).find(x => x.label === l)?.url || '').trim()]).concat((dev.links || []).filter(x => !['LinkedIn', 'GitHub'].includes(x.label)).map(x => [x.label, (x.url || '').trim()])).filter(([l, u]) => l && /^https:\/\/[^\s"'<>]+$/.test(u));
const ICON = {
  LinkedIn: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="3.500" fill="none" stroke="currentColor" stroke-width="1.800"/><rect x="7" y="10" width="2" height="7" fill="currentColor"/><circle cx="8" cy="7.200" r="1.200" fill="currentColor"/><path d="M11 10h2v1c.5-.8 1.300-1.200 2.300-1.200 2 0 2.700 1.300 2.700 3.200V17h-2v-3.500c0-1-.3-1.700-1.300-1.700s-1.700.7-1.700 1.800V17h-2z" fill="currentColor"/></svg>',
  GitHub: '<svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.580 0 0 3.580 0 8c0 3.540 2.290 6.530 5.470 7.590.4.070.55-.170.55-.380 0-.190-.010-.820-.010-1.490-2.010.370-2.530-.490-2.690-.940-.090-.230-.480-.940-.820-1.130-.280-.150-.680-.520-.010-.530.630-.010 1.080.580 1.230.820.720 1.210 1.870.870 2.330.660.070-.520.280-.870.510-1.070-1.780-.200-3.640-.890-3.640-3.950 0-.870.310-1.590.820-2.150-.080-.200-.360-1.020.080-2.120 0 0 .670-.210 2.200.820.640-.180 1.320-.270 2-.270.680 0 1.360.090 2 .270 1.530-1.040 2.200-.820 2.200-.820.440 1.100.160 1.920.080 2.120.510.560.820 1.270.820 2.150 0 3.070-1.870 3.750-3.650 3.950.290.250.540.730.540 1.480 0 1.070-.010 1.930-.010 2.200 0 .210.150.460.550.380A8.013 8.013 0 0 0 16 8c0-4.420-3.580-8-8-8Z"/></svg>'
};
const devIcons = devLinks.map(([l, u]) => `<li><a class="soc" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(l)} (abre em nova aba)" title="${esc(l)}">${ICON[l] || esc(l)}</a></li>`).join('');
// Rodapé: "Desenvolvido por" + somente os ícones das redes (sem nome).
const devBlock = devLinks.length ? `<div class="wrap dev"><span>Desenvolvido por</span><ul aria-label="Redes do desenvolvedor">${devIcons}</ul></div>` : '';
const contactLinks = devLinks.length ? `<ul class="soc-list">${devLinks.map(([l, u]) => `<li><a class="soc-card" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ICON[l] || ''}<span>${esc(l)}<small>${esc(u.replace(/^https:\/\//, ''))}</small></span></a></li>`).join('')}</ul>` : '';
// Tag oficial do AdSense no <head> (exigida para verificar o site). Antes do consentimento, só anúncios não personalizados.
const adsHead = okClient ? `<script>window.adsbygoogle=window.adsbygoogle||[];window.adsbygoogle.requestNonPersonalizedAds=1</script>\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous" data-wg-ads="1"></script>\n` : '';
if (client && !okClient) console.warn('Aviso: GOOGLE_ADSENSE_CLIENT inválido (use ca-pub-0000000000000000). Anúncios desativados.');
if (okClient && !/^\d+$/.test(slot) && !Object.keys(slots).length) console.warn('Aviso: defina GOOGLE_ADSENSE_SLOT (só dígitos) para exibir anúncios.');
if (!contact) console.warn('Aviso: defina CONTACT_EMAIL; a página Sobre mostrará que o contato não foi configurado.');

rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'sobre.html', 'privacidade.html', 'cookies.html', 'termos.html', 'contato.html', 'manifest.webmanifest', 'favicon.ico']) cpSync(f, join(OUT, f));
cpSync('assets', join(OUT, 'assets'), { recursive: true });
cpSync('anuncios', join(OUT, 'anuncios'), { recursive: true });
writeFileSync(join(OUT, 'anuncios/lista.json'), JSON.stringify({ itens: listar('anuncios') }) + '\n');
const contactLine = contact ? `<a href="mailto:${contact}">${contact}</a>` : 'E-mail: em breve. Use as redes acima.';
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk(OUT)) if (['.html', '.webmanifest'].includes(extname(f))){
  writeFileSync(f, readFileSync(f, 'utf8').replaceAll('__SITE_URL__', SITE).replaceAll('__CONTACT_LINE__', contactLine).replaceAll('__ADS_HEAD__', adsHead).replaceAll('__DEV_BLOCK__', devBlock).replaceAll('__DEV_NAME__', esc(devName || 'Desenvolvedor do WAVE GLOBAL')).replaceAll('__CONTACT_LINKS__', contactLinks));
}
const hash = createHash('sha1'); for (const f of walk(OUT).sort()) if (!/config\.js$|version\.json$/.test(f)) hash.update(f).update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);
writeFileSync(join(OUT, 'version.json'), JSON.stringify({ v: version }) + '\n');
writeFileSync(join(OUT, 'assets/js/config.js'), `// Gerado por scripts/build.mjs\nexport default ${JSON.stringify({ tileUrl, tileMaxZ, version, adsClient: okClient ? client : '', adsSlot: /^\d+$/.test(slot) ? slot : '', adsSlots: slots, contactEmail: contact, streamProxy: streamProxy })};\n`);
writeFileSync(join(OUT, 'ads.txt'), okClient ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '# Defina GOOGLE_ADSENSE_CLIENT para gerar a linha do AdSense\n');
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// ---- Páginas /radios/... são geradas por api/radios.js (sem milhares de arquivos); aqui só entram no sitemap.
import { index as radiosIndex, urls as radiosUrls } from '../api/_lib/radios.js';
const urls = radiosUrls(radiosIndex(JSON.parse(readFileSync('assets/cities.json', 'utf8'))));
const pages = ['', 'sobre.html', 'contato.html', 'privacidade.html', 'cookies.html', 'termos.html'];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${SITE}/${p}</loc></url>`).concat(urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`)).join('\n')}\n</urlset>\n`);
console.log(`WAVE GLOBAL build ok · ${SITE} · anúncios: ${okClient ? 'configurados' : 'desligados'} · desenvolvedor: ${devBlock ? 'exibido' : 'não configurado'}`);
