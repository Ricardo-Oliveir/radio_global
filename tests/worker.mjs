// Teste do proxy de streams com fetch simulado (sem rede).
import worker from '../workers/stream-proxy.js';
let fail = 0; const ok = (n, c) => { console[c ? 'log' : 'error'](c ? 'ok' : 'FALHOU', n); if (!c) fail++; };
const env = { ALLOWED_ORIGINS: 'https://site.test' };
const call = (u, o = {}) => worker.fetch(new Request('https://p.test/?u=' + encodeURIComponent(u), { headers: { Origin: 'https://site.test', ...o.headers }, method: o.method || 'GET' }), env);
globalThis.fetch = async url => url.includes('page') ? new Response('<html>', { headers: { 'content-type': 'text/html' } }) : new Response('xxxx', { headers: { 'content-type': 'audio/mpeg' } });
ok('http audio passa com CORS', await call('http://radio.test:8000/live').then(async r => r.status === 200 && r.headers.get('access-control-allow-origin') === 'https://site.test' && await r.text() === 'xxxx'));
ok('origem não permitida = 403', (await call('http://radio.test/live', { headers: { Origin: 'https://evil.test' } })).status === 403);
for (const u of ['http://127.0.0.1/x', 'http://localhost/x', 'http://192.168.0.5/x', 'http://10.1.1.1/x', 'http://169.254.169.254/x', 'http://[::1]/x', 'ftp://radio.test/x', 'http://user:pw@radio.test/x', 'http://radio.test:22/x'])
  ok('bloqueia ' + u, (await call(u)).status === 400);
ok('não-áudio = 415', (await call('http://radio.test/page')).status === 415);
ok('POST = 405', (await call('http://radio.test/live', { method: 'POST' })).status === 405);
process.exit(fail ? 1 : 0);
