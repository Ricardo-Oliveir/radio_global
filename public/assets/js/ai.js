// Assistente de descoberta: o servidor (/api/assistant) fala com a IA; a chave nunca chega ao navegador.
import * as radio from './radio.js';
export async function aiEnabled(){
  try { const r = await fetch('/api/assistant', { cache: 'no-store' }); if (!r.ok) return false; return !!(await r.json()).enabled; } catch { return false; }
}
async function call(body){
  const r = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'erro ' + r.status); return j;
}
export async function suggest(prompt){
  const { filters } = await call({ action: 'plan', prompt });
  const cands = await radio.byFilters(filters || {}, 40);
  if (!cands.length) return { picks: [], note: 'Não encontrei estações com esse perfil no diretório.' };
  const { picks } = await call({ action: 'rank', prompt, candidates: cands.map(s => ({ id: s.id, name: s.name, country: s.country, state: s.state, tags: s.tags, language: s.language, codec: s.codec, bitrate: s.bitrate })) });
  const byId = new Map(cands.map(s => [s.id, s]));
  return { picks: (picks || []).filter(p => byId.has(p.id)).map(p => ({ station: byId.get(p.id), why: p.why })), note: '' };
}
