# Proxy de streams (opcional, mas recomendado)

Para que serve: toca rádios que só transmitem em `http://` dentro do site `https://`, libera o medidor de áudio (CORS) e bloqueia abuso.

1. Crie uma conta grátis na Cloudflare e instale o Wrangler: `npm i -g wrangler` e `wrangler login`.
2. Nesta pasta, crie `wrangler.toml`:
   ```toml
   name = "wave-stream-proxy"
   main = "stream-proxy.js"
   compatibility_date = "2025-01-01"
   [vars]
   ALLOWED_ORIGINS = "https://dioglobal-phi.vercel.app"
   ```
3. `wrangler deploy` (ele mostra o endereço `https://wave-stream-proxy.SEU-USUARIO.workers.dev`).
4. No painel da Cloudflare, ative um limite de requisições por IP (Rate Limiting) para esse Worker.
5. Em `site.config.json` do site, acrescente `"streamProxy": "https://wave-stream-proxy.SEU-USUARIO.workers.dev"` (ou defina `STREAM_PROXY_URL` na Vercel) e publique de novo.

Com o proxy ligado, o site passa a incluir estações http, todas as rádios passam pelo Worker e o medidor de áudio funciona.
Sem o proxy, tudo continua como antes: só estações https, direto da emissora, e o medidor fica escondido.
