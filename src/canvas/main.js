import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import { THEME, clamp } from "./theme.js";
import { createTextures } from "./textures.js";
import { makeText, makeTooltip, setSharedTextures } from "./ui.js";
import { Atmosphere } from "./atmosphere.js";
import { MenuScene } from "./scenes/menu.js";
import { GameScene } from "./scenes/game.js";
import { OptionsScene } from "./scenes/options.js";
import { OverlayLayer } from "./scenes/overlays.js";
import { activeModal, snapshot } from "./state.js";

const FONT_TIMEOUT_MS = 3500;
const POLL_SECONDS = 0.12;

function safeCaret() {
  const el = document.activeElement;
  if (!el) return 0;
  try {
    return typeof el.selectionStart === "number" ? el.selectionStart : 0;
  } catch {
    return 0;
  }
}

function domText(id) {
  const el = document.getElementById(id);
  return el ? el.textContent || "" : "";
}

function domValue(id) {
  const el = document.getElementById(id);
  return el && "value" in el ? String(el.value) : "";
}

function domChecked(id) {
  const el = document.getElementById(id);
  return Boolean(el && el.checked);
}

function elementDisplayed(id) {
  const el = document.getElementById(id);
  return Boolean(el && el.style.display !== "none");
}

function soundKey() {
  const selects = document.querySelectorAll("#soundBands select[data-band]");
  const parts = [];
  for (const select of selects) parts.push(`${select.dataset.band}:${select.dataset.index}:${select.value}`);
  const adds = document.querySelectorAll("#soundBands button[data-add]");
  for (const button of adds) parts.push(`${button.dataset.add}:${button.disabled ? 1 : 0}`);
  return parts.join(",");
}

function signature() {
  const s = window.TTNState;
  if (!s) return "no-state";
  const o = window.TTNOnline;
  const session = o && o.debug ? o.debug.session() : null;
  const board = o && o.debug ? o.debug.board() : null;
  const run = s.run || {};
  const leaderboard = s.leaderboard || [];
  const story = s.storyProgress || {};
  const toast = document.getElementById("toast");
  const parts = [
    s.screen,
    s.mode,
    s.turn,
    s.gameOver ? 1 : 0,
    s.result || "",
    Array.from(s.board || []).map((v) => v || ".").join(""),
    s.previewIndex == null ? "" : s.previewIndex,
    s.previewReply == null ? "" : s.previewReply,
    s.previewReplyThreat ? 1 : 0,
    s.previewWin ? 1 : 0,
    s.erupted ? 1 : 0,
    s.currentSin ? s.currentSin.name || s.currentSin.id || "" : "",
    s.noughtDamage,
    s.noughtDamageTarget,
    s.awaitingNext ? 1 : 0,
    s.aterArmed || "",
    run.score,
    run.level,
    run.xp,
    run.round,
    run.over ? 1 : 0,
    run.buffRounds,
    leaderboard.length,
    leaderboard[0] ? leaderboard[0].score : "",
    leaderboard[leaderboard.length - 1] ? leaderboard[leaderboard.length - 1].score : "",
    s.globalLoading ? 1 : 0,
    s.globalError || "",
    s.globalHint || "",
    (s.globalRows || []).length,
    (s.globalRows || []).map((row) => [row.rank, row.handle, row.score, row.is_guest ? 1 : 0, row.is_me ? 1 : 0].join(":")).join(","),
    s.globalMe ? `${s.globalMe.rank}:${s.globalMe.score}` : "",
    s.account ? [s.account.identity, s.account.best, s.account.sync, s.account.error, s.account.claimVisible ? 1 : 0, s.account.deleteOpen ? 1 : 0].join(":") : "",
    s.onlineAction || "",
    story.easyBeaten ? 1 : 0,
    story.mediumBeaten ? 1 : 0,
    story.hardBeaten ? 1 : 0,
    activeModal() || "",
    document.activeElement && document.activeElement.id ? document.activeElement.id : "",
    safeCaret(),
    toast ? toast.className : "",
    toast ? toast.textContent || "" : "",
    domText("status"),
    domText("saveHint"),
    domText("menuRunNote"),
    domText("runScore"),
    domText("xpLevel"),
    domText("xpNext"),
    domText("powerMeta"),
    domText("onlineBarIdentity"),
    domText("onlineOptionsAccountValue"),
    domText("onlineOptionsSyncValue"),
    domValue("volume"),
    domChecked("mute") ? 1 : 0,
    domChecked("devToolsToggle") ? 1 : 0,
    elementDisplayed("devToolsBtn") ? 1 : 0,
    domValue("menuName"),
    domValue("wishlistText"),
    domValue("onlineHandle"),
    domValue("onlinePassword"),
    domValue("onlinePasswordConfirm"),
    domValue("onlineDeleteInput"),
    soundKey(),
    o ? (o.enabled ? 1 : 0) : 0,
    session && session.user ? session.user.id || "" : "",
    session && session.user ? (session.user.isAnonymous ? 1 : 0) : 0,
    board ? board.version : "",
    board && board.loading ? 1 : 0,
    board ? board.error || "" : "",
    board && board.rows ? board.rows.length : 0,
    document.querySelectorAll("#onlineRunActions button").length
  ];
  return parts.join("|");
}

