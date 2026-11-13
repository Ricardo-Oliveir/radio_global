// Um único <audio> em toda a página: nunca há duas reproduções ao mesmo tempo.
import { loadScript } from './util.js';
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const HLS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
export class Player extends EventTarget {
  constructor(){
    super();
    this.audio = new Audio(); this.audio.preload = 'none'; this.audio.setAttribute('playsinline', '');
    this.state = 'idle'; this.station = null; this.tok = 0; this.hls = null; this.retries = 0; this.wantPlay = false; this.unlocked = false; this.stall = 0;
    const a = this.audio;
    a.addEventListener('playing', () => { this.retries = 0; this.stall = 0; this.set('playing'); });
    a.addEventListener('pause', () => { if (this.state === 'playing' && this.wantPlay === false) this.set('paused'); });
    a.addEventListener('waiting', () => { if (this.wantPlay && this.state === 'playing') this.set('loading'); });
    a.addEventListener('error', () => this.fail());
    a.addEventListener('ended', () => this.fail());
    setInterval(() => { if (this.wantPlay && this.state === 'loading' && this.station && !this.probing){ this.stall += 1; if (this.stall > 15) this.fail(); } else this.stall = 0; }, 1000);
  }
  set(s, detail){ if (this.state !== s || detail){ this.state = s; this.dispatchEvent(new CustomEvent('state', { detail: { state: s, ...detail } })); } }
  unlock(){ if (this.unlocked) return; this.unlocked = true; try { this.audio.src = SILENT; this.audio.play().catch(() => {}); } catch {} }
  teardown(){ if (this.hls){ try { this.hls.destroy(); } catch {} this.hls = null; } this.audio.pause(); this.audio.removeAttribute('src'); try { this.audio.load(); } catch {} }
  attach(st){
    const url = st.url, a = this.audio;
    if ((st.hls || /\.m3u8(\?|$)/i.test(url)) && !a.canPlayType('application/vnd.apple.mpegurl')){
      return loadScript(HLS).then(() => {
        if (!window.Hls || !window.Hls.isSupported()) throw new Error('hls');
        this.hls = new window.Hls(); this.hls.loadSource(url); this.hls.attachMedia(a);
        this.hls.on(window.Hls.Events.ERROR, (e, d) => { if (d.fatal) this.fail(); });
        return a.play();
      });
    }
    a.src = url; return a.play();
  }
  // Tenta tocar; devolve true se começou, false se falhou ou estourou o tempo.
  load(st, ms = 9000){
    const tok = ++this.tok; this.teardown(); this.station = st; this.wantPlay = true; this.retries = 0; this.probing = true; this.set('loading', { station: st });
    return new Promise(res => {
      let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(tm); this.audio.removeEventListener('playing', onP); this.audio.removeEventListener('error', onE); this.probing = false; res(v); };
      const onP = () => fin(tok === this.tok), onE = () => fin(false), tm = setTimeout(() => fin(false), ms);
      this.audio.addEventListener('playing', onP); this.audio.addEventListener('error', onE);
      this.attach(st).catch(e => { if (e && e.name === 'NotAllowedError'){ this.set('blocked'); fin(false); } else if (!st.hls) { /* o evento error decide */ } else fin(false); });
    }).then(v => { if (tok !== this.tok) return false; if (!v && this.state !== 'blocked'){ this.teardown(); this.set('error', { station: st }); } return v; });
  }
  fail(){
    if (this.probing || !this.station || !this.wantPlay) return;
    if (this.retries < 3){
      const tok = this.tok, st = this.station, n = ++this.retries; this.set('loading', { retry: n });
      setTimeout(() => { if (tok !== this.tok || !this.wantPlay) return; this.teardown(); this.attach(st).catch(() => {}); }, 1200 * n);
    } else { this.wantPlay = false; this.teardown(); this.set('error', { station: this.station, final: true }); }
  }
  play(){ if (!this.station) return; this.wantPlay = true; if (!this.audio.src || this.state === 'error' || this.state === 'paused'){ return this.load(this.station); } this.audio.play().catch(e => { if (e.name === 'NotAllowedError') this.set('blocked'); else this.fail(); }); }
  pause(){ this.wantPlay = false; this.audio.pause(); this.set('paused'); }
  toggle(){ return this.state === 'playing' || this.state === 'loading' ? this.pause() : this.play(); }
  stop(){ this.tok++; this.wantPlay = false; this.station = null; this.teardown(); this.set('idle'); }
  setVolume(v){ this.audio.volume = Math.max(0, Math.min(1, v)); }
  setMuted(m){ this.audio.muted = !!m; }
}
