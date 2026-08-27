import { motion } from 'framer-motion';

interface EntryCardProps {
  title: string;
  authorName: string;
  categoryName: string;
  slug: string;
  coverImage?: string;
  /** ISO 8601 date string */
  date: string;
}

export default function EntryCard({
  title,
  authorName,
  categoryName,
  slug,
  coverImage,
  date,
}: EntryCardProps) {
  const formattedDate = new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <motion.a
      href={`/entrada/${slug}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="group flex flex-col overflow-hidden rounded-lg border border-linen bg-paper shadow-sm transition-shadow duration-300 hover:shadow-lg"
    >
      <div className="aspect-[16/9] overflow-hidden bg-linen">
        {coverImage && (
          <motion.img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover"
            initial={{ scale: 1.04 }}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <span className="w-fit rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
          {categoryName}
        </span>

        <h2 className="font-serif text-xl leading-snug text-ink transition-colors group-hover:text-accent">
          {title}
        </h2>

        <p className="mt-auto font-sans text-sm text-ink-muted">
          {authorName} &middot; {formattedDate}
        </p>
      </div>
    </motion.a>
  );
}
