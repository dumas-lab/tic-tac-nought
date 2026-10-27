import { Container, Graphics, Sprite } from "pixi.js";
import { THEME } from "../theme.js";
import {
  makeButton,
  makeIconButton,
  makePanel,
  makeParchmentPage,
  makeSectionLabel,
  makeSlider,
  makeText,
  makeToggle,
  ScrollView
} from "../ui.js";
import { Scene } from "./base.js";
import {
  addSoundLayer,
  click,
  inputValue,
  previewSoundSlot,
  removeSoundLayer,
  setCheckbox,
  setRange,
  setSoundSlot,
  soundSlotOptions
} from "../state.js";

const BAND_LABELS = {
  low: "1–9 points",
  mid: "10–99 points",
  high: "100–999 points",
  top: "1,000+ points"
};

const BAND_HINTS = {
  low: "base layer",
  mid: "adds on top",
  high: "adds on top",
  top: "adds on top"
};

function soundSignature(sound) {
  if (!sound) return "none";
  return JSON.stringify({
    volume: sound.volume,
    muted: sound.muted,
    bands: sound.bands,
    canAdd: sound.canAdd
  });
}

export class OptionsScene extends Scene {
  constructor(engine) {
    super(engine);
    this.layoutMode = "";
    this.layoutKey = "";
    this.soundSignature = "";
    this.settingsHeight = 0;
    this.soundHeight = 0;
    this.soundContentWidth = 0;
    this.soundTop = 0;
    this.scrolls = [];
    this.controls = {};
    this.buildHeader();
  }

  buildHeader() {
    const e = this.engine;
    this.header = new Container();
    this.root.addChild(this.header);

    this.headerWood = new Sprite(e.textures.woodDark);
    this.headerWood.tint = 0xd0b088;
    this.header.addChild(this.headerWood);
    this.headerMask = new Graphics();
    this.headerWood.mask = this.headerMask;
    this.header.addChild(this.headerMask);

    this.headerBorder = new Graphics();
    this.header.addChild(this.headerBorder);

    this.backBtn = makeButton({
      width: 104,
      height: 34,
      label: "← Back",
      variant: "ghost",
      fontSize: 11,
      align: "center",
      padding: 0,
      onClick: () => click("optionsBack")
    });
    this.header.addChild(this.backBtn);

    this.titleText = makeText("Options", {
      size: 27,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.giltHi,
      anchorX: 0.5,
      anchorY: 0.32,
      letterSpacing: 1,
      shadow: true
    });
    this.header.addChild(this.titleText);

    this.subtitleText = makeText("THE TABLE REMEMBERS", {
      size: 8,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.boneDim,
      anchorX: 0.5,
      anchorY: 0.5,
      letterSpacing: 2.4
    });
    this.header.addChild(this.subtitleText);

    this.versionText = makeText("", {
      size: 8,
      font: THEME.fontBody,
      weight: "600",
      fill: THEME.colors.boneDim,
      anchorX: 1,
      anchorY: 0.5,
      letterSpacing: 1.4,
      alpha: 0.7
    });
    this.header.addChild(this.versionText);

    this.folder = new Container();
    this.root.addChild(this.folder);
  }

