import { Container, Graphics, Sprite, TilingSprite } from "pixi.js";
import { THEME } from "./theme.js";

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

export class Atmosphere {
  constructor(textures) {
    this.root = new Container();
    this.textures = textures;
    this.time = 0;
    this.reducedMotion = false;
    this.pointer = { x: 0.5, y: 0.5 };

    this.table = new TilingSprite({ texture: textures.woodDark, width: 1, height: 1 });
    this.table.tileScale.set(1.3);
    this.table.tint = 0x8a6a4a;
    this.root.addChild(this.table);

    this.tableShade = new Graphics().rect(0, 0, 1, 1).fill({ color: 0x0b0705, alpha: 0.42 });
    this.root.addChild(this.tableShade);

    this.warmLeft = new Sprite(textures.goldGlow);
    this.warmLeft.anchor.set(0.5);
    this.warmLeft.tint = 0xe8a95a;
    this.warmLeft.alpha = 0.24;
    this.warmLeft.blendMode = "add";
    this.root.addChild(this.warmLeft);

    this.warmRight = new Sprite(textures.goldGlow);
    this.warmRight.anchor.set(0.5);
    this.warmRight.tint = 0xd98a44;
    this.warmRight.alpha = 0.18;
    this.warmRight.blendMode = "add";
    this.root.addChild(this.warmRight);

    this.dustLayer = new Container();
    this.root.addChild(this.dustLayer);
    this.dust = [];
    const random = mulberry32(913);
    for (let i = 0; i < 44; i++) {
      const dot = new Graphics()
        .circle(0, 0, 0.6 + random() * 1.7)
        .fill({ color: random() < 0.5 ? 0xf4d99a : 0xd8e6c0, alpha: 0.18 + random() * 0.38 });
      dot.baseX = random();
      dot.baseY = random();
      dot.phase = random() * Math.PI * 2;
      dot.speed = 0.2 + random() * 0.7;
      dot.drift = 6 + random() * 26;
      this.dustLayer.addChild(dot);
      this.dust.push(dot);
    }

    this.vignette = new Sprite(textures.vignette);
    this.vignette.alpha = 0.85;
    this.root.addChild(this.vignette);

    this.grain = new TilingSprite({ texture: textures.noise, width: 1, height: 1 });
    this.grain.tileScale.set(2.4);
    this.grain.alpha = 0.16;
    this.grain.blendMode = "overlay";
    this.root.addChild(this.grain);

    this.width = 1;
    this.height = 1;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.table.width = width;
    this.table.height = height;
    this.tableShade.clear().rect(0, 0, width, height).fill({ color: 0x0b0705, alpha: 0.42 });
    this.warmLeft.position.set(width * 0.08, height * 0.12);
    this.warmLeft.width = Math.max(width, height) * 0.9;
    this.warmLeft.height = Math.max(width, height) * 0.9;
    this.warmRight.position.set(width * 0.94, height * 0.78);
    this.warmRight.width = Math.max(width, height) * 0.75;
    this.warmRight.height = Math.max(width, height) * 0.75;
    this.vignette.width = width;
    this.vignette.height = height;
    this.grain.width = width;
    this.grain.height = height;
    for (const dot of this.dust) {
      dot.position.set(dot.baseX * width, dot.baseY * height);
    }
  }

  setPointer(x, y) {
    this.pointer.x = x / Math.max(1, this.width);
    this.pointer.y = y / Math.max(1, this.height);
  }

  tick(dt) {
    this.time += dt;
    const t = this.time;
    const flicker = 0.86 + Math.sin(t * 2.3) * 0.05 + Math.sin(t * 7.1) * 0.025;
    this.warmLeft.alpha = 0.24 * flicker;
    this.warmRight.alpha = 0.18 * (1.7 - flicker);

    const px = (this.pointer.x - 0.5) * 18;
    const py = (this.pointer.y - 0.5) * 12;
    this.warmLeft.x += (this.width * 0.08 + px - this.warmLeft.x) * Math.min(1, dt * 2);
    this.warmLeft.y += (this.height * 0.12 + py - this.warmLeft.y) * Math.min(1, dt * 2);
    this.warmRight.x += (this.width * 0.94 + px * 0.6 - this.warmRight.x) * Math.min(1, dt * 2);
    this.warmRight.y += (this.height * 0.78 + py * 0.6 - this.warmRight.y) * Math.min(1, dt * 2);

    for (const dot of this.dust) {
      if (this.reducedMotion) {
        dot.position.set(dot.baseX * this.width, dot.baseY * this.height);
        continue;
      }
      const drift = Math.sin(t * dot.speed + dot.phase) * dot.drift;
      const rise = ((t * 3 * dot.speed + dot.phase * 20) % (this.height + 40)) - 20;
      dot.position.set(
        dot.baseX * this.width + drift,
        (dot.baseY * this.height + rise) % (this.height + 40)
      );
      dot.alpha = 0.16 + (Math.sin(t * dot.speed * 2 + dot.phase) * 0.5 + 0.5) * 0.34;
    }
  }
}
