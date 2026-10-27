import { Container, Graphics, Sprite, Text } from "pixi.js";
import { THEME } from "./theme.js";
import { makeText } from "./ui.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function taperedBar(g, x1, y1, x2, y2, width, color, alpha = 1) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const end = width * 0.22;
  const waist = width * 0.56;
  g.poly([
    x1 + px * end, y1 + py * end,
    mx + px * waist, my + py * waist,
    x2 + px * end, y2 + py * end,
    x2 - px * end, y2 - py * end,
    mx - px * waist, my - py * waist,
    x1 - px * end, y1 - py * end
  ]).fill({ color, alpha });
}

function carveFlecks(g, size, random, color, count = 7, alpha = 0.5) {
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * size * 0.62;
    const y = (random() - 0.5) * size * 0.62;
    const r = 0.8 + random() * size * 0.022;
    g.circle(size / 2 + x, size / 2 + y, r).fill({ color, alpha: alpha * (0.3 + random() * 0.7) });
  }
}

/**
 * A carved rust-wood X. The silhouette is a letter X; the material is
 * chipped, oxidised timber with a raised highlight on the upper-left edge.
 */
export function drawX(size, { infected = false, ghost = false, tint = null } = {}) {
  const c = new Container();
  const s = size;
  const pad = s * 0.21;
  const w = s * 0.155;
  const random = mulberry32(73);
  const main = tint ?? THEME.colors.rust;
  const alpha = ghost ? 0.32 : 1;

  const shadow = new Graphics();
  taperedBar(shadow, pad + s * 0.035, pad + s * 0.055, s - pad + s * 0.035, s - pad + s * 0.055, w * 1.08, 0x000000, 0.42);
  taperedBar(shadow, s - pad + s * 0.035, pad + s * 0.055, pad + s * 0.035, s - pad + s * 0.055, w * 1.08, 0x000000, 0.42);
  c.addChild(shadow);

  const edge = new Graphics();
  taperedBar(edge, pad, pad, s - pad, s - pad, w * 1.28, 0x1c0904, alpha);
  taperedBar(edge, s - pad, pad, pad, s - pad, w * 1.28, 0x1c0904, alpha);
  c.addChild(edge);

  const body = new Graphics();
  taperedBar(body, pad, pad, s - pad, s - pad, w, main, alpha);
  taperedBar(body, s - pad, pad, pad, s - pad, w, main, alpha);
  c.addChild(body);

  const shade = new Graphics();
  taperedBar(shade, pad + w * 0.22, pad + w * 0.3, s - pad + w * 0.22, s - pad + w * 0.3, w * 0.2, 0x3a0f06, alpha * 0.55);
  taperedBar(shade, s - pad - w * 0.22, pad + w * 0.3, pad - w * 0.22, s - pad + w * 0.3, w * 0.2, 0x3a0f06, alpha * 0.55);
  c.addChild(shade);

  const highlight = new Graphics();
  taperedBar(
    highlight,
    pad - w * 0.18,
    pad - w * 0.24,
    s - pad - w * 0.18,
    s - pad - w * 0.24,
    w * 0.24,
    THEME.colors.rustHi,
    alpha * 0.62
  );
  taperedBar(
    highlight,
    s - pad + w * 0.18,
    pad - w * 0.24,
    pad + w * 0.18,
    s - pad - w * 0.24,
    w * 0.24,
    THEME.colors.rustHi,
    alpha * 0.4
  );
  c.addChild(highlight);

  const flecks = new Graphics();
  carveFlecks(flecks, s, random, 0x2a0b04, 8, alpha * 0.5);
  if (infected) carveFlecks(flecks, s, random, THEME.colors.bile, 9, alpha * 0.6);
  c.addChild(flecks);

  // A tiny carved notch at each tip keeps the piece from looking vector-perfect.
  const notch = new Graphics();
  for (const [x, y] of [[pad, pad], [s - pad, pad], [pad, s - pad], [s - pad, s - pad]]) {
    notch.circle(x, y, s * 0.026).fill({ color: 0x160804, alpha: alpha * 0.55 });
  }
  c.addChild(notch);
  c.pivot.set(s / 2, s / 2);
  return c;
}

/**
 * A cast-steel O with a carved bevel. It is still unmistakably the letter O.
 */
