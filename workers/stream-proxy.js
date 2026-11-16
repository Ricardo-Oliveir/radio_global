// Proxy de streams de rádio para o WAVE GLOBAL (Cloudflare Worker).
// Resolve três coisas: rádios em http:// tocando num site https://, CORS (necessário para o medidor de áudio) e abuso.
// Variáveis: ALLOWED_ORIGINS = "https://seu-site.vercel.app,https://seu-dominio.com" (obrigatória).
// Opcional: binding de rate limit "RL" (Cloudflare Rate Limiting) para limitar por IP.
const PRIVATE = /^(localhost|.*\.(local|internal|localdomain)|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?(::1?|f[cd][0-9a-f]{2}:|fe80:).*)/i;
const AUDIO = /^(audio\/|application\/ogg|application\/octet-stream|binary\/octet-stream)/i;
const json = (o, status, cors) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...cors } });

export default {
  async fetch(req, env){
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const cors = allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' } : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'GET') return json({ error: 'method' }, 405, cors);
    if (!cors['Access-Control-Allow-Origin']) return json({ error: 'origin' }, 403, {});
    if (env.RL){ const ip = req.headers.get('CF-Connecting-IP') || 'x'; const { success } = await env.RL.limit({ key: ip }); if (!success) return json({ error: 'rate_limited' }, 429, cors); }
    let target; try { target = new URL(new URL(req.url).searchParams.get('u') || ''); } catch { return json({ error: 'url' }, 400, cors); }
    if (!/^https?:$/.test(target.protocol) || target.username || target.password || PRIVATE.test(target.hostname)) return json({ error: 'blocked' }, 400, cors);
    if (target.port && !/^(80|443|[1-9]\d{3,4})$/.test(target.port)) return json({ error: 'port' }, 400, cors);
    let up;
    try { up = await fetch(target.href, { headers: { 'User-Agent': 'WaveGlobal/1.0', 'Icy-MetaData': '0', Accept: 'audio/*,*/*;q=0.5' }, redirect: 'follow' }); }
    catch { return json({ error: 'upstream' }, 502, cors); }
    const type = up.headers.get('content-type') || '';
    if (!up.ok || !up.body || !AUDIO.test(type)){ try { up.body && up.body.cancel(); } catch {} return json({ error: 'not_audio' }, 415, cors); }
    return new Response(up.body, { status: 200, headers: { 'content-type': type, 'cache-control': 'no-store', ...cors } });
  }
};
