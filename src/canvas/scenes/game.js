import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { THEME, clamp } from "../theme.js";
import {
  makeButton,
  makeChip,
  makeIconButton,
  makePanel,
  makeSectionLabel,
  makeText,
  ScrollView
} from "../ui.js";
import { drawBoard, drawInfection, drawNoughtIdol, drawO, drawPlaque, drawX } from "../pieces.js";
import { Scene, formatNumber, makeOnlineBar } from "./base.js";
import { action, click, clickPower, powerCards } from "../state.js";

class BoardView extends Container {
  constructor(engine, { onCell, onHover, onOut }) {
    super();
    this.engine = engine;
    this.onCell = onCell;
    this.onHover = onHover;
    this.onOut = onOut;
    this.board = null;
    this.cells = [];
    this.values = [];
    this.previewIndex = null;
    this.previewReply = null;
    this.previewReplyThreat = false;
    this.previewWin = false;
    this.eaten = new Set();
    this.winLine = [];
    this.animations = [];
    this.previewLayer = null;
    this.winLayer = null;
    this.eatenLayer = null;
    this.n = 0;
    this.outer = 0;
  }

  build(n, outer, infected) {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.n = n;
    this.outer = outer;
    const padding = clamp(outer * 0.035, 9, 22);
    const cell = (outer - padding * 2) / n;
    const board = drawBoard(n, cell, this.engine.textures, { erupted: infected, padding });
    this.board = board;
    this.addChild(board);
    this.cells = board.cells;
    this.cellSize = cell;
    this.values = Array(n * n).fill(null);
    this.previewIndex = null;
    this.previewReply = null;
    this.eaten = new Set();
    this.winLine = [];
    this.animations = [];

    this.eatenLayer = new Container();
    board.addChild(this.eatenLayer);
    this.winLayer = new Container();
    board.addChild(this.winLayer);
    this.previewLayer = new Container();
    board.addChild(this.previewLayer);

    for (const cellNode of this.cells) {
      const i = cellNode.cellIndex;
      cellNode.eventMode = "static";
      cellNode.cursor = "pointer";
      cellNode.hitArea = new Rectangle(-cell / 2, -cell / 2, cell, cell);
      cellNode.on("pointerover", () => this.onHover(i));
      cellNode.on("pointerout", () => this.onOut(i));
      cellNode.on("pointerup", () => this.onCell(i));
      if (cellNode.pieceLayer) cellNode.pieceLayer.eventMode = "none";
    }
  }

  update(snap) {
    const infected = Boolean(snap.erupted || snap.currentSin || (snap.mode === "endless" && snap.noughtDamageTarget));
    if (!this.board || this.n !== snap.board.length ** 0.5 || this.values.length !== snap.board.length) {
      // The caller rebuilds on board-size changes; this is a safety net.
    }
    for (let i = 0; i < snap.board.length; i++) {
      const value = snap.board[i] || null;
      if (value !== this.values[i]) {
        this.values[i] = value;
        this.setPiece(i, value, infected);
      }
      const cell = this.cells[i];
      if (cell) {
        cell.cursor = value ? "default" : "pointer";
      }
    }

    const eatenKey = [...snap.eatenCells].sort().join(",");
    if (eatenKey !== this.eatenKey) {
      this.eatenKey = eatenKey;
      this.drawEaten(snap.eatenCells);
    }

    const winKey = snap.winLine.join(",");
    if (winKey !== this.winKey) {
      this.winKey = winKey;
      this.drawWin(snap.winLine);
    }

    const previewKey = [snap.previewIndex, snap.previewReply, snap.previewReplyThreat, snap.previewWin].join("|");
    if (previewKey !== this.previewKey) {
      this.previewKey = previewKey;
      this.drawPreview(snap);
    }
  }

  setPiece(index, value, infected) {
    const cell = this.cells[index];
    if (!cell) return;
    this.animations = this.animations.filter((anim) => anim.index !== index);
    const layer = cell.pieceLayer;
    layer.removeChildren().forEach((child) => child.destroy({ children: true }));
    if (!value) return;
    const size = this.cellSize * 0.82;
    const piece = value === "X"
      ? drawX(size, { infected })
      : drawO(size, { infected });
    piece.rotation = (value === "X" ? -0.02 : 0.01) + (index % 2 ? 0.012 : -0.012);
    layer.addChild(piece);
    piece.scale.set(1.35);
    piece.alpha = 0;
    this.animations.push({ index, piece, elapsed: 0, duration: 0.3, baseRotation: piece.rotation });
  }

