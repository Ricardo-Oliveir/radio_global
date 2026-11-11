# Rádios pelo Mundo

Tela cheia que viaja por quase 2.000 cidades em mais de 200 países: o globo voa até a cidade, a rádio de lá começa a tocar e uma faixa mostra o nome da rádio, hora local, fuso e coordenadas. Nenhuma cidade repete até todas passarem, e cada parada é de um país diferente da anterior.

## Publicar no GitHub Pages
1. Crie um repositório e envie `index.html`, `.nojekyll` e este `README.md`.
2. Em **Settings → Pages**, escolha a branch `main`, pasta `/ (root)`, e salve.
3. Abra `https://SEU-USUARIO.github.io/NOME-DO-REPO/`, toque em **Ligar o rádio** (o navegador só libera o som depois de um toque).

## Como funciona
- As rádios vêm do diretório aberto Radio Browser (radio-browser.info), consultado direto no seu navegador.
- Ordem de busca: rádio com o nome da cidade, rádio até 80 km, rádio popular do país. A tela diz qual caso é.
- Só tocam rádios com transmissão https. Se uma não responde em 8 segundos, tenta a próxima; se cair no meio, troca sozinha.
- Rádio é de terceiros: o que toca e a qualidade dependem de cada emissora.

## Controles
← → pular · espaço pausa · M mudo · ↑ ↓ volume · F tela cheia · O opções (tempo por cidade, padrão 120 s; 3600 = uma cidade por hora)

## Fixar e escolher
- **Fixar** (tecla X): fica na rádio atual sem passar para a próxima cidade. Clique de novo para voltar ao modo aleatório.
- **Escolher no globo** (tecla G): abre um globo para girar (arrastar) e dar zoom (roda do mouse ou + e −). Toque num ponto para ver a cidade e toque de novo para ouvir a rádio dela. Também dá para buscar a cidade pelo nome. Escolher uma cidade já deixa a rádio fixada.
- **Outra rádio** (tecla R): troca por outra rádio da mesma cidade ou região.
- **Próxima / Anterior / setas**: voltam ao modo aleatório.

## Como o site toca agora
O site fica na cidade e na rádio atuais até você agir: **Pular ▶** (botão rosa, sempre visível) vai para a próxima cidade da ordem aleatória. Para escolher, toque no globinho do canto superior ou em **Escolher no globo** (tecla G). Quem quiser a troca sozinha liga **Troca automática** (tecla A), no tempo definido em Opções.

## Google AdSense
1. Crie a conta em adsense.google.com e adicione o endereço do seu site (o GitHub Pages ou um domínio próprio; domínio próprio costuma ser aprovado com mais facilidade).
2. Crie um bloco de anúncio do tipo "Display" e anote o **ID do editor** (`ca-pub-...`) e o **número do bloco**.
3. No `index.html`, procure `const ADS =` e preencha `client` e `slot`. Quando preenchido, aparece uma faixa de anúncio de 90 px na base da tela e o link "Privacidade".
4. Edite `ads.txt` trocando `pub-XXXXXXXXXXXXXXXX` pelo seu ID (sem o `ca-`), e escreva seu e-mail em `privacidade.html`. Mantenha os dois arquivos na raiz do repositório.
5. Em AdSense, ative a mensagem de consentimento (Privacidade e mensagens), exigida para visitantes da Europa e do Reino Unido.

O AdSense só começa a pagar depois que aprova o site, e pode recusar sites com pouco texto. Se recusar, acrescente uma página com texto sobre o projeto e peça nova análise.
