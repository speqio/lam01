# Imágenes con duotono amarillo/rojo, para reemplazar

Detectadas analizando los píxeles de las 1.354 imágenes de `public/images`, y verificadas a ojo en los bordes del criterio. El rasgo que las identifica es que **el color es función del brillo**: una rampa de un solo eje, de rojo oscuro a amarillo. Una foto cálida o un sepia no lo cumplen, y por eso quedaron fuera los frescos pompeyanos de `10-epigramas-eroticos`, las litografías del XIX y las fotos de las minas de `animalismo-subsole`.

**205 archivos en 194 entradas al detectarlas.** 186 son portadas.

## Dudosas, decidir a ojo (no están en la lista)

- `delcielo-y-gunen…-comun-silvestre-3/portada.webp` — cartel impreso a dos tintas. Tiene la paleta, pero puede ser el original del afiche y no el tratamiento.
- `galeria-rectangulo-de-plata-8/polanco-6.jpg` — foto de un papel rojo. Es rojo de verdad, no duotonado.


## Ya reemplazadas con el original

**97 portadas** de los números 21 a 26 y 29 a 30 se reemplazaron por los originales en
color que entregó la revista, y salen de la lista de abajo: 41 el 2026-10-12 (números 26,
29 y 30) y 56 el 2026-10-13 (números 21 a 25).

El mapeo sale del índice de cada número: por el ordinal del nombre del archivo donde lo
trae (29 y 30) y por el nombre contra título y autor donde no. Dos cosas que hubo que
corregir, las dos silenciosas:

- **El ordinal hay que quitarlo antes de comparar.** "2 Bolaño.jpg" normaliza a
  "2 bolano" y ese token suelto le hacía ganar a la entrada "Baño" sobre la de Bolaño.
- **Cada índice tiene su forma, y la que no se reconoce se omite sin avisar.** El del 21
  escribe una línea por pieza ("/ensayo/ Título por Autor") en vez de bloques de
  categoría, así que el lector no encontraba ninguna categoría y el número entero
  quedaba fuera. El del 20 además anota recados al lado del autor ("dejar imagen",
  "te mando imagen") que, sin quitarlos, crean fichas como "Marcelo Mellado dejar imagen".

Quedan sin resolver, y vuelven a la lista:

- `borges-testigo-del-infinito`: su original (`4. Miguel Ogalde-Borges.jpg`) está dañado
  —sharp lo rechaza con "Invalid SOS parameters for sequential JPEG"—. Hay que pedirlo
  de nuevo.
- `mallarme-y-los-libros` (número 21): el zip trae 12 archivos para 12 piezas, pero dos
  son de Ana Cristina Cesar y ninguno es de esta. Falta su imagen.
- Una del número 23 sin resolver: `IMG-20250304-WA0025.jpg`, nombre de WhatsApp que no
  dice nada. Puede ser de `bano` o de la entrevista a `rodrigo-arroyo-castro-inubicalistas`,
  que quedó sin archivo; hay que preguntarlo antes de aplicarla.
- El número **20** tiene índice pero **no zip**, y los números **4 a 19** no tienen
  ninguno de los dos.

Nota sobre resolución: las portadas duotonadas miden todas 961 px y varios originales son
menores (460–960 px). Se reemplazaron igual, que es el objetivo de la tanda; a 1400 px de
tope y una columna de ~700 px la diferencia no se ve. Donde la revista mandó dos fotos de
la misma persona se tomó la de mayor lado (Ana Cristina Cesar: 730 px en vez de 460).

**Quedan 110 archivos en 99 entradas.**

## Lista

- [ ] **3001**
      - portada: `portada.jpg`
- [ ] **4-poemas**
      - portada: `portada.jpg`
- [ ] **5-poemas**
      - portada: `portada.jpg`
- [ ] **5-poemas-2**
      - portada: `portada.jpg`
- [ ] **5-poemas-4**
      - portada: `portada.jpg`