  drawEaten(eaten) {
    const layer = this.eatenLayer;
    if (!layer) return;
    layer.removeChildren().forEach((child) => child.destroy({ children: true }));
    for (const index of eaten) {
      const cell = this.cells[index];
      if (!cell) continue;
      const size = this.cellSize * 0.78;
      const g = new Graphics();
      g.roundRect(cell.x - size / 2, cell.y - size / 2, size, size, 4).fill({ color: 0x0b0d06, alpha: 0.8 });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + index;
        g.moveTo(cell.x, cell.y)
          .lineTo(cell.x + Math.cos(a) * size * 0.5, cell.y + Math.sin(a) * size * 0.5)
          .stroke({ width: 1.5, color: THEME.colors.bileLo, alpha: 0.65 });
      }
      g.circle(cell.x, cell.y, size * 0.12).fill({ color: THEME.colors.bile, alpha: 0.28 });
      layer.addChild(g);
    }
  }

  drawWin(winLine) {
    const layer = this.winLayer;
    if (!layer) return;
    layer.removeChildren().forEach((child) => child.destroy({ children: true }));
    if (!winLine || winLine.length < 2) return;
    const first = this.cells[winLine[0]];
    const last = this.cells[winLine[winLine.length - 1]];
    if (!first || !last) return;
    const line = new Graphics()
      .moveTo(first.x, first.y)
      .lineTo(last.x, last.y)
      .stroke({ width: this.cellSize * 0.08, color: THEME.colors.giltHi, alpha: 0.22 });
    layer.addChild(line);
    for (const index of winLine) {
      const cell = this.cells[index];
      if (!cell) continue;
      const glow = new Sprite(this.engine.textures.goldGlow);
      glow.anchor.set(0.5);
      glow.position.set(cell.x, cell.y);
      glow.width = this.cellSize * 1.2;
      glow.height = this.cellSize * 1.2;
      glow.alpha = 0.25;
      glow.blendMode = "add";
      layer.addChild(glow);
    }
  }

  drawPreview(snap) {
    const layer = this.previewLayer;
    if (!layer) return;
    layer.removeChildren().forEach((child) => child.destroy({ children: true }));
    if (snap.previewIndex != null && !this.values[snap.previewIndex]) {
      const cell = this.cells[snap.previewIndex];
      if (cell) {
        const ghost = drawX(this.cellSize * 0.82, { ghost: true });
        ghost.position.set(cell.x, cell.y);
        ghost.alpha = 0.55;
        layer.addChild(ghost);
        if (snap.previewWin) {
          const ring = new Graphics()
            .circle(cell.x, cell.y, this.cellSize * 0.36)
            .stroke({ width: 2, color: THEME.colors.giltHi, alpha: 0.85 });
          layer.addChild(ring);
        }
      }
    }
    if (snap.previewReply != null && !this.values[snap.previewReply]) {
      const cell = this.cells[snap.previewReply];
      if (cell) {
        const ghost = drawO(this.cellSize * 0.82, {
          ghost: true,
          tint: snap.previewReplyThreat ? THEME.colors.rustHi : THEME.colors.bile
        });
        ghost.position.set(cell.x, cell.y);
        ghost.alpha = 0.6;
        layer.addChild(ghost);
      }
    }
  }

  tick(dt) {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const overshoot = Math.sin(t * Math.PI) * 0.12;
      anim.piece.scale.set(1.35 + (1 - 1.35) * eased - overshoot * (1 - t));
      anim.piece.alpha = Math.min(1, t * 2.2);
      if (t >= 1) {
        anim.piece.scale.set(1);
        anim.piece.alpha = 1;
        anim.piece.rotation = anim.baseRotation;
        this.animations.splice(i, 1);
      }
    }
  }
}

class HScroll extends Container {
  constructor({ width, height, radius = 4 }) {
    super();
    this.viewWidth = width;
    this.viewHeight = height;
    this.content = new Container();
    this.addChild(this.content);
    this.maskShape = new Graphics().roundRect(0, 0, width, height, radius).fill(0xffffff);
    this.addChild(this.maskShape);
    this.content.mask = this.maskShape;
    this.scrollX = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragStart = 0;
    this.dragScroll = 0;
    this.eventMode = "static";
    this.hitArea = new Rectangle(0, 0, width, height);
    this.on("pointerdown", (event) => {
      this.dragging = true;
      this.dragStart = event.global.x;
      this.dragScroll = this.scrollX;
    });
    this.on("globalpointermove", (event) => {
      if (!this.dragging) return;
      this.setScroll(this.dragScroll + event.global.x - this.dragStart);
    });
    this.on("pointerup", () => { this.dragging = false; });
    this.on("pointerupoutside", () => { this.dragging = false; });
    this.on("wheel", (event) => {
      this.setScroll(this.scrollX + (event.deltaX || event.deltaY || 0) * 0.8);
    });
  }

  setContentWidth(width) {
    this.contentWidth = width;
    this.maxScroll = Math.max(0, width - this.viewWidth);
    this.setScroll(this.scrollX);
  }

  setScroll(value) {
    this.scrollX = clamp(value, -this.maxScroll, 0);
    this.content.x = this.scrollX;
  }
}

function makeTray(engine, { width = 224, height = 400, radius = 7 } = {}) {
  const c = new Container();
  const bg = new Sprite(engine.textures.woodDark);
  bg.tint = 0xc8a878;
  c.addChild(bg);
  const mask = new Graphics();
  bg.mask = mask;
  c.addChild(mask);
  const inset = new Graphics();
  c.addChild(inset);
  const border = new Graphics();
  c.addChild(border);

  c.setSize = (w, h) => {
    c.trayWidth = w;
    c.trayHeight = h;
    bg.width = w;
    bg.height = h;
    mask.clear().roundRect(0, 0, w, h, radius).fill(0xffffff);
    inset.clear()
      .roundRect(5, 5, w - 10, h - 10, Math.max(2, radius - 2))
      .fill({ color: 0x0a0705, alpha: 0.22 })
      .roundRect(9, 9, w - 18, h - 18, Math.max(2, radius - 4))
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.16 });
    border.clear()
      .roundRect(0.5, 0.5, w - 1, h - 1, radius)
      .stroke({ width: 2, color: 0x050302 })
      .roundRect(4.5, 4.5, w - 9, h - 9, Math.max(2, radius - 3))
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.42 });
    for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) {
      border.circle(x, y, 2.2).fill({ color: THEME.colors.giltLo, alpha: 0.55 });
    }
  };
  c.setSize(width, height);
  return c;
}

