# Pokédex (PokeAPI + ASP.NET MVC 5)

Pokédex en español con todos los Pokémon de [PokeAPI](https://pokeapi.co): listado completo con búsqueda y filtros, y una ficha por especie con descripción, estadísticas, habilidades, tabla de daño recibido y cadena evolutiva.

**Web publicada:** https://froixrd.github.io/PokemonAPI/

El repositorio tiene dos versiones:

- `web/`: versión estática (HTML + JS) que se publica sola en GitHub Pages con cada push a `master`. Es la versión principal, con portada, menú y diseño propios.
- `WebApplication3/`: la aplicación ASP.NET MVC 5, para ejecutarla en IIS.

![Captura](https://github.com/froixrd/PokemonAPI/assets/88237009/47164cca-71fd-4a4c-a17a-37c52f5b92b0)

## Qué hace

- **Listado** de las 1025 especies con sprite y tipos. Búsqueda instantánea por nombre o número, filtro por tipo (hasta dos a la vez) y por generación, y orden por número o nombre. Los filtros se guardan en la URL, así que se pueden compartir.
- **Ficha** (`/pokemon/25` o `/pokemon/pikachu`): nombre, categoría y descripción en español, ilustración oficial normal y variocolor, grito, altura, peso, hábitat, ratio de captura, estadísticas base con barras, habilidades (con la oculta marcada), multiplicadores de daño por tipo y evoluciones con su condición (nivel, objeto, intercambio, amistad...).
- Navegación con el teclado: `/` enfoca la búsqueda, `←` `→` pasan al Pokémon anterior o siguiente.
- Modo claro y oscuro (sigue al sistema y se puede cambiar a mano).
- Páginas propias para Pokémon inexistente (404) y para cuando PokeAPI no responde (503).

## Cómo usa la API

Todo pasa por `Services/PokeApiClient.cs`:

- Un único `HttpClient` para toda la aplicación, con compresión gzip y tiempo máximo de 20 s.
- Caché en memoria de 12 h por respuesta, y si llegan varias peticiones a la vez a la misma URL se hace una sola llamada.
- Reintentos con espera creciente ante 429, 5xx o fallos de red. Los errores no se quedan en caché.
- El listado sale de 19 llamadas (lista de especies y los 18 tipos), no de una por Pokémon, y se precarga al arrancar la web.

`Services/PokemonService.cs` traduce las respuestas a los modelos de las vistas (`Models/PokedexViewModels.cs`).

## Web estática (GitHub Pages)

- `web/index.html`: portada con un Pokémon destacado distinto cada día, buscador y accesos por tipo y región.
- `web/pokedex.html`: listado con filtros. `web/pokemon.html?id=25` (o `?n=pikachu`): ficha.
- Desde cualquier página: búsqueda rápida (botón de la barra o tecla `/`) y Pokémon aleatorio.
- Al publicar, `tools/build-data.mjs` genera `data/pokedex.json` con todas las especies, su nombre en español, tipos y generación, y la tabla de daño de los 18 tipos. Así el listado carga de una vez, sin 1000 llamadas desde el navegador.
- Cada ficha pide a PokeAPI desde el navegador el Pokémon, la especie, las habilidades y la cadena evolutiva.
- Estilos en `web/css/site.css` (tipografía Outfit, modo claro y oscuro).
- El workflow `pages.yml` construye el sitio, lo prueba en Chromium contra la PokeAPI real (`tools/test-web.mjs`) y lo despliega. También se regenera cada lunes por si PokeAPI añade especies.

Para verla en local: `node tools/build-data.mjs web/data/pokedex.json` y servir la carpeta `web` con cualquier servidor estático.

## Ejecutar la versión MVC en local

1. Abrir `WebApplication3.sln` con Visual Studio 2022 (.NET Framework 4.7.2).
2. Restaurar paquetes NuGet y pulsar F5 (IIS Express).

## Compilación automática

Cada push a `master` compila el proyecto en GitHub Actions (incluidas las vistas Razor) y ejecuta `tools/smoke-test.ps1`, que comprueba contra la PokeAPI real que el listado, la ficha, las evoluciones y las páginas de error funcionan.

Pokémon y sus nombres son marcas de Nintendo, Creatures y GAME FREAK. Proyecto sin ánimo de lucro.
