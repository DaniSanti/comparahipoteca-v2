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
npm run typecheck
npm run lint
npm run build
```

## Arquitectura

- `src/domain`: modelo, validación y cálculos hipotecarios puros.
- `src/features/simulator`: interfaz y carga del Euríbor oficial.
- `src/features/comparison`: comparación local de hasta cinco simulaciones.
- `src/features/sharing`: serialización y lectura segura de URLs compartidas.
- `src/services`: cliente directo de la API pública del Banco de España.
- `tests`: pruebas con el test runner nativo de Node.js.

## Build de producción

```sh
npm run build
npm run preview
```

Vite genera los archivos estáticos en `dist/`; pueden desplegarse en cualquier
hosting estático.
