import { motion } from 'framer-motion';
import {
  cardShell,
  cardImageWrap,
  cardImage,
  cardBadge,
  cardBody,
  cardTitle,
  cardCta,
} from '../lib/cardStyles';

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
      className={cardShell}
    >
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
    </motion.a>
  );
}
