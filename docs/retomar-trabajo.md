# Retomar el proyecto en otra máquina

Qué hacer si te sentás a trabajar en una máquina donde el repositorio quedó
atrasado (no se usó desde antes del PR #16/#17), para no repetir el conflicto
de merge que pasó por tener `keystatic` separada de `main` por 16 commits y
635 archivos. Detalle completo del porqué de la rama `keystatic` en
[flujo-keystatic.md](flujo-keystatic.md); detalle de por qué las imágenes
viven en el repo y cómo se optimizan en
[imagenes-y-cms.md](imagenes-y-cms.md). Esto es el checklist operativo.

## 1. Poner al día las ramas

```bash
git fetch origin

git checkout main
git pull --ff-only origin main

git checkout keystatic
git reset --hard origin/keystatic   # keystatic nunca se edita a mano; siempre refleja al remoto
```

Si `keystatic` y `main` ya están iguales (lo normal justo después de un
`cerrar-ciclo`), no hace falta nada más acá.

## 2. Windows: rutas largas

Varias carpetas de `public/images/entradas/<slug-largo>/...` superan los 260
caracteres que Windows permite por defecto. Si un `checkout`/`clone` falla con
`Filename too long`, correr una sola vez en el repo:

```bash
git config core.longpaths true
git checkout -- .
```

## 3. Dependencias

```bash
npm ci
```

`npm ci` (no `npm install`) para respetar exactamente el `package-lock.json`
del repo — por si la otra máquina quedó con versiones distintas.

## 4. Verificar que todo compila antes de tocar nada

```bash
node scripts/verificar-keystatic.mjs && npm run build
```

Si esto pasa en limpio, la máquina está al día y lista para trabajar.

## 5. Si vas a editar contenido/imágenes

Confirmá primero que `keystatic` no tiene guardados del cliente sin fusionar
(`git log main..keystatic` debería estar vacío apenas se hizo `cerrar-ciclo`).
Si hay commits ahí que no estén en `main`, son guardados pendientes de un PR —
no los pises.

---

# Evitar errores de imágenes a futuro

El origen de los dos problemas que tuvimos (conflicto de merge en 4 portadas,
y una portada que no bajaba de 250 KB) fue el mismo: imágenes que entraron al
repo **sin pasar por el optimizador**, y una rama `keystatic` que se dejó
crecer demasiado antes de fusionar.

## Antes de subir una imagen nueva (portada, galería, lo que sea)

1. Subila desde Keystatic como siempre.
2. Apenas termines de guardar, corré el optimizador **localmente**, acotado a
   esa entrada para no tocar el resto del repo:

   ```bash
   node scripts/optimizar-imagenes.mjs --solo=<parte-del-slug>
   ```

   Sin `--escribir` es solo informe. Si dice que hay algo para optimizar:

   ```bash
   node scripts/optimizar-imagenes.mjs --solo=<parte-del-slug> --escribir
   ```

3. Corré la verificación antes de avisar que el PR está listo:

   ```bash
   node scripts/verificar-keystatic.mjs
   ```

   Si pasa acá, el check `verificar` del PR también va a pasar — no hay que
   esperar a que falle en GitHub para enterarse.

## Si una imagen no baja de 250 KB ni al lado máximo (1600 px)

Pasó con una foto de grano fino (586 KB a 1234×1569, ya en calidad mínima).
El optimizador no agranda ni empeora una imagen más allá de cierto punto; si
queda arriba del tope avisa "ya está al mínimo con este formato" y hay que
decidir a mano:

```bash
node scripts/optimizar-imagenes.mjs --lado=1000 --solo=<parte-del-slug> --escribir
```

Bajar el lado largo (1000, 1200...) es la primera palanca. Si ni así entra,
la alternativa es reemplazar la imagen por una más liviana de origen, o
anotar la excepción consciente en `scripts/imagenes-grandes-aceptadas.json`
con el motivo (hoy está vacío a propósito, ver imagenes-y-cms.md).

## No editar `public/images` ni `src/content` directo en `main`

Es la causa exacta del conflicto de merge que tuvimos: una portada se subió
por un lado en `keystatic` y por otro en `main`, mismo nombre de archivo,
contenido distinto → conflicto binario sin resolución automática. Todo el
contenido (texto e imágenes) entra **solo** por `keystatic`, vía Keystatic o
los scripts de migración. `main` es solo código.

## No dejar `keystatic` crecer sin fusionar

Cuanto más tiempo pasa un ciclo abierto, más grande el PR y más probable el
conflicto si además alguien toca `main`. Seguir el ciclo de
[flujo-keystatic.md](flujo-keystatic.md): PR → `verificar` en verde → squash
and merge → `node scripts/keystatic-sync.mjs cerrar-ciclo` apenas se hace el
squash, sin esperar el deploy de Cloudflare.
