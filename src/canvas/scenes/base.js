import { Container, Graphics } from "pixi.js";
import { THEME } from "../theme.js";
import { makeButton, makePanel, makeText } from "../ui.js";
import { click } from "../state.js";

export class Scene {
  constructor(engine) {
    this.engine = engine;
    this.root = new Container();
    this.width = engine.width;
    this.height = engine.height;
    this.snapshot = null;
    this.time = 0;
  }

  mount() {}
  update(snapshot) { this.snapshot = snapshot; }
  tick() {}
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  destroy() {
    this.root.destroy({ children: true });
  }
}

export function formatNumber(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatScore(value) {
  return formatNumber(value);
}

export function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function popIn(container, { from = 1.2, duration = 0.32, delay = 0 } = {}) {
  container.alpha = 0;
  container.scale.set(from);
  const state = { elapsed: -delay, done: false };
  container.animateIn = state;
  return state;
}

export function updatePopIn(container, dt) {
  const state = container.animateIn;
  if (!state || state.done) return;
  state.elapsed += dt;
  if (state.elapsed < 0) return;
  const t = Math.min(1, state.elapsed / 0.32);
  const eased = 1 - Math.pow(1 - t, 3);
  const overshoot = Math.sin(t * Math.PI) * 0.08;
  container.alpha = Math.min(1, t * 2);
  container.scale.set(1.2 + (1 - 1.2) * eased - overshoot * (1 - t));
  if (t >= 1) {
    container.scale.set(1);
    container.alpha = 1;
    state.done = true;
  }
}

export function makeOnlineBar(engine, { width = 286, compact = false } = {}) {
  const c = new Container();
  const height = compact ? 30 : 34;
  const panel = makePanel({
    width,
    height,
    radius: 5,
    texture: engine.textures.leather,
    textureTint: 0x9a8a72,
    stroke: 0x0b0705,
    innerStroke: THEME.colors.gilt,
    shadow: true,
    shadowTexture: engine.textures.shadow,
    shadowAlpha: 0.4
  });
  c.addChild(panel);

  const dot = new Graphics().circle(14, height / 2, 4).fill({ color: THEME.colors.bile, alpha: 0.8 });
  c.addChild(dot);

  const identity = makeText("Local only", {
    size: compact ? 11 : 12,
    font: THEME.fontBody,
    weight: "600",
    fill: THEME.colors.bone,
    letterSpacing: 0.4
  });
  identity.position.set(24, height / 2);
  identity.anchor.set(0, 0.5);
  c.addChild(identity);

  const action = makeButton({
    width: compact ? 66 : 74,
    height: height - 10,
    label: "Sign in",
    variant: "ghost",
    fontSize: compact ? 10 : 11,
    align: "center",
    padding: 0,
    onClick: () => click("onlineBarAction")
  });
  action.position.set(width - (compact ? 70 : 78), 5);
  c.addChild(action);

  identity.eventMode = "static";
  identity.cursor = "pointer";
  identity.on("pointerup", () => click("onlineBarIdentity"));

  c.updateBar = (snap) => {
    c.visible = Boolean(snap.onlineEnabled);
    if (!snap.onlineEnabled) return;
    const signed = snap.onlineSignedIn;
    identity.text = signed ? snap.onlineBar || "Account" : "Local only";
    identity.style.fill = snap.onlineGuest ? THEME.colors.bileHi : THEME.colors.bone;
    dot.clear().circle(14, height / 2, 4).fill({
      color: signed ? (snap.onlineGuest ? THEME.colors.bile : THEME.colors.gilt) : 0x5a4a38,
      alpha: signed ? 0.9 : 0.6
    });
    action.setText(signed ? "Account" : "Sign in");
  };
  return c;
}

export function makeHeader(engine, { width, title, subtitle = "", height = 64 }) {
  const c = new Container();
  const panel = makePanel({
    width,
    height,
    radius: 6,
    texture: engine.textures.woodDark,
    textureTint: 0xc8a878,
    stroke: 0x0a0604,
    innerStroke: THEME.colors.giltLo,
    shadow: true,
    shadowTexture: engine.textures.shadow,
    shadowAlpha: 0.5
  });
  c.addChild(panel);

  const titleText = makeText(title, {
    size: height > 56 ? 22 : 18,
    font: THEME.fontDisplay,
    weight: "700",
    fill: THEME.colors.giltHi,
    anchorX: 0.5,
    anchorY: subtitle ? 0.36 : 0.5,
    letterSpacing: 1.2,
    shadow: true
  });
  titleText.position.set(width / 2, height / 2);
  c.addChild(titleText);

  let subText = null;
  if (subtitle) {
    subText = makeText(subtitle, {
      size: 9,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.boneDim,
      anchorX: 0.5,
      anchorY: 0.5,
      letterSpacing: 2.4
    });
    subText.position.set(width / 2, height * 0.74);
    c.addChild(subText);
  }

  const trim = new Graphics()
    .moveTo(width * 0.3, height - 7)
    .lineTo(width * 0.7, height - 7)
    .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.28 });
  c.addChild(trim);

  c.setTitle = (nextTitle, nextSubtitle) => {
    titleText.text = nextTitle;
    if (subText && nextSubtitle != null) subText.text = nextSubtitle;
  };
  return c;
}

export function makeTinyButton(engine, { width = 92, height = 28, label, onClick, variant = "ghost" }) {
  return makeButton({
    width,
    height,
    label,
    variant,
    fontSize: 10,
    align: "center",
    padding: 0,
    onClick
  });
}
