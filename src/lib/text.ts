export function normalizeTitleText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/^([a-záéíóúüñç])/, (_, letter) => letter.toLocaleUpperCase('es'));
}
