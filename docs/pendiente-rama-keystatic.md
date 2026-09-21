# Pendiente: rama separada para los cambios de Keystatic

Estado: **propuesta, sin implementar** (decisión aplazada). Hoy todo va a `main`.

## Por qué se consideró
El cliente guarda contenido desde `/keystatic` (cada guardado es un commit a `main`) mientras se desarrolla la plataforma sobre los mismos archivos. Riesgos vistos:
- Un push de código sobre un `.mdoc`/`.json` abierto en Keystatic rompe su guardado.
- Un guardado que rompe el build congela producción sin aviso (ver CLAUDE.md, "A failed build freezes production").

## Idea
Los guardados del cliente van a una rama `keystatic`; después de revisarlos se pasan a `main`.

## Hechos verificados
- Keystatic guarda en la rama de la URL y abre por defecto la **rama predeterminada del repo** (hoy `main`). El commit y push a esa rama ya es automático.
- Keystatic tiene `branchPrefix` en su configuración (afecta qué ramas lista); solo existe `main` hoy y Cloudflare despliega `main`.

## Decisiones pendientes (con recomendación)
1. **Problema a resolver:** evitar choques y builds rotos sin aviso. → Justifica la rama.
2. **Cómo llega el cliente a la rama:**
   - A. Cambiar la rama predeterminada del repo a `keystatic` (los PR nuevos apuntarían ahí).
   - B. Mantener `main` y dar la URL `/keystatic/branch/keystatic/...` (frágil).
   - C. Fijar la rama en el código de la configuración de Keystatic (más robusto; verificar que sea limpio).
   - Recomendación: C si es limpio; si no, A. Descartar B.
3. **Aprobación:** pull request en GitHub (ver diff, aprobar, merge). Recomendado.
4. **Vista previa:** activar builds de ramas no productivas en Cloudflare Workers Builds para ver el cambio y detectar builds rotos antes de aprobar. Verificar coste/secretos en la URL de previsualización.
5. **Historial:** merge con *squash* (los mensajes de Keystatic, "Update src/content/...", no aportan al leer el historial).
6. **Evitar choques con el desarrollo:** no tocar `src/content` ni `public/images` en `main` sin avisar; tras cada merge a `main`, actualizar `keystatic` con `main` (un comando; automatizable con GitHub Actions).
7. **Publicación:** manual vía PR. Automatizar el merge quita la protección contra builds rotos.

## Para retomarlo
Verificar Q2 (fijar la rama en la configuración) y Q4 (previews en Cloudflare), y armar el plan con esas respuestas.
