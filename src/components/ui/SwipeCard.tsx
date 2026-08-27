import { useState, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';

/**
 * Adaptado de `npx @ayushmxxn/serenity-ui@latest add swipecard` — mecánica de arrastre
 * libre en 2D con inclinación 3D (rotateX/rotateY) y reciclado de la tarjeta arrastrada
 * al fondo del mazo. Reskineado por completo con los tokens del design system actual
 * (bordes rectos, tipografía Bebas Neue/Space Grotesk/Newsreader, paleta paper/ink/accent)
 * — cero clases ni colores del original. Uso: islas de "últimas entradas" en mobile.
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

function DraggableCard({ children, onSendToBack }: DraggableCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-200, 200], [30, -30]);
  const rotateY = useTransform(x, [-200, 200], [-30, 30]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 150;
    if (Math.abs(info.offset.x) > threshold || Math.abs(info.offset.y) > threshold) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }

  return (
    <motion.div
      className="absolute h-96 w-72 cursor-grab"
      style={{ x, y, rotateX, rotateY }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.5}
      whileTap={{ cursor: 'grabbing' }}
      onDragEnd={handleDragEnd}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
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
      <div className="relative h-96 w-72" style={{ perspective: 1200 }}>
        {order.map((itemIndex, stackPos) => {
          const item = items[itemIndex];
          return (
            <DraggableCard key={itemIndex} onSendToBack={() => moveToBack(itemIndex)}>
              <motion.div
                className="h-full w-full overflow-hidden border border-ink bg-paper shadow-lg"
                animate={{
                  rotateZ: (order.length - stackPos - 1) * 6,
                  scale: 1 + stackPos * 0.1 - order.length * 0.1,
                  transformOrigin: '85% 85%',
                  zIndex: stackPos,
                }}
                initial={false}
                transition={{ type: 'spring', stiffness: 250, damping: 25 }}
              >
                <div className="relative h-2/3 w-full bg-linen">
                  {item.coverImage && (
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="pointer-events-none h-full w-full object-cover grayscale contrast-125"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-accent/20 mix-blend-color" />
                </div>
                <div className="flex h-1/3 flex-col gap-1 p-4">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
                    {item.categoryName}
                  </span>
                  <h3 className="font-headline text-xl uppercase leading-none text-ink">
                    {item.title}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                    Por {item.authorName}
                  </p>
                  <a
                    href={`/entrada/${item.slug}`}
                    className="mt-auto font-mono text-xs font-medium uppercase tracking-widest text-accent hover:underline"
                  >
                    Leer entrada →
                  </a>
                </div>
              </motion.div>
            </DraggableCard>
          );
        })}
      </div>
    </div>
  );
}
