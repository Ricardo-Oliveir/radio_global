// Carrossel de propaganda com as imagens da pasta "anuncios" (ordem aleatória a cada visita).
// Sem imagens, o espaço não aparece. Links são marcados como patrocinados.
import { h } from './util.js';
const MS = 7000;
async function load(){
  for (const url of ['/api/anuncios', '/anuncios/lista.json']){
    try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) continue; const j = await r.json(); if (j && Array.isArray(j.itens) && j.itens.length) return j.itens; } catch {}
  }
  return [];
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export async function initAdCarousel(root){
  if (!root) return;
  const items = shuffle((await load()).filter(x => x && /^\/anuncios\/[^/]+$/.test(x.src))).slice(0, 12);
  if (!items.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, timer = 0, paused = false;
  const slides = items.map((it, n) => {
    const img = h('img', { src: it.src, alt: 'Publicidade', loading: n ? 'lazy' : 'eager', decoding: 'async', draggable: 'false' });
    const el = it.link && /^https:\/\//.test(it.link) ? h('a', { class: 'car-slide', href: it.link, target: '_blank', rel: 'sponsored noopener noreferrer', 'aria-label': 'Publicidade (abre em nova aba)' }, img) : h('div', { class: 'car-slide' }, img);
    img.addEventListener('error', () => { const k = slides.indexOf(el); if (k < 0) return; slides.splice(k, 1); dots.splice(k, 1)[0].remove(); el.remove(); if (!slides.length) root.hidden = true; else go(Math.min(i, slides.length - 1)); });
    return el;
  });
  const dots = items.map((_, n) => h('button', { class: 'car-dot', type: 'button', 'aria-label': `Propaganda ${n + 1} de ${items.length}`, onclick: () => { go(n); restart(); } }));
  const view = h('div', { class: 'car-view' }, ...slides), nav = h('div', { class: 'car-dots' }, ...dots);
  function go(n){ i = (n + slides.length) % slides.length; slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); s.tabIndex = k === i ? 0 : -1; }); dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false')); nav.hidden = slides.length < 2; }
  function restart(){ clearInterval(timer); if (slides.length > 1 && !reduce) timer = setInterval(() => { if (!paused && !document.hidden && !root.hidden && root.getClientRects().length) go(i + 1); }, MS); }
  root.append(h('div', { class: 'ad-inner' }, h('span', { class: 'ad-label', text: 'Publicidade' }), h('div', { class: 'car', role: 'group', 'aria-roledescription': 'carrossel', 'aria-label': 'Propagandas' }, view, nav)));
  root.addEventListener('pointerenter', () => paused = true); root.addEventListener('pointerleave', () => paused = false);
  root.addEventListener('focusin', () => paused = true); root.addEventListener('focusout', () => paused = false);
  go(0); restart(); root.hidden = false;
}
