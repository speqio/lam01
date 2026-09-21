# Pendientes (al cierre de la sesión del 2026-09-21)

## Antes de entregar / cambiar el DNS
- **Imágenes originales:** ~1400 referencias siguen sin archivo (`node scripts/imagenes-pendientes.mjs estado`). Falta el script de migración masiva (copiar originales por nombre a `public/images/…` y correr `restaurar`); necesita los archivos originales.
- **Portadas de números:** 24 son provisionales (`scripts/portadas-provisionales.json`); reemplazar por las reales.
- **Números vacíos:** 12, 24, 27, 28, 29 y 30 no tienen entradas (se conservan para completarlos).
- **4 entradas de WordPress en `sin-numero`** (autor "redaccion"): asignarles número y autor reales.
- **Autores:** solo quedan "Redacción" y "Riccardo Morello"; cargar los reales (las entradas migradas usan "redaccion").
- **`/proyecto-2`:** la página vieja está en `/proyecto-2`; en el sitio nuevo es `/proyecto` (decisión: dejar así, el enlace viejo dará 404).
- **Tema claro y móvil:** no se verificó el badge compacto en el carrusel móvil, ni la etiqueta del buscador en tema claro, ni la galería de la entrada en un teléfono real.

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
