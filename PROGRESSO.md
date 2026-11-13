# WAVE GLOBAL · progresso por partes

Marca oficial: WAVE GLOBAL. Slogan: THE WORLD. ONE FREQUENCY. Domínio preservado: dioglobal-phi.vercel.app (só aparece em URL canônica, Open Graph e sitemap; o nome antigo não aparece na interface).

Como retomar: `npm test` (ou `node tests/smoke.cjs`) deve dar 150 ok. Para testar a variante com anúncios: `DIR=dist-ads node tests/smoke.cjs` depois de `BUILD_DIR=dist-ads GOOGLE_ADSENSE_CLIENT=ca-pub-1234567890123456 GOOGLE_ADSENSE_SLOT=1234567890 node scripts/build.mjs`.

| Parte | Conteúdo | Estado |
|---|---|---|
| 1 | Versão base completa (globo, player, descoberta, favoritos, histórico, relógio, anúncios, consentimento, assistente, páginas legais, SEO) | feita (sessão anterior) |
| 2 | Verificação: teste novo nas 10 larguras, correção do build (`BUILD_DIR`) | feita: 150 ok sem anúncios, 75 ok com anúncios |
| 3 | Mobile refinado: player menor no celular, globo mais alto na primeira tela | pendente |
| 4 | Globo: toque e pinça em aparelho real, desempenho, mapa real (hoje só testado com mapa simulado) | pendente |
| 5 | Player e rádios: validar com o Radio Browser real, HLS, reconexão | pendente |
| 6 | Assistente: testar a função `api/assistant.js` com chave real | pendente |
| 7 | SEO e desempenho: PageSpeed real, Open Graph, dados estruturados | pendente |
| 8 | Deploy: `vercel dev`, variáveis de ambiente, `ads.txt`, aprovação do AdSense | pendente |

Limites de verificação até agora: não há acesso daqui ao Radio Browser, ao jsDelivr, ao Vercel, ao AdSense nem a aparelhos reais. Tudo isso foi testado com respostas simuladas.

## Atualização: AdSense e créditos
- O ID de editor `ca-pub-6760898010595076` está em `site.config.json` (`adsClient`). O build injeta a tag oficial do AdSense no `<head>` de todas as páginas e gera o `ads.txt` com esse ID. Antes do consentimento, o site pede só anúncios não personalizados.
- Para os anúncios aparecerem falta o número do bloco de anúncio (`GOOGLE_ADSENSE_SLOT`, só dígitos), criado em AdSense > Anúncios > Por bloco de anúncios.
- O bloco "Desenvolvido por" no rodapé aparece quando `site.config.json` tem `dev.name` ou links https preenchidos (ou pelas variáveis `DEV_NAME`, `LINKEDIN_URL`, `GITHUB_URL`).

## Parte 4 — globo real, viagem, páginas no app, redes (feito)
- Globo com textura real da Terra (assets/img/earth.jpg se existir; senão NASA Blue Marble via CDN; senão mapa vetorial). Renderização por pixel em canvas.
- Viagem (assets/js/trip.js): rota em círculo máximo, paradas em cidades reais do cities.json, troca de rádio a cada parada, pausar/próxima/encerrar.
- Sobre, Contato, Privacidade, Cookies e Termos abrem dentro do app: o player não para. Acesso direto à URL continua estático.
- Rodapé: "Desenvolvido por" + só ícones (LinkedIn, GitHub). Página contato.html.
- Pendente: validar textura/CDN no navegador real; e-mail público de contato (CONTACT_EMAIL); slot do AdSense.
