import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { cardImageWrap, cardBadge } from '../../lib/cardStyles';

gsap.registerPlugin(Draggable);

/**
 * Adaptado de `npx @ayushmxxn/serenity-ui@latest add swipecard` — mecánica de arrastre
 * libre en 2D con inclinación 3D (rotateX/rotateY) y reciclado de la tarjeta arrastrada
 * al fondo del mazo. Reskineado por completo con los tokens del design system actual
 * (bordes rectos, tipografía Lekton, paleta canvas/ink/accent) — cero clases ni
 * colores del original. Uso: islas de "últimas entradas" en mobile.
 *
 * Migrado de framer-motion a GSAP (`Draggable` para el arrastre, `gsap.to`/`gsap.set`
 * para el resto): las springs `{stiffness, damping}` del original se tradujeron a
 * duration/ease conservando el mismo carácter — poco amortiguadas (leve rebote) con
 * `back.out`, bien amortiguadas (sin rebote) con `power3.out`. El tilt 3D en vivo
 * durante el arrastre usa `gsap.utils.mapRange`/`clamp` en vez de un cálculo lineal a
 * mano.
 */
export interface SwipeCardItem {
  title: string;
  authorName: string;
  categoryName: string;
  slug: string;
  coverImage?: string;
  excerpt: string;
}

interface DraggableCardProps {
  children: ReactNode;
  onSendToBack: () => void;
}

const DRAG_THRESHOLD = 150;

function DraggableCard({ children, onSendToBack }: DraggableCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onSendToBackRef = useRef(onSendToBack);
  onSendToBackRef.current = onSendToBack;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const [draggable] = Draggable.create(el, {
      type: 'x,y',
      onPress() {
        gsap.set(el, { cursor: 'grabbing' });
        gsap.to(el, { scale: 1.03, duration: 0.2 });
      },
      onDrag() {
        gsap.set(el, {
          rotateX: gsap.utils.clamp(-30, 30, gsap.utils.mapRange(-200, 200, 30, -30, this.y)),
          rotateY: gsap.utils.clamp(-30, 30, gsap.utils.mapRange(-200, 200, -30, 30, this.x)),
        });
      },
      onRelease() {
        gsap.set(el, { cursor: 'grab' });
      },
      onDragEnd() {
        // Igual que el original: si el arrastre supera el umbral, recicla la tarjeta
        // al fondo del mazo (moveToBack, vía el estado `order` del padre); en los dos
        // casos la posición/tilt vuelve a cero con el mismo tween.
        const overThreshold = Math.abs(this.x) > DRAG_THRESHOLD || Math.abs(this.y) > DRAG_THRESHOLD;
        gsap.to(el, {
          x: 0,
          y: 0,
          rotateX: 0,
          rotateY: 0,
          scale: 1,
          duration: 0.45,
          ease: 'power3.out',
        });
        if (overThreshold) onSendToBackRef.current();
      },
    });

    const handleEnter = () => {
      if (!draggable.isDragging) gsap.to(el, { scale: 1.03, duration: 0.2 });
    };
    const handleLeave = () => {
      if (!draggable.isDragging) gsap.to(el, { scale: 1, duration: 0.2 });
    };
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);

    return () => {
      el.removeEventListener('mouseenter', handleEnter);
      el.removeEventListener('mouseleave', handleLeave);
      draggable.kill();
    };
  }, []);

  return (
    <div ref={ref} className="absolute h-56 w-[22rem] cursor-grab">
      {children}
    </div>
  );
}

interface StackedCardProps {
  item: SwipeCardItem;
  stackPos: number;
  totalCount: number;
  onSendToBack: () => void;
}

function StackedCard({ item, stackPos, totalCount, onSendToBack }: StackedCardProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const target = {
      rotateZ: (totalCount - stackPos - 1) * 6,
      scale: 1 + stackPos * 0.1 - totalCount * 0.1,
      zIndex: stackPos,
    };

    if (!mounted.current) {
      // Equivalente a `initial={false}`: el primer render aplica el estado sin
      // transición (si no, todo el mazo "aparecería" animando al montar).
      gsap.set(el, { ...target, transformOrigin: '85% 85%' });
      mounted.current = true;
      return;
    }

    gsap.to(el, { ...target, duration: 0.4, ease: 'back.out(1.4)' });
  }, [stackPos, totalCount]);

  return (
    <DraggableCard onSendToBack={onSendToBack}>
      <div ref={innerRef} className="h-full w-full overflow-hidden border border-ink/15 bg-surface">
        <div className="flex h-full w-full">
          <div className={cardImageWrap}>
            {item.coverImage && (
              <img
                src={item.coverImage}
                alt={item.title}
                className="pointer-events-none h-full w-full object-cover grayscale contrast-125"
              />
            )}
            <span className={cardBadge}>{item.categoryName}</span>
          </div>
          <div className="flex w-3/5 flex-col gap-1 p-4">
            <h3 className="font-headline text-lg uppercase leading-[1.05] text-ink">{item.title}</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              Por {item.authorName}
            </p>
            <a
              href={`/entrada/${item.slug}`}
              className="mt-auto font-mono text-xs font-medium uppercase tracking-widest text-accent hover:underline"
            >
              Leer entrada
            </a>
          </div>
        </div>
      </div>
    </DraggableCard>
  );
}

interface SwipeCardProps {
  items: SwipeCardItem[];
}

export default function SwipeCard({ items }: SwipeCardProps) {
  const [order, setOrder] = useState(() => items.map((_, i) => i));

  if (items.length === 0) return null;

  const moveToBack = (itemIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      next.splice(next.indexOf(itemIndex), 1);
      next.unshift(itemIndex);
      return next;
    });
  };

  return (
    <div className="mx-auto flex flex-col items-center gap-6">
      <div className="relative h-56 w-[22rem]" style={{ perspective: 1200 }}>
        {order.map((itemIndex, stackPos) => {
          const item = items[itemIndex];
          return (
            <StackedCard
              key={itemIndex}
              item={item}
              stackPos={stackPos}
              totalCount={order.length}
              onSendToBack={() => moveToBack(itemIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}
