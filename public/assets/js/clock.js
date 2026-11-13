// Horário local pelo Intl com fusos IANA (sem contas manuais de fuso). Dia/noite pela altura do Sol.
import { rad } from './util.js';
const cache = new Map();
function fmt(tz, key, opts){
  const k = tz + '|' + key;
  if (!cache.has(k)) cache.set(k, new Intl.DateTimeFormat('pt-BR', { timeZone: tz, ...opts }));
  return cache.get(k);
}
export function sunElevation(lat, lon, d = new Date()){
  const n = d.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.0000004 * n) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24, ha = (gmst * 15 + lon) * rad - ra;
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
}
export function clockInfo(tz, lat, lon, d = new Date()){
  const parts = fmt(tz, 'tz', { timeZoneName: 'shortOffset' }).formatToParts(d);
  const off = (parts.find(p => p.type === 'timeZoneName') || {}).value || '';
  return {
    time: fmt(tz, 't', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d),
    weekday: fmt(tz, 'w', { weekday: 'long' }).format(d),
    date: fmt(tz, 'd', { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
    tzLabel: `${off.replace('GMT', 'UTC')} · ${tz.replace(/_/g, ' ')}`,
    isDay: sunElevation(lat, lon, d) > -0.833
  };
}
