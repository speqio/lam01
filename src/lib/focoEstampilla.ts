import { gsap } from 'gsap';

/**
 * Foco de una estampilla del archivo (túnel en desktop, órbita en móvil): la estampilla pasa
 * al centro, el fondo se difumina y su ficha queda al lado (desktop) o debajo (móvil). Todo en
 * un telón propio pegado al <body>: la estampilla original no se mueve del DOM (vive dentro de
 * una escena 3D con transform) y se anima una copia con FLIP desde donde estaba.
 *
 * La ficha sale del <template> del nodo de datos de la entrada (ArchivoCatalogo). Los estilos
 * del telón (.tunel-telon, .tunel-foco-est, .tunel-foco-ficha) viven en TunelEstampillas.astro.
 */
export interface OpcionesFoco {
  /** La cara (.estampilla-perforada) de la estampilla clicada, ya con su portada. */
  cara: HTMLElement;
  /** El elemento que se oculta mientras la copia está arriba. */
  origen: HTMLElement;
  /** Nodo de datos de la entrada: trae el <template> con la ficha y el título. */
  dato: HTMLElement;
  /** Se llama cuando el foco terminó de cerrarse (ya sin telón en el DOM). */
  alCerrar?: () => void;
}

export function abrirFoco({ cara, origen, dato, alCerrar }: OpcionesFoco) {
  const desde = cara.getBoundingClientRect();

  const telon = document.createElement('div');
  telon.className = 'tunel-telon';
  telon.setAttribute('role', 'dialog');
  telon.setAttribute('aria-modal', 'true');
  telon.setAttribute('aria-label', dato.dataset.titulo ?? '');

  const foco = cara.cloneNode(true) as HTMLElement;
  // Las clases de la cara original (túnel u órbita) se cambian por las del foco, para que su
  // tamaño no dependa del orden en que carguen los estilos de cada componente.
  foco.className = 'tunel-cara estampilla-perforada tunel-foco-est';
  foco.removeAttribute('style');

  const ficha = document.createElement('div');
  ficha.className = 'tunel-foco-ficha';
  const plantilla = dato.querySelector<HTMLTemplateElement>('template');
  if (plantilla) ficha.appendChild(plantilla.content.cloneNode(true));

  telon.append(foco, ficha);
  document.body.appendChild(telon);

  // FLIP: la copia parte de donde estaba la estampilla y llega a su sitio.
  const hasta = foco.getBoundingClientRect();
  origen.style.visibility = 'hidden';
  gsap.fromTo(telon, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  gsap.fromTo(
    foco,
    {
      x: desde.left - hasta.left,
      y: desde.top - hasta.top,
      scale: desde.width / hasta.width,
    },
    { x: 0, y: 0, scale: 1, duration: 0.7, ease: 'power3.inOut' }
  );
  gsap.fromTo(
    ficha,
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.5, delay: 0.35, ease: 'power2.out' }
  );

  let cerrando = false;
  const cerrar = () => {
    if (cerrando) return;
    cerrando = true;
    document.removeEventListener('keydown', alTeclado);
    // Se mide al cerrar: el movimiento de la escena está en pausa mientras el foco está abierto.
    const vuelta = cara.getBoundingClientRect();
    const ahora = foco.getBoundingClientRect();
    gsap.to(ficha, { opacity: 0, duration: 0.2 });
    gsap.to(foco, {
      x: `+=${vuelta.left - ahora.left}`,
      y: `+=${vuelta.top - ahora.top}`,
      scale: vuelta.width / ahora.width,
      duration: 0.55,
      ease: 'power3.inOut',
    });
    gsap.to(telon, {
      opacity: 0,
      duration: 0.4,
      delay: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        origen.style.visibility = '';
        telon.remove();
        alCerrar?.();
      },
    });
  };
  const alTeclado = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') cerrar();
  };
  document.addEventListener('keydown', alTeclado);
  telon.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('a')) return; // "Entrar al texto" navega
    cerrar();
  });
}