function rarityColor(rarity) {
  if (rarity === "rare") return 0xb5542a;
  if (rarity === "uncommon") return 0x6a8a5a;
  return 0x9a8a6a;
}

function makePowerCard(engine, card, { width = 224, height = 72, compact = false } = {}) {
  const c = new Container();
  const power = card.power || { name: card.name || "Graft", rarity: "common", category: "ater", desc: "" };
  const accent = rarityColor(power.rarity);

  const panel = makePanel({
    width,
    height,
    radius: 5,
    texture: engine.textures.leather,
    textureTint: 0xd0b090,
    stroke: 0x080503,
    innerStroke: accent,
    shadow: true,
    shadowTexture: engine.textures.shadow,
    shadowAlpha: 0.42
  });
  c.addChild(panel);

  const stateColor = card.armed
    ? THEME.colors.giltHi
    : card.cooling || card.unavailable
      ? 0x7a6a5a
      : card.dormant
        ? 0x7a7a5a
        : THEME.colors.bile;
  const edge = new Graphics()
    .roundRect(3, 3, width - 6, height - 6, 3)
    .stroke({ width: 1, color: accent, alpha: 0.55 });
  c.addChild(edge);

  const discR = compact ? 15 : 18;
  const disc = new Graphics()
    .circle(12 + discR, height / 2, discR)
    .fill({ color: 0x1b120b })
    .stroke({ width: 1.5, color: accent, alpha: 0.85 });
  c.addChild(disc);
  const glyph = makeText(card.glyph || "??", {
    size: Math.round(discR * 0.92),
    font: THEME.fontDisplay,
    weight: "700",
    fill: THEME.colors.giltHi,
    anchorX: 0.5,
    anchorY: 0.5
  });
  glyph.position.set(12 + discR, height / 2 + 1);
  c.addChild(glyph);

  const name = makeText(card.name || power.name, {
    size: compact ? 11 : 12,
    font: THEME.fontDisplay,
    weight: "700",
    fill: THEME.colors.bone,
    letterSpacing: 0.3
  });
  name.position.set(discR * 2 + 20, compact ? 9 : 8);
  c.addChild(name);

  const state = makeText(card.armed ? "ARMED" : card.cooling ? "COOLING" : card.dormant ? "DORMANT" : card.copies || "", {
    size: 8,
    font: THEME.fontBody,
    weight: "700",
    fill: stateColor,
    letterSpacing: 0.8
  });
  state.position.set(discR * 2 + 20, compact ? 25 : 24);
  c.addChild(state);

  if (card.cooldown > 0) {
    const badge = new Graphics()
      .roundRect(width - 32, 6, 26, 16, 3)
      .fill({ color: 0x0c0805, alpha: 0.75 })
      .stroke({ width: 1, color: THEME.colors.rust, alpha: 0.6 });
    c.addChild(badge);
    const cd = makeText(String(card.cooldown), {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.rustHi,
      anchorX: 0.5,
      anchorY: 0.5
    });
    cd.position.set(width - 19, 14);
    c.addChild(cd);
  }

  if (card.tiers && card.tiers.length) {
    const tierY = height - (compact ? 22 : 24);
    const tierW = (width - discR * 2 - 30) / 4;
    card.tiers.forEach((tier, index) => {
      const b = new Container();
      const bg = new Graphics()
        .roundRect(0, 0, tierW - 2, 16, 2)
        .fill({ color: tier.active ? 0x5a4a1a : 0x1a120b })
        .stroke({ width: 1, color: tier.disabled ? 0x3a3028 : tier.active ? THEME.colors.giltHi : THEME.colors.giltLo, alpha: tier.disabled ? 0.4 : 0.8 });
      b.addChild(bg);
      const label = makeText(tier.label, {
        size: 8,
        font: THEME.fontBody,
        weight: "700",
        fill: tier.disabled ? 0x5a5048 : tier.active ? THEME.colors.giltHi : THEME.colors.boneDim,
        anchorX: 0.5,
        anchorY: 0.5
      });
      label.position.set((tierW - 2) / 2, 8);
      b.addChild(label);
      b.position.set(discR * 2 + 18 + index * tierW, tierY);
      if (!tier.disabled) {
        b.eventMode = "static";
        b.cursor = "pointer";
        b.hitArea = new Rectangle(0, 0, tierW - 2, 16);
        b.on("pointerup", (event) => {
          event.stopPropagation();
          clickPower(card.id, tier.tier);
        });
      }
      c.addChild(b);
    });
  }

  c.eventMode = "static";
  c.cursor = card.disabled ? "default" : "pointer";
  c.hitArea = new Rectangle(0, 0, width, height);
  c.on("pointerover", () => {
    let extra = "";
    try {
      const state = window.TTNState;
      if (state && state.helpers && state.helpers.powerState) {
        const p = state.helpers.powerState(card.id);
        extra = state.helpers.powerTooltipState(power, p);
      }
    } catch {
      extra = "";
    }
    engine.showTooltip(power.name + " — " + (power.desc || "") + (extra ? " · " + extra : ""));
  });
  c.on("pointerout", () => engine.hideTooltip());
  c.on("pointerup", (event) => {
    event.stopPropagation();
    if (!card.disabled) clickPower(card.id);
  });
  return c;
}