  update(snapshot) {
    if (!snapshot) return;
    this.snapshot = snapshot;
    const online = Boolean(snapshot.onlineEnabled);
    const key = `${Math.round(this.width)}x${Math.round(this.height)}:${online ? "online" : "local"}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.buildLayout(snapshot);
    }
    this.syncControls(snapshot);
    const nextSoundSignature = soundSignature(snapshot.sound);
    if (nextSoundSignature !== this.soundSignature) {
      this.soundSignature = nextSoundSignature;
      this.renderSound(snapshot.sound);
    }
    this.versionText.text = (snapshot.menuEyebrow || "PRE-ALPHA 0.3.3").toUpperCase();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.layoutKey = "";
    if (this.snapshot) this.update(this.snapshot);
  }

  buildLayout(snapshot) {
    const e = this.engine;
    const mobile = this.width < 760;
    const desktop = this.width >= 1080;
    this.layoutMode = mobile ? "mobile" : desktop ? "desktop" : "compact";
    this.scrolls = [];
    this.controls = {};
    this.folder.removeChildren().forEach((child) => child.destroy({ children: true }));

    const margin = mobile ? 8 : 20;
    const headerH = mobile ? 52 : 60;
    const headerW = this.width - margin * 2;
    this.header.position.set(margin, margin);

    this.headerWood.width = headerW;
    this.headerWood.height = headerH;
    this.headerMask.clear().roundRect(0, 0, headerW, headerH, 8).fill(0xffffff);
    this.headerBorder.clear();
    this.headerBorder
      .roundRect(0.5, 0.5, headerW - 1, headerH - 1, 8)
      .stroke({ width: 2, color: 0x050302 })
      .roundRect(4.5, 4.5, headerW - 9, headerH - 9, 5)
      .stroke({ width: 1, color: THEME.colors.giltLo, alpha: 0.45 });

    this.backBtn.position.set(10, (headerH - 34) / 2);
    this.titleText.position.set(headerW / 2, headerH * 0.4);
    this.subtitleText.position.set(headerW / 2, headerH * 0.78);
    this.versionText.position.set(headerW - 12, headerH / 2);

    const folderY = margin + headerH + (mobile ? 8 : 12);
    const folderW = Math.max(280, Math.min(this.width - margin * 2, 1180));
    const folderH = Math.max(260, this.height - folderY - margin);
    this.folder.position.set((this.width - folderW) / 2, folderY);

    const backdrop = makePanel({
      width: folderW,
      height: folderH,
      radius: 14,
      texture: e.textures.leather,
      textureTint: 0xb69a78,
      stroke: 0x050302,
      innerStroke: THEME.colors.giltLo,
      shadow: true,
      shadowTexture: e.textures.shadow,
      shadowAlpha: 0.7
    });
    this.folder.addChild(backdrop);

    const trim = new Graphics()
      .roundRect(6, 6, folderW - 12, folderH - 12, 10)
      .stroke({ width: 1, color: THEME.colors.gilt, alpha: 0.22 });
    this.folder.addChild(trim);

    if (this.layoutMode === "desktop") {
      const gap = 14;
      const inset = 20;
      const pageW = (folderW - inset * 2 - gap) / 2;
      const pageH = folderH - inset * 2;
      const leftPage = makeParchmentPage(pageW, pageH, e.textures, { radius: 4 });
      leftPage.position.set(inset, inset);
      this.folder.addChild(leftPage);
      const rightPage = makeParchmentPage(pageW, pageH, e.textures, { radius: 4 });
      rightPage.position.set(inset + pageW + gap, inset);
      this.folder.addChild(rightPage);

      const contentW = pageW - 60;
      const leftScroll = new ScrollView({ width: contentW + 12, height: pageH - 48, radius: 3, textures: e.textures });
      leftScroll.position.set(inset + 24, inset + 24);
      this.folder.addChild(leftScroll);
      this.scrolls.push(leftScroll);
      const leftContent = new Container();
      leftScroll.content.addChild(leftContent);
      this.settingsHeight = this.buildSettings(leftContent, contentW, snapshot);

      const rightScroll = new ScrollView({ width: contentW + 12, height: pageH - 48, radius: 3, textures: e.textures });
      rightScroll.position.set(inset + pageW + gap + 24, inset + 24);
      this.folder.addChild(rightScroll);
      this.scrolls.push(rightScroll);
      const rightContent = new Container();
      rightScroll.content.addChild(rightContent);
      this.soundContentWidth = contentW;
      this.soundTop = 0;
      this.soundHeight = this.buildSound(rightContent, contentW, snapshot);
      this.mainScroll = null;
      this.leftScroll = leftScroll;
      this.rightScroll = rightScroll;
      this.updateScrollHeights();
    } else {
      const inset = mobile ? 8 : 14;
      const pageW = folderW - inset * 2;
      const pageH = folderH - inset * 2;
      const page = makeParchmentPage(pageW, pageH, e.textures, { radius: 4 });
      page.position.set(inset, inset);
      this.folder.addChild(page);

      const contentW = pageW - (mobile ? 44 : 56);
      const scroll = new ScrollView({
        width: contentW + 12,
        height: pageH - (mobile ? 28 : 40),
        radius: 3,
        textures: e.textures
      });
      scroll.position.set(inset + (mobile ? 16 : 22), inset + (mobile ? 14 : 20));
      this.folder.addChild(scroll);
      this.scrolls.push(scroll);
      const content = new Container();
      scroll.content.addChild(content);
      this.settingsHeight = this.buildSettings(content, contentW, snapshot);
      this.soundContentWidth = contentW;
      this.soundTop = this.settingsHeight + 24;
      const soundDivider = new Graphics()
        .moveTo(0, this.soundTop - 12)
        .lineTo(contentW, this.soundTop - 12)
        .stroke({ width: 1, color: 0x6b4a24, alpha: 0.3 });
      content.addChild(soundDivider);
      const soundRoot = new Container();
      soundRoot.position.set(0, this.soundTop);
      content.addChild(soundRoot);
      this.soundHeight = this.buildSound(soundRoot, contentW, snapshot);
      this.mainScroll = scroll;
      this.leftScroll = null;
      this.rightScroll = null;
      this.updateScrollHeights();
    }
  }

  buildSettings(parent, width, snapshot) {
    const e = this.engine;
    let y = 0;
    const title = makeText("Table settings", {
      size: 22,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink,
      letterSpacing: 0.3
    });
    title.position.set(0, y);
    parent.addChild(title);
    y += 30;
    const sub = makeText("Volume, tooling, and save transfer.", {
      size: 10,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.inkSoft
    });
    sub.position.set(0, y);
    parent.addChild(sub);
    y += 30;

    const settings = snapshot.options || {};
    const volume = Number(settings.volume ?? inputValue("volume") ?? 70);
    const volumeLabel = makeText("VOLUME", {
      size: 9,
      font: THEME.fontBody,
      weight: "700",
      fill: THEME.colors.inkSoft,
      letterSpacing: 1.8
    });
    volumeLabel.position.set(0, y);
    parent.addChild(volumeLabel);
    const volumeValue = makeText(`${Math.round(volume)}%`, {
      size: 12,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink,
      anchorX: 1,
      anchorY: 0
    });
    volumeValue.position.set(width, y - 1);
    parent.addChild(volumeValue);

    const slider = makeSlider({
      width,
      value: volume,
      onChange: (next) => {
        volumeValue.text = `${next}%`;
        setRange("volume", next);
        this.engine.scheduleSnapshot();
      }
    });
    slider.position.set(0, y + 20);
    parent.addChild(slider);

    const mute = makeToggle({
      width: 42,
      height: 22,
      checked: Boolean(settings.muted),
      onChange: (next) => {
        setCheckbox("mute", next);
        this.engine.scheduleSnapshot();
      }
    });
    mute.position.set(0, y + 54);
    parent.addChild(mute);
    const muteLabel = makeText("Mute all score layers", {
      size: 11,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.ink,
      anchorY: 0.5
    });
    muteLabel.position.set(52, y + 65);
    parent.addChild(muteLabel);
    this.controls.volumeValue = volumeValue;
    this.controls.slider = slider;
    this.controls.mute = mute;

    y += 92;
    const divider = new Graphics()
      .moveTo(0, y)
      .lineTo(width, y)
      .stroke({ width: 1, color: 0x6b4a24, alpha: 0.3 });
    parent.addChild(divider);
    y += 18;

    const devLabel = makeSectionLabel("Dev tools", { width, color: THEME.colors.inkSoft, size: 9 });
    devLabel.position.set(0, y);
    parent.addChild(devLabel);
    y += 26;
    const devToggle = makeToggle({
      width: 42,
      height: 22,
      checked: Boolean(snapshot.devToolsEnabled),
      onChange: (next) => {
        setCheckbox("devToolsToggle", next);
        this.engine.scheduleSnapshot();
      }
    });
    devToggle.position.set(0, y);
    parent.addChild(devToggle);
    const devText = makeText("Show the testing toolbar", {
      size: 11,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.ink,
      anchorY: 0.5
    });
    devText.position.set(52, y + 11);
    parent.addChild(devText);
    const devOpen = makeButton({
      width: 120,
      height: 28,
      label: "Open dev tools",
      variant: "ghost",
      fontSize: 9,
      align: "center",
      padding: 0,
      onClick: () => {
        click("devToolsBtn");
        this.engine.scheduleSnapshot();
      }
    });
    devOpen.position.set(Math.max(0, width - 120), y - 3);
    devOpen.visible = Boolean(snapshot.devToolsEnabled);
    parent.addChild(devOpen);
    this.controls.devToggle = devToggle;
    this.controls.devOpen = devOpen;

    y += 50;
    const saveLabel = makeSectionLabel("Save data", { width, color: THEME.colors.inkSoft, size: 9 });
    saveLabel.position.set(0, y);
    parent.addChild(saveLabel);
    y += 26;
    const exportBtn = makeButton({
      width: Math.min(122, (width - 8) / 2),
      height: 30,
      label: "Export save",
      variant: "wood",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => {
        click("exportSave");
        this.engine.scheduleSnapshot();
      }
    });
    exportBtn.position.set(0, y);
    parent.addChild(exportBtn);
    const importBtn = makeButton({
      width: Math.min(122, (width - 8) / 2),
      height: 30,
      label: "Import save",
      variant: "ghost",
      fontSize: 10,
      align: "center",
      padding: 0,
      onClick: () => {
        click("importSave");
        this.engine.scheduleSnapshot();
      }
    });
    importBtn.position.set(exportBtn.width + 8, y);
    parent.addChild(importBtn);
    y += 40;
    const saveNote = makeText("Export moves run progress, the damage ledger, and sound settings between web and desktop.", {
      size: 9,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 12
    });
    saveNote.position.set(0, y);
    parent.addChild(saveNote);
    y += saveNote.height + 14;

    const helpDivider = new Graphics()
      .moveTo(0, y)
      .lineTo(width, y)
      .stroke({ width: 1, color: 0x6b4a24, alpha: 0.3 });
    parent.addChild(helpDivider);
    y += 18;

    const playLabel = makeSectionLabel("At the table", { width, color: THEME.colors.inkSoft, size: 9 });
    playLabel.position.set(0, y);
    parent.addChild(playLabel);
    y += 26;
    const playText = makeText("Tap a recess to place X. Build lines to damage Nought. Every three completed rounds grants a graft. Observation previews Nought's likely reply while it is active.", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 14
    });
    playText.position.set(0, y);
    parent.addChild(playText);
    y += playText.height + 16;

    const accessLabel = makeSectionLabel("Accessibility", { width, color: THEME.colors.inkSoft, size: 9 });
    accessLabel.position.set(0, y);
    parent.addChild(accessLabel);
    y += 26;
    const accessText = makeText("Reduced motion turns off idle animation and infection drift. Every canvas control mirrors a focusable DOM control for keyboard and screen-reader use.", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 14
    });
    accessText.position.set(0, y);
    parent.addChild(accessText);
    y += accessText.height + 16;

    const aboutLabel = makeSectionLabel("About", { width, color: THEME.colors.inkSoft, size: 9 });
    aboutLabel.position.set(0, y);
    parent.addChild(aboutLabel);
    y += 26;
    const aboutText = makeText("Tic Tac Nought 0.3.3 — a carved table that keeps growing. Built with PixiJS. Fonts: Cinzel and Source Sans 3 (OFL). Sounds: Kenney and WobbleBoxx (CC0).", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 14
    });
    aboutText.position.set(0, y);
    parent.addChild(aboutText);
    y += aboutText.height + 16;

    if (snapshot.onlineEnabled) {
      const accountLabel = makeSectionLabel("Account", { width, color: THEME.colors.inkSoft, size: 9 });
      accountLabel.position.set(0, y);
      parent.addChild(accountLabel);
      y += 26;
      const accountValue = makeText(settings.account || "Not signed in", {
        size: 12,
        font: THEME.fontBody,
        weight: "600",
        fill: THEME.colors.ink,
        wordWrap: true,
        wordWrapWidth: Math.max(100, width - 100),
        lineHeight: 15
      });
      accountValue.position.set(0, y);
      parent.addChild(accountValue);
      const accountBtn = makeButton({
        width: 90,
        height: 28,
        label: settings.signedIn ? "Account" : "Sign in",
        variant: "ghost",
        fontSize: 9,
        align: "center",
        padding: 0,
        onClick: () => {
          click("onlineOptionsAccountBtn");
          this.engine.scheduleSnapshot();
        }
      });
      accountBtn.position.set(Math.max(0, width - 90), y - 3);
      parent.addChild(accountBtn);
      y += Math.max(30, accountValue.height + 12);

      const syncLabel = makeSectionLabel("Save sync", { width, color: THEME.colors.inkSoft, size: 9 });
      syncLabel.position.set(0, y);
      parent.addChild(syncLabel);
      y += 26;
      const syncValue = makeText(settings.sync || "Sign in to sync saves.", {
        size: 10,
        font: THEME.fontBody,
        weight: "500",
        fill: THEME.colors.inkSoft,
        wordWrap: true,
        wordWrapWidth: Math.max(100, width - 100),
        lineHeight: 13
      });
      syncValue.position.set(0, y);
      parent.addChild(syncValue);
      const syncBtn = makeButton({
        width: 90,
        height: 28,
        label: "Sync now",
        variant: "ghost",
        fontSize: 9,
        align: "center",
        padding: 0,
        disabled: Boolean(settings.syncDisabled),
        onClick: () => {
          click("onlineSyncNow");
          this.engine.scheduleSnapshot();
        }
      });
      syncBtn.position.set(Math.max(0, width - 90), y - 3);
      parent.addChild(syncBtn);
      y += Math.max(30, syncValue.height + 12);

      const syncNote = makeText(
        settings.guest
          ? "Guests can submit scores but cannot sync saves. Claim the guest identity from the Account screen."
          : "Save sync is for accounts only. A conflict always asks before overwriting a run.",
        {
          size: 9,
          font: THEME.fontBody,
          weight: "400",
          fill: THEME.colors.inkSoft,
          wordWrap: true,
          wordWrapWidth: width,
          lineHeight: 12
        }
      );
      syncNote.position.set(0, y);
      parent.addChild(syncNote);
      y += syncNote.height + 12;
      this.controls.accountValue = accountValue;
      this.controls.accountBtn = accountBtn;
      this.controls.syncValue = syncValue;
      this.controls.syncBtn = syncBtn;
    }

    this.controls.settingsBottom = y;
    return y;
  }

  buildSound(parent, width, snapshot) {
    const title = makeText("Score sounds", {
      size: 22,
      font: THEME.fontDisplay,
      weight: "700",
      fill: THEME.colors.ink,
      letterSpacing: 0.3
    });
    title.position.set(0, 0);
    parent.addChild(title);
    const sub = makeText("Layered stings. Higher bands add their layers on top of the lower bands.", {
      size: 10,
      font: THEME.fontBody,
      weight: "500",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 14
    });
    sub.position.set(0, 30);
    parent.addChild(sub);

    this.soundRows = new Container();
    this.soundRows.position.set(0, 68);
    parent.addChild(this.soundRows);
    this.soundContentWidth = width;
    this.soundSignature = "";
    this.renderSound(snapshot.sound);
    return 68 + this.soundRowsHeight + 20;
  }

  renderSound(sound) {
    if (!this.soundRows) return;
    this.soundRows.removeChildren().forEach((child) => child.destroy({ children: true }));
    const width = this.soundContentWidth;
    let y = 0;
    const bands = sound && sound.bands ? sound.bands : { low: [], mid: [], high: [], top: [] };
    const canAdd = new Map();
    if (sound && Array.isArray(sound.canAdd)) {
      for (const item of sound.canAdd) canAdd.set(item.band, Boolean(item.disabled));
    }

    for (const band of ["low", "mid", "high", "top"]) {
      const slots = Array.isArray(bands[band]) ? bands[band] : [];
      const head = makeText(BAND_LABELS[band].toUpperCase(), {
        size: 10,
        font: THEME.fontBody,
        weight: "700",
        fill: THEME.colors.ink,
        letterSpacing: 1.4
      });
      head.position.set(0, y);
      this.soundRows.addChild(head);
      const hint = makeText(BAND_HINTS[band].toUpperCase(), {
        size: 7,
        font: THEME.fontBody,
        weight: "700",
        fill: THEME.colors.inkSoft,
        letterSpacing: 1.1
      });
      hint.position.set(head.width + 8, y + 2);
      this.soundRows.addChild(hint);

      const addBtn = makeButton({
        width: 78,
        height: 24,
        label: "+ layer",
        variant: "ghost",
        fontSize: 9,
        align: "center",
        padding: 0,
        disabled: canAdd.get(band) ?? slots.length >= 4,
        onClick: () => {
          addSoundLayer(band);
          this.engine.scheduleSnapshot();
        }
      });
      addBtn.position.set(Math.max(0, width - 78), y - 5);
      this.soundRows.addChild(addBtn);
      y += 26;

      if (!slots.length) {
        const empty = makeText("Silent — add a layer to use this band.", {
          size: 9,
          font: THEME.fontBody,
          weight: "400",
          fill: THEME.colors.inkSoft
        });
        empty.position.set(0, y + 2);
        this.soundRows.addChild(empty);
        y += 24;
      }

      for (const slot of slots) {
        const row = new Container();
        row.position.set(0, y);
        const bg = new Graphics()
          .roundRect(0, 0, width, 30, 4)
          .fill({ color: 0x2a1a0e, alpha: 0.08 })
          .stroke({ width: 1, color: 0x6b4a24, alpha: 0.22 });
        row.addChild(bg);
        const label = makeText(slot.label || "None", {
          size: 10,
          font: THEME.fontBody,
          weight: "600",
          fill: slot.value ? THEME.colors.ink : THEME.colors.inkSoft,
          wordWrap: false
        });
        label.position.set(8, 8);
        label.mask = new Graphics().rect(8, 2, Math.max(40, width - 126), 26).fill(0xffffff);
        row.addChild(label, label.mask);
        const clipWidth = Math.max(40, width - 126);

        const previous = makeButton({
          width: 24,
          height: 24,
          label: "<",
          variant: "ghost",
          fontSize: 11,
          align: "center",
          padding: 0,
          onClick: () => this.cycleSlot(slot.band || band, slot.index, -1, slot.value)
        });
        previous.position.set(width - 116, 3);
        row.addChild(previous);
        const next = makeButton({
          width: 24,
          height: 24,
          label: ">",
          variant: "ghost",
          fontSize: 11,
          align: "center",
          padding: 0,
          onClick: () => this.cycleSlot(slot.band || band, slot.index, 1, slot.value)
        });
        next.position.set(width - 88, 3);
        row.addChild(next);
        const preview = makeButton({
          width: 24,
          height: 24,
          label: "▶",
          variant: "ghost",
          fontSize: 9,
          align: "center",
          padding: 0,
          disabled: !slot.value,
          onClick: () => {
            previewSoundSlot(band, slot.index);
            this.engine.scheduleSnapshot();
          }
        });
        preview.position.set(width - 60, 3);
        row.addChild(preview);
        const remove = makeButton({
          width: 24,
          height: 24,
          label: "×",
          variant: "ghost",
          fontSize: 10,
          align: "center",
          padding: 0,
          onClick: () => {
            removeSoundLayer(band, slot.index);
            this.engine.scheduleSnapshot();
          }
        });
        remove.position.set(width - 32, 3);
        row.addChild(remove);
        this.soundRows.addChild(row);
        y += 34;
      }
      y += 10;
    }

    const note = makeText("Sounds: Kenney Interface Sounds and WobbleBoxx (CC0). No attribution required.", {
      size: 8,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 11
    });
    note.position.set(0, y);
    this.soundRows.addChild(note);
    y += note.height + 16;

    const mixLabel = makeSectionLabel("Mix notes", { width, color: THEME.colors.inkSoft, size: 9 });
    mixLabel.position.set(0, y);
    this.soundRows.addChild(mixLabel);
    y += 26;
    const mixText = makeText("Each band layers its selected stings over the lower bands. Mute silences the table without changing the mix. Preview a clip before assigning it.", {
      size: 10,
      font: THEME.fontBody,
      weight: "400",
      fill: THEME.colors.inkSoft,
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: 14
    });
    mixText.position.set(0, y);
    this.soundRows.addChild(mixText);
    y += mixText.height + 8;
    this.soundRowsHeight = y;
    this.updateScrollHeights();
  }

  cycleSlot(band, index, direction, currentValue) {
    const options = soundSlotOptions(band, index);
    if (!options.length) return;
    let position = options.findIndex((option) => option.value === (currentValue || ""));
    if (position < 0) position = 0;
    const next = options[(position + direction + options.length) % options.length];
    if (!next) return;
    setSoundSlot(band, index, next.value);
    this.engine.scheduleSnapshot();
  }

  syncControls(snapshot) {
    const settings = snapshot.options || {};
    if (this.controls.slider) {
      this.controls.slider.setValue(Number(settings.volume ?? inputValue("volume") ?? 70));
    }
    if (this.controls.volumeValue) {
      this.controls.volumeValue.text = `${Math.round(Number(settings.volume ?? inputValue("volume") ?? 70))}%`;
    }
    if (this.controls.mute) this.controls.mute.setValue(Boolean(settings.muted));
    if (this.controls.devToggle) this.controls.devToggle.setValue(Boolean(snapshot.devToolsEnabled));
    if (this.controls.devOpen) this.controls.devOpen.visible = Boolean(snapshot.devToolsEnabled);
    if (this.controls.accountValue) {
      this.controls.accountValue.text = settings.account || "Not signed in";
    }
    if (this.controls.accountBtn) {
      this.controls.accountBtn.setText(settings.signedIn ? "Account" : "Sign in");
    }
    if (this.controls.syncValue) {
      this.controls.syncValue.text = settings.sync || "Sign in to sync saves.";
    }
    if (this.controls.syncBtn) {
      this.controls.syncBtn.alpha = settings.syncDisabled ? 0.45 : 1;
      this.controls.syncBtn.cursor = settings.syncDisabled ? "default" : "pointer";
    }
  }

  updateScrollHeights() {
    if (!this.soundRowsHeight) this.soundRowsHeight = 0;
    if (this.layoutMode === "desktop") {
      if (this.leftScroll) this.leftScroll.setContentHeight(this.settingsHeight + 20);
      if (this.rightScroll) this.rightScroll.setContentHeight(68 + this.soundRowsHeight + 24);
    } else if (this.mainScroll) {
      this.mainScroll.setContentHeight(this.settingsHeight + 24 + 68 + this.soundRowsHeight + 30);
    }
  }

  tick(dt) {
    this.time += dt;
    for (const scroll of this.scrolls) scroll.drawScrollbar();
  }
}
