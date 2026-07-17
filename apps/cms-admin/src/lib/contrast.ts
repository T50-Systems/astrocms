export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Parses the hex formats supported by the token contrast notice. */
export function parseHexColor(value: string): RgbColor | null {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) return null;

  const hex = match[1]!.length === 3
    ? match[1]!.split("").map((part) => part + part).join("")
    : match[1]!;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Returns the WCAG 2.x contrast ratio without presentation rounding. */
export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** Elige el texto (claro #fafafa u oscuro #171717) con mayor contraste sobre `bg`. */
export function pickReadableForeground(bg: RgbColor): { hex: "#fafafa" | "#171717"; ratio: number } {
  const light = contrastRatio(parseHexColor("#fafafa")!, bg);
  const dark = contrastRatio(parseHexColor("#171717")!, bg);
  return light >= dark ? { hex: "#fafafa", ratio: light } : { hex: "#171717", ratio: dark };
}
