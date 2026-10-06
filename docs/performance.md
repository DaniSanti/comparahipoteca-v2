# Bundle / performance budget

El presupuesto evita regresiones accidentales del peso del frontend. Es un
guardrail, no un objetivo que haya que llenar ni una puntuación de rendimiento.
Speed Insights observa el rendimiento real de usuarios que aceptan métricas;
el bundle budget es un control determinista en CI. Son complementarios.

## Baseline y límites

Baseline medido el 6 de octubre de 2026 sobre `main` (`0fc76b2`, Fase 5A), con
Node 20.20.2, `npm ci` y build de producción con
`VITE_GA_MEASUREMENT_ID=G-E2ETEST000`, igual que CI. Hay un JS y un CSS.
No se detectaron anomalías que justifiquen optimizaciones o code splitting.

| Métrica | Baseline (bytes) | Presupuesto (bytes) | Margen |
| --- | ---: | ---: | ---: |
| JS total raw | 174.020 | 210.000 | 20,7 % |
| JS total gzip | 56.841 | 68.000 | 19,6 % |
| Mayor chunk JS gzip | 56.841 | 68.000 | 19,6 % |
| CSS total raw | 9.743 | 12.000 | 23,2 % |
| CSS total gzip | 2.746 | 3.400 | 23,8 % |

El mayor JS raw también es de 174.020 bytes. Archivos de referencia:
`index-DrQzfBZ7.js` y `index-B5UdTz8r.css`; sus hashes no forman parte del check.
KB significa 1.000 bytes. Los límites se comparan en bytes sin redondear.

Gzip aproxima el peso transferido comprimido y permite una comparación estable.
Usamos `gzipSync` de Node con nivel 9 fijo y sumamos los tamaños de cada archivo
comprimido por separado, como respuestas HTTP independientes. Por eso puede
diferir ligeramente del gzip que muestra Vite (nivel por defecto). No mide
tiempo de ejecución, Core Web Vitals ni una configuración real de CDN/Brotli.

## Ejecutar y mantener

```sh
npm run build
npm run check:bundle
```

El checker solo lee los `.js` y `.css` de `dist/assets/`, sin depender de sus
hashes ni de un número concreto de chunks. Ignora mapas, HTML, favicon y otros
assets. Falla si falta el build, si faltan categorías o si excede cualquier
límite, e informa del valor, presupuesto y exceso. Controlar JS total además
del mayor chunk permite code splitting sin ocultar crecimiento acumulado.
No hace llamadas de red ni necesita dependencias nuevas.

`CI` ejecuta `check:bundle` justo después del build existente con el ID dummy;
Playwright reutiliza ese mismo `dist` y bloquea tráfico externo. El dummy nunca
se envía a Analytics. Los tests del checker usan fixtures temporales sin builds.

Para cambiar un límite, mide de nuevo con Node 20 y el mismo build que CI,
investiga qué explica el crecimiento y propone explícitamente los nuevos bytes
en `scripts/bundle-budget.mjs` junto con la justificación y esta tabla en una PR.
No se recalculan límites automáticamente a partir de otro build o de GitHub.
