# ComparaHipoteca V2

Simulador hipotecario web para calcular hipotecas fijas y variables, comparar
hasta cinco escenarios y compartir una simulación mediante URL. En las
hipotecas variables consulta directamente el último Euríbor publicado por el
Banco de España.

La aplicación es completamente cliente: no necesita base de datos, backend ni
credenciales. Las simulaciones comparadas solo viven durante la sesión actual.

## Requisitos

- Node.js 20 o posterior
- npm

## Desarrollo

```sh
npm ci
npm run dev
```

## Validación

```sh
npm test
npm audit
npm run typecheck
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm test` ejecuta las pruebas unitarias y de integración rápidas. Las E2E cubren
journeys críticos con Chromium sobre un build de producción en localhost:4173.
`npm run test:e2e` construye y arranca `npm run preview` automáticamente; no usa el
servidor de desarrollo. El Banco de España se simula con una respuesta fija y
las llamadas externas (incluido GA) se bloquean y hacen fallar el test. Las rutas
de Speed Insights se responden localmente. No se necesita internet para ejecutar
las E2E una vez instaladas las dependencias y Chromium.
En entornos que ya proporcionan Chromium puede indicarse su ruta con
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; CI utiliza el Chromium de Playwright.

El único check requerido `CI` usa Node 20, audita dependencias y ejecuta ambas
suites; reutiliza el build del mismo job con `PLAYWRIGHT_SKIP_BUILD=1`.
En fallos sube `playwright-failures` (reporte HTML, traces y capturas) durante
7 días; no graba vídeo. `codex-auto-merge` solo gestiona Ready y Auto-merge,
esperando al check requerido; las ramas `codex/review-*` Draft esperan al usuario.

## Arquitectura

- `src/domain`: modelo, validación y cálculos hipotecarios puros.
- `src/features/simulator`: interfaz y carga del Euríbor oficial.
- `src/features/comparison`: comparación local de hasta cinco simulaciones.
- `src/features/sharing`: serialización y lectura segura de URLs compartidas.
- `src/services`: cliente directo de la API pública del Banco de España.
- `src/analytics`: consentimiento, carga opcional de métricas, saneamiento de URLs
  y eventos con parámetros permitidos explícitamente.
- `tests`: pruebas con el test runner nativo de Node.js.

## Build de producción

```sh
npm run build
npm run preview
```

Vite genera los archivos estáticos en `dist/`; pueden desplegarse en cualquier
hosting estático.

## Analítica y privacidad

`VITE_GA_MEASUREMENT_ID` es un identificador público de GA4 con formato
`G-XXXXXXXXXX`; no es un secreto. Configúralo **solo en Production** en Vercel.
Sin esta variable, o si es inválida, la aplicación funciona sin cargar GA.
Incluso con un ID válido, GA solo funciona en el hostname exacto
`comparahipoteca.es` y después de aceptar analítica. Localhost, las previews y
`comparahipoteca-v2.vercel.app` nunca envían Analytics.

Antes de configurar el ID en producción, **desactiva Medición mejorada en el
flujo web de GA4**. Sus eventos automáticos (formularios, clics, scroll, etc.)
dependen de la configuración remota de Google y no forman parte de nuestra
allowlist. No configures Google Ads, Google Signals ni etiquetas adicionales.
El código desactiva el page view automático, Google Signals y las señales de
personalización publicitaria.

No se descarga `gtag.js` antes de aceptar. Usamos consentimiento básico:
`analytics_storage` pasa de `denied` a `granted` al aceptar; `ad_storage`,
`ad_user_data` y `ad_personalization` permanecen siempre `denied`.
Vercel Speed Insights también se monta únicamente tras aceptar.

La única preferencia persistida usa la clave
`comparahipoteca:analytics-consent:v1` con `accepted` o `rejected`. Si falla
localStorage, la elección funciona durante la carga actual. Las simulaciones
no se guardan. «Preferencias de privacidad» permite cambiar la elección.
Al revocar, se bloquean eventos, se actualiza el consentimiento a `denied`, se
eliminan best-effort solo las cookies propias `_ga`/`_ga_*` del dominio actual
y se recarga la página. También se respeta una revocación desde otra pestaña.

Todas las URLs de métricas se reducen a `origin + pathname`, sin query ni hash.
Los eventos usan un título fijo y un referrer vacío; la política HTTP
`no-referrer` evita enviar también la URL compartida en cabeceras. No se envían
campos financieros, IDs de comparación ni URLs compartidas. El saneamiento
también se aplica al middleware de Speed Insights.

Eventos permitidos:

| Evento | Cuándo se envía |
| --- | --- |
| `page_view` | Una vez por carga, después de aceptar. |
| `mortgage_calculated` | Resultado válido tras una modificación del usuario y 900 ms sin cambios. Escenarios duplicados se omiten mediante una firma exclusivamente en memoria, nunca enviada ni persistida. |
| `comparison_added` | Una simulación se añade correctamente. |
| `comparison_removed` | Una simulación se elimina correctamente, sin enviar su ID. |
| `simulation_shared` | Compartir finaliza correctamente. Solo permite `method`: `native`, `clipboard` o `manual` (copia de la URL de fallback). |
| `shared_simulation_opened` | Se restaura correctamente una URL `?sim=`, una vez y sin su contenido. |

Las acciones sin consentimiento no se acumulan para enviarlas posteriormente;
la apertura válida de una URL compartida sí puede registrarse una vez al
aceptar durante esa carga. La herramienta funciona igual al rechazar.