export function drawO(size, { infected = false, ghost = false, tint = null } = {}) {
  const c = new Container();
  const s = size;
  const r = s * 0.335;
  const ring = s * 0.155;
  const cx = s / 2;
  const cy = s / 2;
  const alpha = ghost ? 0.3 : 1;
  const main = tint ?? THEME.colors.steel;

  const shadow = new Graphics()
    .circle(cx + s * 0.03, cy + s * 0.045, r + ring * 0.55)
    .fill({ color: 0x000000, alpha: 0.38 * alpha });
  c.addChild(shadow);

  const edge = new Graphics()
    .circle(cx, cy, r + ring * 0.58)
    .fill({ color: 0x10181d, alpha });
  c.addChild(edge);

  const body = new Graphics()
    .circle(cx, cy, r + ring * 0.3)
    .fill({ color: main, alpha });
  c.addChild(body);

  const hole = new Graphics()
    .circle(cx, cy, r - ring * 0.32)
    .fill({ color: 0x140e0a, alpha });
  c.addChild(hole);

  const innerShadow = new Graphics()
    .circle(cx, cy, r - ring * 0.32)
    .stroke({ width: s * 0.035, color: 0x000000, alpha: 0.55 * alpha });
  c.addChild(innerShadow);

  const bevel = new Graphics();
  bevel
    .arc(cx, cy, r + ring * 0.08, Math.PI * 1.08, Math.PI * 1.88)
    .stroke({ width: s * 0.035, color: THEME.colors.steelHi, alpha: 0.55 * alpha });
  bevel
    .arc(cx, cy, r - ring * 0.3, Math.PI * 0.12, Math.PI * 0.88)
    .stroke({ width: s * 0.025, color: 0xffffff, alpha: 0.2 * alpha });
  c.addChild(bevel);

  const rivets = new Graphics();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI * 0.16;
    const rr = r + ring * 0.02;
    rivets
      .circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.016)
      .fill({ color: 0x2a333a, alpha: 0.85 * alpha });
  }
  c.addChild(rivets);

  if (infected) {
    const infection = new Graphics();
    const random = mulberry32(191);
    for (let i = 0; i < 5; i++) {
      const a = random() * Math.PI * 2;
      const rr = r + (random() - 0.5) * ring * 0.6;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      infection.circle(x, y, s * (0.018 + random() * 0.028)).fill({ color: THEME.colors.bile, alpha: 0.5 });
      infection
        .moveTo(x, y)
        .lineTo(x + Math.cos(a + 1.4) * s * 0.08, y + Math.sin(a + 1.4) * s * 0.08)
        .stroke({ width: s * 0.012, color: THEME.colors.bileLo, alpha: 0.7 });
    }
    c.addChild(infection);
  }
  c.pivot.set(s / 2, s / 2);
  return c;
}

/**
 * The Nought idol: an oversized O standing behind the board. Its eye is carved
 * into the upper arc, not the centre, so the silhouette still reads as an O.
 */
