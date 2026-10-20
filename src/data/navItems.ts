// Ítems de navegación principal, compartidos entre Header.astro (desktop) y
// MobileFloatingNav.astro (mobile) — antes eran dos arrays hardcodeados por separado
// que había que mantener sincronizados a mano. El ícono solo lo usa la barra mobile;
// Header lo ignora.
export interface NavItem {
  name: string;
  url: string;
  icon: string;
}

export const navItems: NavItem[] = [
  { name: 'Inicio', url: '/', icon: 'M3 11l9-8 9 8 M5 10v10h4v-6h6v6h4V10' },
  { name: 'Números', url: '/numeros', icon: 'M12 3l9 5-9 5-9-5 9-5z M3 13l9 5 9-5' },
  {
    name: 'Categorías',
    url: '/categorias',
    icon: 'M20 12.5l-7.5 7.5a1 1 0 0 1-1.4 0L4 12.9V4h8.9l7.1 7.1a1 1 0 0 1 0 1.4z M8 8h.01',
  },
  { name: 'Archivo', url: '/archivo', icon: 'M3 4h18v4H3z M5 8v11h14V8 M10 12h4' },
];

/**
 * Qué ítem de la nav corresponde a la página actual. Una página de número (`/numero-31`) o
 * de categoría (`/category/…`) pertenece a su sección aunque su URL no sea la del ítem. Las
 * entradas y los autores no son ninguna sección de la nav, así que no marcan nada.
 */
export function navItemActivo(item: NavItem, pathname: string): boolean {
  const ruta = pathname.replace(/\/+$/, '') || '/';
  switch (item.url) {
    case '/':
      return ruta === '/';
    case '/numeros':
      return ruta === '/numeros' || /^\/numero-\d+$/.test(ruta);
    case '/categorias':
      return ruta === '/categorias' || ruta.startsWith('/category/');
    default:
      return ruta === item.url;
  }
}