- [ ] **6-poemas-2**
      - galeria+cuerpo: `juan-pablo-navia.webp`
      - portada: `portada.jpg`
- [ ] **7-poemas**
      - ?: `portada.jpg`
- [ ] **a-proposito-de-proteccion-de-la-raza-historias-de-eugenesia-y-profilaxia-social-en-chile-de-guido-flores**
      - portada+galeria: `proteccion-raza.jpg`
- [ ] **asumir-pero-hasta-ahi-noma-ideas-sobre-no-soy-yo**
      - portada: `portada.jpg`
- [ ] **bandera-roja**
      - portada: `portada.jpg`
- [ ] **bangutot**
      - portada: `portada.jpg`
- [ ] **bano**
      - portada: `portada.webp`
- [ ] **bastonero-de-aldea**
      - portada+cuerpo: `portada.jpg`
- [ ] **borges-testigo-del-infinito**
      - portada: `portada.webp`
- [ ] **carta-de-amor-a-j-alfred-prufrock**
      - galeria+cuerpo: `cartamor.webp`
      - portada: `portada.jpg`
- [ ] **casas-de-luz-para-criaturas-pequenas**
      - portada: `portada.jpg`
- [ ] **catalejo-30-anos-en-su-propia-tinta**
      - portada: `portada.jpg`
- [ ] **chacabuco-calle-rota-en-todo-chile-presentacion-de-ruptugrafia-de-alex-bay**
      - portada: `portada.jpg`
- [ ] **combustion-interna**
      - portada: `portada.jpg`
- [ ] **de-chamanes-y-poetas-malditos**
      - portada+galeria: `artaud.webp`
- [ ] **defensa-del-marxismo-de-jose-carlos-mariategui-presentacion-a-la-segunda-reedicion**
      - portada: `portada.jpg`
- [ ] **deseo-rescate-desgaste-un-ejercicio-oulipiano**
      - galeria+cuerpo: `deseo.webp`
      - portada: `portada.jpg`
- [ ] **despues-de-las-doce-ya-se-puede-tomar**
      - portada: `portada.jpg`
- [ ] **dos-hermanas**
      - portada: `portada.jpg`
- [ ] **el-asco-y-el-grito-de-sergio-rojas**
      - portada: `portada.jpg`
- [ ] **el-bolero-impudico-de-patricio-contreras**
      - portada: `portada.jpg`
- [ ] **el-bombero-del-mar**
      - portada: `portada.jpg`
- [ ] **el-factor-ecologico-en-la-critica-literaria**
      - portada: `portada.jpg`
- [ ] **el-feminismo-se-hizo-palabra-y-sentido-comun**
      - portada: `portada.jpg`
- [ ] **el-fin-del-acontecimiento-otra-pregunta-por-el-futuro-de-la-historia**
      - galeria+cuerpo: `muro.webp`
      - portada: `portada.jpg`
- [ ] **el-horizonte-utopico-de-lo-venidero**
      - portada: `portada.jpg`
- [ ] **el-impacto-indefinible-sentir-poesia-leer-poesia-escribir-poesia**
      - portada: `portada.webp`
- [ ] **el-jardin-de-manzanos-de-alejandra-wolleter-y-fabiola-narvaez**
      - portada: `portada.jpg`
- [ ] **el-mudo**
      - portada: `portada.jpg`
- [ ] **el-patio-de-atras**
      - portada: `portada.jpg`
- [ ] **empedocles-dios-supuesto**
      - portada: `portada.jpg`
- [ ] **escribir**
      - portada: `portada.jpg`
- [ ] **feliz-cumpleanos-vecino-artista**
      - portada: `portada.jpg`
- [ ] **fernanda-meza**
      - portada: `portada.jpg`
- [ ] **fotografo-javier-godoy-lo-que-me-gusta-del-futbol-es-el-fenomeno-ritual-y-social-al-que-esta-asociado**
      - portada+galeria+cuerpo: `portada.jpg`