export function drawNoughtIdol(size, textures, { erupted = false } = {}) {
  const c = new Container();
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.345;
  const band = s * 0.19;
  const outer = r + band * 0.5;
  const inner = r - band * 0.5;

  const aura = new Sprite(textures.bileGlow);
  aura.anchor.set(0.5);
  aura.position.set(cx, cy);
  aura.width = s * 1.42;
  aura.height = s * 1.42;
  aura.alpha = erupted ? 0.5 : 0.2;
  aura.blendMode = "add";
  c.addChild(aura);

  const shadow = new Sprite(textures.shadow);
  shadow.anchor.set(0.5);
  shadow.position.set(cx, cy + s * 0.035);
  shadow.width = s * 1.16;
  shadow.height = s * 1.16;
  shadow.alpha = 0.55;
  c.addChild(shadow);

  const back = new Graphics()
    .circle(cx, cy, outer + s * 0.016)
    .fill({ color: 0x080604, alpha: 0.96 });
  c.addChild(back);

  const wood = new Graphics()
    .circle(cx, cy, outer)
    .fill({ color: 0x352315, alpha: 1 })
    .circle(cx, cy, outer)
    .stroke({ width: s * 0.012, color: 0x0a0604, alpha: 1 });
  c.addChild(wood);

  const steel = new Graphics()
    .circle(cx, cy, outer - band * 0.17)
    .fill({ color: 0x68736b, alpha: 1 })
    .circle(cx, cy, outer - band * 0.17)
    .stroke({ width: s * 0.008, color: 0x1b1510, alpha: 0.9 });
  c.addChild(steel);

  const hole = new Graphics()
    .circle(cx, cy, inner)
    .fill({ color: 0x070504, alpha: 1 })
    .circle(cx, cy, inner)
    .stroke({ width: s * 0.012, color: 0x1e150e, alpha: 1 });
  c.addChild(hole);

  const gilt = new Graphics()
    .circle(cx, cy, outer - s * 0.004)
    .stroke({ width: s * 0.009, color: THEME.colors.giltLo, alpha: 0.62 })
    .circle(cx, cy, inner + s * 0.002)
    .stroke({ width: s * 0.007, color: THEME.colors.giltLo, alpha: 0.4 });
  c.addChild(gilt);

  // Rivets and carved seams around the steel band.
  const rivets = new Graphics();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.18;
    const rr = r + band * 0.28;
    rivets
      .circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.012)
      .fill({ color: 0xc6a65e, alpha: 0.78 })
      .circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.0045)
      .fill({ color: 0x2a1c0e, alpha: 0.8 });
  }
  c.addChild(rivets);

  const seams = new Graphics();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = inner + s * 0.01;
    const r1 = outer - s * 0.016;
    seams
      .moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      .lineTo(cx + Math.cos(a + 0.055) * r1, cy + Math.sin(a + 0.055) * r1)
      .stroke({ width: s * 0.006, color: 0x1a120b, alpha: 0.72 });
  }
  c.addChild(seams);

  // Bile veins crawl across the upper-right arc.
  const veins = new Graphics();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (1.6 + i * 0.13);
    const rr = r + band * (0.05 + i * 0.07);
    veins
      .arc(cx, cy, rr, a, a + 0.2 + i * 0.04)
      .stroke({ width: s * 0.007, color: THEME.colors.bile, alpha: 0.35 + i * 0.08 });
  }
  c.addChild(veins);

  // The eye is set into the upper-left arc.
  const eye = new Container();
  const eyeAngle = Math.PI * 1.2;
  const ex = cx + Math.cos(eyeAngle) * r;
  const ey = cy + Math.sin(eyeAngle) * r;
  eye.position.set(ex, ey);
  eye.rotation = eyeAngle + Math.PI / 2;
  const eyeW = s * 0.27;
  const eyeH = s * 0.135;
  const socket = new Graphics()
    .ellipse(0, 0, eyeW * 0.58, eyeH * 0.58)
    .fill({ color: 0x080604, alpha: 1 })
    .ellipse(0, 0, eyeW * 0.58, eyeH * 0.58)
    .stroke({ width: s * 0.01, color: 0x8a6a3a, alpha: 0.9 });
  eye.addChild(socket);
  const lid = new Graphics()
    .ellipse(0, 0, eyeW * 0.46, eyeH * 0.4)
    .fill({ color: THEME.colors.bile, alpha: 0.95 });
  eye.addChild(lid);
  const iris = new Graphics()
    .ellipse(0, 0, eyeH * 0.28, eyeH * 0.4)
    .fill({ color: 0x121008, alpha: 1 });
  eye.addChild(iris);
  const glint = new Graphics()
    .circle(-eyeH * 0.13, -eyeH * 0.15, eyeH * 0.13)
    .fill({ color: 0xf4f0c0, alpha: 0.92 });
  eye.addChild(glint);
  const brow = new Graphics()
    .arc(0, 0, eyeH * 0.86, Math.PI * 1.08, Math.PI * 1.92)
    .stroke({ width: s * 0.016, color: 0x160e08, alpha: 0.95 });
  eye.addChildAt(brow, 0);
  c.addChild(eye);

  // Tendrils curl off the lower arc.
  const tendrils = new Graphics();
  const random = mulberry32(311);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.08 + random() * 0.84);
    let x = cx + Math.cos(a) * (outer - s * 0.02);
    let y = cy + Math.sin(a) * (outer - s * 0.02);
    const points = [[x, y]];
    for (let k = 0; k < 4; k++) {
      x += (random() - 0.5) * s * 0.12;
      y += s * (0.03 + random() * 0.065);
      points.push([x, y]);
    }
    for (let k = 0; k < points.length - 1; k++) {
      tendrils
        .moveTo(points[k][0], points[k][1])
        .lineTo(points[k + 1][0], points[k + 1][1])
        .stroke({
          width: s * Math.max(0.0035, 0.011 - k * 0.002),
          color: k === 0 ? 0x5d703d : 0x344425,
          alpha: 0.85
        });
    }
    tendrils.circle(x, y, s * 0.014).fill({ color: THEME.colors.bile, alpha: 0.8 });
    tendrils.circle(x, y, s * 0.005).fill({ color: 0xe8eab0, alpha: 0.55 });
  }
  c.addChild(tendrils);

  c.eye = eye;
  c.aura = aura;
  return c;
}

