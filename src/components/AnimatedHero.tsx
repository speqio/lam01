import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface AnimatedHeroProps {
  eyebrow?: string;
  title: string;
}

export default function AnimatedHero({ eyebrow, title }: AnimatedHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-hero-eyebrow]',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
      gsap.fromTo(
        '[data-hero-title]',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.9, delay: 0.15, ease: 'power3.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="text-center mb-12">
      {eyebrow && (
        <p
          data-hero-eyebrow
          className="text-sm uppercase tracking-widest text-accent font-sans"
        >
          {eyebrow}
        </p>
      )}
      <h1 data-hero-title className="font-serif text-4xl md:text-5xl mt-2 text-ink">
        {title}
      </h1>
    </div>
  );
}
