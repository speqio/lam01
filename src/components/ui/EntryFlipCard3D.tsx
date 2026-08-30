import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Adaptado de `npx @ayushmxxn/serenity-ui@latest add flipcard3d` — mazo de tapas que se
 * abre en abanico al pasar el mouse (rotateY + desplazamiento en X/Y con spring) y trae
 * una tapa al frente al hacer click, con blur en las demás. Reskineado por completo con
 * los tokens del design system actual — cero clases ni colores del original (que usaba
 * fotos de stock hardcodeadas y una paleta neón). Uso: isla de "últimas entradas" en
 * desktop, como contraparte de SwipeCard.tsx (que cumple el mismo rol en mobile).
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

function Card({ item, index, total, isHovered, isFirstCard, isFront, frontIndex, onClick }: CardProps) {
  return (
    <motion.div
      className={`absolute h-64 w-96 cursor-pointer overflow-hidden border border-ink bg-paper lg:h-80 lg:w-[32rem] ${
        isFront ? 'z-20' : ''
      }`}
      style={{
        transformStyle: 'preserve-3d',
        transformOrigin: 'left center',
        zIndex: isFront ? 20 : total - index,
        filter: isFront || frontIndex === null ? 'none' : 'blur(4px)',
      }}
      initial={{
        rotateY: 0,
        x: 0,
        y: 0,
        scale: 1,
        boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.12)',
      }}
      animate={
        isFront
          ? {
              scale: 1.15,
              rotateY: 0,
              x: 0,
              y: -100,
              boxShadow: '0px 30px 60px rgba(112, 31, 15, 0.35)',
              transition: { type: 'spring', stiffness: 300, damping: 20 },
            }
          : isHovered
            ? {
                rotateY: -45,
                x: index * 75,
                y: index * -8,
                scale: 1.05,
                boxShadow: `10px 20px 30px rgba(0, 0, 0, ${0.15 + index * 0.05})`,
                transition: { type: 'spring', stiffness: 300, damping: 50, delay: index * 0.1 },
              }
            : {
                rotateY: 0,
                x: 0,
                y: 0,
                scale: 1,
                boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.12)',
                transition: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                  delay: (total - index) * 0.1,
                },
              }
      }
      whileHover={{ y: isFirstCard ? 0 : -100 }}
      onClick={() => onClick(index)}
      role="button"
      tabIndex={0}
    >
      <div className="relative h-full w-full">
        {item.coverImage && (
          <img
            src={item.coverImage}
            alt={item.title}
            className="pointer-events-none h-full w-full object-cover grayscale contrast-125"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-accent/20 mix-blend-color" />
      </div>
    </motion.div>
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

  const activeItem = frontIndex !== null ? items[frontIndex] : null;

  return (
    <div className="flex flex-col items-center gap-14 py-6 lg:py-10">
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

      <div className="min-h-[9rem] w-full max-w-2xl text-center">
        {activeItem ? (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-accent">
              {activeItem.categoryName}
            </p>
            <h3 className="mt-2 font-headline text-4xl uppercase leading-none text-ink">
              {activeItem.title}
            </h3>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink-muted">
              Por {activeItem.authorName}
            </p>
            <p className="mx-auto mt-4 max-w-xl font-serif text-base leading-relaxed text-ink-muted">
              {activeItem.excerpt}
            </p>
            <a
              href={activeItem.href}
              className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-accent hover:underline"
            >
              Leer entrada
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