export function drawSinMedallion(sin, size) {
  const c = new Container();
  const s = size;
  const r = s * 0.43;

  const shadow = new Graphics().circle(s / 2 + 1, s / 2 + 2, r).fill({ color: 0x000000, alpha: 0.4 });
  c.addChild(shadow);
  const rim = new Graphics().circle(s / 2, s / 2, r).fill({ color: 0x24160d }).stroke({ width: s * 0.045, color: THEME.colors.giltLo });
  c.addChild(rim);
  const face = new Graphics().circle(s / 2, s / 2, r * 0.82).fill({ color: 0x3a2415 });
  c.addChild(face);
  const inner = new Graphics()
    .circle(s / 2, s / 2, r * 0.7)
    .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.45 });
  c.addChild(inner);

  const glyph = makeText((sin.name || "?").slice(0, 2).toUpperCase(), {
    size: Math.round(s * 0.28),
    font: THEME.fontDisplay,
    weight: "700",
    fill: THEME.colors.giltHi,
    anchorX: 0.5,
    anchorY: 0.5,
    letterSpacing: 1,
    shadow: true
  });
  glyph.position.set(s / 2, s / 2 + 1);
  c.addChild(glyph);
  return c;
}

/**
 * A carved board with recessed cells. Returns the container plus cell anchors so
 * the game scene can drop pieces into the recesses.
 */
