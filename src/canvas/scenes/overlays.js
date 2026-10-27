import { Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { THEME, clamp } from "../theme.js";
import {
  makeButton,
  makeIconButton,
  makePanel,
  makeParchmentPage,
  makeSectionLabel,
  makeText,
  makeTextField,
  makeToggle,
  ScrollView
} from "../ui.js";
import { Scene, formatNumber } from "./base.js";
import { click, focusInput, inputValue } from "../state.js";

function cardShell(engine, width, height, { texture = "woodDark", title = "", subtitle = "", onClose = null } = {}) {
  const root = new Container();
  const panel = makePanel({
    width,
    height,
    radius: 10,
    texture: engine.textures[texture],
    textureTint: texture === "parchment" ? 0xffffff : 0xd0b088,
    stroke: 0x050302,
    innerStroke: THEME.colors.giltLo,
    shadow: true,
    shadowTexture: engine.textures.shadow,
    shadowAlpha: 0.7
  });
  root.addChild(panel);

  if (title) {
    const titleText = makeText(title, {
      size: 26,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.giltHi,
      letterSpacing: 0.6,
      shadow: true
    });
    titleText.position.set(24, 20);
    root.addChild(titleText);
  }
  let subtitleText = null;
  if (subtitle) {
    subtitleText = makeText(subtitle, {
      size: 10,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.boneDim,
      wordWrap: true,
      wordWrapWidth: width - 72,
      lineHeight: 14
    });
    subtitleText.position.set(24, 52);
    root.addChild(subtitleText);
  }

  let close = null;
  if (onClose) {
    close = makeIconButton({
      size: 32,
      glyph: "✕",
      variant: "ghost",
      onClick: onClose
    });
    close.position.set(width - 44, 16);
    root.addChild(close);
  }

  const trim = new Graphics()
    .roundRect(7, 7, width - 14, height - 14, 6)
    .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.22 });
  root.addChild(trim);

  return { root, panel, close, title: root.children.find((c) => c.text !== undefined) };
}

function makeParchmentCard(engine, width, height, { title = "", subtitle = "", onClose = null } = {}) {
  const root = new Container();
  const back = makePanel({
    width,
    height,
    radius: 10,
    texture: engine.textures.woodDark,
    textureTint: 0xc8a878,
    stroke: 0x050302,
    innerStroke: THEME.colors.giltLo,
    shadow: true,
    shadowTexture: engine.textures.shadow,
    shadowAlpha: 0.7
  });
  root.addChild(back);
  const page = makeParchmentPage(width - 26, height - 26, engine.textures, { radius: 4 });
  page.position.set(13, 13);
  root.addChild(page);

  const titleText = makeText(title, {
    size: 26,
    font: THEME.fontDisplay,
    weight: "700",
    fill: THEME.colors.ink,
    letterSpacing: 0.4
  });
  titleText.position.set(32, 24);
  root.addChild(titleText);

  let subtitleText = null;
  if (subtitle) {
    subtitleText = makeText(subtitle, {
      size: 10,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width - 90,
      lineHeight: 14
    });
    subtitleText.position.set(32, 54);
    root.addChild(subtitleText);
  }

  let close = null;
  if (onClose) {
    close = makeIconButton({
      size: 32,
      glyph: "✕",
      variant: "ghost",
      onClick: onClose
    });
    close.position.set(width - 48, 18);
    root.addChild(close);
  }
  return { root, back, page, titleText, subtitleText, close };
}

function addParchmentOverlay(root, width, height) {
  const page = makeParchmentPage(width - 24, height - 24, root.engine.textures, { radius: 3 });
  page.position.set(12, 12);
  root.addChild(page);
  return page;
}

export class OverlayLayer extends Scene {
  constructor(engine) {
    super(engine);
    this.modal = null;
    this.card = null;
    this.fields = {};
    this.scrolls = [];
    this.signature = "";
    this.scrim = new Graphics();
    this.root.addChild(this.scrim);
    this.cardLayer = new Container();
    this.root.addChild(this.cardLayer);
    this.root.visible = false;
    this.visible = false;
  }

  update(snap) {
    this.snapshot = snap;
    if (!snap || !snap.modal) {
      if (this.modal) this.clear();
      return;
    }
    if (snap.modal !== this.modal) {
      this.build(snap);
      return;
    }
    const structural = this.structuralKey(snap);
    if (structural !== this.structuralSignature) {
      this.build(snap);
      return;
    }
    this.sync(snap);
  }

