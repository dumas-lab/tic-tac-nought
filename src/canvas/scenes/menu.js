import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { THEME, clamp } from "../theme.js";
import {
  makeButton,
  makeChip,
  makeGiltFrame,
  makeIconButton,
  makePanel,
  makeParchmentPage,
  makeSectionLabel,
  makeText,
  makeTextField,
  ScrollView
} from "../ui.js";
import { drawBoard, drawInfection, drawNoughtIdol, drawPlaque, drawSinMedallion, drawX, drawO } from "../pieces.js";
import { Scene, formatNumber, makeOnlineBar, popIn, updatePopIn } from "./base.js";
import { click, clickSelector, focusInput, inputValue } from "../state.js";

function makeMenuTile(engine, { width, height, title, sub, glyph, primary = false, onClick }) {
  const c = new Container();
  c.baseY = 0;
  c.lift = 0;
  c.targetLift = 0;

  const glow = new Sprite(engine.textures.bileGlow);
  glow.anchor.set(0.5);
  glow.alpha = primary ? 0.22 : 0.05;
  glow.blendMode = "add";
  c.addChild(glow);

  const bg = new Sprite(engine.textures.wood);
  bg.tint = primary ? 0xe8c890 : 0xb99a72;
  c.addChild(bg);
  const mask = new Graphics().roundRect(0, 0, width, height, 7).fill(0xffffff);
  bg.mask = mask;
  c.addChild(mask);

  const border = new Graphics();
  c.addChild(border);

  const disc = new Graphics();
  c.addChild(disc);

  const glyphText = makeText(glyph, {
    size: 16,
    font: THEME.fontDisplay,
    weight: "700",
    fill: primary ? THEME.colors.giltHi : THEME.colors.boneDim,
    anchorX: 0.5,
    anchorY: 0.5,
    letterSpacing: 0
  });
  c.addChild(glyphText);

  const titleText = makeText(title, {
    size: 16,
    font: THEME.fontDisplay,
    weight: "700",
    fill: primary ? THEME.colors.giltHi : THEME.colors.bone,
    letterSpacing: 0.6,
    shadow: true
  });
  titleText.anchor.set(0, 0.5);
  c.addChild(titleText);

  const subText = makeText(sub, {
    size: 9,
    font: THEME.fontBody,
    weight: "400",
    fill: primary ? THEME.colors.bone : THEME.colors.boneDim,
    letterSpacing: 0.4
  });
  subText.anchor.set(0, 0.5);
  c.addChild(subText);

  const chevron = makeText("›", {
    size: 24,
    font: THEME.fontDisplay,
    weight: "600",
    fill: primary ? THEME.colors.gilt : THEME.colors.giltLo,
    anchorX: 1,
    anchorY: 0.5
  });
  c.addChild(chevron);

  function setSize(w, h) {
    c.tileWidth = w;
    c.tileHeight = h;
    bg.width = w;
    bg.height = h;
    mask.clear().roundRect(0, 0, w, h, 7).fill(0xffffff);
    border.clear();
    border
      .roundRect(0.5, 0.5, w - 1, h - 1, 7)
      .stroke({ width: 2, color: 0x0a0604, alpha: 0.9 })
      .roundRect(5, 5, w - 10, h - 10, 4)
      .stroke({ width: 1, color: primary ? THEME.colors.gilt : THEME.colors.giltLo, alpha: 0.55 });
    const discR = clamp(h * 0.29, 14, 23);
    disc.clear();
    disc
      .circle(discR + 13, h / 2, discR)
      .fill({ color: primary ? 0x4a3a18 : 0x1c120a })
      .stroke({ width: 1.5, color: primary ? THEME.colors.giltHi : THEME.colors.giltLo, alpha: 0.9 });
    glyphText.style.fontSize = Math.round(discR * (glyph.length > 1 ? 0.8 : 1.05));
    glyphText.position.set(discR + 13, h / 2 + 1);
    const textX = discR * 2 + 22;
    titleText.style.fontSize = Math.round(clamp(h * 0.24, 13, 20));
    titleText.position.set(textX, h * 0.32);
    subText.style.fontSize = Math.round(clamp(h * 0.125, 8, 11));
    subText.position.set(textX, h * 0.67);
    chevron.style.fontSize = Math.round(clamp(h * 0.34, 18, 28));
    chevron.position.set(w - 12, h / 2);
    glow.position.set(w / 2, h / 2);
    glow.width = w * 1.25;
    glow.height = h * 1.8;
    c.hitArea = new Rectangle(0, 0, w, h);
  }

  c.eventMode = "static";
  c.cursor = "pointer";
  c.on("pointerover", () => {
    c.targetLift = 4;
    c.scale.set(1.012);
    glow.alpha = primary ? 0.34 : 0.14;
  });
  c.on("pointerout", () => {
    c.targetLift = 0;
    c.scale.set(1);
    glow.alpha = primary ? 0.22 : 0.05;
  });
  c.on("pointerup", onClick);
  c.tick = (dt) => {
    c.lift += (c.targetLift - c.lift) * Math.min(1, dt * 12);
    c.y = c.baseY - c.lift;
  };
  c.setSize = setSize;
  setSize(width, height);
  return c;
}