export function drawBoard(n, cell, textures, { erupted = false, padding: forcedPadding = null } = {}) {
  const padding = forcedPadding ?? Math.max(14, cell * 0.22);
  const size = n * cell + padding * 2;
  const c = new Container();
  c.boardSize = size;
  c.padding = padding;
  c.cellSize = cell;

  const shadow = new Sprite(textures.shadow);
  shadow.anchor.set(0.5);
  shadow.position.set(size / 2, size / 2 + size * 0.035);
  shadow.width = size * 1.18;
  shadow.height = size * 1.18;
  shadow.alpha = 0.7;
  c.addChild(shadow);

  const frame = new Graphics()
    .roundRect(0, 0, size, size, Math.max(8, cell * 0.08))
    .fill({ color: 0x1a0f08 });
  c.addChild(frame);

  const wood = new Sprite(textures.wood);
  wood.width = size;
  wood.height = size;
  const woodMask = new Graphics().roundRect(0, 0, size, size, Math.max(8, cell * 0.08)).fill(0xffffff);
  wood.mask = woodMask;
  c.addChild(wood, woodMask);

  const outerEdge = new Graphics()
    .roundRect(1, 1, size - 2, size - 2, Math.max(8, cell * 0.08))
    .stroke({ width: 3, color: 0x0b0603 })
    .roundRect(5, 5, size - 10, size - 10, Math.max(6, cell * 0.07))
    .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.5 });
  c.addChild(outerEdge);

  const feltX = padding * 0.52;
  const feltY = padding * 0.52;
  const feltW = size - padding * 1.04;
  const feltH = size - padding * 1.04;
  const felt = new Sprite(textures.felt);
  felt.width = feltW;
  felt.height = feltH;
  felt.position.set(feltX, feltY);
  const feltMask = new Graphics().roundRect(feltX, feltY, feltW, feltH, Math.max(4, cell * 0.04)).fill(0xffffff);
  felt.mask = feltMask;
  c.addChild(felt, feltMask);

  const boardBase = new Graphics()
    .roundRect(feltX, feltY, feltW, feltH, Math.max(4, cell * 0.04))
    .fill({ color: 0x0e0b08, alpha: 0.5 });
  c.addChild(boardBase);

  const cells = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = padding + col * cell;
      const y = padding + row * cell;
      const inset = Math.max(2, cell * 0.035);
      const cc = new Container();
      cc.position.set(x + cell / 2, y + cell / 2);
      cc.cellIndex = row * n + col;

      const recess = new Graphics()
        .roundRect(-cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell - inset * 2, Math.max(2, cell * 0.03))
        .fill({ color: 0x19110b });
      cc.addChild(recess);

      const shade = new Graphics();
      shade
        .roundRect(-cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell * 0.2, Math.max(2, cell * 0.03))
        .fill({ color: 0x000000, alpha: 0.32 });
      shade
        .roundRect(-cell / 2 + inset, cell / 2 - inset - cell * 0.08, cell - inset * 2, cell * 0.08, Math.max(1, cell * 0.02))
        .fill({ color: 0xd8b06a, alpha: 0.06 });
      cc.addChild(shade);

      const lip = new Graphics()
        .roundRect(-cell / 2 + inset, -cell / 2 + inset, cell - inset * 2, cell - inset * 2, Math.max(2, cell * 0.03))
        .stroke({ width: 1, color: 0x000000, alpha: 0.8 });
      cc.addChild(lip);

      cc.pieceLayer = new Container();
      cc.addChild(cc.pieceLayer);
      cc.hitArea = null;
      c.addChild(cc);
      cells.push(cc);
    }
  }

  // Grid grooves sit above the recesses but below pieces.
  const grooves = new Graphics();
  for (let i = 1; i < n; i++) {
    const p = padding + i * cell;
    grooves
      .moveTo(p, padding)
      .lineTo(p, size - padding)
      .stroke({ width: Math.max(1.5, cell * 0.018), color: 0x050302, alpha: 0.85 });
    grooves
      .moveTo(p + 1.5, padding)
      .lineTo(p + 1.5, size - padding)
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.22 });
    grooves
      .moveTo(padding, p)
      .lineTo(size - padding, p)
      .stroke({ width: Math.max(1.5, cell * 0.018), color: 0x050302, alpha: 0.85 });
    grooves
      .moveTo(padding, p + 1.5)
      .lineTo(size - padding, p + 1.5)
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.22 });
  }
  c.addChild(grooves);

  // Brass corner brackets.
  const brass = new Graphics();
  const b = padding * 0.42;
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [size, 0, -1, 1], [0, size, 1, -1], [size, size, -1, -1]]) {
    brass
      .moveTo(x + sx * 3, y + sy * 3 + sy * b)
      .lineTo(x + sx * 3, y + sy * 3)
      .lineTo(x + sx * 3 + sx * b, y + sy * 3)
      .stroke({ width: 3, color: THEME.colors.gilt, alpha: 0.55 });
  }
  c.addChild(brass);

  if (erupted) {
    const infection = drawInfection(size, size, { seed: 47, intensity: 0.8, edgeOnly: true });
    infection.position.set(0, 0);
    c.addChild(infection);
  }

  c.cells = cells;
  return c;
}

/**
 * Bile-green veins that crawl in from the edges of a rectangular surface.
 */