class CanvasEngine {
  constructor(app, textures) {
    this.app = app;
    this.textures = textures;
    this.width = Math.max(320, app.screen.width);
    this.height = Math.max(320, app.screen.height);
    this.time = 0;
    this.reducedMotion = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
    this.gameData = window.TTNState ? window.TTNState.data : null;
    this.snapshot = null;
    this.snapshotDirty = true;
    this.currentScreen = "";
    this.lastModal = null;
    this.lastSignature = "";
    this.pollAccumulator = 0;
    this.sceneFade = 1;
    this.pointer = { x: this.width / 2, y: this.height / 2 };
    this.tooltipText = "";
    this.toastAlpha = 0;
    this.toastTarget = 0;
    this.toastTextValue = "";
    this.toastBaseY = 0;
    this.resizeFrame = 0;
    this.observer = null;

    this.stage = new Container();
    this.app.stage.addChild(this.stage);

    this.atmosphere = new Atmosphere(textures);
    this.atmosphere.resize(this.width, this.height);
    this.stage.addChild(this.atmosphere.root);

    this.world = new Container();
    this.stage.addChild(this.world);

    this.scenes = {
      menu: new MenuScene(this),
      game: new GameScene(this),
      options: new OptionsScene(this)
    };
    for (const scene of Object.values(this.scenes)) {
      scene.root.visible = false;
      scene.root.alpha = 0;
      this.world.addChild(scene.root);
    }

    this.overlays = new OverlayLayer(this);
    this.stage.addChild(this.overlays.root);

    this.uiLayer = new Container();
    this.stage.addChild(this.uiLayer);

    this.tooltip = makeTooltip(textures, 320);
    this.uiLayer.addChild(this.tooltip.container);

    this.toastRoot = new Container();
    this.toastRoot.eventMode = "none";
    this.toastRoot.visible = false;
    this.toastShadow = new Sprite(textures.shadow);
    this.toastShadow.anchor.set(0.5);
    this.toastShadow.alpha = 0.6;
    this.toastBg = new Graphics();
    this.toastText = makeText("", {
      size: 13,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.bone,
      align: "center",
      anchorX: 0.5,
      anchorY: 0.5,
      wordWrap: true,
      wordWrapWidth: 500,
      lineHeight: 17,
      shadow: true
    });
    this.toastRoot.addChild(this.toastShadow, this.toastBg, this.toastText);
    this.uiLayer.addChild(this.toastRoot);

    for (const scene of Object.values(this.scenes)) scene.resize(this.width, this.height);
    this.overlays.resize(this.width, this.height);

    this.bindEvents();
  }

