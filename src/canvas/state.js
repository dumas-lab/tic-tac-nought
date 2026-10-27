export function game() {
  return window.TTNState || null;
}

export function online() {
  return window.TTNOnline || null;
}

export function byId(id) {
  return document.getElementById(id);
}

export function textOf(id) {
  const el = byId(id);
  return el ? el.textContent.trim() : "";
}

export function isOpen(id) {
  const el = byId(id);
  return Boolean(el && !el.hidden);
}

export function activeModal() {
  const ids = [
    "onlineAuthModal",
    "onlineAccountModal",
    "onlineChoiceModal",
    "bookModal",
    "difficultyModal",
    "wishlistModal",
    "devToolsModal",
    "continueModal",
    "confirmModal"
  ];
  for (const id of ids) {
    if (isOpen(id)) return id;
  }
  return null;
}

export function screenName() {
  const s = game();
  return s ? s.screen : "menu";
}

export function click(id) {
  const el = byId(id);
  if (el) el.click();
}

export function clickSelector(selector) {
  const el = document.querySelector(selector);
  if (el) el.click();
}

export function focusInput(id) {
  const el = byId(id);
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

export function inputValue(id) {
  const el = byId(id);
  return el ? el.value : "";
}

export function setInputValue(id, value) {
  const el = byId(id);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function activeInputId() {
  const active = document.activeElement;
  return active && active.id ? active.id : "";
}

export function caretIndex(id) {
  const el = byId(id);
  if (!el) return 0;
  try {
    return el.selectionStart || 0;
  } catch {
    return 0;
  }
}

export function setCheckbox(id, checked) {
  const el = byId(id);
  if (!el) return;
  el.checked = Boolean(checked);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function setRange(id, value) {
  const el = byId(id);
  if (!el) return;
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function timeAgo(value) {
  if (!value) return "just now";
  const diff = Math.max(0, Date.now() - Number(value));
  if (diff < 45_000) return "just now";
  if (diff < 3_600_000) return Math.max(1, Math.round(diff / 60_000)) + "m ago";
  if (diff < 86_400_000) return Math.max(1, Math.round(diff / 3_600_000)) + "h ago";
  return Math.max(1, Math.round(diff / 86_400_000)) + "d ago";
}

export function snapshot() {
  const s = game();
  if (!s) return null;
  const modal = activeModal();
  const o = online();
  const globalBoard = o ? o.debug.board() : null;
  const globalRows = globalBoard && Array.isArray(globalBoard.rows) ? Array.from(globalBoard.rows) : [];
  const toastEl = byId("toast");
  let globalHint = "";
  if (globalBoard) {
    if (globalBoard.loading && !globalRows.length) globalHint = "Loading the global board…";
    else if (globalBoard.error) globalHint = globalBoard.error;
    else if (!globalRows.length) globalHint = "No global scores yet. Finish an Endless run to open the board.";
    else globalHint = "Top 50 · updated " + timeAgo(globalBoard.updatedAt) + " · refreshes every 30s while visible";
  }
  return {
    screen: s.screen,
    modal,
    onlineEnabled: Boolean(o && o.enabled),
    onlineSignedIn: Boolean(o && o.debug.session()),
    onlineGuest: Boolean(o && o.debug.session() && o.debug.session().user && o.debug.session().user.isAnonymous),
    globalRows,
    globalMe: globalBoard ? globalBoard.me : null,
    globalLoading: Boolean(globalBoard && globalBoard.loading),
    globalError: globalBoard ? globalBoard.error || "" : "",
    globalHint,
    globalUpdatedAt: globalBoard ? globalBoard.updatedAt || 0 : 0,
    devToolsEnabled: byId("devToolsBtn") ? byId("devToolsBtn").style.display !== "none" : false,
    toast: toastEl ? toastEl.textContent.trim() : "",
    toastVisible: toastEl ? toastEl.classList.contains("show") : false,
    toastRarity: toastEl && toastEl.className.includes("rarity-") ? toastEl.className.split("rarity-")[1].split(" ")[0] : "",
    mode: s.mode,
    board: Array.from(s.board || []),
    turn: s.turn,
    gameOver: s.gameOver,
    result: s.result,
    winLine: Array.from(s.winLine || []),
    run: s.run,
    erupted: s.erupted,
    eruptedSession: s.eruptedSession,
    currentSin: s.currentSin,
    sinOrder: s.sinOrder,
    eatenCells: new Set(s.eatenCells || []),
    previewIndex: s.previewIndex,
    previewReply: s.previewReply,
    previewReplyThreat: s.previewReplyThreat,
    previewWin: s.previewWin,
    scores: s.scores,
    leaderboard: s.leaderboard,
    storyProgress: s.storyProgress,
    noughtDamage: s.noughtDamage,
    noughtDamageTarget: s.noughtDamageTarget,
    awaitingNext: s.awaitingNext,
    pendingGrowth: s.pendingGrowth,
    aterArmed: s.aterArmed,
    status: textOf("status"),
    saveHint: textOf("saveHint"),
    gameModeLabel: textOf("gameModeLabel"),
    menuRunNote: textOf("menuRunNote"),
    runScore: textOf("runScore"),
    xpLevel: textOf("xpLevel"),
    xpNext: textOf("xpNext"),
    xpFill: byId("xpFill") ? byId("xpFill").style.width : "0%",
    runRound: textOf("runRound"),
    runBoard: textOf("runBoard"),
    powerMeta: textOf("powerMeta"),
    powerEmpty: byId("powerEmpty") && !byId("powerEmpty").hidden ? textOf("powerEmpty") : "",
    onlineBar: textOf("onlineBarIdentity"),
    onlineAction: textOf("onlineBarAction"),
    onlineRunStatus: textOf("onlineRunStatus"),
    onlineRunActions: byId("onlineRunActions") ? byId("onlineRunActions").children.length : 0,
    onlineRunButtons: byId("onlineRunActions")
      ? Array.from(byId("onlineRunActions").querySelectorAll("button")).map((button) => ({
          label: button.textContent,
          className: button.className,
          disabled: button.disabled
        }))
      : [],
    menuErupted: byId("menuScreen") ? byId("menuScreen").classList.contains("erupted") : false,
    menuTag: byId("menuScreen") && byId("menuScreen").querySelector(".menu-tag")
      ? byId("menuScreen").querySelector(".menu-tag").textContent.trim()
      : "",
    menuEyebrow: byId("menuScreen") && byId("menuScreen").querySelector(".eyebrow")
      ? byId("menuScreen").querySelector(".eyebrow").textContent.trim()
      : "",
    auth: readAuth(),
    account: readAccount(),
    book: readBook(),
    options: readOptions(),
    wishlist: inputValue("wishlistText"),
    powerCards: powerCards(),
    confirm: readConfirm(),
    choice: readChoice(),
    sound: readSound(),
    focused: activeInputId(),
    caret: caretIndex(activeInputId()),
    difficulty: {
      easy: textOf("diffEasyStatus"),
      medium: textOf("diffMedStatus"),
      hard: textOf("diffHardStatus")
    }
  };
}

function readConfirm() {
  const modal = byId("confirmModal");
  if (!modal || modal.hidden) return null;
  return {
    title: textOf("confirmTitle"),
    message: textOf("confirmMsg"),
    yes: textOf("confirmYes")
  };
}

function readChoice() {
  const modal = byId("onlineChoiceModal");
  if (!modal || modal.hidden) return null;
  return {
    title: textOf("onlineChoiceTitle"),
    message: textOf("onlineChoiceMessage"),
    primary: textOf("onlineChoicePrimary"),
    secondary: textOf("onlineChoiceSecondary"),
    secondaryVisible: byId("onlineChoiceSecondary") ? !byId("onlineChoiceSecondary").hidden : false
  };
}

function readSound() {
  const volume = byId("volume");
  const mute = byId("mute");
  const bands = { low: [], mid: [], high: [], top: [] };
  const selects = document.querySelectorAll("#soundBands select[data-band]");
  for (const select of selects) {
    const band = select.dataset.band;
    if (!bands[band]) continue;
    const option = select.options[select.selectedIndex];
    bands[band].push({
      index: Number(select.dataset.index),
      value: select.value,
      label: option ? option.textContent : "None"
    });
  }
  return {
    volume: volume ? Number(volume.value) : 70,
    muted: mute ? mute.checked : false,
    bands,
    canAdd: Array.from(document.querySelectorAll("#soundBands button[data-add]")).map((button) => ({
      band: button.dataset.add,
      disabled: button.disabled
    }))
  };
}

function readAuth() {
  const authModal = byId("onlineAuthModal");
  if (!authModal || authModal.hidden) return null;
  return {
    title: textOf("onlineAuthTitle"),
    note: textOf("onlineAuthNote"),
    error: textOf("onlineAuthError"),
    mode: byId("onlineAuthTabRegister") && byId("onlineAuthTabRegister").classList.contains("active") ? "register" : "login",
    handle: inputValue("onlineHandle"),
    password: inputValue("onlinePassword"),
    confirm: inputValue("onlinePasswordConfirm"),
    confirmVisible: byId("onlineConfirmRow") ? !byId("onlineConfirmRow").hidden : false,
    submit: textOf("onlineAuthSubmit"),
    busy: byId("onlineAuthSubmit") ? byId("onlineAuthSubmit").disabled : false
  };
}

function readAccount() {
  const modal = byId("onlineAccountModal");
  if (!modal || modal.hidden) return null;
  return {
    identity: textOf("onlineAccountIdentity"),
    best: textOf("onlineAccountBest"),
    sync: textOf("onlineAccountSync"),
    error: textOf("onlineAccountError"),
    deleteOpen: byId("onlineDeleteRow") ? !byId("onlineDeleteRow").hidden : false,
    deleteValue: inputValue("onlineDeleteInput"),
    claimVisible: byId("onlineAccountClaim") ? !byId("onlineAccountClaim").hidden : false
  };
}

function readBook() {
  const modal = byId("bookModal");
  if (!modal || modal.hidden) return null;
  const s = game();
  return {
    powers: s ? s.data.POWERUPS : [],
    sins: s ? s.data.SINS : [],
    rarityOrder: s ? s.data.RARITY_ORDER : ["common", "uncommon", "rare"],
    rarityLabel: s ? s.data.RARITY_LABEL : {},
    rarityPercent: s ? s.helpers.rarityPercent : () => 0
  };
}

function readOptions() {
  const options = byId("optionsScreen");
  if (!options || options.hidden) return null;
  return {
    volume: inputValue("volume"),
    muted: byId("mute") ? byId("mute").checked : false,
    devTools: byId("devToolsToggle") ? byId("devToolsToggle").checked : false,
    account: textOf("onlineOptionsAccountValue"),
    sync: textOf("onlineOptionsSyncValue"),
    signedIn: Boolean(online() && online().debug.session()),
    guest: Boolean(online() && online().debug.session() && online().debug.session().user && online().debug.session().user.isAnonymous),
    syncDisabled: byId("onlineSyncNow") ? byId("onlineSyncNow").disabled : false,
    accountButton: textOf("onlineOptionsAccountBtn")
  };
}

export function menuRows() {
  const s = game();
  if (!s) return [];
  return Array.from(s.leaderboard || []).slice(0, 8);
}

export function globalRows() {
  const o = online();
  if (!o) return [];
  const board = o.debug.board();
  return Array.from(board.rows || []);
}

export function globalBoardState() {
  const o = online();
  if (!o) return null;
  return o.debug.board();
}

export function accountInfo() {
  const o = online();
  if (!o) return null;
  return {
    enabled: o.enabled,
    session: o.debug.session(),
    account: o.debug.account(),
    board: o.debug.board(),
    sync: o.debug.sync(),
    syncBlocked: o.debug.syncBlocked(),
    queue: o.debug.queue(),
    submitted: o.debug.submitted()
  };
}

export function menuButton(label) {
  const buttons = Array.from(document.querySelectorAll("#menuScreen .menu-btn"));
  return buttons.find((button) => button.textContent.toLowerCase().includes(label.toLowerCase())) || null;
}

export function clickMenu(label) {
  const button = menuButton(label);
  if (button) button.click();
}

export function clickPower(powerId, tier = null) {
  const card = document.querySelector(`#powerGridLeft [data-power="${powerId}"], #powerGridRight [data-power="${powerId}"]`);
  if (!card) return false;
  if (tier != null) {
    const tierButton = card.querySelector(`.tier-btn[data-tier="${tier}"]`);
    if (tierButton && !tierButton.disabled) {
      tierButton.click();
      return true;
    }
  }
  const icon = card.querySelector(".slot-icon");
  if (icon) {
    icon.click();
    return true;
  }
  card.click();
  return true;
}

export function powerCards() {
  const s = game();
  if (!s) return { left: [], right: [], empty: "" };
  const read = (gridId) => {
    const grid = byId(gridId);
    if (!grid) return [];
    return Array.from(grid.querySelectorAll(".slot-card")).map((card) => {
      const power = s.data.POWER_BY_ID[card.dataset.power];
      const icon = card.querySelector(".slot-icon");
      const glyph = card.querySelector(".slot-glyph");
      const name = card.querySelector(".slot-name");
      const cd = card.querySelector(".cd-badge");
      const copy = card.querySelector(".copy-badge");
      const tiers = Array.from(card.querySelectorAll(".tier-btn")).map((button) => ({
        tier: Number(button.dataset.tier),
        label: button.textContent,
        active: button.classList.contains("active"),
        disabled: button.disabled
      }));
      return {
        id: card.dataset.power,
        power,
        glyph: glyph ? glyph.textContent : "",
        name: name ? name.textContent : power ? power.name : "",
        cooldown: cd ? Number(cd.textContent) : 0,
        copies: copy ? copy.textContent : "",
        armed: card.classList.contains("armed"),
        cooling: card.classList.contains("cooling"),
        unavailable: card.classList.contains("unavailable"),
        dormant: card.classList.contains("dormant"),
        tiers,
        disabled: icon ? Boolean(icon.disabled) : false
      };
    });
  };
  return {
    left: read("powerGridLeft"),
    right: read("powerGridRight"),
    empty: byId("powerEmpty") && !byId("powerEmpty").hidden ? textOf("powerEmpty") : ""
  };
}

export function action(name, ...args) {
  const s = game();
  if (!s || !s.actions[name]) return false;
  s.actions[name](...args);
  return true;
}

export function onlineAction(name, ...args) {
  const o = online();
  if (!o || typeof o[name] !== "function") return false;
  o[name](...args);
  return true;
}

export function soundSlotSelect(band, index) {
  return document.querySelector(`#soundBands select[data-band="${band}"][data-index="${index}"]`);
}

export function soundSlotOptions(band, index) {
  const select = soundSlotSelect(band, index);
  if (!select) return [];
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.textContent,
    pack: option.parentElement && option.parentElement.tagName === "OPTGROUP" ? option.parentElement.label : ""
  }));
}

export function setSoundSlot(band, index, value) {
  const select = soundSlotSelect(band, index);
  if (!select) return false;
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function previewSoundSlot(band, index) {
  const select = soundSlotSelect(band, index);
  if (!select) return false;
  const row = select.closest(".band-slot");
  const button = row ? row.querySelector("button[data-preview]") : null;
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

export function addSoundLayer(band) {
  const button = document.querySelector(`#soundBands button[data-add="${band}"]`);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

export function removeSoundLayer(band, index) {
  const button = document.querySelector(`#soundBands button[data-remove="${band}:${index}"]`);
  if (!button) return false;
  button.click();
  return true;
}

export function dismissToast() {
  const toast = byId("toast");
  if (toast) toast.classList.remove("show");
}