export function drawInfection(width, height, { seed = 1, intensity = 1, edgeOnly = false } = {}) {
  const c = new Container();
  const random = mulberry32(seed);
  const g = new Graphics();
  const count = Math.round(10 * intensity);
  for (let i = 0; i < count; i++) {
    const side = Math.floor(random() * 4);
    let x;
    let y;
    let vx;
    let vy;
    if (side === 0) { x = random() * width; y = 0; vx = (random() - 0.5) * 0.5; vy = 1; }
    else if (side === 1) { x = width; y = random() * height; vx = -1; vy = (random() - 0.5) * 0.5; }
    else if (side === 2) { x = random() * width; y = height; vx = (random() - 0.5) * 0.5; vy = -1; }
    else { x = 0; y = random() * height; vx = 1; vy = (random() - 0.5) * 0.5; }

    const maxLen = (edgeOnly ? 0.18 : 0.42) * Math.min(width, height) * (0.5 + random());
    const points = [[x, y]];
    let px = x;
    let py = y;
    let dx = vx;
    let dy = vy;
    const steps = 5 + Math.floor(random() * 6);
    for (let s = 0; s < steps; s++) {
      dx += (random() - 0.5) * 0.55;
      dy += (random() - 0.5) * 0.55;
      const len = Math.hypot(dx, dy) || 1;
      px += (dx / len) * (maxLen / steps);
      py += (dy / len) * (maxLen / steps);
      points.push([px, py]);
    }
    for (let k = 0; k < points.length - 1; k++) {
      g.moveTo(points[k][0], points[k][1])
        .lineTo(points[k + 1][0], points[k + 1][1])
        .stroke({
          width: Math.max(1, (1 - k / points.length) * 5 * intensity),
          color: k < 2 ? 0x5f6f3c : THEME.colors.bileLo,
          alpha: 0.7
        });
      if (random() < 0.35) {
        g.circle(points[k][0], points[k][1], (1.5 + random() * 3) * intensity).fill({
          color: THEME.colors.bile,
          alpha: 0.28 + random() * 0.25
        });
      }
    }
    g.circle(px, py, 2.2 * intensity).fill({ color: THEME.colors.bile, alpha: 0.7 });
  }
  c.addChild(g);
  return c;
}

/**
 * A carved brass plaque. Used for headings and the game's title.
 */
export function drawPlaque(width, height, { texture = null, title = "", subtitle = "", size = 24 } = {}) {
  const c = new Container();
  const shadow = new Graphics().roundRect(3, 4, width, height, 6).fill({ color: 0x000000, alpha: 0.4 });
  c.addChild(shadow);
  const base = new Graphics().roundRect(0, 0, width, height, 6).fill({ color: 0x3a2412 });
  c.addChild(base);

  const sprite = texture ? new Sprite(texture) : null;
  const mask = new Graphics().roundRect(0, 0, width, height, 6).fill(0xffffff);
  if (sprite) {
    sprite.width = width;
    sprite.height = height;
    sprite.mask = mask;
    c.addChild(sprite, mask);
  } else {
    c.addChild(mask);
  }

  const trim = new Graphics();
  c.addChild(trim);

  const titleText = title
    ? makeText(title, {
        size,
        font: THEME.fontDisplay,
        weight: "700",
        fill: THEME.colors.giltHi,
        anchorX: 0.5,
        anchorY: 0.5,
        letterSpacing: 1.2,
        shadow: true
      })
    : null;
  if (titleText) c.addChild(titleText);

  const subtitleText = subtitle
    ? makeText(subtitle, {
        size: Math.max(8, Math.round(size * 0.32)),
        font: THEME.fontBody,
        weight: "600",
        fill: THEME.colors.boneDim,
        anchorX: 0.5,
        anchorY: 0.5,
        letterSpacing: 2
      })
    : null;
  if (subtitleText) c.addChild(subtitleText);

  c.setSize = (nextWidth, nextHeight) => {
    width = nextWidth;
    height = nextHeight;
    shadow.clear().roundRect(3, 4, width, height, 6).fill({ color: 0x000000, alpha: 0.4 });
    base.clear().roundRect(0, 0, width, height, 6).fill({ color: 0x3a2412 });
    if (sprite) {
      sprite.width = width;
      sprite.height = height;
    }
    mask.clear().roundRect(0, 0, width, height, 6).fill(0xffffff);
    trim.clear();
    trim
      .roundRect(1, 1, width - 2, height - 2, 5)
      .stroke({ width: 2, color: THEME.colors.giltLo })
      .roundRect(4, 4, width - 8, height - 8, 4)
      .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.55 });
    if (titleText) {
      titleText.style.fontSize = Math.round(Math.min(size, Math.max(18, width * 0.062)));
      titleText.position.set(width / 2, subtitleText ? height * 0.38 : height / 2);
      titleText.anchor.set(0.5, 0.5);
    }
    if (subtitleText) {
      subtitleText.style.fontSize = Math.max(7, Math.round(Math.min(size * 0.32, width * 0.024)));
      subtitleText.position.set(width / 2, height * 0.76);
    }
  };
  c.setTitle = (nextTitle, nextSubtitle) => {
    if (titleText) titleText.text = nextTitle;
    if (subtitleText && nextSubtitle != null) subtitleText.text = nextSubtitle;
  };
  c.setSize(width, height);
  return c;
}