  bindEvents() {
    this.onResize = () => {
      if (this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.resize();
      });
    };
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("orientationchange", this.onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", this.onResize, { passive: true });
    }

    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.motionQuery = mq;
      const onChange = (event) => {
        this.reducedMotion = event.matches;
        this.snapshotDirty = true;
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    this.onPointerMove = (event) => {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.atmosphere.setPointer(event.clientX, event.clientY);
      if (this.tooltip.visible && this.tooltipText) {
        this.tooltip.show(this.tooltipText, event.clientX, event.clientY);
      }
    };
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });

    this.scheduleSnapshot = () => {
      this.snapshotDirty = true;
    };

    this.observer = new MutationObserver(() => {
      this.snapshotDirty = true;
    });
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "style", "disabled", "aria-selected", "value"]
    });

    const onInput = () => {
      this.snapshotDirty = true;
    };
    for (const type of ["input", "change", "keyup", "click", "pointerup", "focusin", "focusout"]) {
      window.addEventListener(type, onInput, true);
    }
    document.addEventListener("selectionchange", onInput);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.snapshotDirty = true;
    });
  }

  start() {
    this.refresh();
    this.app.ticker.add((ticker) => this.tick(ticker));
  }

  resize() {
    const width = Math.max(320, Math.floor(window.innerWidth));
    const height = Math.max(320, Math.floor(window.innerHeight));
    if (width === this.width && height === this.height) {
      this.snapshotDirty = true;
      return;
    }
    this.width = width;
    this.height = height;
    this.app.renderer.resize(width, height);
    this.atmosphere.resize(width, height);
    for (const scene of Object.values(this.scenes)) scene.resize(width, height);
    this.overlays.resize(width, height);
    this.layoutToast();
    this.snapshotDirty = true;
    this.refresh();
  }

  setScreen(name) {
    if (!name || name === this.currentScreen) return;
    const first = !this.currentScreen;
    this.currentScreen = name;
    for (const [key, scene] of Object.entries(this.scenes)) {
      scene.root.visible = key === name;
      if (key === name) {
        scene.root.alpha = first || this.reducedMotion ? 1 : 0;
      }
    }
    this.sceneFade = first || this.reducedMotion ? 1 : 0;
    this.hideTooltip();
  }

  refresh() {
    const snap = snapshot();
    if (!snap) return;
    this.snapshot = snap;
    this.snapshotDirty = false;
    this.lastSignature = signature();
    const screen = snap.screen || "menu";
    this.setScreen(screen);
    const scene = this.scenes[screen];
    if (scene) scene.update(snap);
    this.overlays.update(snap);
    if (snap.modal !== this.lastModal) {
      this.lastModal = snap.modal;
      this.hideTooltip();
    }
    this.updateToast(snap);
    if (this.sceneFade >= 1 && this.currentScreen) {
      const active = this.scenes[this.currentScreen];
      if (active) active.root.alpha = 1;
    }
  }

  tick(ticker) {
    const dt = Math.min(0.05, Math.max(0, (ticker.deltaMS || 16.7) / 1000));
    this.time += dt;

    this.pollAccumulator += dt;
    if (this.pollAccumulator >= POLL_SECONDS) {
      this.pollAccumulator = 0;
      const next = signature();
      if (next !== this.lastSignature) {
        this.lastSignature = next;
        this.snapshotDirty = true;
      }
    }
    if (this.snapshotDirty) this.refresh();

    this.atmosphere.reducedMotion = this.reducedMotion;
    this.atmosphere.tick(dt);

    const scene = this.scenes[this.currentScreen];
    if (scene) scene.tick(dt);
    this.overlays.tick(dt);

    if (this.sceneFade < 1) {
      this.sceneFade = Math.min(1, this.sceneFade + dt / 0.26);
      const active = this.scenes[this.currentScreen];
      if (active) active.root.alpha = 1 - Math.pow(1 - this.sceneFade, 3);
    }

    this.tickToast(dt);
  }

  showTooltip(text) {
    if (!text) {
      this.hideTooltip();
      return;
    }
    this.tooltipText = text;
    this.tooltip.show(text, this.pointer.x, this.pointer.y);
  }

  hideTooltip() {
    this.tooltipText = "";
    if (this.tooltip) this.tooltip.hide();
  }

  layoutToast() {
    const maxWidth = Math.max(180, Math.min(560, this.width - 32));
    this.toastText.style.wordWrapWidth = maxWidth - 40;
    const width = Math.max(160, Math.min(maxWidth, Math.ceil(this.toastText.width) + 40));
    const height = Math.max(38, Math.ceil(this.toastText.height) + 18);
    this.toastWidth = width;
    this.toastHeight = height;
    this.toastBg.clear();
    this.toastBg
      .roundRect(-width / 2, -height / 2, width, height, 7)
      .fill({ color: 0x0b0704, alpha: 0.96 })
      .roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 5)
      .fill({ color: 0x24170e, alpha: 0.98 })
      .roundRect(-width / 2 + 0.5, -height / 2 + 0.5, width - 1, height - 1, 7)
      .stroke({ width: 1, color: this.toastBorder || THEME.colors.giltLo, alpha: 0.85 })
      .roundRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 4)
      .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.2 });
    this.toastShadow.width = width * 1.25;
    this.toastShadow.height = height * 2.1;
    this.toastBaseY = this.width < 760 ? this.height - 154 : this.height - 44;
    this.toastRoot.position.set(this.width / 2, this.toastBaseY);
  }

  updateToast(snap) {
    const message = snap.toast || "";
    const visible = Boolean(snap.toastVisible && message);
    if (message && message !== this.toastTextValue) {
      this.toastTextValue = message;
      this.toastText.text = message;
      const rarity = snap.toastRarity || "";
      this.toastBorder = rarity === "rare"
        ? THEME.colors.rust
        : rarity === "uncommon"
          ? 0x6a8a5a
          : THEME.colors.giltLo;
      this.layoutToast();
      this.toastRoot.scale.set(1.04);
    }
    this.toastTarget = visible ? 1 : 0;
    if (visible) this.toastRoot.visible = true;
  }

  tickToast(dt) {
    const root = this.toastRoot;
    const target = this.toastTarget;
    this.toastAlpha += (target - this.toastAlpha) * Math.min(1, dt * 12);
    if (target > 0 && this.toastAlpha < 0.02) this.toastAlpha = 0.02;
    if (target > 0) {
      root.visible = true;
      root.alpha = clamp(this.toastAlpha, 0, 1);
      root.y = this.toastBaseY + (1 - root.alpha) * 8;
    } else {
      root.alpha = clamp(this.toastAlpha, 0, 1);
      if (root.alpha <= 0.015) {
        root.visible = false;
        root.alpha = 0;
      }
    }
    if (root.visible) {
      const nextScale = 1 + Math.max(0, root.scale.x - 1) * Math.max(0, 1 - dt * 9);
      root.scale.set(nextScale);
    }
  }
}

