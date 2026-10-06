# Hardening HTTP

`vercel.json` usa el [mecanismo oficial de response headers de Vercel](https://vercel.com/docs/project-configuration/vercel-json#headers)
con `source: "/(.*)"`, para documentos, assets y rutas inexistentes. Solo configura
headers: no añade rewrites, redirects, fallback SPA, funciones ni cambios de cache.
La 404 estática conserva `noindex` y el enlace a `/`; su CSS se ha trasladado sin
cambiar las reglas a `public/404.css`. El estado HTTP 404 debe verificarse en Vercel.

## Headers y motivos

| Header | Valor / motivo |
| --- | --- |
| Content-Security-Policy | Política efectiva siguiente; limita recursos, scripts y conexiones. |
| X-Content-Type-Options | `nosniff`, evita interpretar contenido con un MIME diferente. |
| Referrer-Policy | `no-referrer`, coherente con el meta existente; protege queries compartidas. |
| X-Frame-Options | `DENY`, defensa para clientes antiguos junto a `frame-ancestors 'none'`. |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), web-share=(self)`; deshabilita capacidades sin uso y mantiene sharing propio. No restringe clipboard. |

No se añaden COEP, COOP ni CORP: la aplicación no necesita aislamiento entre
orígenes y consume recursos externos legítimos. Las directivas de Permissions
Policy son las documentadas por [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy);
`web-share=(self)` preserva explícitamente el [sharing nativo](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/web-share).

## CSP exacta

```text
default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'; script-src 'self' 'sha256-3iQbLsmX+x8/7qcmuFAmGeaKRsTztqU6++5eqZXum3c=' https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self' https://www.googletagmanager.com https://*.google-analytics.com; font-src 'self'; connect-src 'self' https://app.bde.es https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com; manifest-src 'self'
```

No contiene `unsafe-inline`, `unsafe-eval`, wildcard general ni permiso global
`https:`. Tampoco necesita `data:` para las imágenes actuales.

## Auditoría de recursos y orígenes

| Recurso / origen | Necesidad y permiso |
| --- | --- |
| `'self'` | Build React/Vite externo, CSS, favicon SVG y assets propios. No fuentes remotas. Sharing usa API nativa, clipboard o un campo local, sin proveedor externo. |
| `https://app.bde.es` | Solo `connect-src`: `src/services/euribor.ts` consulta `/bierest/resources/srdatosapp/favoritas`. No script ni proxy. |
| `https://www.googletagmanager.com` | `script-src` para `gtag/js`, más `img-src` y `connect-src` según la guía oficial GA sin Ads. No se usa un contenedor GTM. |
| `https://*.google-analytics.com` | `img-src` y `connect-src` para recolección GA, incluidos endpoints regionales. |
| `https://*.google.com` | Únicamente `connect-src`, conforme a la sección actual «Google Analytics without any Ads features» de la guía oficial. No autoriza scripts, imágenes ni frames de esos hosts. |

