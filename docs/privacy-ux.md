# Aviso compacto de analítica y privacidad

La primera capa es una barra inferior no modal: el simulador sigue disponible.
En escritorio (desde 760 px), texto y acciones comparten una fila; en móvil,
las acciones van debajo. El ancho máximo coincide con los 1100 px del contenido.

Medición local en Chromium, primera capa cerrada y fuente al 100 %:

| Ventana | Altura anterior | Altura nueva | Reducción de altura |
| --- | ---: | ---: | ---: |
| Escritorio, 1440 × 900 | 226 px | 90 px | 60 % |
| Móvil, 390 × 844 | 268 px | 161 px | 40 % |

La referencia anterior es el componente de `main` (`7516f5f`) con su CSS y
contenido originales, medido en las mismas ventanas. Son medidas en píxeles
CSS; cambian con el ancho, el zoom, las fuentes y las áreas seguras del dispositivo.

El título y «Más información» comparten línea cuando caben. El mensaje breve
explica qué se usa, su finalidad y que requiere aceptación. «Aceptar» y
«Rechazar» tienen igual ancho, color y altura mínima de 44 px. El nombre accesible
del primer botón sigue siendo «Aceptar analíticas».

El detalle se abre solo bajo demanda, con un botón que expone `aria-expanded`
y `aria-controls`; incluye Google Analytics 4, Vercel Speed Insights, las
exclusiones de datos financieros y URLs, la persistencia y la revocación.
Elegir una opción cierra el aviso y restablece el detalle cerrado al reabrirlo.
Abrir el detalle, navegar o seguir usando el simulador no implica consentimiento.

La lógica existente de consentimiento no cambia: no se carga GA ni se monta
Speed Insights antes de aceptar, la elección se guarda en el navegador y puede
cambiarse desde «Preferencias de privacidad». Revocar bloquea los eventos,
limpia las cookies propias de GA y recarga según el controlador existente.

La altura es automática, sin recortar ni reducir el texto con zoom. El aviso
respeta las áreas seguras del móvil y limita su altura al 70 % de la ventana;
si se necesita más espacio, permite desplazamiento interno. El pie reserva la
altura medida del aviso y el área segura. Se mantiene el ajuste de desplazamiento
para que el aviso no oculte los controles del simulador enfocados con teclado.
No se añaden animaciones, fuentes externas ni dependencias.

Las pruebas de Chromium verifican 320, 390 y 1440 px, botones equivalentes de
al menos 44 px, apertura con teclado, reserva de espacio y restauración de foco.
También comprueban los controles con texto al 200 % en una ventana de 320 × 320.
La suite existente cubre consentimiento, persistencia, simulación, comparación,
sharing y CSP. Las pruebas locales simulan servicios externos; la Preview de
Vercel y los servicios reales siguen requiriendo la revisión habitual.