- [ ] **frivolidad**
      - portada: `portada.jpg`
- [ ] **galeria-rectangulo-de-plata-3**
      - portada: `portada.jpg`
- [ ] **galeria-rectangulo-de-plata-4**
      - portada: `portada.jpg`
- [ ] **galeria-rectangulo-de-plata-5**
      - portada+galeria+cuerpo: `portada.jpg`
- [ ] **galeria-rectangulo-de-plata-6**
      - portada+galeria+cuerpo: `portada.jpg`
- [ ] **galeria-rectangulo-de-plata-8**
      - portada: `portada.webp`
- [ ] **gandhi-un-asesinato-que-siempre-vuelve**
      - portada: `portada.jpg`
- [ ] **garrido-cadiz-en-el-submundo**
      - galeria+cuerpo: `escalera.webp`
      - portada: `portada.jpg`
- [ ] **gaspar-penaloza-avsolomovich**
      - portada: `portada.jpg`
- [ ] **grita-la-lluvia-cantan-las-flores-presentacion-del-libro-objeto-marta-de-mariana-zegers-izquierdo**
      - portada: `portada.jpg`
- [ ] **intimidad**
      - portada: `portada.jpg`
- [ ] **kit-de-supervivencia-de-ninas-que-usaban-baby-g-amarillo-de-natasha-isabella-martinez**
      - portada: `portada.webp`
- [ ] **la-caracas-suicida-de-ricardo-azuaje**
      - portada: `portada.jpg`
- [ ] **la-escritura-ginocentrica-de-mary-daly**
      - portada: `portada.jpg`
- [ ] **la-espera-es-mala-consejera**
      - portada: `portada.jpg`
- [ ] **la-exempla-de-sylvia-plath-alejandro-salas**
      - portada: `portada.jpg`
- [ ] **la-hegemonia-norteamericana-en-america-latina-i-desde-el-plan-marshall-a-la-intervencion-en-guatemala-1945-1952**
      - portada: `portada.jpg`
- [ ] **la-hegemonia-norteamericana-en-america-latina-ii-la-conciencia-norteamericana-la-revolucion-de-fidel-y-la-alianza-para-el-progreso-1958-1965**
      - galeria+cuerpo: `10kmiles4.webp`
      - portada: `portada.jpg`
- [ ] **la-proteccion-de-la-raza-chilena-historias-de-eugenesia-y-profilaxia-social**
      - portada: `portada.jpg`
- [ ] **la-quebrada**
      - portada: `portada.jpg`
- [ ] **la-residencia-de-paula-lavanderos-en-la-usera-de-madrid**
      - portada+cuerpo: `portada.jpg`
- [ ] **la-salida-insurreccional-a-la-dictadura-y-el-surgimiento-del-fpmr-autonomo**
      - portada: `portada.jpg`
- [ ] **la-urbex-de-la-lengua**
      - portada: `portada.jpg`
- [ ] **las-aves**
      - portada: `portada.jpg`
- [ ] **lo-que-el-ojo-no-ve-la-imaginacion-lo-atraviesa**
      - portada: `portada.jpg`
- [ ] **los-aeroplanos-de-brescia**
      - portada: `portada.jpg`
- [ ] **los-monstruos-del-nuevo-mundo-una-vision-europea**
      - portada: `portada.jpg`
- [ ] **mallarme-y-los-libros**
      - portada: `portada.jpg`
- [ ] **nunca-tuve-un-cuarto-propio**
      - portada: `portada.jpg`
- [ ] **pancho-sazo-no-tenemos-vuelta-estamos-condenados-a-ser-seres-humanos**
      - portada: `portada.jpg`
- [ ] **paolo-bortolameolli-el-maestro-que-no-para-nunca**
      - portada: `portada.jpg`
- [ ] **pasaje-cerrado**
      - portada: `portada.jpg`
- [ ] **pase-por-copiapo**
      - galeria+cuerpo: `copiapo.webp`
      - portada: `portada.jpg`
