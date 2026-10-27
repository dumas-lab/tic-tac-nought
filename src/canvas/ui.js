import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import { THEME, clamp } from "./theme.js";

export function makeText(value, options = {}) {
  const {
    size = 18,
    font = THEME.fontBody,
    weight = "400",
    fill = THEME.colors.bone,
    align = "left",
    anchorX = 0,
    anchorY = 0,
    letterSpacing = 0,
    lineHeight,
    wordWrap = false,
    wordWrapWidth = 0,
    stroke = null,
    strokeWidth = 0,
    shadow = false,
    resolution = 2
  } = options;

  const style = {
    fontFamily: font,
    fontSize: size,
    fontWeight: String(weight),
    fill,
    align,
    letterSpacing,
    wordWrap,
    breakWords: true,
    padding: 4
  };
  if (lineHeight) style.lineHeight = lineHeight;
  if (wordWrapWidth) style.wordWrapWidth = wordWrapWidth;
  if (stroke) style.stroke = { color: stroke, width: strokeWidth || 2 };
  if (shadow) {
    style.dropShadow = {
      color: 0x000000,
      alpha: 0.65,
      blur: 4,
      distance: 2,
      angle: Math.PI / 2
    };
  }

  const text = new Text({ text: String(value ?? ""), style });
  text.resolution = resolution;
  text.anchor.set(anchorX, anchorY);
  return text;
}

export function addShadow(parent, width, height, alpha = 0.5, offsetY = 8, texture) {
  const shadow = new Sprite(texture);
  shadow.anchor.set(0.5);
  shadow.width = width * 1.16;
  shadow.height = height * 1.16;
  shadow.position.set(width / 2, height / 2 + offsetY);
  shadow.alpha = alpha;
  parent.addChildAt(shadow, 0);
  return shadow;
}

export function makePanel({
  width,
  height,
  radius = THEME.radius.panel,
  texture = null,
  textureTint = 0xffffff,
  textureAlpha = 1,
  fill = THEME.colors.wood,
  stroke = THEME.colors.woodEdge,
  innerStroke = THEME.colors.gilt,
  shadow = true,
  shadowTexture = null,
  shadowAlpha = 0.5,
  highlight = true
} = {}) {
  const panel = new Container();
  if (shadow && shadowTexture) {
    addShadow(panel, width, height, shadowAlpha, 8, shadowTexture);
  }

  if (texture) {
    const bg = new Sprite(texture);
    bg.anchor.set(0);
    bg.width = width;
    bg.height = height;
    bg.tint = textureTint;
    bg.alpha = textureAlpha;
    const mask = new Graphics().roundRect(0, 0, width, height, radius).fill(0xffffff);
    bg.mask = mask;
    panel.addChild(bg, mask);
  } else {
    const bg = new Graphics().roundRect(0, 0, width, height, radius).fill(fill);
    panel.addChild(bg);
  }

  const border = new Graphics();
  border
    .roundRect(0.5, 0.5, width - 1, height - 1, radius)
    .stroke({ width: 2, color: stroke, alignment: 0.5 });
  if (innerStroke) {
    border
      .roundRect(4.5, 4.5, width - 9, height - 9, Math.max(2, radius - 3))
      .stroke({ width: 1, color: innerStroke, alpha: 0.45, alignment: 0.5 });
  }
  panel.addChild(border);

  if (highlight) {
    const hi = new Graphics()
      .roundRect(3, 2, width - 6, Math.max(6, height * 0.34), Math.max(2, radius - 2))
      .fill({ color: 0xffffff, alpha: 0.045 });
    panel.addChild(hi);
  }

  panel.eventMode = "static";
  panel.hitArea = new Rectangle(0, 0, width, height);
  return panel;
}