  structuralKey(snap) {
    if (snap.modal === "onlineAuthModal" && snap.auth) {
      return `auth:${snap.auth.mode}:${snap.auth.confirmVisible ? 1 : 0}:${snap.auth.title}`;
    }
    if (snap.modal === "onlineAccountModal" && snap.account) {
      return `account:${snap.account.deleteOpen ? 1 : 0}:${snap.account.claimVisible ? 1 : 0}`;
    }
    if (snap.modal === "onlineChoiceModal" && snap.choice) {
      return `choice:${snap.choice.primary}:${snap.choice.secondaryVisible ? 1 : 0}`;
    }
    return snap.modal;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.layoutScrim();
    if (this.modal) this.build(this.snapshot, true);
  }

  layoutScrim() {
    this.scrim.clear().rect(0, 0, this.width, this.height).fill({ color: 0x040302, alpha: 0.74 });
    this.scrim.eventMode = "static";
    this.scrim.hitArea = new Rectangle(0, 0, this.width, this.height);
  }

  clear() {
    this.modal = null;
    this.card = null;
    this.fields = {};
    this.scrolls = [];
    this.cardLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.root.visible = false;
    this.visible = false;
  }

  build(snap, keepPosition = false) {
    this.layoutScrim();
    this.cardLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.fields = {};
    this.scrolls = [];
    this.modal = snap.modal;
    this.structuralSignature = this.structuralKey(snap);
    this.root.visible = true;
    this.visible = true;

    const builders = {
      difficultyModal: () => this.buildDifficulty(snap),
      wishlistModal: () => this.buildWishlist(snap),
      bookModal: () => this.buildBook(snap),
      confirmModal: () => this.buildConfirm(snap),
      continueModal: () => this.buildContinue(snap),
      onlineAuthModal: () => this.buildAuth(snap),
      onlineAccountModal: () => this.buildAccount(snap),
      onlineChoiceModal: () => this.buildChoice(snap),
      devToolsModal: () => this.buildDevTools(snap)
    };
    const build = builders[snap.modal] || (() => this.buildGeneric(snap));
    const card = build();
    this.card = card;
    this.cardLayer.addChild(card.root);

    const width = card.root.cardWidth || card.root.width || 480;
    const height = card.root.cardHeight || card.root.height || 360;
    const scale = Math.min(1, (this.width - 24) / width, (this.height - 24) / height);
    card.root.scale.set(scale);
    card.root.position.set(
      (this.width - width * scale) / 2,
      (this.height - height * scale) / 2
    );
    this.sync(snap);
  }

  sync(snap) {
    if (!this.card) return;
    if (this.card.sync) this.card.sync(snap, this.engine.time);
    for (const [id, field] of Object.entries(this.fields)) {
      const focused = snap.focused === id;
      field.updateField({
        value: inputValue(id),
        focused,
        caret: focused ? snap.caret : 0,
        time: this.engine.time
      });
    }
  }

  tick(dt) {
    this.time += dt;
    if (!this.visible) return;
    for (const [id, field] of Object.entries(this.fields)) {
      if (this.snapshot && this.snapshot.focused === id) {
        field.updateField({ time: this.time });
      }
    }
    for (const scroll of this.scrolls) {
      if (scroll && scroll.drawScrollbar) scroll.drawScrollbar();
    }
  }

  closeModal(id) {
    click(id);
  }

