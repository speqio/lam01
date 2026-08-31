import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  cardShell,
  cardImageWrap,
  cardImage,
  cardBadge,
  cardBody,
  cardTitle,
  cardCta,
} from '../lib/cardStyles';

gsap.registerPlugin(ScrollTrigger);

/**
 * Migrado de framer-motion (`whileInView`/`whileHover`) a GSAP: `ScrollTrigger` con
 * `once: true` dispara el fade-in+desplazamiento la primera vez que la card entra en
 * viewport (equivalente a `viewport={{once:true, margin:'-60px'}}`), y un hover propio
 * maneja el levantamiento de 4px. Cada instancia (hidratada con `client:visible`) crea
 * su propio ScrollTrigger — si el navegador ya la hidrató estando visible, dispara de
 * inmediato, mismo comportamiento que tenía con framer-motion bajo la misma hidratación
 * diferida.
 */
interface EntryCardProps {
  title: string;
  authorName: string;
  categoryName: string;
  slug: string;
  coverImage?: string;
}

export default function EntryCard({
  title,
  authorName,
  categoryName,
  slug,
  coverImage,
}: EntryCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, y: 24 });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom-=60px',
      once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }),
    });

    const handleEnter = () => gsap.to(el, { y: -4, duration: 0.2, ease: 'power2.out' });
    const handleLeave = () => gsap.to(el, { y: 0, duration: 0.2, ease: 'power2.out' });
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);

    return () => {
      trigger.kill();
      el.removeEventListener('mouseenter', handleEnter);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <a ref={ref} href={`/entrada/${slug}`} className={cardShell}>
      <div className={cardImageWrap}>
        {coverImage && <img src={coverImage} alt={title} className={cardImage} />}
        <span className={cardBadge}>{categoryName}</span>
      </div>

      <div className={cardBody}>
        <h2 className={cardTitle}>{title}</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Por {authorName}
        </p>
        <span className={cardCta}>Leer entrada</span>
      </div>
    </a>
  );
}