export function makeButton({
  width,
  height,
  label = "",
  sub = "",
  variant = "wood",
  onClick = null,
  fontSize = 18,
  subSize = 11,
  icon = "",
  disabled = false,
  align = "left",
  padding = 16
} = {}) {
  const container = new Container();
  const isBrass = variant === "brass";
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";
  const material = isGhost ? null : containerTexture(isBrass ? "brass" : "wood");
  const fill = isGhost
    ? { color: THEME.colors.woodLo, alpha: 0.45 }
    : isDanger
      ? { color: 0x4a1410, alpha: 1 }
      : THEME.colors.wood;

  const panel = makePanel({
    width,
    height,
    radius: THEME.radius.button,
    texture: material,
    textureTint: isDanger ? 0xb05040 : 0xffffff,
    fill,
    stroke: isDanger ? 0x5a1a12 : THEME.colors.woodEdge,
    innerStroke: isBrass ? THEME.colors.giltHi : isDanger ? THEME.colors.danger : THEME.colors.gilt,
    shadow: true,
    shadowTexture: containerTexture("shadow"),
    shadowAlpha: 0.45
  });
  container.addChild(panel);

  const bevel = new Graphics();
  bevel
    .roundRect(1, height - 5, width - 2, 4, 2)
    .fill({ color: 0x000000, alpha: isBrass ? 0.22 : 0.38 });
  bevel
    .roundRect(2, 2, width - 4, 2, 1)
    .fill({ color: 0xffffff, alpha: isBrass ? 0.28 : 0.08 });
  container.addChild(bevel);

  const textColor = isBrass ? THEME.colors.ink : isDanger ? THEME.colors.bone : THEME.colors.bone;
  const textX = align === "center" ? width / 2 : padding;
  const textAnchor = align === "center" ? 0.5 : 0;

  if (icon) {
    const iconText = makeText(icon, {
      size: Math.round(fontSize * 1.15),
      font: THEME.fontDisplay,
      weight: "600",
      fill: textColor,
      anchorX: textAnchor,
      anchorY: 0.5,
      shadow: !isBrass
    });
    iconText.position.set(align === "center" ? width / 2 : padding, height / 2);
    container.addChild(iconText);
  }

  const labelText = makeText(label, {
    size: fontSize,
    font: THEME.fontDisplay,
    weight: "600",
    fill: textColor,
    anchorX: textAnchor,
    anchorY: sub ? 0.15 : 0.5,
    letterSpacing: 0.4,
    shadow: !isBrass
  });
  labelText.position.set(textX, sub ? height * 0.34 : height / 2);
  container.addChild(labelText);
  container.labelText = labelText;
  container.setText = (next) => {
    labelText.text = next;
  };

  if (sub) {
    const subText = makeText(sub, {
      size: subSize,
      font: THEME.fontBody,
      weight: "400",
      fill: isBrass ? THEME.colors.inkSoft : THEME.colors.boneDim,
      anchorX: textAnchor,
      anchorY: 0.2,
      wordWrap: true,
      wordWrapWidth: width - padding * 2
    });
    subText.position.set(textX, height * 0.56);
    container.addChild(subText);
  }

  container.eventMode = "static";
  container.cursor = disabled ? "default" : "pointer";
  container.hitArea = new Rectangle(0, 0, width, height);
  container.alpha = disabled ? 0.45 : 1;

  if (!disabled && onClick) {
    let pressed = false;
    container.on("pointerover", () => {
      if (!pressed) container.scale.set(1.015);
      container.alpha = 1;
    });
    container.on("pointerout", () => {
      pressed = false;
      container.scale.set(1);
      container.alpha = 1;
    });
    container.on("pointerdown", () => {
      pressed = true;
      container.scale.set(0.985);
    });
    container.on("pointerup", () => {
      if (!pressed) return;
      pressed = false;
      container.scale.set(1.015);
      onClick();
    });
    container.on("pointerupoutside", () => {
      pressed = false;
      container.scale.set(1);
    });
  }

  return container;
}

// The button factory needs the shared texture map. Scenes set this once at boot.
let sharedTextures = null;
export function setSharedTextures(textures) {
  sharedTextures = textures;
}
function containerTexture(name) {
  return sharedTextures ? sharedTextures[name] : null;
}

export function makeIconButton({ size = 36, glyph = "", onClick = null, variant = "wood", label = "" } = {}) {
  const button = makeButton({
    width: size,
    height: size,
    label: glyph,
    variant,
    onClick,
    fontSize: Math.round(size * 0.52),
    align: "center",
    padding: 0
  });
  if (label) button.label = label;
  return button;
}

