import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Tipo = 'entrada' | 'autor' | 'categoria' | 'numero';

interface ItemBusqueda {
  tipo: Tipo;
  titulo: string;
  url: string;
  autor?: string;
  /** Solo entradas: nombre de quien tradujo, si corresponde — también se busca por este nombre. */
  traductor?: string;
  /** Solo autores: si está marcado en Keystatic, la etiqueta es "Traductor" en vez de "Autor". */
  esTraductor?: boolean;
}

const ETIQUETA: Record<Tipo, string> = {
  entrada: 'Entrada',
  autor: 'Autor',
  categoria: 'Categoría',
  numero: 'Número',
};

const etiquetaDe = (item: ItemBusqueda) =>
  item.tipo === 'autor' && item.esTraductor ? 'Traductor' : ETIQUETA[item.tipo];

const MAX_RESULTADOS = 8;
const MIN_CARACTERES = 2;

// Sin distinguir tildes ni mayúsculas.
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');

// Con la misma coincidencia, autores, categorías y números van antes que las entradas.
const ORDEN_TIPO: Record<Tipo, number> = { autor: 0, categoria: 1, numero: 2, entrada: 3 };

function puntuar(clave: string, q: string): number | null {
  if (clave === q) return 0;
  if (clave.startsWith(q) || clave.includes(' ' + q)) return 1;
  if (clave.includes(q)) return 2;
  return null;
}

/**
 * Coincidencia exacta, luego los que empiezan con lo escrito (o cuya palabra empieza así),
 * luego los que lo contienen. Una entrada también aparece si lo escrito coincide con el
 * nombre de quien la tradujo (`claveTraductor`), no solo con el título — así buscar al
 * traductor encuentra sus entradas, igual que buscar su propia ficha de autor.
 */
function buscar(
  indice: { item: ItemBusqueda; clave: string; claveTraductor?: string }[],
  consulta: string
): ItemBusqueda[] {
  const q = normalizar(consulta.trim());
  if (q.length < MIN_CARACTERES) return [];
  const puntuados: { item: ItemBusqueda; puntos: number }[] = [];
  for (const { item, clave, claveTraductor } of indice) {
    const puntosTitulo = puntuar(clave, q);
    const puntosTraductor = claveTraductor ? puntuar(claveTraductor, q) : null;
    const candidatos = [puntosTitulo, puntosTraductor].filter((p): p is number => p !== null);
    if (candidatos.length === 0) continue;
    puntuados.push({ item, puntos: Math.min(...candidatos) });
  }
  puntuados.sort((x, y) => x.puntos - y.puntos || ORDEN_TIPO[x.item.tipo] - ORDEN_TIPO[y.item.tipo]);
  return puntuados.slice(0, MAX_RESULTADOS).map((x) => x.item);
}

interface SearchModalProps {
  /** "compact": ícono solo, sin label ni atajo — para la barra flotante mobile. */
  variant?: 'default' | 'compact';
}

export default function SearchModal({ variant = 'default' }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [indice, setIndice] = useState<
    { item: ItemBusqueda; clave: string; claveTraductor?: string }[] | null
  >(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [activo, setActivo] = useState(-1);
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
      setActivo(-1);
    }
  }, [open]);

  // El índice (/buscador.json, generado en el build) se pide una sola vez, al abrir.
  useEffect(() => {
    if (!open || indice) return;
    setStatus('loading');
    fetch('/buscador.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<ItemBusqueda[]>;
      })
      .then((items) => {
        setIndice(
          items.map((item) => ({
            item,
            clave: normalizar(item.titulo),
            claveTraductor: item.traductor ? normalizar(item.traductor) : undefined,
          }))
        );
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, [open, indice]);

  const results = useMemo(() => (indice ? buscar(indice, query) : []), [indice, query]);

  useEffect(() => setActivo(-1), [query]);

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setActivo((prev) => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setActivo((prev) => (prev - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && activo >= 0 && results[activo]) {
      event.preventDefault();
      window.location.href = results[activo].url;
    }
  }

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
                id="buscador-sitio"
                name="buscador-sitio"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar entrada, autor, categoría o número..."
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
              {status === 'error' && (
                <p className="p-4 text-center font-sans text-sm text-ink-muted">
                  No se pudo cargar el buscador. Intenta de nuevo en un momento.
                </p>
              )}

              {status === 'idle' && query.trim().length >= MIN_CARACTERES && results.length === 0 && (
                <p className="p-4 text-center font-sans text-sm text-ink-muted">
                  Sin resultados para &ldquo;{query}&rdquo;.
                </p>
              )}

              {results.map((result, i) => (
                <a
                  key={result.url}
                  href={result.url}
                  className={`flex items-baseline gap-3 px-3 py-3 transition-colors hover:bg-ink/5 ${i === activo ? 'bg-ink/5' : ''}`}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActivo(i)}
                >
                  <span className="w-20 shrink-0 font-mono text-[10px] font-black uppercase tracking-widest text-ink">
                    {etiquetaDe(result)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-base text-ink">{result.titulo}</span>
                    {result.autor && (
                      <span className="mt-0.5 block font-sans text-xs text-ink-muted">Por {result.autor}</span>
                    )}
                    {result.traductor && (
                      <span className="mt-0.5 block font-sans text-xs text-ink-muted">
                        Traducción de {result.traductor}
                      </span>
                    )}
                  </span>
                </a>
              ))}

              {query.trim().length < MIN_CARACTERES && status !== 'error' && (
                <p className="p-4 text-center font-sans text-sm text-ink-muted">
                  Escribe al menos {MIN_CARACTERES} caracteres para buscar.
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
