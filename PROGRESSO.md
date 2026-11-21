# WAVE GLOBAL · progresso por partes

Marca oficial: WAVE GLOBAL. Slogan: THE WORLD. ONE FREQUENCY. Domínio preservado: radioglobal-phi.vercel.app (só aparece em URL canônica, Open Graph e sitemap; o nome antigo não aparece na interface).

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

## Parte 5 — suavidade e viagem de avião
- Globo desenhado na placa de vídeo (WebGL2) com zoom suave; cai para canvas se não houver WebGL.
- Avião com rastro que segue a rota; câmera acompanha. Botão "Viagem" no globo e atalho nas Opções (ícone de ajustes, não mais engrenagem/sol). Opções com interruptores.

## Parte 6 — celular compacto e anúncio pequeno
- Cabeçalho do celular em uma linha (busca vira ícone); menu abre como lista flutuante. Player compacto com botão "mais".
- Globo inteiro no celular (zoom inicial ajustado, textos menores).
- Espaço de anúncio pequeno (posição "loc", 320x100) no painel da cidade; quando ativo, substitui a lista de rádios próximas. Precisa do número do bloco (GOOGLE_ADSENSE_SLOT_LOC ou adsSlots.loc em site.config.json).

## Parte 7 — visual de equipamento e segurança
- Preto fosco + granulação SVG, fontes IBM Plex (Sans, Condensed, Mono); dados em mono; botões em relevo e play em forma de botão giratório.
- Texto direto (sem frases de efeito). Chiado de estática ao sintonizar (opção nas Opções).
- Medidor de áudio real (AnalyserNode) só com proxy de streams; sem proxy fica escondido.
- workers/stream-proxy.js (Cloudflare Worker): http→https, CORS, bloqueio de IP privado, só áudio, rate limit opcional. Testes em tests/worker.mjs.
- vercel.json: CSP, HSTS, COOP. Sem innerHTML no código; sem campo de envio de rádios.
- Pendente: publicar o Worker e preencher streamProxy; validar CSP/anúncios em produção; dial visual completo.

## Parte 8 — perto de mim
- Ao abrir: com permissão de localização já dada, acha a cidade mais próxima da lista e toca; sem permissão, mostra "Ouvir perto de mim". Botão "Perto de mim" na barra do globo. Posição usada só no navegador. Permissions-Policy liberou geolocation. Texto na página de privacidade.

## Parte 9 — mais cidades
- cities.json passou de 1.998 para 4.535 cidades (238 países/territórios). As novas foram escritas por região, validadas por script (fuso IANA, faixa de coordenadas, duplicatas, distância ao país) e conferidas por amostra. Coordenadas não vêm de base oficial: podem ter pequenos desvios.
- Rádios: vêm ao vivo do Radio Browser (sem lista fixa).

## Parte 10 — Globo grande e aviso de versão
- Botão "Tela cheia" virou "Globo grande": aumenta o globo, mostra o painel "No ar" (rádio, cidade, hora local, A seguir/Antes, contagem do modo automático) e deixa só um mini player (tocar/pausar, trocar rádio, mudo). Esc ou o mesmo botão saem. A rádio não para.
- Build gera `version.json` (hash do conteúdo, sem cache). O app consulta a cada 10 min (e ao voltar para a aba) e mostra "Há uma versão nova — Atualizar". Nunca recarrega sozinho.
- Não foi feita atualização automática de anúncios/página: o AdSense proíbe refresh forçado de anúncios e recarregar cortaria o áudio.
- TV: pendente (precisa decidir a fonte dos canais; nenhum link inventado).

## Parte 11 — Remoção do assistente de IA
- Removidos a seção "Assistente", assets/js/ai.js, a pasta api/ e as menções em Sobre/Privacidade/README. O site agora é 100% estático (sem função de servidor, sem chave de IA).
- Painel do Globo grande só abre sob demanda (botão Painel); × e Esc saem.

## Parte 12 — Painel lateral e tema
- Painel lateral: duas janelas de anúncio (loc e loc2; loc2 usa o mesmo bloco de loc até existir um segundo bloco em adsSlots.loc2), botão "Outra estação" removido.
- Tema claro/escuro (botão no cabeçalho, salvo no aparelho, padrão escuro). Área do globo, player e avisos ficam escuros nos dois temas.
- Anúncios NÃO são atualizados sozinhos nem colocados em iframe (políticas do AdSense).