export function makeTooltip(textures, width = 300) {
  const container = new Container();
  container.visible = false;
  container.eventMode = "none";
  container.zIndex = 100;

  const panel = makePanel({
    width,
    height: 80,
    radius: 8,
    texture: textures.parchment,
    stroke: 0x6b4a24,
    innerStroke: THEME.colors.giltLo,
    shadow: true,
    shadowTexture: textures.shadow,
    shadowAlpha: 0.55
  });
  container.addChild(panel);

  const body = makeText("", {
    size: 13,
    font: THEME.fontBody,
    fill: THEME.colors.ink,
    wordWrap: true,
    wordWrapWidth: width - 24,
    lineHeight: 18
  });
  body.position.set(12, 10);
  container.addChild(body);

  let current = "";
  function render(value) {
    if (value === current) return;
    current = value;
    body.text = value;
    const height = Math.max(42, Math.ceil(body.height) + 20);
    panel.destroy({ children: true });
    const next = makePanel({
      width,
      height,
      radius: 8,
      texture: textures.parchment,
      stroke: 0x6b4a24,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: textures.shadow,
      shadowAlpha: 0.55
    });
    container.addChildAt(next, 0);
    container.panel = next;
    body.position.set(12, 10);
    container.addChild(body);
  }

  return {
    container,
    show(value, x, y) {
      render(value);
      const height = Math.max(42, Math.ceil(body.height) + 20);
      container.position.set(
        clamp(x + 16, 8, Math.max(8, window.innerWidth - width - 8)),
        clamp(y - height - 12, 8, Math.max(8, window.innerHeight - height - 8))
      );
      container.visible = true;
    },
    hide() {
      container.visible = false;
    },
    get visible() {
      return container.visible;
    }
  };
}

export class ScrollView extends Container {
  constructor({ width, height, radius = 8, textures }) {
    super();
    this.viewWidth = width;
    this.viewHeight = height;
    this.radius = radius;
    this.textures = textures;
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragStartY = 0;
    this.dragStartScroll = 0;

    this.viewport = new Container();
    this.content = new Container();
    this.viewport.addChild(this.content);
    this.addChild(this.viewport);

    this.maskShape = new Graphics().roundRect(0, 0, width, height, radius).fill(0xffffff);
    this.addChild(this.maskShape);
    this.viewport.mask = this.maskShape;

    this.scrollbar = new Graphics();
    this.addChild(this.scrollbar);

    this.eventMode = "static";
    this.hitArea = new Rectangle(0, 0, width, height);
    this.cursor = "default";

    this.on("pointerdown", (event) => {
      this.dragging = true;
      this.dragStartY = event.global.y;
      this.dragStartScroll = this.scrollY;
    });
    this.on("globalpointermove", (event) => {
      if (!this.dragging) return;
      const delta = event.global.y - this.dragStartY;
      this.setScroll(this.dragStartScroll + delta);
    });
    this.on("pointerup", () => {
      this.dragging = false;
    });
    this.on("pointerupoutside", () => {
      this.dragging = false;
    });
    this.on("wheel", (event) => {
      this.setScroll(this.scrollY + (event.deltaY || 0) * 0.8);
    });
  }

  setContentHeight(height) {
    this.contentHeight = height;
    this.maxScroll = Math.max(0, height - this.viewHeight);
    this.setScroll(this.scrollY);
  }

  setScroll(value) {
    this.scrollY = clamp(value, -this.maxScroll, 0);
    this.content.y = this.scrollY;
    this.drawScrollbar();
  }

  scrollBy(delta) {
    this.setScroll(this.scrollY + delta);
  }

  drawScrollbar() {
    this.scrollbar.clear();
    if (this.maxScroll <= 0) return;
    const trackX = this.viewWidth - 6;
    const trackH = this.viewHeight - 8;
    this.scrollbar
      .roundRect(trackX, 4, 3, trackH, 1.5)
      .fill({ color: 0x000000, alpha: 0.25 });
    const thumbH = Math.max(24, (this.viewHeight / (this.viewHeight + this.maxScroll)) * trackH);
    const t = this.maxScroll === 0 ? 0 : -this.scrollY / this.maxScroll;
    const thumbY = 4 + t * (trackH - thumbH);
    this.scrollbar
      .roundRect(trackX, thumbY, 3, thumbH, 1.5)
      .fill({ color: THEME.colors.gilt, alpha: 0.7 });
  }
}

