# WAVE GLOBAL
**THE WORLD. ONE FREQUENCY.**

Plataforma para explorar o planeta pelas rádios ao vivo: gire o globo, escolha uma cidade e ouça as estações de lá, com horário local, favoritos, histórico e descoberta por país, continente e categoria.

Site estático (HTML, CSS e JavaScript sem framework) com uma função serverless opcional para o assistente de descoberta. Pronto para a Vercel.

## Estrutura
| Caminho | Função |
|---|---|
| `index.html` | Página inicial: cabeçalho, globo, local selecionado, descoberta, favoritos, assistente, rodapé e player |
| `sobre.html`, `privacidade.html`, `cookies.html`, `termos.html` | Páginas institucionais e legais |
| `assets/css/styles.css` | Estilos, mobile-first, breakpoints 375 / 481 / 768 / 1024 / 1280 |
| `assets/js/app.js` | Orquestra interface, busca, favoritos, histórico e navegação |
| `assets/js/player.js` | Player com um único `<audio>`, reconexão, MP3/AAC/AAC+ e HLS (hls.js carregado sob demanda) |
| `assets/js/globe.js` | Globo em canvas: arrastar, pinça, roda do mouse, teclado, voo animado, marcadores |
| `assets/js/radio.js` | Cliente do diretório Radio Browser (dados reais) |
| `assets/js/clock.js` | Relógio local via `Intl.DateTimeFormat` + indicador dia/noite pela altura do Sol |
| `assets/js/ads.js` | `AdContainer`, `AdBanner`, `AdResponsive` e carregamento único do AdSense |
| `assets/js/ai.js` e `api/assistant.js` | Assistente de descoberta (a chave fica só no servidor) |
| `assets/cities.json` | 1.997 cidades, 219 países, com fuso IANA e continente |
| `scripts/build.mjs` | Build sem dependências: injeta variáveis, gera `config.js`, `ads.txt`, `robots.txt`, `sitemap.xml` |
| `vercel.json` | Comando de build, saída `dist` e cabeçalhos de cache e segurança |

## Rodar e publicar
```
node scripts/build.mjs        # gera dist/
npx serve dist                # (opcional) servir localmente
```
Na Vercel, importe o repositório: o `vercel.json` já define `buildCommand` e `outputDirectory`. Domínio, DNS e configurações do projeto não são alterados por este código.

## Variáveis de ambiente
Veja `.env.example`. Todas são opcionais.

| Variável | Para quê |
|---|---|
| `SITE_URL` | URL canônica, Open Graph e sitemap (padrão `https://dioglobal-phi.vercel.app`) |
| `GOOGLE_ADSENSE_CLIENT` | ID do editor, `ca-pub-…` |
| `GOOGLE_ADSENSE_SLOT` | Bloco de anúncio padrão (só dígitos) |
| `GOOGLE_ADSENSE_SLOT_HEADER/_BETWEEN/_SIDE/_CONTENT/_FOOTER` | Blocos por posição (opcional) |
| `CONTACT_EMAIL` | Contato exibido na página Sobre |
| `ANTHROPIC_API_KEY` | Liga o assistente de descoberta (servidor) |
| `ANTHROPIC_MODEL` | Modelo usado pelo assistente (padrão `claude-sonnet-5-5`) |

## Google AdSense
1. Crie a conta em adsense.google.com e adicione o site. A aprovação depende da avaliação do Google; este projeto não garante aprovação.
2. Crie um bloco de anúncio e anote o ID do editor e o número do bloco.
3. Na Vercel, defina `GOOGLE_ADSENSE_CLIENT` e `GOOGLE_ADSENSE_SLOT` (e opcionalmente os blocos por posição), e `CONTACT_EMAIL`. Faça um novo deploy.
4. O build gera `ads.txt` com a linha do seu ID. Confirme que abre em `/ads.txt`.
5. Em AdSense, ative a mensagem de consentimento em "Privacidade e mensagens". O site já pede anúncios não personalizados por padrão e só personaliza depois do "Aceitar"; para visitantes da UE e do Reino Unido o Google exige uma plataforma de consentimento certificada, e a mensagem do AdSense cumpre esse papel.
6. Para ver onde os espaços ficam sem anúncio real, abra `/?adpreview`.

Posições: horizontal abaixo do cabeçalho (≥ 768 px), entre o globo e a descoberta (celular), coluna lateral ao lado da descoberta (≥ 1280 px), abaixo do conteúdo e no rodapé. Os anúncios ficam em blocos próprios, nunca sobre o globo, o player ou botões. Sem configuração, nenhum espaço aparece.

## Assistente de descoberta
Ativo só quando `ANTHROPIC_API_KEY` existe. O fluxo tem dois passos no servidor: (1) transformar o pedido em filtros do Radio Browser; (2) escolher até 6 entre estações reais já buscadas, usando apenas os dados delas. Todo id devolvido é validado contra a lista enviada, então o assistente não cria estações. Limite simples de 12 pedidos por minuto por IP.

## Dados e limites conhecidos
- Estações, logotipos, codec e bitrate vêm do Radio Browser. Campos ausentes não são preenchidos.
- Só tocam transmissões `https` (o site é `https`). Streams `http` são ignorados.
- Nem toda cidade tem estação cadastrada; o site avisa quando mostra estações da região ou do país.
- Navegadores bloqueiam som automático: o primeiro toque na página libera o áudio.
- Bandeiras vêm do flagcdn.com; mapa e bibliotecas do jsDelivr (carregados depois do conteúdo principal).

## Marca
Nome oficial: WAVE GLOBAL. Slogan: THE WORLD. ONE FREQUENCY. Símbolo: planeta com onda de rádio (`assets/img/mark.svg`).
