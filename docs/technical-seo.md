# Fase 4C — SEO técnico

## Auditoría inicial (main, 4f5bff4)

- `index.html` y el build inicial contienen una canonical única a `https://comparahipoteca.es/`; `og:url` y JSON-LD usan también ese dominio. No hay metadatos SEO inyectados por React ni `noindex` en HTML.
- El título anterior era «ComparaHipoteca - Simulador hipotecario». La descripción no indicaba el mercado español y Open Graph tenía otra descripción más corta. Existía `meta keywords`; faltaban `og:site_name`, `og:locale` y Twitter cards.
- JSON-LD válido: `WebApplication`, `FinanceApplication`, navegador con JavaScript y `Offer` gratuito en EUR. La marca aparecía con un espacio.
- `robots.txt` repetía la misma regla para cuatro bots y para `*`, sin sitemap. No existía sitemap.
- El único asset público gráfico es `favicon.png`; no hay imagen diseñada para compartir. El build inicial copia el favicon y robots a la raíz.
- Sharing usa el formato v1 fijo/variable. El simulador lee `window.location.href` al inicializarse; no elimina `sim` ni modifica los metadatos.
- No existe `vercel.json` ni rewrite global en el repositorio. La comprobación HTTP de producción de `/esto-no-existe` fue bloqueada por la política de red del entorno (403 del proxy, no del sitio); no se afirma haber verificado el 404 remoto.

## Decisiones

La canonical permanece en el HTML original y es la misma para `/` y cualquier query, incluido `?sim=...`. No se cambia el formato de sharing ni la URL del usuario. La canonical es una señal de consolidación para buscadores; no garantiza por sí sola que estos nunca indexen una variante.

Title, description, Open Graph y Twitter describen el simulador con el mismo contenido. Se elimina `keywords`. No se añade imagen social ni cuentas inventadas. JSON-LD conserva la aplicación y su oferta gratuita, normaliza la marca y añade idioma y acceso gratuito.

El sitemap contiene exclusivamente la raíz canónica, sin `lastmod` artificial. Robots permite rastreo normal y anuncia el sitemap; no bloquea queries.

Según la configuración existente indicada para esta tarea, Vercel Preview proporciona `X-Robots-Tag: noindex`. Se mantiene esa protección en la plataforma: el HTML compartido con Production no incorpora `noindex`, ni se añade lógica React o configuración Vercel. El redirect 308 de `www` permanece gestionado externamente. No se añaden rewrites: el estado HTTP de rutas inexistentes debe verificarse en Vercel, no con el fallback del servidor de desarrollo de Vite.

La aplicación sigue siendo una SPA renderizada en cliente. Los metadatos están disponibles sin ejecutar JavaScript, pero el contenido funcional requiere renderización JavaScript por el buscador. SSR o prerender podrían evaluarse en otra fase.

## Verificación

`tests/technicalSeo.test.mjs` comprueba canonical única y exacta, idioma, título, descripción, ausencia de keywords/noindex, coherencia social, JSON-LD válido, el documento XML mínimo completo del sitemap, su única URL, robots, ausencia del dominio antiguo en SEO público y round-trip de simulaciones sobre el dominio canónico. No incorpora dependencias.

Tras el build se deben comprobar `dist/index.html`, `dist/robots.txt`, `dist/sitemap.xml` y `dist/favicon.png`; validar XML con un parser y JSON-LD con `JSON.parse`. Para revisión en Vercel: comprobar `/`, una query `sim` válida, los tres assets raíz, `X-Robots-Tag` de Preview y 404 para `/esto-no-existe`.

`npm audit` detectó GHSA-68fv-2mgg-jv7q en la dependencia transitiva de desarrollo `source-map-js` 1.2.1. Se actualiza únicamente esa entrada del lockfile a 1.2.2 para cumplir cero vulnerabilidades; `package.json` permanece igual.