  buildDifficulty(snap) {
    const width = Math.min(520, this.width - 30);
    const height = 430;
    const shell = makeParchmentCard(this.engine, width, height, {
      title: "Story difficulty",
      subtitle: "Choose how many sins you face before Nought.",
      onClose: () => click("difficultyCancel")
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;

    const labels = [
      { id: "easy", name: "Easy", count: "3 sins" },
      { id: "medium", name: "Medium", count: "5 sins" },
      { id: "hard", name: "Hard", count: "7 sins" }
    ];
    let y = 100;
    for (const diff of labels) {
      const status = snap.difficulty[diff.id] || "New";
      const b = makeButton({
        width: width - 64,
        height: 72,
        label: diff.name,
        sub: diff.count + " · " + status,
        variant: diff.id === "hard" ? "danger" : "wood",
        fontSize: 20,
        subSize: 10,
        align: "left",
        padding: 22,
        onClick: () => {
          const target = document.querySelector(`[data-difficulty="${diff.id}"]`);
          if (target) target.click();
        }
      });
      b.position.set(32, y);
      shell.root.addChild(b);
      y += 82;
    }

    const cancel = makeButton({
      width: 110,
      height: 32,
      label: "Cancel",
      variant: "ghost",
      fontSize: 11,
      align: "center",
      padding: 0,
      onClick: () => click("difficultyCancel")
    });
    cancel.position.set(width - 142, height - 52);
    shell.root.addChild(cancel);

    shell.sync = () => {};
    return shell;
  }

  buildWishlist(snap) {
    const width = Math.min(660, this.width - 24);
    const height = Math.min(640, this.height - 24);
    const shell = makeParchmentCard(this.engine, width, height, {
      title: "Wishlist",
      subtitle: "Dev notes. Saved locally and downloadable.",
      onClose: () => click("wishlistClose")
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;

    const field = makeTextField({
      width: width - 64,
      height: height - 190,
      value: inputValue("wishlistText"),
      placeholder: "Write notes for the next pass…",
      multiline: true,
      size: 14,
      onFocus: () => focusInput("wishlistText")
    });
    field.position.set(32, 100);
    shell.root.addChild(field);
    this.fields.wishlistText = field;

    const buttons = [
      { label: "Save", id: "wishlistSave", variant: "brass", w: 86 },
      { label: "Download", id: "wishlistDownload", variant: "ghost", w: 110 },
      { label: "Upload", id: "wishlistUpload", variant: "ghost", w: 90 },
      { label: "Close", id: "wishlistClose", variant: "ghost", w: 86 }
    ];
    let x = 32;
    for (const info of buttons) {
      const b = makeButton({
        width: info.w,
        height: 34,
        label: info.label,
        variant: info.variant,
        fontSize: 11,
        align: "center",
        padding: 0,
        onClick: () => click(info.id)
      });
      b.position.set(x, height - 62);
      shell.root.addChild(b);
      x += info.w + 8;
    }

    shell.sync = (next, time) => {
      field.updateField({
        value: inputValue("wishlistText"),
        focused: next.focused === "wishlistText",
        caret: next.focused === "wishlistText" ? next.caret : 0,
        time
      });
    };
    return shell;
  }

  buildBook(snap) {
    const width = Math.min(940, this.width - 20);
    const height = Math.min(760, this.height - 20);
    const root = new Container();
    root.cardWidth = width;
    root.cardHeight = height;

    const back = makePanel({
      width,
      height,
      radius: 10,
      texture: this.engine.textures.leather,
      textureTint: 0x9a7a58,
      stroke: 0x050302,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: this.engine.textures.shadow,
      shadowAlpha: 0.75
    });
    root.addChild(back);

    const title = makeText("Book of Decay", {
      size: 28,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.giltHi,
      letterSpacing: 0.8,
      shadow: true
    });
    title.position.set(30, 18);
    root.addChild(title);

    const close = makeIconButton({
      size: 32,
      glyph: "✕",
      variant: "ghost",
      onClick: () => click("bookCloseX")
    });
    close.position.set(width - 46, 16);
    root.addChild(close);

    const mobile = width < 760;
    const pageW = mobile ? width - 48 : (width - 78) / 2;
    const pageH = height - 110;
    const left = makeParchmentPage(pageW, pageH, this.engine.textures, { radius: 3 });
    left.position.set(24, 72);
    root.addChild(left);
    const right = makeParchmentPage(pageW, pageH, this.engine.textures, { radius: 3 });
    right.position.set(mobile ? 24 : 24 + pageW + 30, mobile ? 72 : 72);
    right.visible = !mobile;
    root.addChild(right);

    const leftScroll = new ScrollView({ width: pageW - 30, height: pageH - 30, radius: 3, textures: this.engine.textures });
    leftScroll.position.set(39, 87);
    root.addChild(leftScroll);
    this.scrolls.push(leftScroll);

    const rightScroll = new ScrollView({ width: pageW - 30, height: pageH - 30, radius: 3, textures: this.engine.textures });
    rightScroll.position.set(39 + pageW + 30, 87);
    rightScroll.visible = !mobile;
    root.addChild(rightScroll);
    this.scrolls.push(rightScroll);

    const book = snap.book;
    const powers = book ? book.powers : [];
    const sins = book ? book.sins : [];
    const rarityOrder = book ? book.rarityOrder : ["common", "uncommon", "rare"];
    const rarityLabel = book ? book.rarityLabel : { common: "Common", uncommon: "Uncommon", rare: "Rare" };

    let y = 0;
    const heading = makeText("GRAFTS TORN FROM NOUGHT", {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.inkSoft,
      letterSpacing: 1.6
    });
    heading.position.set(0, y);
    leftScroll.content.addChild(heading);
    y += 22;
    for (const rarity of rarityOrder) {
      const label = makeText(rarityLabel[rarity].toUpperCase(), {
        size: 9,
        font: THEME.fontBody,
        weight: "700",
        fill: rarity === "rare" ? 0x8a3a1a : rarity === "uncommon" ? 0x3a5a2a : 0x5a4a2a,
        letterSpacing: 1.4
      });
      label.position.set(0, y);
      leftScroll.content.addChild(label);
      y += 18;
      for (const power of powers.filter((p) => p.rarity === rarity)) {
        const name = makeText(power.name + "  " + (power.category === "plusser" ? "(+)" : "(@)"), {
          size: 12,
          font: THEME.fontDisplay,
          weight: "700",
          fill: THEME.colors.ink
        });
        name.position.set(0, y);
        leftScroll.content.addChild(name);
        y += 16;
        const desc = makeText(power.desc, {
          size: 9,
          font: THEME.fontBody,
          weight: "400",
          fill: THEME.colors.inkSoft,
          wordWrap: true,
          wordWrapWidth: pageW - 42,
          lineHeight: 12
        });
        desc.position.set(0, y);
        leftScroll.content.addChild(desc);
        y += desc.height + 10;
      }
    }
    leftScroll.setContentHeight(y + 10);

    let sy = 0;
    const sinHeading = makeText("SINS", {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.inkSoft,
      letterSpacing: 1.6
    });
    sinHeading.position.set(0, sy);
    rightScroll.content.addChild(sinHeading);
    sy += 22;
    for (const sin of sins) {
      const name = makeText(sin.name, {
        size: 13,
        font: THEME.fontDisplay,
        weight: "700",
        fill: THEME.colors.ink
      });
      name.position.set(0, sy);
      rightScroll.content.addChild(name);
      sy += 18;
      const taunt = makeText(sin.taunt, {
        size: 9,
        font: THEME.fontBody,
        weight: "400",
        fill: THEME.colors.inkSoft,
        wordWrap: true,
        wordWrapWidth: pageW - 42,
        lineHeight: 12
      });
      taunt.position.set(0, sy);
      rightScroll.content.addChild(taunt);
      sy += taunt.height + 6;
      if (Array.isArray(sin.rounds)) {
        sin.rounds.forEach((round, index) => {
          const row = makeText((index + 1) + ". " + round, {
            size: 8,
            font: THEME.fontBody,
            weight: "400",
            fill: 0x5a4328,
            wordWrap: true,
            wordWrapWidth: pageW - 52,
            lineHeight: 11
          });
          row.position.set(8, sy);
          rightScroll.content.addChild(row);
          sy += row.height + 3;
        });
      }
      sy += 8;
    }
    rightScroll.setContentHeight(sy + 10);

    if (mobile) {
      rightScroll.visible = false;
      // On a narrow screen the sins follow the grafts in the single page.
      let my = leftScroll.contentHeight + 18;
      const sinHead = makeText("SINS", {
        size: 9,
        font: THEME.fontBody,
        weight: "700",
        fill: THEME.colors.inkSoft,
        letterSpacing: 1.6
      });
      sinHead.position.set(0, my);
      leftScroll.content.addChild(sinHead);
      my += 22;
      for (const sin of sins) {
        const name = makeText(sin.name, {
          size: 12,
          font: THEME.fontDisplay,
          weight: "700",
          fill: THEME.colors.ink
        });
        name.position.set(0, my);
        leftScroll.content.addChild(name);
        my += 16;
        const taunt = makeText(sin.taunt, {
          size: 9,
          font: THEME.fontBody,
          weight: "400",
          fill: THEME.colors.inkSoft,
          wordWrap: true,
          wordWrapWidth: pageW - 42,
          lineHeight: 12
        });
        taunt.position.set(0, my);
        leftScroll.content.addChild(taunt);
        my += taunt.height + 10;
      }
      leftScroll.setContentHeight(my + 10);
    }

    root.sync = () => {};
    return { root, sync: () => {} };
  }

  buildConfirm(snap) {
    const width = 460;
    const height = 260;
    const shell = makeParchmentCard(this.engine, width, height, {
      title: snap.confirm ? snap.confirm.title : "Confirm",
      onClose: () => click("confirmNo")
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;

    const message = makeText(snap.confirm ? snap.confirm.message : "", {
      size: 12,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.ink,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 17
    });
    message.position.set(32, 96);
    shell.root.addChild(message);

    const yes = makeButton({
      width: 130,
      height: 36,
      label: snap.confirm ? snap.confirm.yes : "Yes",
      variant: "brass",
      fontSize: 12,
      align: "center",
      padding: 0,
      onClick: () => click("confirmYes")
    });
    yes.position.set(32, height - 62);
    shell.root.addChild(yes);

    const no = makeButton({
      width: 110,
      height: 36,
      label: "No",
      variant: "ghost",
      fontSize: 12,
      align: "center",
      padding: 0,
      onClick: () => click("confirmNo")
    });
    no.position.set(174, height - 62);
    shell.root.addChild(no);
    return shell;
  }

  buildContinue(snap) {
    const width = 460;
    const height = 260;
    const shell = makeParchmentCard(this.engine, width, height, {
      title: "Continue run?",
      subtitle: "You have a saved run in progress.",
      onClose: () => click("continueNo")
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;

    const yes = makeButton({
      width: 140,
      height: 38,
      label: "Continue",
      variant: "brass",
      fontSize: 12,
      align: "center",
      padding: 0,
      onClick: () => click("continueYes")
    });
    yes.position.set(32, height - 66);
    shell.root.addChild(yes);

    const no = makeButton({
      width: 140,
      height: 38,
      label: "New run",
      variant: "ghost",
      fontSize: 12,
      align: "center",
      padding: 0,
      onClick: () => click("continueNo")
    });
    no.position.set(184, height - 66);
    shell.root.addChild(no);
    return shell;
  }

  buildAuth(snap) {
    const width = Math.min(480, this.width - 24);
    const height = 590;
    const root = new Container();
    root.cardWidth = width;
    root.cardHeight = height;
    const panel = makePanel({
      width,
      height,
      radius: 10,
      texture: this.engine.textures.leather,
      textureTint: 0xb09478,
      stroke: 0x050302,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: this.engine.textures.shadow,
      shadowAlpha: 0.75
    });
    root.addChild(panel);
    const page = makeParchmentPage(width - 26, height - 26, this.engine.textures, { radius: 3 });
    page.position.set(13, 13);
    root.addChild(page);

    const auth = snap.auth || {};
    const title = makeText(auth.title || "Sign in", {
      size: 26,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink
    });
    title.position.set(32, 24);
    root.addChild(title);

    const close = makeIconButton({
      size: 32,
      glyph: "✕",
      variant: "ghost",
      onClick: () => click("onlineAuthClose")
    });
    close.position.set(width - 48, 18);
    root.addChild(close);

    const note = makeText(auth.note || "", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 14
    });
    note.position.set(32, 58);
    root.addChild(note);

    const tabLogin = makeButton({
      width: 130,
      height: 30,
      label: "Sign in",
      variant: auth.mode === "register" ? "ghost" : "brass",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("onlineAuthTabLogin")
    });
    tabLogin.position.set(32, 106);
    root.addChild(tabLogin);
    const tabRegister = makeButton({
      width: 150,
      height: 30,
      label: "Create account",
      variant: auth.mode === "register" ? "brass" : "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("onlineAuthTabRegister")
    });
    tabRegister.position.set(168, 106);
    root.addChild(tabRegister);

    const handle = makeTextField({
      width: width - 64,
      height: 40,
      label: "Handle",
      value: auth.handle || "",
      placeholder: "3–20 letters, numbers, _ or -",
      size: 14,
      onFocus: () => focusInput("onlineHandle")
    });
    handle.position.set(32, 168);
    root.addChild(handle);
    this.fields.onlineHandle = handle;

    const password = makeTextField({
      width: width - 64,
      height: 40,
      label: "Password",
      value: auth.password || "",
      placeholder: "8–128 characters",
      password: true,
      size: 14,
      onFocus: () => focusInput("onlinePassword")
    });
    password.position.set(32, 228);
    root.addChild(password);
    this.fields.onlinePassword = password;

    let confirm = null;
    if (auth.confirmVisible) {
      confirm = makeTextField({
        width: width - 64,
        height: 40,
        label: "Confirm password",
        value: auth.confirm || "",
        placeholder: "Repeat the password",
        password: true,
        size: 14,
        onFocus: () => focusInput("onlinePasswordConfirm")
      });
      confirm.position.set(32, 288);
      root.addChild(confirm);
      this.fields.onlinePasswordConfirm = confirm;
    }

    const error = makeText(auth.error || "", {
      size: 10,
      font: THEME.fontBody,
      weight: "600",
      fill: 0x8a2a1a,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 13
    });
    error.position.set(32, auth.confirmVisible ? 338 : 288);
    root.addChild(error);

    const perks = new Container();
    perks.position.set(32, 366);
    const perksRule = new Graphics()
      .moveTo(0, 0)
      .lineTo(width - 64, 0)
      .stroke({ width: 1, color: 0x6b4a24, alpha: 0.3 });
    perks.addChild(perksRule);
    const perksTitle = makeText("WHY AN ACCOUNT", {
      size: 8,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.inkSoft,
      letterSpacing: 1.4
    });
    perksTitle.position.set(0, 10);
    perks.addChild(perksTitle);
    const perksText = makeText("Keep your best damage on the global board, sync saves between web and desktop, and claim a guest score when you are ready.", {
      size: 9.5,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 13
    });
    perksText.position.set(0, 26);
    perks.addChild(perksText);
    root.addChild(perks);

    const submit = makeButton({
      width: 170,
      height: 38,
      label: auth.submit || "Sign in",
      variant: "brass",
      fontSize: 11,
      align: "center",
      padding: 0,
      disabled: auth.busy,
      onClick: () => click("onlineAuthSubmit")
    });
    submit.position.set(32, height - 128);
    root.addChild(submit);

    const cancel = makeButton({
      width: 100,
      height: 38,
      label: "Cancel",
      variant: "ghost",
      fontSize: 11,
      align: "center",
      padding: 0,
      onClick: () => click("onlineAuthCancel")
    });
    cancel.position.set(212, height - 128);
    root.addChild(cancel);

    const fine = makeText("No email is required. Accounts use a handle and password.", {
      size: 9,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 12
    });
    fine.position.set(32, height - 70);
    root.addChild(fine);

    const sync = (next, time) => {
      title.text = next.auth ? next.auth.title : "Sign in";
      note.text = next.auth ? next.auth.note : "";
      error.text = next.auth ? next.auth.error : "";
      submit.setText(next.auth ? next.auth.submit : "Sign in");
      submit.alpha = next.auth && next.auth.busy ? 0.5 : 1;
      tabLogin.alpha = next.auth && next.auth.mode === "register" ? 0.55 : 1;
      tabRegister.alpha = next.auth && next.auth.mode === "register" ? 1 : 0.55;
      if (confirm) confirm.visible = Boolean(next.auth && next.auth.confirmVisible);
      error.position.y = next.auth && next.auth.confirmVisible ? 338 : 288;
    };
    return { root, sync };
  }

  buildAccount(snap) {
    const width = Math.min(520, this.width - 24);
    const height = 500;
    const root = new Container();
    root.cardWidth = width;
    root.cardHeight = height;
    const panel = makePanel({
      width,
      height,
      radius: 10,
      texture: this.engine.textures.leather,
      textureTint: 0xb09478,
      stroke: 0x050302,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: this.engine.textures.shadow,
      shadowAlpha: 0.75
    });
    root.addChild(panel);
    const page = makeParchmentPage(width - 26, height - 26, this.engine.textures, { radius: 3 });
    page.position.set(13, 13);
    root.addChild(page);

    const account = snap.account || {};
    const title = makeText("Account", {
      size: 26,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink
    });
    title.position.set(32, 24);
    root.addChild(title);

    const close = makeIconButton({
      size: 32,
      glyph: "✕",
      variant: "ghost",
      onClick: () => click("onlineAccountClose")
    });
    close.position.set(width - 48, 18);
    root.addChild(close);

    const rows = [
      ["Identity", account.identity || "—"],
      ["Global best", account.best || "—"],
      ["Save sync", account.sync || "—"]
    ];
    let y = 78;
    for (const [label, value] of rows) {
      const key = makeText(label.toUpperCase(), {
        size: 9,
        font: THEME.fontBody,
        weight: "700",
        fill: THEME.colors.inkSoft,
        letterSpacing: 1.2
      });
      key.position.set(32, y);
      root.addChild(key);
      const val = makeText(value, {
        size: 13,
        font: THEME.fontBody,
        weight: "600",
        fill: THEME.colors.ink,
        wordWrap: true,
        wordWrapWidth: width - 180,
        lineHeight: 16
      });
      val.position.set(160, y - 3);
      root.addChild(val);
      const line = new Graphics()
        .moveTo(32, y + 22)
        .lineTo(width - 32, y + 22)
        .stroke({ width: 1, color: 0x6b4a24, alpha: 0.18 });
      root.addChild(line);
      y += 44;
    }

    const actions = [
      { label: "Claim guest score", id: "onlineAccountClaim", visible: account.claimVisible },
      { label: "Sync now", id: "onlineAccountSyncNow", visible: true },
      { label: "Sign out", id: "onlineAccountSignOut", visible: true },
      { label: "Delete account", id: "onlineAccountDelete", visible: true }
    ];
    let bx = 32;
    let by = 228;
    for (const info of actions) {
      if (!info.visible) continue;
      const w = Math.min(150, info.label.length * 6.6 + 24);
      if (bx + w > width - 32) {
        bx = 32;
        by += 40;
      }
      const b = makeButton({
        width: w,
        height: 32,
        label: info.label,
        variant: info.id === "onlineAccountDelete" ? "danger" : info.id === "onlineAccountClaim" ? "brass" : "ghost",
        fontSize: 9,
        align: "center",
        padding: 0,
        onClick: () => click(info.id)
      });
      b.position.set(bx, by);
      root.addChild(b);
      bx += w + 8;
    }

    const error = makeText(account.error || "", {
      size: 10,
      font: THEME.fontBody,
      weight: "600",
      fill: 0x8a2a1a,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 13
    });
    error.position.set(32, by + 46);
    root.addChild(error);

    let deleteRow = null;
    let deleteField = null;
    if (account.deleteOpen) {
      deleteRow = new Container();
      const warn = makeText("Type DELETE to confirm. This removes the account, its global score, and its cloud save. The local save stays on this device.", {
        size: 9,
        font: THEME.fontBody,
        weight: "500",
        fill: 0x6a2a1a,
        wordWrap: true,
        wordWrapWidth: width - 64,
        lineHeight: 12
      });
      deleteRow.addChild(warn);
      deleteField = makeTextField({
        width: width - 64,
        height: 36,
        label: "Confirmation",
        value: account.deleteValue || "",
        placeholder: "DELETE",
        size: 13,
        onFocus: () => focusInput("onlineDeleteInput")
      });
      deleteField.position.set(0, 46);
      deleteRow.addChild(deleteField);
      this.fields.onlineDeleteInput = deleteField;
      const confirmBtn = makeButton({
        width: 160,
        height: 34,
        label: "Delete permanently",
        variant: "danger",
        fontSize: 10,
        align: "center",
        padding: 0,
        onClick: () => click("onlineDeleteConfirm")
      });
      confirmBtn.position.set(0, 92);
      deleteRow.addChild(confirmBtn);
      const cancelBtn = makeButton({
        width: 100,
        height: 34,
        label: "Cancel",
        variant: "ghost",
        fontSize: 10,
        align: "center",
        padding: 0,
        onClick: () => click("onlineDeleteCancel")
      });
      cancelBtn.position.set(170, 92);
      deleteRow.addChild(cancelBtn);
      deleteRow.position.set(32, by + 72);
      root.addChild(deleteRow);
    }

    const accountNote = makeText("Cloud saves are account-only. A conflict always asks before overwriting a run. Guest progress stays on this device until claimed.", {
      size: 9,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 13
    });
    accountNote.position.set(32, height - 58);
    root.addChild(accountNote);

    const sync = (next, time) => {
      error.text = next.account ? next.account.error : "";
      if (deleteField && next.account) {
        deleteField.updateField({
          value: inputValue("onlineDeleteInput"),
          focused: next.focused === "onlineDeleteInput",
          caret: next.focused === "onlineDeleteInput" ? next.caret : 0,
          time
        });
      }
    };
    return { root, sync };
  }

  buildChoice(snap) {
    const width = Math.min(500, this.width - 24);
    const height = 330;
    const shell = makeParchmentCard(this.engine, width, height, {
      title: snap.choice ? snap.choice.title : "Choose",
      onClose: () => click("onlineChoiceCancel")
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;

    const message = makeText(snap.choice ? snap.choice.message : "", {
      size: 12,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.ink,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 17
    });
    message.position.set(32, 86);
    shell.root.addChild(message);

    const primary = makeButton({
      width: 150,
      height: 38,
      label: snap.choice ? snap.choice.primary : "Continue",
      variant: "brass",
      fontSize: 11,
      align: "center",
      padding: 0,
      onClick: () => click("onlineChoicePrimary")
    });
    primary.position.set(32, height - 132);
    shell.root.addChild(primary);

    if (snap.choice && snap.choice.secondaryVisible) {
      const secondary = makeButton({
        width: 170,
        height: 38,
        label: snap.choice.secondary,
        variant: "ghost",
        fontSize: 11,
        align: "center",
        padding: 0,
        onClick: () => click("onlineChoiceSecondary")
      });
      secondary.position.set(32, height - 88);
      shell.root.addChild(secondary);
    }

    const cancel = makeButton({
      width: 100,
      height: 34,
      label: "Cancel",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("onlineChoiceCancel")
    });
    cancel.position.set(width - 132, height - 52);
    shell.root.addChild(cancel);
    return shell;
  }

  buildDevTools(snap) {
    const width = Math.min(560, this.width - 24);
    const height = Math.min(640, this.height - 24);
    const shell = makeParchmentCard(this.engine, width, height, {
      title: "Dev tools",
      subtitle: "Testing utilities. Loot weights and reset.",
      onClose: () => click("devCloseX")
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;

    const buttons = [
      { label: "Skip round", id: "devSkip", variant: "brass", w: 120 },
      { label: "Full reset (reload)", id: "devReset", variant: "danger", w: 150 },
      { label: "Toggle log", id: "devToggleLog", variant: "ghost", w: 110 }
    ];
    let x = 32;
    for (const info of buttons) {
      const b = makeButton({
        width: info.w,
        height: 34,
        label: info.label,
        variant: info.variant,
        fontSize: 10,
        align: "center",
        padding: 0,
        onClick: () => click(info.id)
      });
      b.position.set(x, 100);
      shell.root.addChild(b);
      x += info.w + 8;
    }

    const note = makeText("Graft and round controls mirror the DOM dev panel. Use the fields below.", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width - 64,
      lineHeight: 14
    });
    note.position.set(32, 154);
    shell.root.addChild(note);

    const roundField = makeTextField({
      width: 120,
      height: 36,
      label: "Round (Endless)",
      value: inputValue("devRoundInput"),
      placeholder: "1",
      size: 13,
      onFocus: () => focusInput("devRoundInput")
    });
    roundField.position.set(32, 220);
    shell.root.addChild(roundField);
    this.fields.devRoundInput = roundField;

    const apply = makeButton({
      width: 100,
      height: 36,
      label: "Apply round",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => click("devRoundApply")
    });
    apply.position.set(164, 220);
    shell.root.addChild(apply);

    const graftLabel = makeText("GRAFTS", {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.inkSoft,
      letterSpacing: 1.4
    });
    graftLabel.position.set(32, 282);
    shell.root.addChild(graftLabel);

    const graftScroll = new ScrollView({ width: width - 64, height: height - 380, radius: 3, textures: this.engine.textures });
    graftScroll.position.set(32, 302);
    shell.root.addChild(graftScroll);
    this.scrolls.push(graftScroll);

    const select = document.getElementById("devGraftSelect");
    const options = select ? Array.from(select.options) : [];
    let gy = 0;
    for (const option of options) {
      const b = makeButton({
        width: width - 78,
        height: 28,
        label: option.textContent,
        variant: "ghost",
        fontSize: 10,
        align: "left",
        padding: 10,
        onClick: () => {
          if (select) {
            select.value = option.value;
            click("devGraftAdd");
          }
        }
      });
      b.position.set(0, gy);
      graftScroll.content.addChild(b);
      gy += 32;
    }
    graftScroll.setContentHeight(gy + 4);

    shell.sync = (next, time) => {
      roundField.updateField({
        value: inputValue("devRoundInput"),
        focused: next.focused === "devRoundInput",
        caret: next.focused === "devRoundInput" ? next.caret : 0,
        time
      });
    };
    return shell;
  }

  buildGeneric(snap) {
    const width = Math.min(460, this.width - 24);
    const height = 240;
    const shell = makeParchmentCard(this.engine, width, height, {
      title: "Notice",
      onClose: () => {}
    });
    shell.root.cardWidth = width;
    shell.root.cardHeight = height;
    return shell;
  }
}
