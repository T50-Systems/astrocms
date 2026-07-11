/** Puertos inyectables → testabilidad (ADR-0008). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Quita marcas diacríticas combinantes (U+0300–U+036F) sin usar regex de combinantes. */
function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
}

/** Convierte un título en un slug con prefijo '/'. */
export function slugify(title: string): string {
  const base = stripDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return "/" + base;
}
