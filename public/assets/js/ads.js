// Anúncios Google AdSense. Só funcionam com GOOGLE_ADSENSE_CLIENT e slot configurados; sem isso, nada é exibido.
// Componentes: AdContainer (rótulo + espaço), AdBanner (horizontal), AdResponsive (automático).
import config from './config.js';
import { h, store } from './util.js';
const preview = new URLSearchParams(location.search).has('adpreview');
export const adsEnabled = () => /^ca-pub-\d{8,20}$/.test(config.adsClient || '');
export function personalized(){ return store.get('consent') === 'yes'; }
export function applyConsent(){ window.adsbygoogle = window.adsbygoogle || []; window.adsbygoogle.requestNonPersonalizedAds = personalized() ? 0 : 1; }
function loadAdsScriptOnce(){
  if (window.__wgAdsLoaded || document.querySelector('script[data-wg-ads]')) return;
  window.__wgAdsLoaded = true; applyConsent();
  const s = h('script', { async: true, crossorigin: 'anonymous', src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + config.adsClient, dataset: { wgAds: '1' } });
  document.head.append(s);
}
const slotFor = pos => (config.adsSlots && config.adsSlots[pos]) || config.adsSlot || '';
export function AdBanner(pos){ return h('ins', { class: 'adsbygoogle ad-slot', style: 'display:block', 'data-ad-client': config.adsClient, 'data-ad-slot': slotFor(pos), 'data-ad-format': 'horizontal', 'data-full-width-responsive': 'true' }); }
export function AdResponsive(pos){ return h('ins', { class: 'adsbygoogle ad-slot', style: 'display:block', 'data-ad-client': config.adsClient, 'data-ad-slot': slotFor(pos), 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' }); }
export function AdContainer(pos){
  const box = h('div', { class: 'ad-inner' }, h('span', { class: 'ad-label', text: 'Publicidade' }));
  if (preview && !adsEnabled()){ box.append(h('div', { class: 'ad-slot', text: 'Espaço reservado para anúncio (' + pos + ')' })); return box; }
  box.append(pos === 'side' ? AdResponsive(pos) : AdBanner(pos)); return box;
}
const mq = { desktop: matchMedia('(min-width:768px)'), mobile: matchMedia('(max-width:767px)'), wide: matchMedia('(min-width:1280px)') };
const fits = rule => rule === 'all' || (mq[rule] && mq[rule].matches);
// Monta cada espaço no máximo uma vez; navegação dinâmica não duplica o script nem os blocos.
export function mountAds(root = document){
  if (!adsEnabled() && !preview) return;
  for (const el of root.querySelectorAll('[data-ad]')){
    if (el.dataset.mounted || !fits(el.dataset.show)) continue;
    const pos = el.dataset.ad;
    if (adsEnabled() && !slotFor(pos)) continue;
    el.dataset.mounted = '1'; el.hidden = false; if (preview && !adsEnabled()) el.classList.add('preview');
    el.append(AdContainer(pos));
    if (adsEnabled()){ loadAdsScriptOnce(); const ins = el.querySelector('ins'); try { if (!ins.dataset.adsbygoogleStatus) (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} }
  }
}
Object.values(mq).forEach(m => m.addEventListener('change', () => mountAds()));