## Parte 13 — Painel de anúncios (PC) e reestruturação mobile
- PC: painel lateral usa a altura toda; AdSense em cima, carrossel (fundo desfocado) embaixo. Opcional `adsSlots.locResp` para bloco AdSense responsivo maior.
- Mobile: barra do globo em grade 2x2, zoom +/− sobre o globo, nada escondido atrás da gaveta de cidade. 264 testes ok.

## Parte 14 — Viagem por qualquer cidade
- Botão Viagem: "Para onde você quer viajar?" com autocomplete (cidades locais + geocodificação Open-Meteo, sem chave).
- Destino separado de estação: rádios da cidade; senão por proximidade 10/30/75/150 km, com aviso e "X km do destino".
- Rota entre duas cidades continua, dentro de "Ou faça uma viagem de avião".
- Pendente da proposta: bottom sheet 3 alturas, mini-player expansível, histórico, saúde dos streams, URLs/SEO por cidade, marcador duplo (destino x rádio).

## Parte 15 — Evolução completa (etapas 1–4)
- Celular: menu de cidade com 3 alturas (alça: toque/arraste), cards de rádio padronizados (nome, local/distância, gênero, codec discreto, botão tocar), mini-player expande ao tocar no nome.
- PC: painel lateral mostra estações da cidade antes do anúncio; anúncios com espaço reservado.
- Histórico: "Cidades visitadas" (neste aparelho) além de recentes/favoritos.
- Rádio fora do ar: troca sozinha por outra da lista (até 3 tentativas), tempo de espera 7 s.
- Globo: modo leve em aparelhos fracos (menos pontos de longe, sem halo, DPR 1.5; force com ?lite); segundo marcador verde pulsando = origem do áudio quando difere do destino.
- SEO: build gera /radios/<pais>/ e /radios/<pais>/<cidade>/ (238 países, 4.535 cidades) + sitemap; links ?c=br/cidade, ?r=<uuid da estação>, ?pais=BR abrem o contexto; o endereço acompanha a cidade/estação.
- Pendente: testar tudo em celular real, Open-Meteo/Radio Browser no ar, enviar sitemap no Search Console.

## Parte 16 — Viagem estilo mapa
- Diálogo com campos "De" e "Para" (busca de qualquer cidade do mundo, botão "minha localização", inverter). Partida já vem com a cidade atual; sem partida vai direto ao destino.

## Parte 17 — Idiomas, filtros, globo
- Idiomas PT/EN/ES (seletor no topo; escolha salva; padrão pelo idioma do navegador). Países traduzidos via Intl. Páginas legais continuam em português.
- Filtros: +3 religiões (espírita, judaica, budista) e +12 gêneros/estilos.
- Celular: banner AdSense no topo (slot 'mtop', espaço reservado); carrossel de imagens só no PC.
- Globo: sombra de dia/noite em tempo real, cidades acesas à noite, estrelas, brilho de atmosfera, pulsos de atividade (só PC, desligam no modo leve), feixe de luz na cidade escolhida. Opção "Dia e noite no globo".
- Cidades: suporte a assets/cities-extra.json; `node scripts/importar-geonames.mjs cities15000.txt` gera o arquivo (GeoNames, CC BY 4.0).

## Parte 18 — 35 mil cidades
- assets/cities-extra.json gerado do GeoNames cities15000 (30.667 cidades novas; total 35.202). Globo mostra por níveis (base + populosas de longe; todas ao aproximar). Halo desligado com base grande.
- Páginas de SEO continuam só para as 4.535 da base + países (limite de arquivos da Vercel: ~4,8 mil arquivos no deploy).
- Créditos GeoNames (CC BY 4.0) e Open-Meteo na página Sobre.

## Parte 19 — Repositório enxuto
- Páginas /radios/... agora são geradas por api/radios.js (cache de CDN), sem milhares de arquivos. Deploy ~40 arquivos / 4,6 MB. Sitemap continua com ~4,8 mil URLs.
- Para o Git: use wave-global-raiz.zip (só código-fonte; a Vercel roda `node scripts/build.mjs`). wave-global-pronto.zip = pacote já construído (sem build).

## Parte 20 — Zoom estilo mapa
- Zoom máximo 7× → 60×. Desagrupamento por grade de tela (1 ponto por célula de 8 px; principais primeiro; todos aparecem ao aproximar). Nomes das cidades sem sobreposição quando o zoom é alto. Clique/hover usam os pontos visíveis; clique no vazio só pega cidade muito próxima conforme o zoom.

## Parte 21 — Um só zoom e tema claro com estrelas
- Removidos os botões − + da barra (ficam só os do globo, à direita). Tema claro: palco em céu azul-lavanda suave, com estrelas.