export function drawCarvedDivider(width, color = THEME.colors.gilt) {
  const g = new Graphics();
  g.moveTo(0, 0).lineTo(width, 0).stroke({ width: 1, color, alpha: 0.35 });
  g.moveTo(0, 2).lineTo(width, 2).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
  return g;
}

export function makeGlow(texture, width, height, color = 0xffffff, alpha = 0.35) {
  const glow = new Sprite(texture);
  glow.anchor.set(0.5);
  glow.width = width;
  glow.height = height;
  glow.tint = color;
  glow.alpha = alpha;
  glow.blendMode = "add";
  return glow;
}

export function makeKeyValueLine(key, value, width, { keySize = 11, valueSize = 14 } = {}) {
  const row = new Container();
  const keyText = makeText(key, {
    size: keySize,
    font: THEME.fontBody,
    weight: "600",
    fill: THEME.colors.inkSoft,
    letterSpacing: 1.2
  });
  keyText.position.set(0, 0);
  row.addChild(keyText);

  const valueText = makeText(value, {
    size: valueSize,
    font: THEME.fontBody,
    weight: "600",
    fill: THEME.colors.ink,
    wordWrap: true,
    wordWrapWidth: width - 110
  });
  valueText.position.set(110, -1);
  row.addChild(valueText);
  row.valueText = valueText;
  return row;
}

export function makeSectionLabel(value, { width = 0, color = THEME.colors.gilt, size = 11 } = {}) {
  const row = new Container();
  const text = makeText(value.toUpperCase(), {
    size,
    font: THEME.fontBody,
    weight: "700",
    fill: color,
    letterSpacing: 2.2
  });
  row.addChild(text);
  if (width > 0) {
    const line = drawCarvedDivider(width, color);
    line.position.set(0, size + 5);
    row.addChild(line);
  }
  return row;
}

export function makeChip(value, { size = 11, color = THEME.colors.boneDim, border = THEME.colors.giltLo } = {}) {
  const text = makeText(value, {
    size,
    font: THEME.fontBody,
    weight: "600",
    fill: color,
    letterSpacing: 0.6
  });
  const width = Math.ceil(text.width) + 18;
  const height = size + 12;
  const c = new Container();
  const bg = new Graphics()
    .roundRect(0, 0, width, height, height / 2)
    .fill({ color: 0x1a1009, alpha: 0.55 })
    .stroke({ width: 1, color: border, alpha: 0.55 });
  c.addChild(bg);
  text.position.set(width / 2, height / 2 - 1);
  text.anchor.set(0.5);
  c.addChild(text);
  c.chipWidth = width;
  c.chipHeight = height;
  c.text = text;
  return c;
}

/**
 * A parchment page with a subtle deckled edge. The caller supplies content.
 */
export function makeParchmentPage(width, height, textures, { radius = 5, shadow = true } = {}) {
  const c = new Container();
  if (shadow) {
    const s = new Sprite(textures.shadow);
    s.anchor.set(0.5);
    s.position.set(width / 2, height / 2 + 8);
    s.width = width * 1.12;
    s.height = height * 1.12;
    s.alpha = 0.55;
    c.addChild(s);
  }
  const page = new Sprite(textures.parchment);
  page.width = width;
  page.height = height;
  const mask = new Graphics().roundRect(0, 0, width, height, radius).fill(0xffffff);
  page.mask = mask;
  c.addChild(page, mask);
  const edge = new Graphics()
    .roundRect(0.5, 0.5, width - 1, height - 1, radius)
    .stroke({ width: 1, color: 0x6b4a24, alpha: 0.8 })
    .roundRect(4, 4, width - 8, height - 8, Math.max(2, radius - 2))
    .stroke({ width: 1, color: 0x9a7a4a, alpha: 0.28 });
  c.addChild(edge);
  return c;
}

/**
 * Canvas text field backed by a real (invisible) DOM input. The DOM input keeps
 * mobile keyboards, autofill, accessibility, and the existing form handlers.
 */