export class MenuScene extends Scene {
  constructor(engine) {
    super(engine);
    this.erupted = false;
    this.layoutMode = "";
    this.tileList = [];
    this.idleBoard = null;
    this.idlePieces = [];
    this.infoKind = null;
    this.rowsSignature = "";
    this.globalSignature = "";
    this.idolEye = null;
    this.blinkTimer = 2;
    this.medallions = [];
    this.build();
  }

  build() {
    const e = this.engine;
    this.box = new Container();
    this.root.addChild(this.box);

    this.boxShadow = new Sprite(e.textures.shadow);
    this.boxShadow.anchor.set(0.5);
    this.boxShadow.alpha = 0.8;
    this.box.addChild(this.boxShadow);

    this.boxWood = new Sprite(e.textures.woodDark);
    this.boxWood.tint = 0xd0b088;
    this.box.addChild(this.boxWood);
    this.boxWoodMask = new Graphics().roundRect(0, 0, 100, 100, 18).fill(0xffffff);
    this.boxWood.mask = this.boxWoodMask;
    this.box.addChild(this.boxWoodMask);

    this.boxBorder = new Graphics();
    this.box.addChild(this.boxBorder);

    this.felt = new Sprite(e.textures.felt);
    this.felt.alpha = 0.9;
    this.box.addChild(this.felt);
    this.feltMask = new Graphics().roundRect(0, 0, 100, 100, 14).fill(0xffffff);
    this.felt.mask = this.feltMask;
    this.box.addChild(this.feltMask);

    this.feltShade = new Graphics().rect(0, 0, 100, 100).fill({ color: 0x0a0705, alpha: 0.25 });
    this.box.addChild(this.feltShade);

    this.rim = new Graphics();
    this.box.addChild(this.rim);

    this.idol = drawNoughtIdol(300, e.textures, { erupted: false });
    this.idol.alpha = 0.12;
    this.box.addChild(this.idol);
    this.idolEye = this.idol.eye;

    this.infection = new Container();
    this.box.addChild(this.infection);

    this.center = new Container();
    this.box.addChild(this.center);

    this.titlePlaque = drawPlaque(520, 84, {
      texture: e.textures.brass,
      title: "Tic Tac Nought",
      subtitle: "A GAME THAT KEEPS GROWING",
      size: 34
    });
    this.center.addChild(this.titlePlaque);

    this.tagline = makeText("", {
      size: 13,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.boneDim,
      align: "center",
      anchorX: 0.5,
      anchorY: 0.5,
      letterSpacing: 0.4,
      wordWrap: true,
      wordWrapWidth: 500,
      lineHeight: 18
    });
    this.center.addChild(this.tagline);

    this.idleWrap = new Container();
    this.center.addChild(this.idleWrap);

    this.tilesWrap = new Container();
    this.center.addChild(this.tilesWrap);
    this.tiles = [
      makeMenuTile(e, {
        width: 100,
        height: 76,
        title: "Endless",
        sub: "roguelite run",
        glyph: "∞",
        primary: true,
        onClick: () => clickSelector('[data-start="endless"]')
      }),
      makeMenuTile(e, {
        width: 100,
        height: 76,
        title: "Story",
        sub: "tear grafts off Nought",
        glyph: "III",
        onClick: () => clickSelector('[data-start="story"]')
      }),
      makeMenuTile(e, {
        width: 100,
        height: 76,
        title: "VS",
        sub: "two players",
        glyph: "X/O",
        onClick: () => clickSelector('[data-start="two"]')
      }),
      makeMenuTile(e, {
        width: 100,
        height: 76,
        title: "Wishlist",
        sub: "dev notes",
        glyph: "✎",
        onClick: () => click("openWishlist")
      })
    ];
    this.tileList = this.tiles;
    for (const tile of this.tiles) this.tilesWrap.addChild(tile);

    this.noteText = makeText("", {
      size: 12,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.bileHi,
      align: "center",
      anchorX: 0.5,
      anchorY: 0.5,
      wordWrap: true,
      wordWrapWidth: 520
    });
    this.center.addChild(this.noteText);

    this.nameField = makeTextField({
      width: 260,
      height: 38,
      label: "Run name (optional)",
      value: "",
      placeholder: "Name this run",
      size: 14,
      onFocus: () => focusInput("menuName")
    });
    this.center.addChild(this.nameField);

    this.mobileButtons = new Container();
    this.ledgerBtn = makeButton({
      width: 132,
      height: 30,
      label: "Damage ledger",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => this.openInfo("ledger")
    });
    this.globalBtn = makeButton({
      width: 122,
      height: 30,
      label: "Global board",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => this.openInfo("global")
    });
    this.mobileButtons.addChild(this.ledgerBtn, this.globalBtn);
    this.center.addChild(this.mobileButtons);

    this.versionText = makeText("PRE-ALPHA 0.3.3", {
      size: 9,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.boneDim,
      letterSpacing: 2.2,
      alpha: 0.6
    });
    this.box.addChild(this.versionText);

    this.optionsBtn = makeIconButton({
      size: 34,
      glyph: "⚙",
      variant: "ghost",
      onClick: () => click("optionsTopBtn")
    });
    this.box.addChild(this.optionsBtn);

    this.onlineBar = makeOnlineBar(e, { width: 280 });
    this.box.addChild(this.onlineBar);

    this.ledgerPanel = this.buildLedgerPanel();
    this.box.addChild(this.ledgerPanel.root);
    this.globalPanel = this.buildGlobalPanel();
    this.box.addChild(this.globalPanel.root);
    this.sinsPanel = this.buildSinsPanel();
    this.box.addChild(this.sinsPanel.root);

    this.infoOverlay = this.buildInfoOverlay();
    this.box.addChild(this.infoOverlay.root);
  }