export class GameScene extends Scene {
  constructor(engine) {
    super(engine);
    this.layoutMode = "";
    this.powerSignature = "";
    this.lastScore = null;
    this.scorePulse = 0;
    this.blinkTimer = 2;
    this.idolEye = null;
    this.build();
  }

  build() {
    const e = this.engine;
    this.topBar = new Container();
    this.root.addChild(this.topBar);

    this.menuBtn = makeButton({
      width: 96,
      height: 34,
      label: "← Menu",
      variant: "ghost",
      fontSize: 11,
      align: "center",
      padding: 0,
      onClick: () => action("toMenu")
    });
    this.topBar.addChild(this.menuBtn);

    this.titlePlaque = drawPlaque(300, 44, {
      texture: e.textures.brass,
      title: "Tic Tac Nought",
      subtitle: "",
      size: 20
    });
    this.topBar.addChild(this.titlePlaque);

    this.modeText = makeText("ENDLESS", {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.boneDim,
      anchorX: 1,
      anchorY: 0.5,
      letterSpacing: 2
    });
    this.topBar.addChild(this.modeText);

    this.onlineBar = makeOnlineBar(e, { width: 260, compact: true });
    this.topBar.addChild(this.onlineBar);

    this.optionsBtn = makeIconButton({
      size: 34,
      glyph: "⚙",
      variant: "ghost",
      onClick: () => click("optionsTopBtn")
    });
    this.topBar.addChild(this.optionsBtn);

    this.bookBtn = makeIconButton({
      size: 34,
      glyph: "B",
      variant: "ghost",
      label: "Book of Decay",
      onClick: () => click("openBook")
    });
    this.topBar.addChild(this.bookBtn);

    this.resetBtn = makeIconButton({
      size: 34,
      glyph: "↻",
      variant: "ghost",
      label: "Reset run",
      onClick: () => click("reset")
    });
    this.topBar.addChild(this.resetBtn);

    this.statusText = makeText("", {
      size: 15,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.bone,
      align: "center",
      anchorX: 0.5,
      anchorY: 0.5,
      wordWrap: true,
      wordWrapWidth: 520
    });
    this.root.addChild(this.statusText);

    this.scorePlaque = new Container();
    this.root.addChild(this.scorePlaque);
    const scoreBg = makePanel({
      width: 210,
      height: 66,
      radius: 6,
      texture: e.textures.woodDark,
      textureTint: 0xc8a878,
      stroke: 0x060403,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: e.textures.shadow,
      shadowAlpha: 0.45
    });
    this.scorePlaque.addChild(scoreBg);
    this.scoreCaption = makeText("DAMAGE", {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.boneDim,
      letterSpacing: 2
    });
    this.scoreCaption.position.set(12, 8);
    this.scorePlaque.addChild(this.scoreCaption);
    this.scoreValue = makeText("0", {
      size: 30,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.giltHi,
      shadow: true
    });
    this.scoreValue.position.set(12, 20);
    this.scorePlaque.addChild(this.scoreValue);
    this.xpTrack = new Graphics();
    this.xpTrack.position.set(12, 54);
    this.scorePlaque.addChild(this.xpTrack);
    this.xpText = makeText("0/10", {
      size: 8,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.boneDim,
      anchorX: 1,
      anchorY: 0.5
    });
    this.xpText.position.set(198, 58);
    this.scorePlaque.addChild(this.xpText);
    this.scoreFloat = makeText("", {
      size: 13,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.bileHi,
      anchorX: 0.5,
      anchorY: 1
    });
    this.scorePlaque.addChild(this.scoreFloat);

    this.chips = new Container();
    this.root.addChild(this.chips);
    this.roundChip = makeChip("Round 1", { size: 10 });
    this.boardChip = makeChip("3×3", { size: 10 });
    this.boostChip = makeChip("BOOST", { size: 9, color: THEME.colors.bile });
    this.chips.addChild(this.roundChip, this.boardChip, this.boostChip);
    this.boostPips = new Graphics();
    this.chips.addChild(this.boostPips);

    this.infection = new Container();
    this.root.addChild(this.infection);

    this.idol = drawNoughtIdol(300, e.textures, { erupted: false });
    this.root.addChildAt(this.idol, 0);
    this.idolEye = this.idol.eye;

    this.boardView = new BoardView(e, {
      onCell: (index) => action("handleCell", index),
      onHover: (index) => {
        const state = window.TTNState;
        if (!state) return;
        if (state.helpers.canPlayCell(index)) action("setPreview", index);
      },
      onOut: () => {
        const state = window.TTNState;
        if (state && state.previewIndex != null) action("clearPreview");
      }
    });
    this.root.addChild(this.boardView);

    this.leftTray = makeTray(e);
    this.rightTray = makeTray(e);
    this.leftTrayMark = new Graphics();
    this.rightTrayMark = new Graphics();
    this.leftTray.addChild(this.leftTrayMark);
    this.rightTray.addChild(this.rightTrayMark);
    this.root.addChild(this.leftTray, this.rightTray);

    this.leftRack = new Container();
    this.rightRack = new Container();
    this.root.addChild(this.leftRack, this.rightRack);
    this.leftTitle = makeSectionLabel("Cancerous +", { width: 196, color: THEME.colors.gilt });
    this.leftRack.addChild(this.leftTitle);
    this.rightTitle = makeSectionLabel("Technological @", { width: 196, color: THEME.colors.gilt });
    this.rightRack.addChild(this.rightTitle);
    this.leftCards = new Container();
    this.rightCards = new Container();
    this.leftRack.addChild(this.leftCards);
    this.rightRack.addChild(this.rightCards);
    this.leftEmpty = makeText("", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.boneDim,
      wordWrap: true,
      wordWrapWidth: 196,
      lineHeight: 14
    });
    this.leftRack.addChild(this.leftEmpty);
    this.powerMeta = makeText("", {
      size: 9,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.boneDim,
      wordWrap: true,
      wordWrapWidth: 196
    });
    this.leftRack.addChild(this.powerMeta);

