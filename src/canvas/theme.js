export const THEME = {
  colors: {
    bg: 0x120c08,
    table: 0x1a110a,
    tableDeep: 0x0b0705,
    wood: 0x3a2416,
    woodHi: 0x6b4a2a,
    woodLo: 0x1a0f08,
    woodEdge: 0x0d0805,
    gilt: 0xd9a54a,
    giltHi: 0xf0cd78,
    giltLo: 0x8a5a1c,
    bone: 0xefe0c4,
    boneDim: 0xcbb894,
    parchment: 0xd8c8a2,
    parchmentHi: 0xecdcb6,
    parchmentLo: 0xb29a74,
    ink: 0x2a1a0c,
    inkSoft: 0x5a4328,
    rust: 0xb5542a,
    rustHi: 0xe07a44,
    steel: 0x9aaab8,
    steelHi: 0xd8e2ea,
    bile: 0xb9c96a,
    bileHi: 0xdbe78a,
    bileLo: 0x3a4a2a,
    danger: 0xa33a2a,
    shadow: 0x000000,
    white: 0xffffff
  },
  fontDisplay: "Cinzel, Georgia, serif",
  fontBody: '"Source Sans 3", system-ui, sans-serif',
  radius: {
    panel: 12,
    button: 8,
    card: 7
  }
};

export const isMobileWidth = (width) => width < 760;
export const isNarrowWidth = (width) => width < 980;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