export function makeTextField({
  width,
  height = 42,
  label = "",
  value = "",
  placeholder = "",
  password = false,
  multiline = false,
  font = THEME.fontBody,
  size = 15,
  onFocus = null,
  onCommit = null
} = {}) {
  const c = new Container();
  const padX = 12;
  const padY = multiline ? 10 : 0;

  const labelText = label
    ? makeText(label.toUpperCase(), {
        size: 9,
        font: THEME.fontBody,
        weight: "700",
        fill: THEME.colors.gilt,
        letterSpacing: 1.8
      })
    : null;
  if (labelText) {
    labelText.position.set(2, -16);
    c.addChild(labelText);
  }

  const fieldY = label ? 0 : 0;
  const bg = new Graphics()
    .roundRect(0, fieldY, width, height, 4)
    .fill({ color: 0x2b1d11 })
    .roundRect(2, fieldY + 2, width - 4, height - 4, 3)
    .fill({ color: 0xe2d3ae, alpha: 0.9 })
    .roundRect(0.5, fieldY + 0.5, width - 1, height - 1, 4)
    .stroke({ width: 1, color: 0x6b4a24, alpha: 0.9 });
  c.addChild(bg);

  const focus = new Graphics()
    .roundRect(1, fieldY + 1, width - 2, height - 2, 4)
    .stroke({ width: 2, color: THEME.colors.giltHi, alpha: 0 })
    .roundRect(4, fieldY + 4, width - 8, height - 8, 2)
    .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0 });
  c.addChild(focus);

  const maskShape = new Graphics()
    .roundRect(padX, fieldY + 4, width - padX * 2, height - 8, 2)
    .fill(0xffffff);
  c.addChild(maskShape);

  const valueText = makeText("", {
    size,
    font,
    weight: "600",
    fill: THEME.colors.ink,
    wordWrap: multiline,
    wordWrapWidth: width - padX * 2,
    lineHeight: Math.round(size * 1.35)
  });
  valueText.position.set(padX, fieldY + height / 2);
  valueText.anchor.set(0, multiline ? 0 : 0.5);
  valueText.mask = maskShape;
  c.addChild(valueText);

  const placeholderText = makeText(placeholder, {
    size,
    font,
    weight: "400",
    fill: 0x7a6244,
    wordWrap: multiline,
    wordWrapWidth: width - padX * 2,
    lineHeight: Math.round(size * 1.35)
  });
  placeholderText.position.set(padX, fieldY + height / 2);
  placeholderText.anchor.set(0, multiline ? 0 : 0.5);
  placeholderText.mask = maskShape;
  c.addChild(placeholderText);

  const caret = new Graphics().rect(0, 0, 1.5, size * 1.25).fill({ color: THEME.colors.ink });
  caret.visible = false;
  c.addChild(caret);

  let current = value;
  let focused = false;
  let caretPos = 0;
  let blinkTime = 0;

  function display(valueString) {
    if (password) return "•".repeat(valueString.length);
    return valueString;
  }

  function update(next = {}) {
    if (typeof next.value === "string") current = next.value;
    if (typeof next.focused === "boolean") focused = next.focused;
    if (Number.isFinite(next.caret)) caretPos = next.caret;
    if (Number.isFinite(next.time)) blinkTime = next.time;

    const shown = display(current);
    valueText.text = shown;
    placeholderText.visible = current.length === 0;
    focus.clear();
    focus
      .roundRect(1, fieldY + 1, width - 2, height - 2, 4)
      .stroke({ width: 2, color: THEME.colors.giltHi, alpha: focused ? 0.9 : 0 })
      .roundRect(4, fieldY + 4, width - 8, height - 8, 2)
      .stroke({ width: 1, color: THEME.colors.gilt, alpha: focused ? 0.5 : 0 });

    caret.visible = focused && Math.floor(blinkTime * 2) % 2 === 0;
    if (caret.visible) {
      const prefix = shown.slice(0, Math.max(0, Math.min(caretPos, shown.length)));
      let caretX = padX;
      if (multiline) {
        const lines = prefix.split("\n");
        const last = lines[lines.length - 1] || "";
        const lastLine = makeText(last, { size, font, weight: "600", fill: 0x000000 });
        caretX = padX + Math.min(lastLine.width, width - padX * 2);
        lastLine.destroy();
        caret.position.set(caretX, fieldY + padY + Math.max(0, lines.length - 1) * size * 1.35 + size * 0.1);
      } else {
        const measure = makeText(prefix, { size, font, weight: "600", fill: 0x000000 });
        caretX = padX + measure.width;
        measure.destroy();
        caret.position.set(caretX, fieldY + height / 2 - size * 0.62);
      }
      caret.height = size * 1.25;
      caret.width = 1.5;
    }
  }

  c.eventMode = "static";
  c.cursor = "text";
  c.hitArea = new Rectangle(0, fieldY, width, height);
  c.on("pointerdown", () => {
    if (onFocus) onFocus();
  });
  c.on("pointerup", () => {
    if (onCommit) onCommit();
  });

  c.updateField = update;
  c.valueText = valueText;
  update({ value, focused: false, caret: 0 });
  return c;
}