    this.leftActions = new Container();
    this.leftRack.addChild(this.leftActions);
    this.bookButton = makeButton({
      width: 196,
      height: 32,
      label: "Book of Decay",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("openBook")
    });
    this.leftActions.addChild(this.bookButton);
    this.resetButton = makeButton({
      width: 196,
      height: 32,
      label: "Reset run",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("reset")
    });
    this.resetButton.position.set(0, 38);
    this.leftActions.addChild(this.resetButton);

    this.mobileTray = makeTray(e, { width: 360, height: 178, radius: 6 });
    this.mobileSlots = new Graphics();
    this.mobileTray.addChild(this.mobileSlots);
    this.root.addChild(this.mobileTray);

    this.mobilePowerStrip = new HScroll({ width: 400, height: 88, radius: 4 });
    this.root.addChild(this.mobilePowerStrip);
    this.mobilePowerLabel = makeSectionLabel("Grafts", { width: 0, color: THEME.colors.gilt, size: 9 });
    this.root.addChild(this.mobilePowerLabel);
    this.mobileEmpty = makeText("No grafts yet. Every 3 completed rounds grants one.", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.boneDim,
      anchorX: 0.5,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 300
    });
    this.root.addChild(this.mobileEmpty);

    this.runPanel = new Container();
    this.root.addChild(this.runPanel);
    this.runPanelBg = makePanel({
      width: 420,
      height: 64,
      radius: 5,
      texture: e.textures.parchment,
      stroke: 0x5a3a1a,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: e.textures.shadow,
      shadowAlpha: 0.4
    });
    this.runPanel.addChild(this.runPanelBg);
    this.runStatus = makeText("", {
      size: 10,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.ink,
      wordWrap: true,
      wordWrapWidth: 388,
      lineHeight: 13
    });
    this.runStatus.position.set(14, 10);
    this.runPanel.addChild(this.runStatus);
    this.runButtons = new Container();
    this.runPanel.addChild(this.runButtons);

    this.runPanel.visible = false;
  }

  update(snap) {
    this.snapshot = snap;
    const e = this.engine;

    this.modeText.text = (snap.gameModeLabel || snap.mode || "").toUpperCase();
    this.statusText.text = snap.status || "";
    this.statusText.style.fill = snap.result === "X" || snap.result === "O" || snap.result === "draw"
      ? THEME.colors.giltHi
      : THEME.colors.bone;

    const score = snap.run && snap.run.score != null ? snap.run.score : 0;
    this.scoreValue.text = formatNumber(score);
    this.scoreCaption.text = snap.mode === "two" ? "SCORE" : "DAMAGE";
    if (this.lastScore != null && score !== this.lastScore) {
      const diff = score - this.lastScore;
      if (diff > 0) {
        this.scoreFloat.text = "+" + formatNumber(diff);
        this.scorePulse = 0.5;
      }
    }
    this.lastScore = score;

    const need = snap.run ? Math.max(1, snap.run.level * 10) : 10;
    const xp = snap.run ? snap.run.xp || 0 : 0;
    const xpPct = clamp(xp / need, 0, 1);
    this.xpTrack.clear()
      .roundRect(0, 0, 186, 4, 2)
      .fill({ color: 0x0b0704, alpha: 0.8 })
      .roundRect(0, 0, Math.max(2, 186 * xpPct), 4, 2)
      .fill({ color: THEME.colors.gilt, alpha: 0.85 });
    this.xpText.text = "Lv " + (snap.run ? snap.run.level : 1) + " · " + xp + "/" + need;

    this.roundChip.text.text = "Round " + (snap.run ? snap.run.round : 1);
    this.boardChip.text.text = snap.runBoard || "3×3";
    const buff = snap.run ? snap.run.buffRounds || 0 : 0;
    this.boostChip.visible = buff > 0;
    this.boostPips.clear();
    if (buff > 0) {
      for (let i = 0; i < Math.min(5, buff); i++) {
        this.boostPips.circle(4 + i * 9, 4, 3).fill({ color: THEME.colors.bile, alpha: 0.85 });
      }
    }

    const n = Math.max(1, Math.round(Math.sqrt(snap.board.length)));
    const infected = Boolean(snap.erupted || snap.currentSin || snap.noughtDamageTarget);
    const boardOuter = this.boardOuter || 400;
    if (!this.boardView.board || this.boardView.n !== n || Math.abs(this.boardView.outer - boardOuter) > 1) {
      this.boardView.build(n, boardOuter, infected);
      this.layoutBoardPosition();
    }
    this.boardView.update(snap);

    this.updatePowers(snap);
    this.updateRunPanel(snap);

    const sinMode = snap.mode === "endless" || snap.mode === "story";
    this.idol.visible = sinMode;
    const nought = Boolean(snap.noughtDamageTarget) || (snap.currentSin == null && sinMode && snap.run && !snap.run.over);
    this.idol.alpha = nought ? 0.92 : 0.7;
    this.idol.aura.alpha = nought ? 0.72 : 0.42;
    this.idolEye = this.idol.eye;

    this.onlineBar.updateBar(snap);
    this.onlineBar.visible = Boolean(snap.onlineEnabled);

    this.layout(this.width, this.height);
  }

  updatePowers(snap) {
    const cards = snap.powerCards || powerCards();
    const sig = JSON.stringify({
      left: cards.left.map((card) => [card.id, card.armed, card.cooling, card.unavailable, card.dormant, card.cooldown, card.copies, card.tiers.map((t) => [t.tier, t.active, t.disabled])]),
      right: cards.right.map((card) => [card.id, card.armed, card.cooling, card.unavailable, card.dormant, card.cooldown, card.copies]),
      empty: cards.empty,
      meta: snap.powerMeta,
      mode: snap.mode
    });
    if (sig === this.powerSignature) return;
    this.powerSignature = sig;

    this.leftCards.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.rightCards.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.mobilePowerStrip.content.removeChildren().forEach((child) => child.destroy({ children: true }));

    const buildCards = (list, parent, mobile = false) => {
      let y = 0;
      for (const card of list) {
        const c = makePowerCard(this.engine, card, mobile ? { width: 178, height: 76, compact: true } : { width: 208, height: 68 });
        c.position.set(0, y);
        parent.addChild(c);
        y += (mobile ? 80 : 74);
      }
      return y;
    };

    buildCards(cards.left, this.leftCards);
    buildCards(cards.right, this.rightCards);

    const all = [...cards.left, ...cards.right];
    let x = 0;
    for (const card of all) {
      const c = makePowerCard(this.engine, card, { width: 178, height: 76, compact: true });
      c.position.set(x, 0);
      this.mobilePowerStrip.content.addChild(c);
      x += 186;
    }
    this.mobilePowerStrip.setContentWidth(Math.max(0, x - 8));

    this.leftEmpty.text = cards.empty || "";
    this.leftEmpty.visible = all.length === 0;
    this.powerMeta.text = snap.powerMeta || "";
  }

  updateRunPanel(snap) {
    const visible = Boolean(snap.onlineEnabled && (snap.onlineRunStatus || (snap.onlineRunButtons && snap.onlineRunButtons.length)));
    this.runPanel.visible = visible;
    if (!visible) return;
    this.runStatus.text = snap.onlineRunStatus || "";
    this.runButtons.removeChildren().forEach((child) => child.destroy({ children: true }));
    let x = 14;
    const buttons = snap.onlineRunButtons || [];
    buttons.forEach((info, index) => {
      const b = makeButton({
        width: Math.max(74, Math.min(130, info.label.length * 7 + 22)),
        height: 22,
        label: info.label,
        variant: info.className.includes("ghost") ? "ghost" : "brass",
        fontSize: 9,
        align: "center",
        padding: 0,
        disabled: info.disabled,
        onClick: () => {
          const list = document.querySelectorAll("#onlineRunActions button");
          if (list[index]) list[index].click();
        }
      });
      b.position.set(x, 36);
      this.runButtons.addChild(b);
      x += b.width + 6;
    });
  }

  layout(width, height) {
    this.width = width;
    this.height = height;
    const mobile = width < 760;
    const compact = width < 1100;
    const mode = mobile ? "mobile" : compact ? "compact" : "desktop";
    this.layoutMode = mode;

    const topH = mobile ? 46 : 52;
    const margin = mobile ? 10 : 20;
    this.topBar.position.set(margin, mobile ? 8 : 10);
    this.menuBtn.visible = true;
    this.titlePlaque.visible = !mobile;
    this.modeText.visible = !mobile;
    this.bookBtn.visible = mobile;
    this.resetBtn.visible = mobile;
    this.optionsBtn.visible = true;
    this.onlineBar.visible = Boolean(this.snapshot && this.snapshot.onlineEnabled) && !mobile;

    const topBarW = width - margin * 2;
    this.menuBtn.position.set(0, 0);
    this.titlePlaque.setSize(Math.min(320, topBarW * 0.36), 42);
    this.titlePlaque.position.set((topBarW - Math.min(320, topBarW * 0.36)) / 2, 0);
    this.modeText.position.set(
      topBarW - (this.snapshot && this.snapshot.onlineEnabled ? 328 : 52),
      21
    );
    this.optionsBtn.position.set(topBarW - 38, 4);
    this.onlineBar.position.set(topBarW - 318, 4);
    if (mobile) {
      this.menuBtn.position.set(0, 2);
      this.bookBtn.position.set(topBarW - 112, 2);
      this.resetBtn.position.set(topBarW - 76, 2);
      this.optionsBtn.position.set(topBarW - 38, 2);
    } else {
      this.menuBtn.position.set(0, 0);
    }

    const contentTop = (mobile ? 8 : 10) + topH + (mobile ? 8 : 14);
    const rackW = mode === "desktop" ? Math.min(224, width * 0.19) : 0;
    const centerW = mode === "desktop" ? width - rackW * 2 - margin * 2 - 48 : width - margin * 2;

    // HUD sizing.
    const scoreW = mobile ? Math.min(180, centerW * 0.55) : 210;
    this.scorePlaque.scale.set(mobile ? 0.86 : 1);
    this.scorePlaque.position.set(
      mobile ? margin : margin + rackW + 24,
      contentTop + (mobile ? 26 : 28)
    );
    this.scoreValue.style.fontSize = mobile ? 26 : 30;
    this.xpTrack.position.set(12, 54);
    this.xpText.position.set(198, 58);

    this.statusText.style.wordWrapWidth = centerW;
    this.statusText.position.set(width / 2, contentTop + (mobile ? 6 : 8));

    this.chips.position.set(
      mobile ? width - margin - 124 : margin + rackW + 24 + scoreW + 20,
      contentTop + (mobile ? 30 : 30)
    );
    this.roundChip.position.set(0, 0);
    this.boardChip.position.set(this.roundChip.chipWidth + 6, 0);
    this.boostChip.position.set(this.roundChip.chipWidth + this.boardChip.chipWidth + 12, 0);
    this.boostPips.position.set(this.roundChip.chipWidth + this.boardChip.chipWidth + 12, this.boostChip.chipHeight + 4);

    const hudH = mobile ? 96 : 78;
    const bottomH = mobile ? (this.mobilePowerStrip.visible ? 190 : 40) : 46;
    const availableH = height - contentTop - hudH - bottomH - 18;
    const boardOuter = Math.max(
      mobile ? 160 : 220,
      Math.min(centerW - (mobile ? 8 : 24), availableH, mobile ? 460 : 620)
    );
    this.boardOuter = boardOuter;
    if (this.boardView.board && Math.abs(this.boardView.outer - boardOuter) > 1) {
      this.boardView.build(this.boardView.n, boardOuter, Boolean(this.snapshot && (this.snapshot.erupted || this.snapshot.currentSin)));
      if (this.snapshot) this.boardView.update(this.snapshot);
    }
    this.layoutBoardPosition();

    this.infection.visible = Boolean(this.snapshot && (this.snapshot.erupted || this.snapshot.currentSin));
    if (this.infection.visible && this.infectionKey !== Math.round(boardOuter)) {
      this.infectionKey = Math.round(boardOuter);
      this.infection.removeChildren().forEach((child) => child.destroy({ children: true }));
      const inf = drawInfection(boardOuter, boardOuter, { seed: 37, intensity: 0.8 });
      inf.alpha = 0.38;
      this.infection.addChild(inf);
      this.infection.width = boardOuter;
      this.infection.height = boardOuter;
    }

    const sideGap = mode === "desktop"
      ? Math.max(0, (width - margin * 2 - rackW * 2 - boardOuter) / 2)
      : 0;
    const gapIdolSize = Math.min(184, Math.max(124, sideGap * 0.95));
    const idolFitsGap = mode === "desktop" && sideGap >= gapIdolSize;
    const idolSize = idolFitsGap
      ? gapIdolSize
      : Math.min(mobile ? 150 : 170, boardOuter * 0.42);
    this.idol.width = idolSize;
    this.idol.height = idolSize;
    if (idolFitsGap) {
      this.idol.position.set(
        this.boardView.x + boardOuter + (sideGap - idolSize) / 2,
        this.boardView.y + (boardOuter - idolSize) / 2
      );
    } else {
      this.idol.position.set(
        this.boardView.x + boardOuter - idolSize * 0.9,
        this.boardView.y - idolSize * 0.38
      );
    }

    if (mode === "desktop") {
      this.leftRack.visible = true;
      this.rightRack.visible = true;
      this.leftTray.visible = true;
      this.rightTray.visible = true;
      this.mobileTray.visible = false;
      this.mobilePowerStrip.visible = false;
      this.mobilePowerLabel.visible = false;
      this.mobileEmpty.visible = false;
      const rackX = margin;
      const rackTop = contentTop + 46;
      const trayH = height - rackTop - 14;
      this.leftTray.setSize(rackW, trayH);
      this.rightTray.setSize(rackW, trayH);
      this.leftTray.position.set(rackX, rackTop - 12);
      this.rightTray.position.set(width - margin - rackW, rackTop - 12);
      this.leftRack.position.set(rackX, rackTop);
      this.rightRack.position.set(width - margin - rackW, rackTop);
      this.leftTitle.visible = true;
      this.rightTitle.visible = true;
      this.leftTitle.position.set(14, 14);
      this.rightTitle.position.set(14, 14);
      this.leftCards.position.set(14, 50);
      this.rightCards.position.set(14, 50);
      this.leftEmpty.position.set(14, 54);
      const noCards = this.leftCards.children.length === 0 && this.rightCards.children.length === 0;
      this.leftEmpty.visible = noCards;
      this.leftTrayMark.visible = noCards;
      this.rightTrayMark.visible = noCards;
      for (const mark of [this.leftTrayMark, this.rightTrayMark]) {
        mark.clear();
        const mx = rackW / 2;
        const my = trayH * 0.56;
        mark
          .circle(mx, my, 42)
          .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.16 })
          .circle(mx, my, 31)
          .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.1 })
          .moveTo(mx - 10, my)
          .lineTo(mx + 10, my)
          .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.18 })
          .moveTo(mx, my - 10)
          .lineTo(mx, my + 10)
          .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.18 });
      }
      this.powerMeta.position.set(14, 52);
      this.powerMeta.visible = false;
      this.leftActions.position.set(14, height - rackTop - 98);
      this.leftActions.visible = true;
    } else {
      this.leftRack.visible = false;
      this.rightRack.visible = false;
      this.leftTray.visible = false;
      this.rightTray.visible = false;
      this.mobileTray.visible = true;
      this.mobilePowerStrip.visible = true;
      this.mobilePowerLabel.visible = true;
      const trayW = width - margin * 2;
      const trayH = 178;
      const trayY = height - trayH - 12;
      this.mobileTray.setSize(trayW, trayH);
      this.mobileTray.position.set(margin, trayY);
      const stripW = trayW - 16;
      this.mobilePowerStrip.viewWidth = stripW;
      this.mobilePowerStrip.hitArea = new Rectangle(0, 0, stripW, 88);
      this.mobilePowerStrip.maskShape.clear().roundRect(0, 0, stripW, 88, 4).fill(0xffffff);
      this.mobilePowerStrip.position.set(margin + 8, trayY + 42);
      this.mobilePowerStrip.setContentWidth(this.mobilePowerStrip.contentWidth || 0);
      this.mobilePowerLabel.position.set(margin + 12, trayY + 12);
      const hasCards = this.mobilePowerStrip.content.children.length > 0;
      this.mobileEmpty.visible = !hasCards;
      this.mobileEmpty.style.wordWrapWidth = trayW - 28;
      this.mobileEmpty.position.set(margin + trayW / 2, trayY + 108);
      this.mobileSlots.visible = !hasCards;
      this.mobileSlots.clear();
      if (!hasCards) {
        const gap = 8;
        const slotW = (trayW - 28 - gap * 2) / 3;
        for (let i = 0; i < 3; i++) {
          const sx = 14 + i * (slotW + gap);
          const sy = 40;
          const cx = sx + slotW / 2;
          this.mobileSlots
            .roundRect(sx, sy, slotW, 54, 4)
            .fill({ color: 0x0a0705, alpha: 0.32 })
            .roundRect(sx, sy, slotW, 54, 4)
            .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.2 })
            .circle(cx, sy + 27, 9)
            .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.22 })
            .moveTo(cx - 5, sy + 27)
            .lineTo(cx + 5, sy + 27)
            .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.22 })
            .moveTo(cx, sy + 22)
            .lineTo(cx, sy + 32)
            .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.22 });
        }
      }
    }

    this.runPanel.visible = Boolean(this.snapshot && this.snapshot.onlineEnabled && (this.snapshot.onlineRunStatus || (this.snapshot.onlineRunButtons || []).length));
    if (this.runPanel.visible) {
      const panelW = Math.min(520, centerW);
      this.runPanel.position.set((width - panelW) / 2, height - (mobile ? 208 : 86));
      this.runPanelBg.width = panelW;
      this.runPanelBg.height = mobile ? 92 : 64;
      this.runStatus.style.wordWrapWidth = panelW - 28;
      this.runButtons.y = mobile ? 50 : 0;
    }

    this.engine.hideTooltip();
    if (this.snapshot) this.onlineBar.visible = Boolean(this.snapshot.onlineEnabled) && !mobile;
  }

  layoutBoardPosition() {
    const mobile = this.layoutMode === "mobile";
    const size = this.boardOuter || 400;
    const contentTop = mobile ? 62 : 76;
    const minY = contentTop + (mobile ? 90 : 106);
    const x = (this.width - size) / 2;
    const y = Math.max(minY, (this.height - size) / 2 - (mobile ? 20 : 10));
    this.boardView.position.set(x, y);
    if (this.infection.visible) this.infection.position.set(x, y);
  }

  tick(dt) {
    this.time += dt;
    this.boardView.tick(dt);
    if (this.scorePulse > 0) {
      this.scorePulse = Math.max(0, this.scorePulse - dt);
      const t = this.scorePulse / 0.5;
      this.scoreValue.scale.set(1 + Math.sin(t * Math.PI) * 0.08);
      this.scoreFloat.alpha = Math.min(1, t * 1.6);
      this.scoreFloat.y = 16 - (1 - t) * 14;
    } else {
      this.scoreValue.scale.set(1);
      this.scoreFloat.alpha = 0;
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blinkTimer = 2.2 + Math.random() * 4;
      if (this.idolEye) this.idolEye.scale.y = 0.12;
    }
    if (this.idolEye) this.idolEye.scale.y += (1 - this.idolEye.scale.y) * Math.min(1, dt * 14);

    if (this.infection.visible) {
      this.infection.alpha = 0.8 + Math.sin(this.time * 1.4) * 0.12;
    }
    if (!this.engine.reducedMotion && this.idol.visible) {
      this.idol.rotation = Math.sin(this.time * 0.2) * 0.005;
    }
  }
}
