import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { cardImageWrap, cardBadge } from '../../lib/cardStyles';
import { normalizeTitleText } from '../../lib/text';

/**
 * Adaptado de `npx @ayushmxxn/serenity-ui@latest add flipcard3d` — mazo de tapas que se
 * abre en abanico al pasar el mouse (rotateY + desplazamiento en X/Y con spring) y trae
 * una tapa al frente al hacer click, con blur en las demás. Reskineado por completo con
 * los tokens del design system actual — cero clases ni colores del original (que usaba
 * fotos de stock hardcodeadas y una paleta neón). Uso: isla de "últimas entradas" en
 * desktop, como contraparte de UltimasEntradasCarousel.astro (mismo rol en mobile).
 *
 * Migrado de framer-motion a GSAP (`gsap.to`/`gsap.set` sobre un ref por tarjeta,
 * disparado desde un `useEffect`): las springs `{stiffness, damping}` del original se
 * tradujeron a duration/ease conservando el mismo carácter — {300,20} (frente/reposo)
 * queda poco amortiguada, con leve rebote (`back.out`); {300,50} (abanico al hover) va
 * bien amortiguada, sin rebote (`power3.out`). El `delay` escalonado por índice se
 * mantiene igual. El `whileHover` puntual del original (la tarjeta se levanta un poco
 * más si el mouse pasa por ENCIMA de ella, además del abanico general del contenedor)
 * se replica con un estado de hover propio por tarjeta.
 *
 * Sin drop-shadows (el design system actual es plano): la tarjeta al frente se separa
 * visualmente con un borde acid-flash en vez de una sombra debajo.
 *
 * Diagramación interna de la tarjeta (imagen izquierda + badge de categoría flotando +
 * título/autor a la derecha) igual a SwipeCard/NumeroSequence — mismo design system en
 * todos los lugares donde aparece una tarjeta de entrada. La info va SIEMPRE visible,
 * no solo al hacer click; al frente lo único que se agrega es el link "Leer entrada".
 */
export interface EntryFlipItem {
  title: string;
  authorName: string;
  categoryName: string;
  excerpt: string;
  coverImage?: string;
  href: string;
}

interface CardProps {
  item: EntryFlipItem;
  index: number;
  total: number;
  isHovered: boolean;
  isFirstCard: boolean;
  isFront: boolean;
  frontIndex: number | null;
  onClick: (index: number) => void;
}

const EASE_SNAPPY = 'back.out(1.4)';
const EASE_SMOOTH = 'power3.out';

function Card({ item, index, total, isHovered, isFirstCard, isFront, frontIndex, onClick }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [isSelfHovered, setIsSelfHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let target: gsap.TweenVars;
    if (isFront) {
      target = { rotateY: 0, x: 0, y: -100, scale: 1.15, duration: 0.5, ease: EASE_SNAPPY, delay: 0 };
    } else if (isHovered) {
      target = {
        rotateY: -45,
        x: index * 75,
        y: isSelfHovered ? (isFirstCard ? 0 : -100) : index * -8,
        scale: 1.05,
        duration: 0.4,
        ease: EASE_SMOOTH,
        delay: index * 0.1,
      };
    } else {
      target = {
        rotateY: 0,
        x: 0,
        y: isSelfHovered ? (isFirstCard ? 0 : -100) : 0,
        scale: 1,
        duration: 0.5,
        ease: EASE_SNAPPY,
        delay: (total - index) * 0.1,
      };
    }

    if (!mounted.current) {
      // Equivalente a `initial={rotateY:0,x:0,y:0,scale:1}`: el primer render aplica
      // el estado de reposo sin transición.
      gsap.set(el, { rotateY: 0, x: 0, y: 0, scale: 1 });
      mounted.current = true;
      return;
    }

    gsap.to(el, target);
  }, [isFront, isHovered, isSelfHovered, isFirstCard, index, total]);

  const normalizedTitle = normalizeTitleText(item.title);

  return (
    <div
      ref={ref}
      className={`absolute flex h-64 w-96 cursor-pointer overflow-hidden border bg-surface transition-colors lg:h-80 lg:w-[32rem] ${
        isFront ? 'z-20 border-accent' : 'border-ink/15'
      }`}
      style={{
        transformStyle: 'preserve-3d',
        transformOrigin: 'left center',
        zIndex: isFront ? 20 : total - index,
        filter: isFront || frontIndex === null ? 'none' : 'blur(4px)',
      }}
      onMouseEnter={() => setIsSelfHovered(true)}
      onMouseLeave={() => setIsSelfHovered(false)}
      onClick={() => onClick(index)}
      role="button"
      tabIndex={0}
    >
      <div className={cardImageWrap}>
        {item.coverImage && (
          <img
            src={item.coverImage}
            alt=""
            className="pointer-events-none h-full w-full object-cover grayscale contrast-125"
          />
        )}
        <span className={cardBadge}>{item.categoryName}</span>
      </div>
      <div className="flex w-3/5 flex-col gap-1 p-4 lg:gap-2 lg:p-6">
        <h3 className="font-headline text-lg leading-[1.05] text-ink lg:text-2xl">
          {normalizedTitle}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted lg:text-xs">
          Por {item.authorName}
        </p>
        {isFront && (
          <a
            href={item.href}
            onClick={(event) => event.stopPropagation()}
            className="mt-auto font-mono text-xs font-medium uppercase tracking-widest text-accent hover:underline lg:text-sm"
          >
            Leer entrada
          </a>
        )}
      </div>
    </div>
  );
}

interface EntryFlipCard3DProps {
  items: EntryFlipItem[];
}

export default function EntryFlipCard3D({ items }: EntryFlipCard3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [frontIndex, setFrontIndex] = useState<number | null>(null);

  useEffect(() => {
    if (frontIndex === null) return;
    // Colapsa la tarjeta al frente si el mouse se va del todo (evita dejarla "pegada").
    const handleLeaveWindow = () => setFrontIndex(null);
    window.addEventListener('mouseleave', handleLeaveWindow);
    return () => window.removeEventListener('mouseleave', handleLeaveWindow);
  }, [frontIndex]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col items-center py-6 lg:py-10">
      <div
        className="relative h-64 w-96 [perspective:1600px] lg:h-80 lg:w-[32rem]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {items.map((item, index) => (
          <Card
            key={item.href}
            item={item}
            index={index}
            total={items.length}
            isHovered={isHovered}
            isFirstCard={index === 0}
            isFront={frontIndex === index}
            frontIndex={frontIndex}
            onClick={(i) => setFrontIndex((prev) => (prev === i ? null : i))}
          />
        ))}
      </div>
    </div>
  );
}
