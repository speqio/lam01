import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PagefindResult {
  id: string;
  data: () => Promise<{
    url: string;
    excerpt: string;
    meta: Record<string, string>;
  }>;
}

interface PagefindModule {
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

type ResultData = Awaited<ReturnType<PagefindResult['data']>>;

interface SearchModalProps {
  /** "compact": ícono solo, sin label ni atajo — para la barra flotante mobile. */
  variant?: 'default' | 'compact';
}

export default function SearchModal({ variant = 'default' }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultData[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'unavailable'>('idle');
  const pagefindRef = useRef<PagefindModule | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery('');
      setResults([]);
      setStatus('idle');
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setStatus('loading');
      try {
        if (!pagefindRef.current) {
          // Generado por `pagefind --site dist` durante el build (ver package.json).
          // No existe en el repo ni en modo desarrollo, solo después de `npm run build`.
          // La ruta se arma en runtime (no como string literal) para que Vite/Rolldown
          // no intente resolverla como import estático en build time.
          const pagefindPath = ['', 'pagefind', 'pagefind.js'].join('/');
          // @ts-ignore
          pagefindRef.current = await import(/* @vite-ignore */ pagefindPath);
        }
        const search = await pagefindRef.current!.search(query);
        const data = await Promise.all(search.results.slice(0, 8).map((r) => r.data()));
        setResults(data);
        setStatus('idle');
      } catch {
        setStatus('unavailable');
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, open]);

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 px-2 py-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-muted transition-colors hover:text-accent"
          aria-label="Buscar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>Buscar</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md border border-ink/20 bg-surface px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-ink transition-colors hover:border-accent hover:text-accent"
          aria-label="Buscar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="hidden sm:inline">Buscar</span>
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
          <div
            className="w-full max-w-xl overflow-hidden border border-ink/20 bg-surface"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-ink-muted"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por título, autor o texto..."
                className="flex-1 bg-transparent font-sans text-ink outline-none placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 font-sans text-xs text-ink-muted hover:text-ink"
              >
                Esc
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {status === 'unavailable' && (
                <p className="p-4 text-center font-sans text-sm text-ink-muted">
                  El índice de búsqueda no está disponible en desarrollo. Pagefind indexa el
                  sitio ya construido — corré <code className="text-accent">npm run build</code> para generarlo.
                </p>
              )}

              {status === 'idle' && query.trim().length >= 2 && results.length === 0 && (
                <p className="p-4 text-center font-sans text-sm text-ink-muted">
                  Sin resultados para &ldquo;{query}&rdquo;.
                </p>
              )}

              {results.map((result) => (
                <a
                  key={result.url}
                  href={result.url}
                  className="block px-3 py-3 transition-colors hover:bg-ink/5"
                  onClick={() => setOpen(false)}
                >
                  <p className="font-serif text-base text-ink">{result.meta.title}</p>
                  {result.meta.author && (
                    <p className="mt-0.5 font-sans text-xs text-ink-muted">
                      Por {result.meta.author}
                    </p>
                  )}
                  <p
                    className="mt-1 font-sans text-sm text-ink-muted [&_mark]:bg-accent/30 [&_mark]:font-medium [&_mark]:text-ink"
                    dangerouslySetInnerHTML={{ __html: result.excerpt }}
                  />
                </a>
              ))}

              {query.trim().length < 2 && status !== 'unavailable' && (
                <p className="p-4 text-center font-sans text-sm text-ink-muted">
                  Escribí al menos 2 caracteres para buscar.
                </p>
              )}
            </div>
          </div>
          </div>,
          document.body
        )}
    </>
  );
}
