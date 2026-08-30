import { motion } from 'framer-motion';

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
  return (
    <motion.a
      href={`/entrada/${slug}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="group flex h-56 overflow-hidden border border-ink bg-paper shadow-sm transition-shadow duration-300 hover:shadow-lg lg:h-64"
    >
      <div className="relative h-full w-2/5 shrink-0 bg-linen">
        {coverImage && (
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover grayscale contrast-125 transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-accent/20 mix-blend-color" />
        <span className="absolute left-2 top-2 border border-paper bg-ink/80 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-paper">
          {categoryName}
        </span>
      </div>

      <div className="flex w-3/5 flex-col gap-1 p-4 lg:gap-2 lg:p-6">
        <h2 className="font-headline text-lg uppercase leading-[1.05] text-ink lg:text-xl">
          {title}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Por {authorName}
        </p>
        <span className="mt-auto font-mono text-xs font-medium uppercase tracking-widest text-accent transition-colors group-hover:underline">
          Leer entrada
        </span>
      </div>
    </motion.a>
  );
}
