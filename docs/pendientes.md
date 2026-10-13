# Pendientes (al cierre de la sesión del 2026-09-21)

## Antes de entregar / cambiar el DNS
- ~~**Imágenes originales**~~ **HECHO (2026-10-12).** Las 2.243 referencias (1.261 archivos) se cargaron con `node scripts/migrar-imagenes.mjs descargar | optimizar | instalar`, que baja los originales del WordPress viejo a un staging fuera del repositorio, los optimiza ahí y recién entonces los copia a `public/` y llama a `restaurar`. Quedó en **0 pendientes** (`node scripts/imagenes-pendientes.mjs estado`): 411 MB de originales → 109 MB en el repositorio. Dos bajas conscientes: un hotlink a `cdnx.jumpseller.com` que da 404 (tienda ajena), y la segunda aparición en el cuerpo de una imagen de `donde-empieza-el-camino` que ya se ve en su galería.
- **Portadas de números:** 24 son provisionales (`scripts/portadas-provisionales.json`); reemplazar por las reales.
- **Números vacíos:** 12 y 24 no tienen entradas (se conservan para completarlos). Los 27, 28, 29 y 30 ya las recuperaron: estaban en `sin-numero` y se asignaron por bloque de fecha (2026-10-12). **Falta `numero-05`**, que no existe como ítem.
- **4 entradas de WordPress en `sin-numero`** (autor "redaccion"): asignarles número y autor reales.
- **Autores:** se cargaron 63 fichas nuevas desde los índices de la revista (números 26 a 31) y 75 entradas tienen ya su autoría real. Las fichas van solo con el nombre: `biografia` pasó a ser opcional. Las entradas de los números 1 a 25 siguen con "redaccion" — necesitan sus índices para resolverse igual.
- **`/proyecto-2`:** la página vieja está en `/proyecto-2`; en el sitio nuevo es `/proyecto` (decisión: dejar así, el enlace viejo dará 404).
- **Tema claro y móvil:** no se verificó el badge compacto en el carrusel móvil, ni la etiqueta del buscador en tema claro, ni la galería de la entrada en un teléfono real.

## Campos nuevos: `notas` y `traducidoPor` (sin migrar)
- **`notas`:** 39 entradas ya tienen una sección `**Notas**` (notas al pie) escrita a mano dentro del cuerpo, antes de donde hoy va Biografía del autor / Bibliografía. El campo nuevo existe, pero esas 39 entradas no se migraron — el texto sigue en el cuerpo. Mover ese contenido al campo es un pedido aparte.
- **`traducidoPor`:** relación opcional con `autores`, para separar autoría original de traducción. Ninguna entrada existente fue migrada (las que dicen "Traducción de X" a mano en el cuerpo, o mencionan "traducción" en el texto, ~128 entradas) — sigue siendo texto libre en el cuerpo. Para completar el campo en una entrada hace falta que el traductor (y en algunos casos el autor original) exista como ficha en `autores`; hoy solo existen "Redacción" y "Riccardo Morello".

## Flujo de Keystatic
- **Protección de `main`:** los rulesets no funcionan en repos privados con plan gratuito. Hoy la única barrera es la redirección `/keystatic` → rama `keystatic` y fusionar solo con `verificar` en verde. Opciones: GitHub Team, o repo público (riesgos evaluados: contenido no publicado y correos de commits visibles).
- **Vista previa por rama** en Cloudflare (builds de ramas no productivas): sin verificar en el panel.
- **Aviso de builds fallidos (mejora opcional, hoy no hay ninguno roto):** si algún día un commit directo a `main` rompe el build, Cloudflare mantiene la versión anterior sin avisar. Los cambios que llegan por la rama `keystatic` ya pasan por `verificar`; solo queda sin cubrir un push directo a `main`.
- **Ampliar `verificar-keystatic.mjs`:** que avise de etiquetas HTML en títulos y de líneas "Missing image" en el cuerpo (hoy solo se limpiaron a mano).
- **Prueba pendiente:** confirmar que un simple F5 basta en la pestaña de la colaboradora tras `cerrar-ciclo`.

## Ideas ofrecidas y no pedidas
- Arrastrar con el mouse en la galería de la entrada (sin flechas, con mouse solo sirven trackpad/Shift+rueda/teclado).
- Barra lateral en la entrada (relacionadas + "Te podría interesar"): planeada, nunca aprobada.
- Diagramas de arquitectura (`scripts/migration-report/*architecture*`, `keystatic-vs-produccion*`): sin versionar y desactualizados (mencionan Vercel, Keystatic local y Pagefind).
