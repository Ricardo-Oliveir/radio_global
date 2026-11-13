export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const flagUrl = cc => `https://flagcdn.com/w40/${String(cc).toLowerCase()}.png`;
export const store = {
  get(k, d = null){ try { const v = localStorage.getItem('wg.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('wg.' + k, JSON.stringify(v)); } catch {} },
  clear(){ try { Object.keys(localStorage).filter(k => k.startsWith('wg.')).forEach(k => localStorage.removeItem(k)); } catch {} }
};
export function h(tag, props = {}, ...kids){
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})){
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
export const icon = id => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-' + id); s.append(u); return s; };
const scripts = new Map();
export function loadScript(src){
  if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => { scripts.delete(src); rej(new Error('script ' + src)); }; document.head.append(s); }));
  return scripts.get(src);
}
export const rad = Math.PI / 180;
export function distKm(aLon, aLat, bLon, bLat){
  const dφ = (bLat - aLat) * rad, dλ = (bLon - aLon) * rad;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dλ / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(x)));
}
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