async function waitForFonts() {
  if (!document.fonts) return;
  const loads = [
    document.fonts.load('700 32px "Cinzel"'),
    document.fonts.load('400 16px "Source Sans 3"'),
    document.fonts.load('600 16px "Source Sans 3"')
  ];
  const ready = Promise.all(loads.map((p) => p.catch(() => null))).then(() => document.fonts.ready);
  await Promise.race([
    ready.catch(() => null),
    new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS))
  ]);
}

async function boot() {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("canvas") === "off" || params.get("dom") === "1") {
    document.documentElement.dataset.canvasEngine = "disabled";
    return;
  }
  try {
    await waitForFonts();
    const app = new Application();
    await app.init({
      canvas,
      width: Math.max(320, window.innerWidth),
      height: Math.max(320, window.innerHeight),
      backgroundColor: THEME.colors.bg,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      preference: "webgl",
      powerPreference: "high-performance"
    });

    const textures = createTextures();
    setSharedTextures(textures);
    const engine = new CanvasEngine(app, textures);
    engine.start();

    document.body.classList.add("canvas-mode");
    document.documentElement.dataset.canvasEngine = "ready";
    window.TTNCanvas = {
      ready: true,
      app,
      engine,
      snapshot: () => engine.snapshot,
      refresh: () => engine.refresh(true)
    };
  } catch (error) {
    console.error("Canvas engine failed to start; keeping the DOM interface.", error);
    document.body.classList.remove("canvas-mode");
    document.documentElement.dataset.canvasEngine = "failed";
    const root = document.getElementById("canvas-root");
    if (root) root.dataset.failed = "true";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
