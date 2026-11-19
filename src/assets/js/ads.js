/* WAVE GLOBAL · Google AdSense: componentes reutilizáveis (AdContainer, AdBanner, AdResponsive)
   Configuração vem de assets/js/config.js, gerado no build a partir das variáveis de ambiente
   GOOGLE_ADSENSE_CLIENT e GOOGLE_ADSENSE_SLOT. Sem elas, nenhum anúncio é carregado. */
(function(){
'use strict';
const W = window.WAVE = window.WAVE || {};
const CFG = window.WAVE_CONFIG || {};
const CLIENT = /^ca-pub-\d{8,20}$/.test(CFG.adsClient || '') ? CFG.adsClient : '';
const slotFor = place => { const s = {top:CFG.adsSlotTop, mid:CFG.adsSlotMid, side:CFG.adsSlotSide, bottom:CFG.adsSlotBottom}[place] || CFG.adsSlot || ''; return /^\d{6,20}$/.test(s) ? s : ''; };

let scriptPromise = null, allowed = false;
/* o script oficial é carregado uma única vez, mesmo com várias chamadas */
function loadScript(){
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((res, rej) => {
    if (document.querySelector('script[data-wave-ads]')) return res();
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous'; s.dataset.waveAds = '1';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  return scriptPromise;
}

/* AdContainer: moldura com rótulo "Publicidade" e espaço reservado (sem deslocar a página) */
function AdContainer(host){
  const box = document.createElement('div'); box.className = 'ad__box';
  const tag = document.createElement('span'); tag.className = 'ad__tag'; tag.textContent = 'Publicidade';
  box.appendChild(tag); host.replaceChildren(box); return box;
}
/* AdBanner: bloco horizontal de tamanho fixo (cabeçalho e rodapé em telas largas) */
function AdBanner(box, slot){
  const ins = document.createElement('ins'); ins.className = 'adsbygoogle'; ins.style.cssText = 'display:inline-block;width:728px;max-width:100%;height:90px';
  ins.dataset.adClient = CLIENT; ins.dataset.adSlot = slot; box.appendChild(ins); return ins;
}
/* AdResponsive: bloco que se ajusta à largura (entre seções, lateral e celulares) */
function AdResponsive(box, slot, format){
  const ins = document.createElement('ins'); ins.className = 'adsbygoogle'; ins.style.display = 'block';
  ins.dataset.adClient = CLIENT; ins.dataset.adSlot = slot; ins.dataset.adFormat = format || 'auto'; ins.dataset.fullWidthResponsive = 'true'; box.appendChild(ins); return ins;
}

/* monta só os blocos que estão visíveis agora (anúncio em contêiner oculto dá erro); pode ser chamada de novo */
function mount(){
  if (!CLIENT || !allowed) return;
  const hosts = [...document.querySelectorAll('.ad[data-ad]')].filter(h => !h.dataset.adDone);
  if (!hosts.length) return;
  loadScript().then(() => {
    hosts.forEach(h => {
      if (h.dataset.adDone) return;
      const place = h.dataset.ad, slot = slotFor(place); if (!slot) return;
      h.hidden = false;
      if (!h.offsetWidth){ h.hidden = true; return; }
      h.dataset.adDone = '1';
      const box = AdContainer(h);
      const ins = (place === 'top' || place === 'bottom') && h.offsetWidth >= 740 ? AdBanner(box, slot) : AdResponsive(box, slot, place === 'side' ? 'rectangle' : 'auto');
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
      void ins;
    });
  }).catch(() => { document.querySelectorAll('.ad[data-ad]').forEach(h => { h.hidden = true; }); });
}

W.ads = {
  enabled: !!CLIENT,
  /* chamado quando o visitante aceita os cookies de publicidade */
  allow(){ allowed = true; mount(); },
  mount
};
let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(mount, 400); });
})();