  buildLedgerPanel() {
    const e = this.engine;
    const root = new Container();
    const panel = makePanel({
      width: 280,
      height: 740,
      radius: 8,
      texture: e.textures.woodDark,
      textureTint: 0xb09068,
      stroke: 0x060403,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: e.textures.shadow,
      shadowAlpha: 0.55
    });
    root.addChild(panel);
    const page = makeParchmentPage(252, 712, e.textures, { radius: 3 });
    page.position.set(14, 14);
    root.addChild(page);

    const title = makeText("Damage ledger", {
      size: 19,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink,
      letterSpacing: 0.4
    });
    title.position.set(30, 26);
    root.addChild(title);

    const hint = makeText("", {
      size: 10,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: 220,
      lineHeight: 13
    });
    hint.position.set(30, 52);
    root.addChild(hint);

    const divider = new Graphics()
      .moveTo(30, 78)
      .lineTo(252, 78)
      .stroke({ width: 1, color: 0x6b4a24, alpha: 0.35 });
    root.addChild(divider);

    const scroll = new ScrollView({ width: 228, height: 560, radius: 3, textures: e.textures });
    scroll.position.set(26, 88);
    root.addChild(scroll);

    const clear = makeButton({
      width: 108,
      height: 28,
      label: "Clear ledger",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("clearLeaderboard")
    });
    clear.position.set(30, 682);
    root.addChild(clear);

    return { root, panel, page, title, hint, scroll, clear };
  }

