// Idiomas: português (original no código), inglês e espanhol. Traduz o que está na tela por correspondência exata de texto
// (+ algumas regras com variáveis) e acompanha o que o app escreve depois. Nomes de cidades e emissoras não são traduzidos.
import { store } from './util.js';
export const LANGS = { pt: 'PT', en: 'EN', es: 'ES' };
const EN = {
  'Usamos armazenamento local para lembrar suas escolhas. Se os anúncios estiverem ativos, o Google AdSense pode usar cookies. Você decide se eles podem ser personalizados.': 'We use local storage to remember your choices. If ads are active, Google AdSense may use cookies. You decide whether they can be personalized.',
  'WAVE GLOBAL, página inicial': 'WAVE GLOBAL, home page', 'Globo interativo. Arraste para girar, use mais e menos para aproximar, Enter para escolher a cidade mais próxima do centro.': 'Interactive globe. Drag to rotate, use plus and minus to zoom, Enter to choose the city closest to the center.',
  'Ir para o conteúdo': 'Skip to content', 'THE WORLD. ONE FREQUENCY.': 'THE WORLD. ONE FREQUENCY.', 'Globo': 'Globe', 'Descobrir': 'Discover', 'Favoritos': 'Favorites', 'Sobre': 'About', 'Contato': 'Contact',
  'Anúncios e cookies': 'Ads and cookies', 'Saiba mais': 'Learn more', 'Só anúncios não personalizados': 'Non-personalized ads only', 'Aceitar': 'Accept',
  'Rádio ao vivo': 'Live radio', 'Toque num ponto do globo e ouça a rádio de lá.': 'Tap a point on the globe and hear the radio from there.',
  'Mais de 35.000 cidades. As estações vêm do diretório aberto Radio Browser.': 'More than 35,000 cities. Stations come from the open Radio Browser directory.',
  'Globo inteiro': 'Whole globe', 'Cidade aleatória': 'Random city', 'Perto de mim': 'Near me', 'Ir para um país': 'Go to a country', 'Ir para um país…': 'Go to a country…', 'Globo grande': 'Big globe',
  'Painel': 'Panel', 'NO AR': 'ON AIR', 'Nada tocando': 'Nothing playing', 'A seguir': 'Next', 'Antes': 'Previous', 'Ouvir perto de mim': 'Listen near me', 'Agora não': 'Not now',
  'Há uma versão nova do WAVE GLOBAL.': 'There is a new version of WAVE GLOBAL.', 'Atualizar': 'Update', 'Viagem': 'Trip', 'Toque numa cidade. Arraste para girar.': 'Tap a city. Drag to rotate.',
  'Nenhuma cidade escolhida': 'No city chosen', 'Toque num ponto do globo.': 'Tap a point on the globe.', 'Estações': 'Stations', 'Dia': 'Day', 'Noite': 'Night', 'Publicidade': 'Advertising', 'Estações nesta região': 'Stations in this region',
  'Semelhantes à que está tocando': 'Similar to what is playing', 'Descobrir rádios': 'Discover radios', 'Dados do diretório Radio Browser. A ordem usa a contagem de cliques registrada lá.': 'Data from the Radio Browser directory. Order uses the click count recorded there.',
  'Populares': 'Popular', 'Categorias': 'Categories', 'Países': 'Countries', 'Continentes': 'Continents', 'Histórico': 'History', 'Não consegui carregar o diretório agora.': 'Could not load the directory right now.',
  'Cidades visitadas': 'Visited cities', 'Seu histórico de destinos, só neste aparelho.': 'Your travel history, only on this device.', 'Favoritas': 'Favorites', 'Ficam salvas só neste aparelho.': 'Saved only on this device.',
  'Nenhuma favorita ainda. Toque no coração de uma estação para guardá-la aqui.': 'No favorites yet. Tap the heart on a station to save it here.',
  'As rádios são de terceiros e transmitidas diretamente pelas emissoras. O WAVE GLOBAL apenas ajuda a encontrá-las.': 'Radios belong to third parties and are streamed directly by the broadcasters. WAVE GLOBAL only helps you find them.',
  'Projeto': 'Project', 'Sobre o projeto': 'About the project', 'Legal': 'Legal', 'Política de privacidade': 'Privacy policy', 'Política de cookies': 'Cookie policy', 'Termos de uso': 'Terms of use', 'Preferências de anúncios': 'Ad preferences',
  'Desenvolvido por': 'Developed by', 'WAVE GLOBAL. Todos os direitos reservados.': 'WAVE GLOBAL. All rights reserved.', 'Privacidade': 'Privacy', 'Cookies': 'Cookies', 'Termos': 'Terms',
  '. Os nomes, marcas e logotipos das emissoras pertencem aos seus titulares.': '. Station names, brands and logos belong to their owners.',
  'Toque em ▶ para uma cidade ao acaso': 'Tap ▶ for a random city', 'AO VIVO': 'LIVE', 'Fazer uma viagem': 'Take a trip', 'De': 'From', 'Para': 'To',
  'Pesquise qualquer cidade do mundo. Com partida e destino, o globo viaja de avião, passa por cidades do caminho e sintoniza uma rádio em cada parada. Sem partida, ele vai direto ao destino e procura rádios lá (ou as mais próximas, com a distância).': 'Search any city in the world. With a start and a destination, the globe flies by plane, passes cities along the way and tunes a radio at each stop. Without a start, it goes straight to the destination and looks for radios there (or the nearest ones, with the distance).',
  'Tempo em cada parada': 'Time at each stop', '30 segundos': '30 seconds', '1 minuto': '1 minute', '2 minutos': '2 minutes', '5 minutos': '5 minutes', '10 minutos': '10 minutes', '30 minutos': '30 minutes', '1 hora': '1 hour',
  'Cancelar': 'Cancel', 'Iniciar viagem': 'Start trip', 'Opções do globo e do player': 'Globe and player options', 'Fazer uma viagem de avião': 'Take a plane trip', 'Troca automática de cidade': 'Automatic city change',
  'Passa sozinho para outra cidade depois do tempo escolhido. Desligada, o site só muda quando você pede.': 'Moves to another city by itself after the chosen time. When off, the site only changes when you ask.',
  'Tempo em cada cidade': 'Time in each city', 'Chiado entre estações': 'Static between stations', 'Um ruído baixo de rádio enquanto a estação sintoniza.': 'A soft radio noise while the station tunes in.',
  'Dia e noite no globo': 'Day and night on the globe', 'Mostra a sombra da noite em tempo real e as cidades acesas.': 'Shows the night shadow in real time and lit-up cities.',
  'Rotação lenta do globo': 'Slow globe rotation', 'Desligada por padrão para poupar bateria.': 'Off by default to save battery.', 'Limpar dados salvos': 'Clear saved data', 'Pronto': 'Done',
  'Buscar': 'Search', 'Mudar para tema claro': 'Switch to light theme', 'Mudar para tema escuro': 'Switch to dark theme', 'Abrir menu': 'Open menu', 'Buscar rádio, cidade ou país': 'Search radio, city or country', 'Principal': 'Main',
  'Zoom do globo': 'Globe zoom', 'Afastar': 'Zoom out', 'Aproximar': 'Zoom in', 'Sair do globo grande': 'Exit big globe', 'No ar agora': 'On air now', 'Viagem em andamento': 'Trip in progress', 'Pausar a viagem': 'Pause the trip',
  'Ir para a próxima parada': 'Go to the next stop', 'Encerrar a viagem': 'End the trip', 'Local selecionado': 'Selected place', 'Ajustar altura da lista de rádios': 'Adjust radio list height', 'Filtrar estações': 'Filter stations',
  'Formas de descobrir': 'Ways to discover', 'Rodapé': 'Footer', 'Redes do desenvolvedor': 'Developer links', 'Player de rádio': 'Radio player', 'Controles de reprodução': 'Playback controls', 'Estação anterior': 'Previous station',
  'Reproduzir': 'Play', 'Pausar': 'Pause', 'Pular para a próxima estação': 'Skip to the next station', 'Outra estação desta cidade': 'Another station in this city', 'Favoritar': 'Favorite', 'Mais controles': 'More controls', 'Silenciar': 'Mute', 'Volume': 'Volume',
  'Fechar': 'Close', 'Ponto de partida (opcional)': 'Starting point (optional)', 'Usar minha localização': 'Use my location', 'Minha localização': 'My location', 'Para onde você quer ir?': 'Where do you want to go?',
  'Inverter partida e destino': 'Swap start and destination', 'Inverter': 'Swap', 'Página': 'Page', 'Idioma': 'Language',
  'Carregando…': 'Loading…', 'Buscando estações…': 'Looking for stations…', 'Buscando sua localização…': 'Finding your location…', 'Procurando você…': 'Finding you…', 'Ouvir': 'Listen', 'Cidades': 'Cities', 'Escolha um país': 'Choose a country', 'Todas as categorias': 'All categories',
  'Nada encontrado. Tente outro nome.': 'Nothing found. Try another name.', 'Nenhuma estação encontrada.': 'No stations found.', 'Sem estações para esta categoria.': 'No stations for this category.', 'Sem estações para este filtro.': 'No stations for this filter.',
  'Escolha uma cidade para ver outras estações.': 'Choose a city to see other stations.', 'Esta estação não respondeu. Tente outra.': 'This station did not respond. Try another.', 'Nenhuma estação cadastrada para este local.': 'No station registered for this place.',
  'Nenhuma estação respondeu agora. Tente outra cidade.': 'No station responded right now. Try another city.', 'Não há estação anterior nesta sessão.': 'There is no previous station in this session.', 'O navegador bloqueou o som. Toque em reproduzir.': 'The browser blocked the sound. Tap play.',
  'Dados apagados': 'Data cleared', 'Escolha o destino na lista de sugestões.': 'Choose the destination from the suggestions.', 'Escolha um país para ver as estações.': 'Choose a country to see its stations.', 'Nenhuma cidade perto desse ponto. Gire o globo ou aproxime.': 'No city near this point. Rotate or zoom the globe.',
  'Não consegui sua localização. Digite o ponto de partida.': 'Could not get your location. Type the starting point.', 'Não foi possível carregar os dados do site. Recarregue a página.': 'Could not load the site data. Reload the page.',
  'Partida e destino são o mesmo lugar.': 'Start and destination are the same place.', 'Seu navegador não informa a localização.': 'Your browser does not provide location.', 'Nenhum lugar encontrado.': 'No place found.', 'Local não informado': 'Place not provided', 'Dados não informados': 'Data not provided',
  'Estações com o nome desta cidade.': 'Stations with this city name.', 'Estações cadastradas até 80 km daqui.': 'Stations registered within 80 km of here.', 'Sem estação cadastrada na cidade. Mostrando as mais ouvidas do país.': 'No station registered in the city. Showing the most listened to in the country.',
  'América do Sul': 'South America', 'América do Norte e Central': 'North and Central America', 'Europa': 'Europe', 'África': 'Africa', 'Ásia': 'Asia', 'Oceania': 'Oceania',
  'Evangélica': 'Evangelical', 'Católica': 'Catholic', 'Religião': 'Religion', 'Islâmica': 'Islamic', 'Espírita': 'Spiritist', 'Judaica': 'Jewish', 'Budista': 'Buddhist', 'Notícias': 'News', 'Esportes': 'Sports', 'Sertaneja': 'Sertanejo', 'Forró': 'Forró', 'MPB': 'MPB', 'Samba e pagode': 'Samba and pagode',
  'Funk': 'Funk', 'Pop': 'Pop', 'Rock': 'Rock', 'Metal': 'Metal', 'Hip hop e rap': 'Hip hop and rap', 'Eletrônica': 'Electronic', 'Jazz e blues': 'Jazz and blues', 'Clássica': 'Classical', 'Reggae': 'Reggae', 'Latina': 'Latin', 'Country e folk': 'Country and folk', 'Anos 70, 80 e 90': '70s, 80s and 90s',
  'Infantil': 'Kids', 'K-pop e J-pop': 'K-pop and J-pop', 'Conversa': 'Talk', 'Cultura': 'Culture', 'Música': 'Music', 'Romântica': 'Romantic', 'Axé': 'Axé', 'Chill e lo-fi': 'Chill and lo-fi', 'Ambiente e relax': 'Ambient and relax', 'Soul e R&B': 'Soul and R&B', 'Indie e alternativa': 'Indie and alternative',
  'Tradicional e folclore': 'Traditional and folk', 'Comunitária': 'Community', 'Universitária': 'University', 'Instrumental': 'Instrumental', 'Gospel': 'Gospel', 'Cristã': 'Christian', 'Árabe': 'Arabic', 'Francesa': 'French', 'Mundo': 'World'
};
const ES = {
  'Usamos armazenamento local para lembrar suas escolhas. Se os anúncios estiverem ativos, o Google AdSense pode usar cookies. Você decide se eles podem ser personalizados.': 'Usamos almacenamiento local para recordar tus elecciones. Si los anuncios están activos, Google AdSense puede usar cookies. Tú decides si pueden ser personalizados.',
  'WAVE GLOBAL, página inicial': 'WAVE GLOBAL, página de inicio', 'Globo interativo. Arraste para girar, use mais e menos para aproximar, Enter para escolher a cidade mais próxima do centro.': 'Globo interactivo. Arrastra para girar, usa más y menos para acercar, Enter para elegir la ciudad más cercana al centro.',
  'Ir para o conteúdo': 'Ir al contenido', 'Globo': 'Globo', 'Descobrir': 'Descubrir', 'Favoritos': 'Favoritos', 'Sobre': 'Acerca de', 'Contato': 'Contacto',
  'Anúncios e cookies': 'Anuncios y cookies', 'Saiba mais': 'Más información', 'Só anúncios não personalizados': 'Solo anuncios no personalizados', 'Aceitar': 'Aceptar',
  'Rádio ao vivo': 'Radio en vivo', 'Toque num ponto do globo e ouça a rádio de lá.': 'Toca un punto del globo y escucha la radio de allí.',
  'Mais de 35.000 cidades. As estações vêm do diretório aberto Radio Browser.': 'Más de 35.000 ciudades. Las emisoras provienen del directorio abierto Radio Browser.',
  'Globo inteiro': 'Globo entero', 'Cidade aleatória': 'Ciudad aleatoria', 'Perto de mim': 'Cerca de mí', 'Ir para um país': 'Ir a un país', 'Ir para um país…': 'Ir a un país…', 'Globo grande': 'Globo grande',
  'Painel': 'Panel', 'NO AR': 'EN EL AIRE', 'Nada tocando': 'Nada sonando', 'A seguir': 'Siguiente', 'Antes': 'Anterior', 'Ouvir perto de mim': 'Escuchar cerca de mí', 'Agora não': 'Ahora no',
  'Há uma versão nova do WAVE GLOBAL.': 'Hay una nueva versión de WAVE GLOBAL.', 'Atualizar': 'Actualizar', 'Viagem': 'Viaje', 'Toque numa cidade. Arraste para girar.': 'Toca una ciudad. Arrastra para girar.',
  'Nenhuma cidade escolhida': 'Ninguna ciudad elegida', 'Toque num ponto do globo.': 'Toca un punto del globo.', 'Estações': 'Emisoras', 'Dia': 'Día', 'Noite': 'Noche', 'Publicidade': 'Publicidad', 'Estações nesta região': 'Emisoras en esta región',
  'Semelhantes à que está tocando': 'Similares a la que suena', 'Descobrir rádios': 'Descubrir radios', 'Dados do diretório Radio Browser. A ordem usa a contagem de cliques registrada lá.': 'Datos del directorio Radio Browser. El orden usa el conteo de clics registrado allí.',
  'Populares': 'Populares', 'Categorias': 'Categorías', 'Países': 'Países', 'Continentes': 'Continentes', 'Histórico': 'Historial', 'Não consegui carregar o diretório agora.': 'No pude cargar el directorio ahora.',
  'Cidades visitadas': 'Ciudades visitadas', 'Seu histórico de destinos, só neste aparelho.': 'Tu historial de destinos, solo en este dispositivo.', 'Favoritas': 'Favoritas', 'Ficam salvas só neste aparelho.': 'Se guardan solo en este dispositivo.',
  'Nenhuma favorita ainda. Toque no coração de uma estação para guardá-la aqui.': 'Aún no hay favoritas. Toca el corazón de una emisora para guardarla aquí.',
  'As rádios são de terceiros e transmitidas diretamente pelas emissoras. O WAVE GLOBAL apenas ajuda a encontrá-las.': 'Las radios son de terceros y las transmiten directamente las emisoras. WAVE GLOBAL solo ayuda a encontrarlas.',
  'Projeto': 'Proyecto', 'Sobre o projeto': 'Acerca del proyecto', 'Legal': 'Legal', 'Política de privacidade': 'Política de privacidad', 'Política de cookies': 'Política de cookies', 'Termos de uso': 'Términos de uso', 'Preferências de anúncios': 'Preferencias de anuncios',
  'Desenvolvido por': 'Desarrollado por', 'WAVE GLOBAL. Todos os direitos reservados.': 'WAVE GLOBAL. Todos los derechos reservados.', 'Privacidade': 'Privacidad', 'Termos': 'Términos',
  '. Os nomes, marcas e logotipos das emissoras pertencem aos seus titulares.': '. Los nombres, marcas y logotipos de las emisoras pertenecen a sus titulares.',
  'Toque em ▶ para uma cidade ao acaso': 'Toca ▶ para una ciudad al azar', 'AO VIVO': 'EN VIVO', 'Fazer uma viagem': 'Hacer un viaje', 'De': 'Desde', 'Para': 'Hasta',
  'Pesquise qualquer cidade do mundo. Com partida e destino, o globo viaja de avião, passa por cidades do caminho e sintoniza uma rádio em cada parada. Sem partida, ele vai direto ao destino e procura rádios lá (ou as mais próximas, com a distância).': 'Busca cualquier ciudad del mundo. Con origen y destino, el globo viaja en avión, pasa por ciudades del camino y sintoniza una radio en cada parada. Sin origen, va directo al destino y busca radios allí (o las más cercanas, con la distancia).',
  'Tempo em cada parada': 'Tiempo en cada parada', '30 segundos': '30 segundos', '1 minuto': '1 minuto', '2 minutos': '2 minutos', '5 minutos': '5 minutos', '10 minutos': '10 minutos', '30 minutos': '30 minutos', '1 hora': '1 hora',
  'Cancelar': 'Cancelar', 'Iniciar viagem': 'Iniciar viaje', 'Opções do globo e do player': 'Opciones del globo y del reproductor', 'Fazer uma viagem de avião': 'Hacer un viaje en avión', 'Troca automática de cidade': 'Cambio automático de ciudad',
  'Passa sozinho para outra cidade depois do tempo escolhido. Desligada, o site só muda quando você pede.': 'Pasa solo a otra ciudad tras el tiempo elegido. Apagado, el sitio solo cambia cuando lo pides.',
  'Tempo em cada cidade': 'Tiempo en cada ciudad', 'Chiado entre estações': 'Ruido entre emisoras', 'Um ruído baixo de rádio enquanto a estação sintoniza.': 'Un ruido suave de radio mientras la emisora sintoniza.',
  'Dia e noite no globo': 'Día y noche en el globo', 'Mostra a sombra da noite em tempo real e as cidades acesas.': 'Muestra la sombra de la noche en tiempo real y las ciudades encendidas.',
  'Rotação lenta do globo': 'Rotación lenta del globo', 'Desligada por padrão para poupar bateria.': 'Apagada por defecto para ahorrar batería.', 'Limpar dados salvos': 'Borrar datos guardados', 'Pronto': 'Listo',
  'Buscar': 'Buscar', 'Mudar para tema claro': 'Cambiar a tema claro', 'Mudar para tema escuro': 'Cambiar a tema oscuro', 'Abrir menu': 'Abrir menú', 'Buscar rádio, cidade ou país': 'Buscar radio, ciudad o país', 'Principal': 'Principal',
  'Zoom do globo': 'Zoom del globo', 'Afastar': 'Alejar', 'Aproximar': 'Acercar', 'Sair do globo grande': 'Salir del globo grande', 'No ar agora': 'En el aire ahora', 'Viagem em andamento': 'Viaje en curso', 'Pausar a viagem': 'Pausar el viaje',
  'Ir para a próxima parada': 'Ir a la siguiente parada', 'Encerrar a viagem': 'Terminar el viaje', 'Local selecionado': 'Lugar seleccionado', 'Ajustar altura da lista de rádios': 'Ajustar la altura de la lista', 'Filtrar estações': 'Filtrar emisoras',
  'Formas de descobrir': 'Formas de descubrir', 'Rodapé': 'Pie de página', 'Redes do desenvolvedor': 'Redes del desarrollador', 'Player de rádio': 'Reproductor de radio', 'Controles de reprodução': 'Controles de reproducción', 'Estação anterior': 'Emisora anterior',
  'Reproduzir': 'Reproducir', 'Pausar': 'Pausar', 'Pular para a próxima estação': 'Saltar a la siguiente emisora', 'Outra estação desta cidade': 'Otra emisora de esta ciudad', 'Favoritar': 'Marcar favorita', 'Mais controles': 'Más controles', 'Silenciar': 'Silenciar', 'Volume': 'Volumen',
  'Fechar': 'Cerrar', 'Ponto de partida (opcional)': 'Punto de partida (opcional)', 'Usar minha localização': 'Usar mi ubicación', 'Minha localização': 'Mi ubicación', 'Para onde você quer ir?': '¿A dónde quieres ir?',
  'Inverter partida e destino': 'Invertir origen y destino', 'Inverter': 'Invertir', 'Página': 'Página', 'Idioma': 'Idioma',
  'Carregando…': 'Cargando…', 'Buscando estações…': 'Buscando emisoras…', 'Buscando sua localização…': 'Buscando tu ubicación…', 'Procurando você…': 'Buscándote…', 'Ouvir': 'Escuchar', 'Cidades': 'Ciudades', 'Escolha um país': 'Elige un país', 'Todas as categorias': 'Todas las categorías',
  'Nada encontrado. Tente outro nome.': 'No se encontró nada. Prueba con otro nombre.', 'Nenhuma estação encontrada.': 'No se encontraron emisoras.', 'Sem estações para esta categoria.': 'Sin emisoras para esta categoría.', 'Sem estações para este filtro.': 'Sin emisoras para este filtro.',
  'Escolha uma cidade para ver outras estações.': 'Elige una ciudad para ver otras emisoras.', 'Esta estação não respondeu. Tente outra.': 'Esta emisora no respondió. Prueba otra.', 'Nenhuma estação cadastrada para este local.': 'No hay emisoras registradas para este lugar.',
  'Nenhuma estação respondeu agora. Tente outra cidade.': 'Ninguna emisora respondió ahora. Prueba otra ciudad.', 'Não há estação anterior nesta sessão.': 'No hay emisora anterior en esta sesión.', 'O navegador bloqueou o som. Toque em reproduzir.': 'El navegador bloqueó el sonido. Toca reproducir.',
  'Dados apagados': 'Datos borrados', 'Escolha o destino na lista de sugestões.': 'Elige el destino en la lista de sugerencias.', 'Escolha um país para ver as estações.': 'Elige un país para ver sus emisoras.', 'Nenhuma cidade perto desse ponto. Gire o globo ou aproxime.': 'No hay ciudades cerca de este punto. Gira o acerca el globo.',
  'Não consegui sua localização. Digite o ponto de partida.': 'No pude obtener tu ubicación. Escribe el punto de partida.', 'Não foi possível carregar os dados do site. Recarregue a página.': 'No se pudieron cargar los datos del sitio. Recarga la página.',
  'Partida e destino são o mesmo lugar.': 'El origen y el destino son el mismo lugar.', 'Seu navegador não informa a localização.': 'Tu navegador no informa la ubicación.', 'Nenhum lugar encontrado.': 'No se encontró ningún lugar.', 'Local não informado': 'Lugar no informado', 'Dados não informados': 'Datos no informados',
  'Estações com o nome desta cidade.': 'Emisoras con el nombre de esta ciudad.', 'Estações cadastradas até 80 km daqui.': 'Emisoras registradas a menos de 80 km.', 'Sem estação cadastrada na cidade. Mostrando as mais ouvidas do país.': 'Sin emisora registrada en la ciudad. Mostrando las más escuchadas del país.',
  'América do Sul': 'América del Sur', 'América do Norte e Central': 'América del Norte y Central', 'Europa': 'Europa', 'África': 'África', 'Ásia': 'Asia', 'Oceania': 'Oceanía',
  'Evangélica': 'Evangélica', 'Católica': 'Católica', 'Religião': 'Religión', 'Islâmica': 'Islámica', 'Espírita': 'Espiritista', 'Judaica': 'Judía', 'Budista': 'Budista', 'Notícias': 'Noticias', 'Esportes': 'Deportes', 'Sertaneja': 'Sertaneja', 'Samba e pagode': 'Samba y pagode',
  'Hip hop e rap': 'Hip hop y rap', 'Eletrônica': 'Electrónica', 'Jazz e blues': 'Jazz y blues', 'Clássica': 'Clásica', 'Latina': 'Latina', 'Country e folk': 'Country y folk', 'Anos 70, 80 e 90': 'Años 70, 80 y 90', 'Infantil': 'Infantil', 'K-pop e J-pop': 'K-pop y J-pop',
  'Conversa': 'Conversación', 'Cultura': 'Cultura', 'Música': 'Música', 'Romântica': 'Romántica', 'Chill e lo-fi': 'Chill y lo-fi', 'Ambiente e relax': 'Ambiente y relax', 'Soul e R&B': 'Soul y R&B', 'Indie e alternativa': 'Indie y alternativa', 'Tradicional e folclore': 'Tradicional y folclore',
  'Comunitária': 'Comunitaria', 'Universitária': 'Universitaria', 'Cristã': 'Cristiana', 'Árabe': 'Árabe', 'Francesa': 'Francesa', 'Mundo': 'Mundo'
};
const km = n => n;
const RULES = {
  en: [[/^Estações de (.+)\.$/, (m, a) => `Stations in ${a}.`], [/^Estações \((\d+)\)$/, (m, a) => `Stations (${a})`], [/^(.+) · (\d+) km do destino$/, (m, a, b) => `${a} · ${b} km from destination`], [/^(.+) está fora do ar\. Tentando (.+)…$/, (m, a, b) => `${a} is off the air. Trying ${b}…`],
    [/^Nenhuma estação cadastrada exatamente em (.+)\. Encontramos rádios a partir de (\d+) km do destino \(busca até (\d+) km\)\.$/, (m, a, b, c) => `No station registered exactly in ${a}. We found radios starting ${b} km from the destination (searched up to ${c} km).`],
    [/^Nenhuma estação perto de (.+)\. Mostrando as mais ouvidas do país\.$/, (m, a) => `No station near ${a}. Showing the most listened to in the country.`], [/^(\d+) km do destino$/, (m, a) => `${a} km from destination`], [/^Buscando a rádio…$/, () => 'Finding the radio…']],
  es: [[/^Estações de (.+)\.$/, (m, a) => `Emisoras de ${a}.`], [/^Estações \((\d+)\)$/, (m, a) => `Emisoras (${a})`], [/^(.+) · (\d+) km do destino$/, (m, a, b) => `${a} · ${b} km del destino`], [/^(.+) está fora do ar\. Tentando (.+)…$/, (m, a, b) => `${a} está fuera del aire. Probando ${b}…`],
    [/^Nenhuma estação cadastrada exatamente em (.+)\. Encontramos rádios a partir de (\d+) km do destino \(busca até (\d+) km\)\.$/, (m, a, b, c) => `No hay emisoras registradas exactamente en ${a}. Encontramos radios desde ${b} km del destino (búsqueda hasta ${c} km).`],
    [/^Nenhuma estação perto de (.+)\. Mostrando as mais ouvidas do país\.$/, (m, a) => `Sin emisoras cerca de ${a}. Mostrando las más escuchadas del país.`], [/^(\d+) km do destino$/, (m, a) => `${a} km del destino`], [/^Buscando a rádio…$/, () => 'Buscando la radio…']]
};
const D = { en: EN, es: ES };
let lang = 'pt', obs = null, names = null;
const tNodes = new WeakMap(), tAttrs = new WeakMap();
export const getLang = () => lang;
export function tr(s){
  if (lang === 'pt' || !s) return s; const k = s.trim(); if (!k) return s;
  const out = D[lang][k] ?? (() => { for (const [re, f] of RULES[lang]){ const m = k.match(re); if (m) return f(...m); } return null; })();
  return out == null ? s : s.replace(k, out);
}
export const countryName = (cc, fb) => { if (lang === 'pt' || !/^[A-Z]{2}$/.test(cc || '')) return fb; try { return (names ||= new Intl.DisplayNames([lang], { type: 'region' })).of(cc) || fb; } catch { return fb; } };
function doText(n){
  const cur = n.nodeValue, rec = tNodes.get(n), src = rec && rec.out === cur ? rec.src : cur, p = n.parentElement;
  let out = (p && p.tagName === 'OPTION' && /^[A-Z]{2}$/.test(p.value)) ? (lang === 'pt' ? src : countryName(p.value, src)) : tr(src);
  if (out !== cur) n.nodeValue = out; if (out !== src || rec) tNodes.set(n, { src, out });
}
function doAttr(e, a){
  const cur = e.getAttribute(a); if (cur == null) return; let rec = tAttrs.get(e); if (!rec) tAttrs.set(e, rec = {});
  const r = rec[a], src = r && r.out === cur ? r.src : cur, out = tr(src); if (out !== cur) e.setAttribute(a, out); if (out !== src || r) rec[a] = { src, out };
}
const ATTRS = ['placeholder', 'aria-label', 'title'];
function walk(root){
  if (root.nodeType === 3){ doText(root); return; } if (root.nodeType !== 1) return;
  if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(root.tagName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n = w.currentNode;
  for (; n; n = w.nextNode()){ if (n.nodeType === 3){ if (n.parentElement && !/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) && n.nodeValue.trim()) doText(n); } else for (const a of ATTRS) if (n.hasAttribute && n.hasAttribute(a)) doAttr(n, a); }
}
function run(fn){ if (obs) obs.disconnect(); try { fn(); } finally { if (obs) obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); } }
export function setLang(l){
  if (!LANGS[l]) l = 'pt'; lang = l; names = null; store.set('lang', l); document.documentElement.lang = l === 'pt' ? 'pt-BR' : l;
  run(() => walk(document.body)); const sel = document.getElementById('langSel'); if (sel) sel.value = l;
  document.dispatchEvent(new CustomEvent('wg:lang', { detail: l }));
}
export function initI18n(){
  const saved = store.get('lang'), nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  const sel = document.getElementById('langSel'); if (sel){ sel.replaceChildren(...Object.entries(LANGS).map(([k, v]) => Object.assign(document.createElement('option'), { value: k, textContent: v }))); sel.addEventListener('change', () => setLang(sel.value)); }
  obs = new MutationObserver(ms => run(() => { for (const m of ms){
    if (m.type === 'characterData') doText(m.target); else if (m.type === 'attributes') doAttr(m.target, m.attributeName); else m.addedNodes.forEach(n => walk(n)); } }));
  setLang(LANGS[saved] ? saved : (nav === 'es' ? 'es' : nav === 'pt' ? 'pt' : 'en'));
}