- [ ] **poema-y-duelo-sobre-ninos-en-el-rio-de-teofilo-cid**
      - portada: `portada.jpg`
- [ ] **poesia-transactivismos-y-otros-cuentos-analisis-descarrilado-sobre-transpoesia-y-la-guerra-cultural-en-curso**
      - portada: `portada.jpg`
- [ ] **postfacio-en-intercepto-intercambio-interrumpido-a-limo-de-natalia-rojas**
      - portada: `portada.jpg`
- [ ] **presentacion-de-que-hay-detras-de-la-ventana-letra-imagen-musica-arte-x-roberto-bolano**
      - portada: `portada.jpg`
- [ ] **que-es-el-pensamiento-politico-radical-algunas-consideraciones-ejecutivas**
      - portada: `portada.jpg`
- [ ] **raices-ritos-y-huacas-un-camino-que-se-abre**
      - portada: `portada.jpg`
- [ ] **recabarren-el-despertar-de-los-trabajadores-y-la-casa-del-pueblo**
      - portada: `portada.jpg`
- [ ] **recuerdos-del-porvenir**
      - portada: `portada.jpg`
- [ ] **reflexiones-sobre-diversidad-e-interculturalidad-en-la-escuela**
      - portada: `portada.webp`
- [ ] **ricardo-azuaje-a-cuatro-tiempos-y-la-narrativa-venezolana-de-los-90**
      - galeria+cuerpo: `4tiempos.webp`
      - portada: `portada.jpg`
- [ ] **rodrigo-arroyo-castro-inubicalistas-privilegia-lo-que-no-esta-necesariamente-en-el-lugar-del-canon-literario-o-las-ventas**
      - portada: `portada.webp`
- [ ] **sobre-la-oscuridad-y-sus-efectos-en-dos-poemas-de-jorge-teillier**
      - portada: `portada.jpg`
- [ ] **socavon-zombi**
      - portada: `portada.jpg`
- [ ] **stasiologia-guerra-civil-formas-de-vida-capitalismo-de-rodrigo-karmy-los-momentos-del-texto**
      - portada: `portada.jpg`
- [ ] **terror-consenso-y-monumento-politicas-de-patrimonio-cultural-en-las-dictaduras-de-chile-y-uruguay-1973-1989**
      - galeria+cuerpo: `monumento.webp`
      - portada: `portada.jpg`
- [ ] **too-much-munch**
      - portada: `portada.jpg`
- [ ] **traccion-a-sangre-de-sergio-guerra-la-intima-victoria-de-lo-comun**
      - portada: `portada.jpg`
- [ ] **trizaduras-refracciones-y-silencios-una-poetica-de-la-transparencia-en-objetos-de-vidrio-de-jaime-villanueva-donoso**
      - portada: `portada.jpg`
- [ ] **turismo-del-abandono-o-turistas-en-el-abandono**
      - portada: `portada.jpg`
- [ ] **un-cine-que-baila-1-el-desierto-de-nacer-khemir**
      - portada: `portada.jpg`
- [ ] **un-cine-que-baila-2-la-petite-vendeuse-du-soleil-de-mambety-diop**
      - galeria+cuerpo: `cinequebaila.webp`
      - portada: `portada.jpg`
- [ ] **un-paseo-circular**
      - portada: `portada.jpg`
- [ ] **un-viaje-a-la-selva-peruana**
      - portada: `portada.jpg`
- [ ] **una-roca-se-deshilacha-en-el-calor-del-utero-o-algo-asi-presentacion-de-retablo-de-natalia-rojas**
      - portada: `portada.jpg`
      - galeria+cuerpo: `rocas.webp`
- [ ] **valparaiso-ciudad-de-contradicciones**
      - portada: `portada.jpg`
- [ ] **yo-le-doy-mi-nombre-de-viviana-ponce-escudero**
      - portada: `portada.jpg`