La allowlist GA se basa en la [guía oficial de CSP de Google](https://developers.google.com/tag-platform/security/guides/csp),
consultada el 2026-10-06, sección **sin Ads**. No se ha observado tráfico GA real
desde este entorno: los endpoints de esa guía son permisos de compatibilidad,
no una afirmación de conexiones capturadas. Se excluyen DoubleClick,
googleadservices, googlesyndication y dominios de Ads/remarketing. El código
mantiene Ads/Signals/personalización desactivados y solo carga GA en el hostname
exacto `comparahipoteca.es`, con ID válido y consentimiento aceptado.

Se inspeccionó `@vercel/speed-insights` **2.0.0**, su entrypoint React instalado y
la configuración de `App`: en producción, sin `dsn`, `scriptSrc`, `endpoint` ni
`basePath` personalizados, carga `/_vercel/speed-insights/script.js`; las métricas
usan el endpoint propio `/_vercel/speed-insights/vitals`. `'self'` basta. No se
autoriza el CDN de desarrollo `va.vercel-scripts.com`. Solo se monta tras aceptar.
Las pruebas locales simulan estas rutas; no comprueban la ingestión remota real.

`index.html` conserva el único script inline, JSON-LD; URLs de canonical,
Open Graph y `schema.org` son metadatos, no recursos descargados. No hay handlers
inline. La 404 usa ahora CSS externo. `PrivacyControls` mantiene su
`style={{ paddingBottom: ... }}`: React escribe propiedades CSSOM del elemento,
permitidas por CSP; no introduce `style="..."` en HTML estático ni usa `cssText`.
[MDN distingue estas operaciones](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr).
Una E2E con CSP HTTP comprueba el padding antes y después del consentimiento.

## Hash JSON-LD

El hash SHA-256 se calcula sobre los **bytes exactos del cuerpo** del script,
incluyendo espacios y saltos de línea, sin las etiquetas. No necesita nonce por
request ni permiso general para scripts inline. El test Node compara el hash
configurado con `index.html`; cualquier edición sin actualizarlo falla en CI.

Para recalcularlo desde la raíz del repo:

```sh
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const html = readFileSync('index.html', 'utf8');
const body = html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1];
console.log("'sha256-" + createHash('sha256').update(body).digest('base64') + "'");
NODE
```

Actualizar `script-src` en `vercel.json` y esta documentación, ejecutar tests y
build, y comprobar también el JSON-LD del HTML generado y la consola en Preview.

## HSTS y límites de la comprobación

Antes de modificar no existía `vercel.json`; el HTML ya tenía el meta
`no-referrer`. No se pudieron observar los headers HTTP previos de producción:
`curl -I https://comparahipoteca.es/` fue rechazado por el proxy del entorno
(`403`, `Domain forbidden`), antes de contactar con Vercel. Esa respuesta no
representa headers del sitio.

La [documentación de Vercel](https://vercel.com/docs/headers/response-headers#strict-transport-security)
declara HSTS predeterminado `max-age=63072000`. Se deja a la plataforma, sin
sobrescribirlo, duplicarlo ni añadir `preload` o `includeSubDomains` desde el
proyecto. El valor **real** del despliegue sigue pendiente de verificar; el valor
documentado no sustituye una captura HTTP de Preview/producción.

Los seis journeys existentes siguen ejecutándose sobre `vite preview`, que
**no aplica `vercel.json`**. Tres E2E adicionales interceptan documentos locales
y añaden estos headers HTTP a la respuesta para probar compatibilidad y bloqueo
de inline en Chromium; no prueban el edge de Vercel, su HSTS ni el estado 404 de
rutas inexistentes. BDE está simulado y toda petición externa inesperada falla.
GA está desactivado en localhost y Preview, aun con el ID dummy del build E2E.

## Revisión humana y producción

La rama `codex/review-phase-5c-security-headers` debe permanecer Draft hasta que
se revise la Preview. En un entorno con acceso, comprobar:

```sh
curl -I https://<preview>/
curl -I https://<preview>/ruta-que-no-existe
```

Verificar los cinco headers, HSTS de plataforma y HTTP **404** real en la segunda
respuesta. Revisar en navegador cálculo fijo, variable/Euríbor real, comparación,
sharing, preferencias, aspecto de la 404 y ausencia de errores CSP. Preview no
valida GA real por la restricción deliberada de hostname. Si Deployment
Protection impide el acceso, usar una sesión humana autorizada, sin abrir CSP.

**Después del merge**, en `https://comparahipoteca.es`, aceptar analítica y
comprobar `gtag.js`, eventos en GA4 Realtime, ausencia de errores CSP, Euríbor
real y Speed Insights. Revisar Network para confirmar que no hay conexiones
Ads/DoubleClick y que no se envían query/hash compartidos. Estas comprobaciones
remotas quedan pendientes; no están cubiertas por mocks ni por tests locales.

**Añadir una nueva dependencia externa puede requerir actualizar CSP**. Al
cambiar Analytics, Speed Insights o cualquier proveedor, inspeccionar su versión,
orígenes, cargas dinámicas y documentación oficial; permitir solo los recursos
necesarios y repetir tests, revisión Preview y verificación de producción. No
se añaden scanners externos como required CI ni dependencias nuevas.