  buildGlobalPanel() {
    const e = this.engine;
    const root = new Container();
    const panel = makePanel({
      width: 280,
      height: 360,
      radius: 8,
      texture: e.textures.leather,
      textureTint: 0xb09a80,
      stroke: 0x060403,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: e.textures.shadow,
      shadowAlpha: 0.55
    });
    root.addChild(panel);

    const title = makeText("Global board", {
      size: 18,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.giltHi,
      letterSpacing: 0.4
    });
    title.position.set(16, 14);
    root.addChild(title);

    const hint = makeText("", {
      size: 9,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.boneDim,
      wordWrap: true,
      wordWrapWidth: 246,
      lineHeight: 12
    });
    hint.position.set(16, 38);
    root.addChild(hint);

    const divider = new Graphics()
      .moveTo(16, 62)
      .lineTo(264, 62)
      .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.25 });
    root.addChild(divider);

    const scroll = new ScrollView({ width: 248, height: 230, radius: 3, textures: e.textures });
    scroll.position.set(16, 70);
    root.addChild(scroll);

    const refresh = makeButton({
      width: 92,
      height: 26,
      label: "Refresh",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("globalBoardRefresh")
    });
    refresh.position.set(16, 324);
    root.addChild(refresh);

    return { root, panel, title, hint, scroll, refresh };
  }

  buildSinsPanel() {
    const e = this.engine;
    const root = new Container();
    const panel = makePanel({
      width: 280,
      height: 368,
      radius: 8,
      texture: e.textures.woodDark,
      textureTint: 0xb09068,
      stroke: 0x060403,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: e.textures.shadow,
      shadowAlpha: 0.55
    });
    root.addChild(panel);

    const title = makeText("The Body", {
      size: 18,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.giltHi,
      letterSpacing: 0.5
    });
    title.position.set(16, 14);
    root.addChild(title);

    const sub = makeText("SEVEN GRAFTS · ONE HOST", {
      size: 8,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.bile,
      letterSpacing: 1.6
    });
    sub.position.set(16, 37);
    root.addChild(sub);

    const sins = e.gameData ? e.gameData.SINS : [];
    const grid = new Container();
    grid.position.set(16, 54);
    root.addChild(grid);
    this.medallions = [];
    const cols = 2;
    const cellW = 122;
    const cellH = 72;
    for (let i = 0; i < sins.length; i++) {
      const sin = sins[i];
      const cell = new Container();
      cell.position.set((i % cols) * cellW, Math.floor(i / cols) * cellH);
      const med = drawSinMedallion(sin, 38);
      med.position.set(0, 0);
      cell.addChild(med);
      const name = makeText(sin.name, {
        size: 11,
        font: THEME.fontBody,
        weight: "600",
        fill: THEME.colors.bone,
        letterSpacing: 0.3
      });
      name.position.set(46, 11);
      cell.addChild(name);
      const taunt = makeText(sin.taunt.slice(0, 30) + (sin.taunt.length > 30 ? "…" : ""), {
        size: 8,
        font: THEME.fontBody,
        weight: "400",
        fill: THEME.colors.boneDim,
        wordWrap: true,
        wordWrapWidth: 70,
        lineHeight: 10
      });
      taunt.position.set(46, 25);
      cell.addChild(taunt);
      cell.eventMode = "static";
      cell.cursor = "help";
      cell.on("pointerover", () => {
        e.showTooltip(sin.name + " — " + sin.taunt);
      });
      cell.on("pointerout", () => e.hideTooltip());
      grid.addChild(cell);
      this.medallions.push({ cell, med, phase: i * 0.9 });
    }

    return { root, panel, title, sub, grid };
  }

  buildInfoOverlay() {
    const e = this.engine;
    const root = new Container();
    root.visible = false;
    const scrim = new Graphics().rect(0, 0, 100, 100).fill({ color: 0x050302, alpha: 0.72 });
    scrim.eventMode = "static";
    root.addChild(scrim);
    const page = makeParchmentPage(520, 600, e.textures, { radius: 4 });
    root.addChild(page);
    const title = makeText("Damage ledger", {
      size: 24,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink
    });
    root.addChild(title);
    const close = makeIconButton({
      size: 34,
      glyph: "✕",
      variant: "ghost",
      onClick: () => this.closeInfo()
    });
    root.addChild(close);
    const scroll = new ScrollView({ width: 470, height: 500, radius: 3, textures: e.textures });
    root.addChild(scroll);
    return { root, scrim, page, title, close, scroll, width: 520, height: 600 };
  }

  openInfo(kind) {
    this.infoKind = kind;
    this.infoOverlay.root.visible = true;
    this.engine.hideTooltip();
    this.rowsSignature = "";
    this.globalSignature = "";
    this.update(this.snapshot);
  }

  closeInfo() {
    this.infoKind = null;
    this.infoOverlay.root.visible = false;
  }

  update(snapshot) {
    if (!snapshot) return;
    this.snapshot = snapshot;
    this.erupted = Boolean(snapshot.eruptedSession);

    const tag = snapshot.menuTag || "Tic-tac-toe that keeps growing. Build a run, collect powers, chase the score.";
    this.tagline.text = tag;
    this.titlePlaque.children[this.titlePlaque.children.length - 1];
    this.titlePlaque.setTitle?.("Tic Tac Nought");
    this.noteText.text = snapshot.menuRunNote || "";
    this.noteText.visible = Boolean(snapshot.menuRunNote);

    const nameValue = inputValue("menuName");
    this.nameField.updateField({
      value: nameValue,
      focused: snapshot.focused === "menuName",
      caret: snapshot.focused === "menuName" ? snapshot.caret : 0,
      time: this.engine.time
    });

    this.onlineBar.updateBar(snapshot);
    this.ledgerPanel.hint.text = snapshot.saveHint || "Endless:";
    this.updateLedger(snapshot);
    this.updateGlobal(snapshot);

    this.idol.alpha = this.erupted ? 0.3 : 0.12;
    this.idol.aura.alpha = this.erupted ? 0.5 : 0.16;
    if (this.erupted) {
      this.buildInfection();
      this.titlePlaque.setTitle?.("Tic Tac Nought");
    } else if (this.infection.children.length) {
      this.infection.removeChildren().forEach((child) => child.destroy({ children: true }));
    }

    this.versionText.text = (snapshot.menuEyebrow || "Pre-alpha 0.3.3").toUpperCase();

    if (this.layoutMode === "compact" || this.layoutMode === "mobile") {
      this.globalBtn.visible = Boolean(snapshot.onlineEnabled);
    }
    this.layout(this.width, this.height);
  }

  updateLedger(snapshot) {
    const sig = JSON.stringify({
      rows: (snapshot.leaderboard || []).slice(0, 12).map((row) => [row.name, row.score, row.level, row.round, row.boardSize, row.date]),
      story: snapshot.storyProgress,
      hint: snapshot.saveHint
    });
    if (sig === this.rowsSignature) return;
    this.rowsSignature = sig;

    const scroll = this.ledgerPanel.scroll;
    scroll.content.removeChildren().forEach((child) => child.destroy({ children: true }));
    let y = 0;
    const rows = (snapshot.leaderboard || []).slice(0, 12);
    if (!rows.length) {
      const empty = makeText("No Endless runs saved yet.", {
        size: 11,
        font: THEME.fontBody,
        weight: "400",
        fill: THEME.colors.inkSoft,
        wordWrap: true,
        wordWrapWidth: 214,
        lineHeight: 15
      });
      empty.position.set(2, 2);
      scroll.content.addChild(empty);
      y = 30;
    } else {
      rows.forEach((row, index) => {
        const rank = makeText(String(index + 1) + ".", {
          size: 10,
          font: THEME.fontBody,
          weight: "700",
          fill: THEME.colors.giltLo
        });
        rank.position.set(2, y + 3);
        scroll.content.addChild(rank);
        const name = makeText(row.name || "Unknown", {
          size: 12,
          font: THEME.fontBody,
          weight: "600",
          fill: THEME.colors.ink
        });
        name.position.set(24, y);
        scroll.content.addChild(name);
        const score = makeText(formatNumber(row.score), {
          size: 12,
          font: THEME.fontDisplay,
          weight: "700",
          fill: THEME.colors.ink
        });
        score.anchor.set(1, 0);
        score.position.set(214, y);
        scroll.content.addChild(score);
        const meta = makeText(
          "Lv " + row.level + " · R" + row.round + " · " + row.boardSize + "×" + row.boardSize,
          {
            size: 8,
            font: THEME.fontBody,
            weight: "400",
            fill: THEME.colors.inkSoft
          }
        );
        meta.position.set(24, y + 15);
        scroll.content.addChild(meta);
        const line = new Graphics()
          .moveTo(2, y + 31)
          .lineTo(214, y + 31)
          .stroke({ width: 1, color: 0x6b4a24, alpha: 0.16 });
        scroll.content.addChild(line);
        y += 38;
      });
    }

    const story = snapshot.storyProgress || {};
    y += 8;
    const header = makeText("STORY PROGRESS", {
      size: 8,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.inkSoft,
      letterSpacing: 1.4
    });
    header.position.set(2, y);
    scroll.content.addChild(header);
    y += 18;
    for (const diff of ["easy", "medium", "hard"]) {
      const label = makeText(diff.charAt(0).toUpperCase() + diff.slice(1), {
        size: 11,
        font: THEME.fontBody,
        weight: "600",
        fill: THEME.colors.ink
      });
      label.position.set(2, y);
      scroll.content.addChild(label);
      const value = makeText(story[diff + "Beaten"] ? "Beaten" : "—", {
        size: 10,
        font: THEME.fontBody,
        weight: "700",
        fill: story[diff + "Beaten"] ? 0x4a5a2a : THEME.colors.inkSoft
      });
      value.anchor.set(1, 0);
      value.position.set(214, y);
      scroll.content.addChild(value);
      y += 20;
    }
    scroll.setContentHeight(y + 6);
  }

  updateGlobal(snapshot) {
    const panel = this.globalPanel;
    panel.root.visible = Boolean(snapshot.onlineEnabled);
    if (!snapshot.onlineEnabled) return;

    const sig = JSON.stringify({
      rows: (snapshot.globalRows || []).slice(0, 10).map((row) => [row.rank, row.handle, row.score, row.is_guest, row.is_me]),
      loading: snapshot.globalLoading,
      error: snapshot.globalError,
      hint: snapshot.globalHint
    });
    if (sig === this.globalSignature) return;
    this.globalSignature = sig;

    panel.hint.text = snapshot.globalHint || "Top 50 · refreshes every 30s while visible";
    const scroll = panel.scroll;
    scroll.content.removeChildren().forEach((child) => child.destroy({ children: true }));
    const rows = snapshot.globalRows || [];
    if (!rows.length) {
      const empty = makeText(snapshot.globalLoading ? "Loading…" : "No global scores yet.", {
        size: 11,
        font: THEME.fontBody,
        weight: "400",
        fill: THEME.colors.boneDim
      });
      empty.position.set(2, 2);
      scroll.content.addChild(empty);
      scroll.setContentHeight(30);
      return;
    }
    let y = 0;
    for (const row of rows.slice(0, 10)) {
      const rank = makeText(row.rank != null ? row.rank + "." : "—", {
        size: 10,
        font: THEME.fontBody,
        weight: "700",
        fill: THEME.colors.gilt
      });
      rank.position.set(2, y + 2);
      scroll.content.addChild(rank);
      const name = makeText(row.handle || "Unknown", {
        size: 11,
        font: THEME.fontBody,
        weight: "600",
        fill: row.is_me ? THEME.colors.bileHi : THEME.colors.bone
      });
      name.position.set(28, y);
      scroll.content.addChild(name);
      if (row.is_guest) {
        const badge = makeText("GUEST", {
          size: 7,
          font: THEME.fontBody,
          weight: "700",
          fill: THEME.colors.bile,
          letterSpacing: 0.6
        });
        badge.position.set(28 + name.width + 6, y + 3);
        scroll.content.addChild(badge);
      }
      const score = makeText(formatNumber(row.score), {
        size: 11,
        font: THEME.fontDisplay,
        weight: "700",
        fill: row.is_me ? THEME.colors.bileHi : THEME.colors.giltHi
      });
      score.anchor.set(1, 0);
      score.position.set(246, y);
      scroll.content.addChild(score);
      y += 24;
    }
    scroll.setContentHeight(y + 4);
  }

  buildInfection() {
    this.infection.removeChildren().forEach((child) => child.destroy({ children: true }));
    const inf = drawInfection(this.boxW || 100, this.boxH || 100, { seed: 83, intensity: 1.15 });
    inf.alpha = 0.45;
    this.infection.addChild(inf);
    this.infection.alpha = 1;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.layout(width, height);
  }

  layout(width, height) {
    const mobile = width < 760;
    const compact = width < 1080;
    const mode = mobile ? "mobile" : compact ? "compact" : "desktop";
    this.layoutMode = mode;

    const margin = mobile ? 8 : 22;
    const boxW = Math.min(mobile ? width - margin * 2 : 1260, width - margin * 2);
    const boxH = Math.min(mobile ? height - margin * 2 : 820, height - margin * 2);
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;
    this.boxW = boxW;
    this.boxH = boxH;
    this.box.position.set(boxX, boxY);

    this.boxShadow.position.set(boxW / 2, boxH / 2 + 12);
    this.boxShadow.width = boxW * 1.08;
    this.boxShadow.height = boxH * 1.08;
    this.boxWood.width = boxW;
    this.boxWood.height = boxH;
    this.boxWoodMask.clear().roundRect(0, 0, boxW, boxH, 18).fill(0xffffff);
    this.boxBorder.clear();
    this.boxBorder
      .roundRect(0.5, 0.5, boxW - 1, boxH - 1, 18)
      .stroke({ width: 3, color: 0x050302 })
      .roundRect(5.5, 5.5, boxW - 11, boxH - 11, 15)
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.5 });

    const inset = mobile ? 10 : 18;
    this.felt.width = boxW - inset * 2;
    this.felt.height = boxH - inset * 2;
    this.felt.position.set(inset, inset);
    this.feltMask.clear().roundRect(inset, inset, boxW - inset * 2, boxH - inset * 2, 12).fill(0xffffff);
    this.feltShade.clear().rect(inset, inset, boxW - inset * 2, boxH - inset * 2).fill({ color: 0x0a0705, alpha: 0.28 });

    this.rim.clear();
    this.rim
      .roundRect(1, 1, boxW - 2, boxH - 2, 18)
      .stroke({ width: 3, color: 0x050302 })
      .roundRect(6, 6, boxW - 12, boxH - 12, 15)
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.5 })
      .roundRect(inset - 3, inset - 3, boxW - inset * 2 + 6, boxH - inset * 2 + 6, 13)
      .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.2 });

    // Brass corner brackets on the box.
    const cb = mobile ? 26 : 40;
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [boxW, 0, -1, 1], [0, boxH, 1, -1], [boxW, boxH, -1, -1]]) {
      this.rim
        .moveTo(x + sx * 8, y + sy * 8 + sy * cb)
        .lineTo(x + sx * 8, y + sy * 8)
        .lineTo(x + sx * 8 + sx * cb, y + sy * 8)
        .stroke({ width: 2, color: THEME.colors.gilt, alpha: 0.4 });
    }

    const sideW = mode === "desktop" ? Math.min(300, boxW * 0.255) : 0;
    const sideGap = 18;
    const centerX = mode === "desktop" ? sideW + sideGap * 2 : (mobile ? 18 : 28);
    const centerW = mode === "desktop" ? boxW - sideW * 2 - sideGap * 4 : boxW - (mobile ? 36 : 56);
    const centerH = boxH - (mobile ? 20 : 32);

    this.center.position.set(centerX, mobile ? 10 : 16);

    // Title.
    const titleW = Math.min(mobile ? centerW : 520, centerW);
    const titleH = mobile ? 66 : 82;
    this.titlePlaque.setSize(titleW, titleH);
    this.titlePlaque.x = (centerW - titleW) / 2;
    this.titlePlaque.y = 0;

    this.tagline.style.wordWrapWidth = Math.min(centerW, 560);
    this.tagline.position.set(centerW / 2, titleH + 18);

    const boardOuter = Math.min(
      centerW * (mobile ? 0.86 : 0.56),
      centerH - (mobile ? 285 : 360),
      mobile ? 250 : 340
    );
    const boardSize = Math.max(mobile ? 150 : 190, boardOuter);
    this.layoutIdleBoard(boardSize);
    this.idleWrap.position.set((centerW - boardSize) / 2, titleH + 38);

    const tilesY = titleH + 38 + boardSize + (mobile ? 12 : 20);
    const gap = mobile ? 8 : 12;
    const tileW = (centerW - gap) / 2;
    const tileH = mobile ? 60 : 76;
    this.tiles.forEach((tile, index) => {
      tile.setSize(tileW, tileH);
      tile.x = (index % 2) * (tileW + gap);
      tile.baseY = tilesY + Math.floor(index / 2) * (tileH + gap);
      tile.y = tile.baseY;
      tile.tick(0);
    });

    const noteY = tilesY + tileH * 2 + gap + 12;
    this.noteText.style.wordWrapWidth = centerW;
    this.noteText.position.set(centerW / 2, noteY + 8);

    const nameY = noteY + (this.noteText.visible ? 28 : 14);
    this.nameField.position.set((centerW - 260) / 2, nameY);
    this.nameField.visible = true;

    const buttonsY = nameY + 54;
    this.mobileButtons.visible = mode !== "desktop";
    this.ledgerBtn.visible = mode !== "desktop";
    this.globalBtn.visible = mode !== "desktop" && Boolean(this.snapshot && this.snapshot.onlineEnabled);
    this.ledgerBtn.position.set(centerW / 2 - 136, buttonsY);
    this.globalBtn.position.set(centerW / 2 + 4, buttonsY);

    const naturalHeight = buttonsY + 40;
    const scale = Math.min(1, centerH / naturalHeight);
    this.center.scale.set(scale);
    this.center.position.set(
      centerX + (centerW - centerW * scale) / 2,
      (mobile ? 10 : 16) + (centerH - naturalHeight * scale) / 2
    );

    // Side panels are designed at fixed sizes and scaled uniformly so their
    // carved corners and typography keep their proportions.
    const sideTop = 26;
    const sideH = boxH - 88;
    const ledgerScale = Math.min(1, sideW / 280, sideH / 740);
    this.ledgerPanel.root.visible = mode === "desktop";
    if (mode === "desktop") {
      this.ledgerPanel.root.scale.set(ledgerScale);
      this.ledgerPanel.root.position.set(
        22 + (sideW - 280 * ledgerScale) / 2,
        sideTop + (sideH - 740 * ledgerScale) / 2
      );
    }

    const rightX = boxW - sideW - 22;
    const showGlobal = Boolean(this.snapshot && this.snapshot.onlineEnabled);
    this.globalPanel.root.visible = mode === "desktop" && showGlobal;
    this.sinsPanel.root.visible = mode === "desktop";
    if (mode === "desktop") {
      if (showGlobal) {
        const globalSpace = sideH * 0.5;
        const sinsSpace = sideH - globalSpace - 10;
        const globalScale = Math.min(1, sideW / 280, globalSpace / 360);
        const sinsScale = Math.min(1, sideW / 280, sinsSpace / 368);
        this.globalPanel.root.scale.set(globalScale);
        this.globalPanel.root.position.set(
          rightX + (sideW - 280 * globalScale) / 2,
          sideTop + (globalSpace - 360 * globalScale) / 2
        );
        this.sinsPanel.root.scale.set(sinsScale);
        this.sinsPanel.root.position.set(
          rightX + (sideW - 280 * sinsScale) / 2,
          sideTop + globalSpace + 10 + (sinsSpace - 368 * sinsScale) / 2
        );
      } else {
        const sinsScale = Math.min(1, sideW / 280, sideH / 368);
        this.sinsPanel.root.scale.set(sinsScale);
        this.sinsPanel.root.position.set(
          rightX + (sideW - 280 * sinsScale) / 2,
          sideTop + (sideH - 368 * sinsScale) / 2
        );
      }
    }

    this.onlineBar.position.set(
      mode === "desktop" ? rightX : boxW - 296,
      mode === "desktop" ? boxH - 48 : boxH - 40
    );

    this.optionsBtn.position.set(mobile ? 10 : 14, mobile ? 10 : 14);
    this.versionText.position.set(18, boxH - 18);
    this.versionText.anchor.set(0, 0.5);

    this.idol.width = Math.min(boxH * 0.55, 420);
    this.idol.height = Math.min(boxH * 0.55, 420);
    this.idol.position.set(boxW * 0.5 - this.idol.width / 2, boxH * 0.08);
    if (this.infection.children.length) this.buildInfection();

    this.layoutInfoOverlay(boxW, boxH);
    this.layoutIdlePieces();
  }

  layoutIdleBoard(size) {
    const key = Math.round(size) + (this.erupted ? "e" : "n");
    if (this.idleBoard && this.idleBoard.layoutKey === key) return;
    this.idleWrap.removeChildren().forEach((child) => child.destroy({ children: true }));
    const padding = clamp(size * 0.045, 8, 18);
    const cell = (size - padding * 2) / 3;
    const board = drawBoard(3, cell, this.engine.textures, {
      erupted: this.erupted,
      padding
    });
    board.layoutKey = key;
    this.idleWrap.addChild(board);
    this.idleBoard = board;
    this.idlePieces = [];

    const pattern = ["X", "", "O", "", "X", "O", "O", "", "X"];
    pattern.forEach((value, index) => {
      if (!value) return;
      const piece = value === "X"
        ? drawX(cell * 0.82, { infected: this.erupted })
        : drawO(cell * 0.82, { infected: this.erupted });
      piece.position.set(0, 0);
      piece.rotation = (index % 2 ? -1 : 1) * 0.025;
      const cellNode = board.cells[index];
      cellNode.pieceLayer.addChild(piece);
      this.idlePieces.push({ piece, phase: index * 0.7, baseRotation: piece.rotation });
    });
  }

  layoutIdlePieces() {
    // Pieces are positioned by the board's cell containers; nothing to do.
  }

  tick(dt) {
    this.time += dt;
    const t = this.time;
    for (const tile of this.tiles) tile.tick(dt);
    if (!this.engine.reducedMotion) {
      for (const item of this.idlePieces) {
        item.piece.y = Math.sin(t * 0.9 + item.phase) * 1.4;
        item.piece.rotation = item.baseRotation + Math.sin(t * 0.5 + item.phase) * 0.008;
      }
      for (const item of this.medallions) {
        item.med.y = Math.sin(t * 0.8 + item.phase) * 2;
        item.med.rotation = Math.sin(t * 0.35 + item.phase) * 0.03;
      }
      this.idol.rotation = Math.sin(t * 0.18) * 0.006;
    }

    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blinkTimer = 2.4 + Math.random() * 4;
      if (this.idolEye) {
        this.idolEye.scale.y = 0.15;
      }
    }
    if (this.idolEye) {
      this.idolEye.scale.y += (1 - this.idolEye.scale.y) * Math.min(1, dt * 14);
    }

    if (this.infection.children.length) {
      this.infection.alpha = 0.75 + Math.sin(t * 1.3) * 0.12;
    }

    if (this.infoOverlay.root.visible) {
      this.infoOverlay.root.alpha = 1;
    }

    // Keep the text caret blinking while a field is focused.
    if (this.snapshot && this.snapshot.focused === "menuName") {
      this.nameField.updateField({ time: t });
    }
  }

  layoutInfoOverlay(boxW, boxH) {
    const overlay = this.infoOverlay;
    overlay.root.visible = Boolean(this.infoKind);
    if (!overlay.root.visible) return;
    overlay.scrim.clear().rect(0, 0, boxW, boxH).fill({ color: 0x050302, alpha: 0.72 });
    const w = Math.min(560, boxW - 32);
    const h = Math.min(640, boxH - 32);
    overlay.page.width = w;
    overlay.page.height = h;
    overlay.page.position.set((boxW - w) / 2, (boxH - h) / 2);
    const px = (boxW - w) / 2;
    const py = (boxH - h) / 2;
    overlay.title.text = this.infoKind === "global" ? "Global board" : "Damage ledger";
    overlay.title.position.set(px + 26, py + 22);
    overlay.close.position.set(px + w - 46, py + 18);
    overlay.scroll.viewWidth = w - 60;
    overlay.scroll.viewHeight = h - 110;
    overlay.scroll.position.set(px + 26, py + 70);
    overlay.scroll.maskShape.clear().roundRect(0, 0, w - 60, h - 110, 3).fill(0xffffff);
    this.updateInfoContent();
  }

  updateInfoContent() {
    if (!this.infoKind) return;
    const snap = this.snapshot;
    if (!snap) return;
    const scroll = this.infoOverlay.scroll;
    scroll.content.removeChildren().forEach((child) => child.destroy({ children: true }));
    let y = 0;
    if (this.infoKind === "global") {
      const rows = snap.globalRows || [];
      if (!rows.length) {
        const empty = makeText("No global scores yet.", {
          size: 13,
          font: THEME.fontBody,
          fill: THEME.colors.inkSoft
        });
        empty.position.set(2, 2);
        scroll.content.addChild(empty);
        y = 30;
      }
      for (const row of rows) {
        const rank = makeText(row.rank != null ? row.rank + "." : "—", {
          size: 12,
          font: THEME.fontBody,
          weight: "700",
          fill: THEME.colors.giltLo
        });
        rank.position.set(2, y + 2);
        scroll.content.addChild(rank);
        const name = makeText((row.handle || "Unknown") + (row.is_guest ? "  GUEST" : ""), {
          size: 14,
          font: THEME.fontBody,
          weight: "600",
          fill: row.is_me ? 0x4a5a2a : THEME.colors.ink
        });
        name.position.set(36, y);
        scroll.content.addChild(name);
        const score = makeText(formatNumber(row.score), {
          size: 15,
          font: THEME.fontDisplay,
          weight: "700",
          fill: THEME.colors.ink
        });
        score.anchor.set(1, 0);
        score.position.set(scroll.viewWidth - 4, y);
        scroll.content.addChild(score);
        y += 32;
      }
      scroll.setContentHeight(y + 4);
      return;
    }

    const rows = (snap.leaderboard || []).slice(0, 20);
    if (!rows.length) {
      const empty = makeText("No Endless runs saved yet.", {
        size: 13,
        font: THEME.fontBody,
        fill: THEME.colors.inkSoft
      });
      empty.position.set(2, 2);
      scroll.content.addChild(empty);
      y = 30;
    }
    for (const row of rows) {
      const name = makeText(row.name || "Unknown", {
        size: 14,
        font: THEME.fontBody,
        weight: "600",
        fill: THEME.colors.ink
      });
      name.position.set(2, y);
      scroll.content.addChild(name);
      const score = makeText(formatNumber(row.score), {
        size: 15,
        font: THEME.fontDisplay,
        weight: "700",
        fill: THEME.colors.ink
      });
      score.anchor.set(1, 0);
      score.position.set(scroll.viewWidth - 4, y);
      scroll.content.addChild(score);
      const meta = makeText("Lv " + row.level + " · Round " + row.round + " · " + row.boardSize + "×" + row.boardSize, {
        size: 9,
        font: THEME.fontBody,
        fill: THEME.colors.inkSoft
      });
      meta.position.set(2, y + 18);
      scroll.content.addChild(meta);
      y += 40;
    }
    scroll.setContentHeight(y + 4);
  }

  destroy() {
    super.destroy();
  }
}
