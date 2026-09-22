import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { normalizeTitleText } from '../lib/text';
import {
  cardShell,
  cardImageWrap,
  cardImage,
  cardBadgeClass,
  cardBody,
  cardTitle,
  cardCta,
  cardCtaWrap,
  cardCtaUnderline,
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
 *
 * El estado inicial oculto (opacity 0, y +24px) lo pone CSS (clase "entry-card-reveal"
 * acá abajo + regla en global.css — no en cardStyles.ts, que también usa numeros.astro
 * como markup estático sin este script), NO este efecto: con `client:visible`, React
 * puede tardar en hidratar una card que ya se pintó visible en el HTML servido — si el
 * `gsap.set()` inicial corriera acá, se vería la card completa un instante y recién
 * ahí saltar a oculta antes de animarse de vuelta. Como el CSS ya la esconde desde el
 * primer frame (ver BaseLayout.astro), este efecto solo necesita revelarla.
 */
interface EntryCardProps {
  title: string;
  authorName: string;
  /** Nombre de quien tradujo la entrada, si corresponde — se muestra debajo del autor. */
  translatorName?: string;
  categoryName: string;
  slug: string;
  coverImage?: string;
  coverAlt?: string;
}

export default function EntryCard({
  title,
  authorName,
  translatorName,
  categoryName,
  slug,
  coverImage,
  coverAlt,
}: EntryCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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

  const normalizedTitle = normalizeTitleText(title);

  return (
    <a ref={ref} href={`/${slug}`} className={`entry-card-reveal ${cardShell}`}>
      <div className={cardImageWrap}>
        {coverImage && <img src={coverImage} alt={coverAlt || normalizedTitle} className={cardImage} />}
        <span className={cardBadgeClass(categoryName)}>{categoryName}</span>
      </div>

      <div className={cardBody}>
        <h2 className={cardTitle}>{normalizedTitle}</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Por {authorName}
        </p>
        {translatorName && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Traducción de {translatorName}
          </p>
        )}
        <span className={cardCtaWrap}>
          <span className={cardCta}>Leer entrada</span>
          <span className={cardCtaUnderline} />
        </span>
      </div>
    </a>
  );
}
