import { Texture } from "pixi.js";

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

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

function addNoise(ctx, width, height, amount = 18, alpha = 0.18, seed = 1) {
  const random = mulberry32(seed);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    data[i + 3] = Math.round(data[i + 3] * alpha + 255 * (1 - alpha));
  }
  ctx.putImageData(image, 0, 0);
}

function woodTexture({ width = 1024, height = 1024, base = "#3a2416", light = "#7a5532", dark = "#1a0f08", seed = 7 } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Broad tonal bands.
  for (let i = 0; i < 26; i++) {
    const y = random() * height;
    const band = 8 + random() * 70;
    const grad = ctx.createLinearGradient(0, y, 0, y + band);
    const a = 0.02 + random() * 0.06;
    grad.addColorStop(0, `rgba(255, 220, 160, 0)`);
    grad.addColorStop(0.5, random() < 0.5 ? `rgba(255, 210, 150, ${a})` : `rgba(0, 0, 0, ${a * 1.5})`);
    grad.addColorStop(1, `rgba(0, 0, 0, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, width, band);
  }

  // Long grain lines.
  for (let i = 0; i < 520; i++) {
    const y = random() * height;
    const amp = 1 + random() * 11;
    const freq = 0.0015 + random() * 0.008;
    const phase = random() * Math.PI * 2;
    const warm = random() < 0.45;
    ctx.strokeStyle = warm
      ? `rgba(220, 170, 110, ${0.03 + random() * 0.1})`
      : `rgba(0, 0, 0, ${0.05 + random() * 0.14})`;
    ctx.lineWidth = 0.5 + random() * 2.4;
    ctx.beginPath();
    for (let x = -10; x <= width + 10; x += 7) {
      const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase * 0.7) * amp * 0.35;
      if (x === -10) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Knots.
  for (let k = 0; k < 5; k++) {
    const cx = random() * width;
    const cy = random() * height;
    const rx = 18 + random() * 54;
    const ry = rx * (0.35 + random() * 0.3);
    for (let ring = 0; ring < 7; ring++) {
      ctx.strokeStyle = ring % 2 === 0 ? `rgba(0,0,0,${0.08 + random() * 0.08})` : `rgba(230,180,120,${0.04 + random() * 0.06})`;
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + ring * 5, ry + ring * 3, random() * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Plank seams.
  for (const x of [width * 0.33, width * 0.68]) {
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 6, height);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,220,160,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, 0);
    ctx.lineTo(x + 10, height);
    ctx.stroke();
  }

  addNoise(ctx, width, height, 22, 0.22, seed + 11);
  return Texture.from(canvas);
}

function parchmentTexture({ width = 1024, height = 1024, seed = 21 } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#e6d7b1");
  grad.addColorStop(0.45, "#d8c8a2");
  grad.addColorStop(1, "#b9a277");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Fibers.
  for (let i = 0; i < 900; i++) {
    const x = random() * width;
    const y = random() * height;
    const len = 2 + random() * 18;
    const angle = random() * Math.PI;
    ctx.strokeStyle = random() < 0.5 ? `rgba(90, 65, 35, ${0.02 + random() * 0.05})` : `rgba(255, 245, 220, ${0.03 + random() * 0.05})`;
    ctx.lineWidth = 0.5 + random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Stains.
  for (let i = 0; i < 9; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 30 + random() * 150;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, r);
    stain.addColorStop(0, `rgba(120, 85, 40, ${0.03 + random() * 0.06})`);
    stain.addColorStop(1, "rgba(120, 85, 40, 0)");
    ctx.fillStyle = stain;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  addNoise(ctx, width, height, 12, 0.3, seed + 5);
  return Texture.from(canvas);
}

function brassTexture({ width = 512, height = 512, seed = 31 } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#f0cd78");
  grad.addColorStop(0.28, "#d9a54a");
  grad.addColorStop(0.55, "#9a6a22");
  grad.addColorStop(0.78, "#e7b75a");
  grad.addColorStop(1, "#6a4310");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 160; i++) {
    const y = random() * height;
    ctx.strokeStyle = random() < 0.5 ? `rgba(255,245,210,${0.03 + random() * 0.08})` : `rgba(40,20,0,${0.03 + random() * 0.08})`;
    ctx.lineWidth = 0.5 + random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + (random() - 0.5) * 8);
    ctx.stroke();
  }

  addNoise(ctx, width, height, 14, 0.2, seed + 3);
  return Texture.from(canvas);
}

function feltTexture({ width = 512, height = 512, seed = 41 } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  ctx.fillStyle = "#1b241a";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 2400; i++) {
    const x = random() * width;
    const y = random() * height;
    const len = 1 + random() * 5;
    ctx.strokeStyle = random() < 0.5 ? `rgba(120, 150, 90, ${0.02 + random() * 0.06})` : `rgba(0, 0, 0, ${0.03 + random() * 0.08})`;
    ctx.lineWidth = 0.5 + random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * len, y + (random() - 0.5) * len);
    ctx.stroke();
  }
  addNoise(ctx, width, height, 20, 0.28, seed + 2);
  return Texture.from(canvas);
}

function stoneTexture({ width = 512, height = 512, seed = 51 } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#8a7550");
  grad.addColorStop(0.5, "#6d5838");
  grad.addColorStop(1, "#3a2a18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 26; i++) {
    let x = random() * width;
    let y = random() * height;
    ctx.strokeStyle = `rgba(20, 12, 6, ${0.15 + random() * 0.25})`;
    ctx.lineWidth = 0.6 + random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 3 + Math.floor(random() * 6);
    for (let s = 0; s < steps; s++) {
      x += (random() - 0.5) * 80;
      y += (random() - 0.5) * 80;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  addNoise(ctx, width, height, 28, 0.3, seed + 4);
  return Texture.from(canvas);
}

function leatherTexture({ width = 512, height = 512, seed = 61 } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);

  ctx.fillStyle = "#2a1a10";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 300; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 2 + random() * 10;
    ctx.fillStyle = random() < 0.5 ? `rgba(90, 55, 30, ${0.04 + random() * 0.08})` : `rgba(0,0,0,${0.04 + random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  addNoise(ctx, width, height, 24, 0.24, seed + 6);
  return Texture.from(canvas);
}

function radialTexture(color, innerAlpha, outerAlpha, size = 256) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${innerAlpha})`);
  grad.addColorStop(0.55, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${innerAlpha * 0.55})`);
  grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${outerAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

function vignetteTexture(size = 1024) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.62, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

function noiseTexture(size = 256, seed = 71) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(random() * 255);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 28;
  }
  ctx.putImageData(image, 0, 0);
  return Texture.from(canvas);
}

function cloudTexture(size = 512, seed = 81) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = mulberry32(seed);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 12 + random() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(185, 201, 106, ${0.02 + random() * 0.08})`);
    g.addColorStop(1, "rgba(185, 201, 106, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return Texture.from(canvas);
}

export function createTextures() {
  return {
    wood: woodTexture({ seed: 7 }),
    woodDark: woodTexture({ base: "#24160c", light: "#5a3a20", dark: "#0d0805", seed: 17 }),
    woodRed: woodTexture({ base: "#4a1f12", light: "#a34a28", dark: "#1a0a05", seed: 27 }),
    parchment: parchmentTexture({}),
    brass: brassTexture({}),
    felt: feltTexture({}),
    stone: stoneTexture({}),
    leather: leatherTexture({}),
    shadow: radialTexture([0, 0, 0], 0.62, 0),
    goldGlow: radialTexture([240, 205, 120], 0.5, 0),
    bileGlow: radialTexture([185, 201, 106], 0.55, 0),
    rustGlow: radialTexture([181, 84, 42], 0.5, 0),
    vignette: vignetteTexture(),
    noise: noiseTexture(),
    bileCloud: cloudTexture()
  };
}