export function makeSlider({ width, value = 50, onChange = null } = {}) {
  const c = new Container();
  const height = 28;
  const trackY = height / 2;
  const track = new Graphics();
  const knob = new Graphics();
  c.addChild(track, knob);
  let current = clamp(value, 0, 100);

  function draw() {
    track.clear();
    track
      .roundRect(0, trackY - 3, width, 6, 3)
      .fill({ color: 0x2a1b0e, alpha: 0.8 })
      .roundRect(1, trackY - 2, width - 2, 4, 2)
      .fill({ color: 0x120c08, alpha: 0.7 });
    const x = (current / 100) * (width - 14) + 7;
    track
      .roundRect(1, trackY - 2, Math.max(0, x - 1), 4, 2)
      .fill({ color: THEME.colors.gilt, alpha: 0.65 });
    knob.clear();
    knob
      .circle(x, trackY + 1, 9)
      .fill({ color: 0x1a0f08, alpha: 0.6 })
      .circle(x, trackY, 8)
      .fill({ color: THEME.colors.brass || 0xd9a54a })
      .circle(x, trackY, 8)
      .stroke({ width: 1, color: THEME.colors.giltHi, alpha: 0.9 })
      .circle(x - 2, trackY - 2, 2.5)
      .fill({ color: 0xffffff, alpha: 0.4 });
  }

  function setFromEvent(event) {
    const local = event.getLocalPosition(c);
    current = clamp(Math.round((local.x / width) * 100), 0, 100);
    draw();
    if (onChange) onChange(current);
  }

  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new Rectangle(0, 0, width, height);
  let dragging = false;
  c.on("pointerdown", (event) => {
    dragging = true;
    setFromEvent(event);
  });
  c.on("globalpointermove", (event) => {
    if (dragging) setFromEvent(event);
  });
  c.on("pointerup", () => { dragging = false; });
  c.on("pointerupoutside", () => { dragging = false; });
  c.setValue = (next) => {
    current = clamp(next, 0, 100);
    draw();
  };
  draw();
  return c;
}

export function makeToggle({ width = 46, height = 24, checked = false, onChange = null } = {}) {
  const c = new Container();
  const track = new Graphics();
  const knob = new Graphics();
  c.addChild(track, knob);
  let state = Boolean(checked);

  function draw() {
    track.clear();
    track
      .roundRect(0, 0, width, height, height / 2)
      .fill({ color: state ? 0x4a5a2a : 0x2a1b0e })
      .stroke({ width: 1, color: state ? THEME.colors.bile : THEME.colors.giltLo, alpha: 0.8 });
    knob.clear();
    const x = state ? width - height / 2 : height / 2;
    knob
      .circle(x, height / 2, height / 2 - 3)
      .fill({ color: state ? THEME.colors.bileHi : THEME.colors.boneDim })
      .stroke({ width: 1, color: 0x000000, alpha: 0.35 });
  }

  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new Rectangle(0, 0, width, height);
  c.on("pointerup", () => {
    state = !state;
    draw();
    if (onChange) onChange(state);
  });
  c.setValue = (next) => {
    state = Boolean(next);
    draw();
  };
  c.getValue = () => state;
  draw();
  return c;
}

/**
 * A soft, irregular gold frame used around important panels.
 */
export function makeGiltFrame(width, height, radius = 8, alpha = 0.55) {
  return new Graphics()
    .roundRect(0.5, 0.5, width - 1, height - 1, radius)
    .stroke({ width: 1, color: THEME.colors.gilt, alpha })
    .roundRect(4.5, 4.5, width - 9, height - 9, Math.max(2, radius - 3))
    .stroke({ width: 1, color: THEME.colors.giltLo, alpha: alpha * 0.5 });
}
