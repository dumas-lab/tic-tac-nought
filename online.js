/*
 * Tic Tac Nought online client for 0.3.3.
 *
 * The game itself stays local-first. This file adds optional accounts, guest
 * score submission, the global Endless board, and account-only save sync.
 * It is loaded before the game script and exposes window.TTNOnline.
 */
(function () {
  "use strict";

  const config = Object.assign(
    {
      enabled: false,
      supabaseUrl: "",
      supabaseAnonKey: "",
      version: "0.3.3"
    },
    window.TTN_ONLINE_CONFIG || {}
  );

  const enabled = Boolean(
    config.enabled &&
    typeof config.supabaseUrl === "string" &&
    config.supabaseUrl &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseAnonKey
  );

  const KEYS = {
    session: "ttn-session-v1",
    sync: "ttn-sync-v1",
    board: "ttn-global-board-v1",
    queue: "ttn-submit-queue-v1",
    submitted: "ttn-submitted-v1",
    device: "ttn-device-v1",
    state: "ttn-state-v2",
    leaderboard: "ttn-leaderboard-v1",
    sound: "ttn-sound-v1"
  };

  const state = {
    enabled,
    session: null,
    account: null,
    board: {
      version: null,
      rows: [],
      me: null,
      loading: false,
      error: "",
      updatedAt: 0,
      dirty: true
    },
    queue: [],
    submitted: {},
    syncMeta: null,
    syncBlocked: false,
    syncInFlight: null,
    localDirty: false,
    activeRun: null,
    currentScreen: "menu",
    authMode: "login",
    authContext: null,
    authBusy: false,
    flushing: false,
    flushAgain: false,
    guestIntent: false,
    online: navigator.onLine !== false,
    suppressLocal: false,
    renderScheduled: false,
    signatures: {},
    choiceResolver: null,
    lastSyncAt: 0,
    lastSyncError: "",
    pendingCloud: null,
    pendingConflict: null,
    localChangeTimer: null
  };

  const dom = {};

  /* -----------------------------------------------------------------------
   * Small helpers
   * --------------------------------------------------------------------- */

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function show(el, visible) {
    if (el) el.hidden = !visible;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function removeKey(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  function formatNumber(value) {
    return String(Math.max(0, Math.floor(Number(value) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function timeAgo(ms) {
    if (!ms) return "never";
    const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (seconds < 10) return "just now";
    if (seconds < 60) return seconds + "s ago";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.round(hours / 24) + "d ago";
  }

  function toast(message, rarity) {
    if (typeof window.showToast === "function") {
      try {
        window.showToast(message, rarity);
        return;
      } catch {
        /* fall through */
      }
    }
    console.log("[online] " + message);
  }

  function stableStringify(value) {
    if (value === undefined) return "undefined";
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }

  async function hashPayload(payload) {
    const text = stableStringify(payload);
    if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
      try {
        const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return "sha256:" + Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      } catch {
        /* fall back below */
      }
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "fnv1a:" + (hash >>> 0).toString(16);
  }

  function getDeviceId() {
    let id = "";
    try {
      id = localStorage.getItem(KEYS.device) || "";
    } catch {
      id = "";
    }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        id = window.crypto.randomUUID();
      } else {
        id = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      }
      try {
        localStorage.setItem(KEYS.device, id);
      } catch {
        /* storage unavailable */
      }
    }
    return id.slice(0, 64);
  }

  function currentUserId() {
    return state.session && state.session.user ? state.session.user.id : null;
  }

  function isGuest() {
    return Boolean(state.session && state.session.user && state.session.user.isAnonymous);
  }

  function isAccount() {
    return Boolean(state.session && state.session.user && !state.session.user.isAnonymous);
  }

  function handleForDisplay() {
    if (state.account && state.account.profile && typeof state.account.profile.handle === "string") {
      return state.account.profile.handle;
    }
    if (state.session && state.session.user && typeof state.session.user.handle === "string" && state.session.user.handle) {
      return state.session.user.handle;
    }
    return isGuest() ? "Guest" : "Account";
  }

  /* -----------------------------------------------------------------------
   * Network and session
   * --------------------------------------------------------------------- */

  class OnlineError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = "OnlineError";
      this.status = Number(status) || 0;
      this.code = code || "";
    }
  }

  function parseError(status, data) {
    let code = "";
    let message = "";
    if (data && typeof data === "object") {
      const rawCode = data.error_code || data.code || data.error || "";
      code = typeof rawCode === "string" ? rawCode : "";
      const rawMessage = data.message || data.error_description || data.msg || data.error || "";
      message = typeof rawMessage === "string" ? rawMessage : "";
      if (!message && data.details) message = String(data.details);
    } else if (typeof data === "string") {
      message = data;
    }
    if (!code && /invalid login credentials/i.test(message)) code = "invalid_credentials";
    if (!message) message = status === 0 ? "Network error" : "Request failed (" + status + ")";
    return new OnlineError(message, status, code);
  }

  function errorCode(error) {
    if (!error) return "";
    if (error.code && !/^PT\d+$/.test(error.code)) return error.code;
    if (error.message) return String(error.message);
    return "";
  }

  async function rawFetch(path, options) {
    const opts = options || {};
    const base = String(config.supabaseUrl || "").replace(/\/+$/, "");
    const headers = Object.assign({ apikey: config.supabaseAnonKey }, opts.headers || {});
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers.Authorization = "Bearer " + opts.token;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 20000) : null;
    let response;
    try {
      response = await fetch(base + path, {
        method: opts.method || "GET",
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        cache: "no-store",
        credentials: "omit",
        signal: controller ? controller.signal : undefined
      });
    } catch {
      throw new OnlineError("network", 0, "network");
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { response, data, text };
  }

  let refreshPromise = null;

  function adoptAuth(data) {
    const payload = data && data.access_token ? data : data && data.session ? data.session : null;
    if (!payload || !payload.access_token || !payload.user) {
      throw new OnlineError("invalid_session", 500, "invalid_session");
    }
    const user = payload.user;
    state.session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || "",
      expiresAt: Number(payload.expires_at) || nowSec() + (Number(payload.expires_in) || 3600),
      user: {
        id: String(user.id),
        isAnonymous: Boolean(user.is_anonymous),
        handle: user.user_metadata && typeof user.user_metadata.handle === "string" ? user.user_metadata.handle : ""
      }
    };
    writeJson(KEYS.session, state.session);
  }

  function clearSession() {
    state.session = null;
    state.account = null;
    removeKey(KEYS.session);
    state.pendingCloud = null;
    state.pendingConflict = null;
  }

  async function refreshSession() {
    if (!state.session || !state.session.refreshToken) {
      throw new OnlineError("not_authenticated", 401, "not_authenticated");
    }
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const result = await rawFetch("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: state.session.refreshToken }
      });
      if (!result.response.ok) {
        const error = parseError(result.response.status, result.data);
        if (result.response.status === 400 || result.response.status === 401) clearSession();
        throw error;
      }
      adoptAuth(result.data);
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  async function ensureSession() {
    if (!state.session) return null;
    if (state.session.expiresAt && state.session.expiresAt - 60 <= nowSec()) {
      try {
        await refreshSession();
      } catch (error) {
        if (error.status === 400 || error.status === 401) clearSession();
        return null;
      }
    }
    return state.session;
  }

  async function rpc(name, args, options) {
    const opts = options || {};
    let token = null;
    if (state.session) {
      const session = opts.requireAuth ? await ensureSession() : await ensureSession().catch(() => null);
      if (session) token = session.accessToken;
    }
    if (opts.requireAuth && !token) {
      throw new OnlineError("not_authenticated", 401, "not_authenticated");
    }
    const result = await rawFetch("/rest/v1/rpc/" + name, {
      method: "POST",
      body: args || {},
      token
    });
    if (!result.response.ok) throw parseError(result.response.status, result.data);
    return result.data;
  }

  async function callFunction(name, body, options) {
    const opts = options || {};
    let token = null;
    if (state.session && opts.auth !== false) {
      const session = opts.requireAuth === false ? state.session : await ensureSession();
      if (session) token = session.accessToken;
    }
    if (opts.requireAuth !== false && opts.auth !== false && !token) {
      throw new OnlineError("not_authenticated", 401, "not_authenticated");
    }
    const result = await rawFetch("/functions/v1/" + name, {
      method: "POST",
      body: body || {},
      token
    });
    if (!result.response.ok) throw parseError(result.response.status, result.data);
    return result.data;
  }

  async function loginWithPassword(handle, password) {
    const result = await rawFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: {
        email: String(handle).trim().toLowerCase() + "@ttn.invalid",
        password
      }
    });
    if (!result.response.ok) throw parseError(result.response.status, result.data);
    adoptAuth(result.data);
  }

  async function signupAnonymous() {
    const result = await rawFetch("/auth/v1/signup", {
      method: "POST",
      body: {}
    });
    if (!result.response.ok) throw parseError(result.response.status, result.data);
    adoptAuth(result.data);
  }

  async function registerAccount(handle, password) {
    await callFunction("register", { handle, password }, { auth: false });
    try {
      await loginWithPassword(handle, password);
    } catch (error) {
      throw new OnlineError("Account created, but sign-in failed. Try signing in with the same handle.", error.status, error.code);
    }
  }

  async function claimGuestAccount(handle, password) {
    if (!state.session || !state.session.user.isAnonymous) {
      throw new OnlineError("Only a guest can claim a guest score.", 403, "not_guest");
    }
    const result = await callFunction("claim-guest", { handle, password });
    await loginWithPassword(handle, password);
    for (const entry of Object.values(state.submitted)) {
      if (entry && entry.isGuest) {
        entry.isGuest = false;
        entry.handle = handle;
        entry.claimedAt = Date.now();
      }
    }
    saveSubmitted();
    return result;
  }

  async function logoutSession() {
    const session = state.session;
    if (session && session.accessToken) {
      try {
        await rawFetch("/auth/v1/logout", { method: "POST", token: session.accessToken });
      } catch {
        /* local sign-out still succeeds */
      }
    }
    clearSession();
  }

  async function loadAccount() {
    if (!state.session) {
      state.account = null;
      return null;
    }
    const account = await rpc("get_my_account", {}, { requireAuth: true });
    state.account = account;
    if (account && account.profile) {
      state.session.user.isAnonymous = Boolean(account.profile.is_guest);
      state.session.user.handle = account.profile.handle;
      writeJson(KEYS.session, state.session);
    }
    return account;
  }

  function authErrorMessage(error) {
    const code = errorCode(error);
    if (code === "network" || error.status === 0) return "Cannot reach the server. Check your connection and try again.";
    if (code === "invalid_credentials" || /invalid login credentials/i.test(error.message || "")) return "Handle or password is wrong.";
    if (code === "handle_taken") return "That handle is already taken.";
    if (code === "reserved_handle") return "That handle is reserved.";
    if (code === "invalid_handle") return "Use 3–20 letters, numbers, underscores, or hyphens.";
    if (code === "invalid_password") return "Use a password of 8–128 characters.";
    if (code === "rate_limited") return "Too many attempts. Wait an hour and try again.";
    if (code === "not_guest") return "Only a guest session can claim a guest score.";
    if (code === "account_suspended") return "This account is suspended.";
    if (code === "guest_saves_not_allowed") return "Save sync is for accounts only.";
    if (code === "payload_too_large") return "This save is too large to sync.";
    if (code === "not_authenticated") return "Sign in again to continue.";
    return error.message || "Something went wrong.";
  }

  /* -----------------------------------------------------------------------
   * Local save and sync metadata
   * --------------------------------------------------------------------- */

  function buildLocalPayload() {
    const gameState = readJson(KEYS.state);
    if (!gameState || typeof gameState !== "object" || Array.isArray(gameState)) return null;
    const data = { state: gameState };
    const leaderboard = readJson(KEYS.leaderboard);
    if (Array.isArray(leaderboard)) data.leaderboard = leaderboard;
    const sound = readJson(KEYS.sound);
    if (sound && typeof sound === "object" && !Array.isArray(sound)) data.sound = sound;
    return {
      app: "tic-tac-nought",
      schema: 1,
      gameVersion: String(config.version || "0.3.3"),
      data
    };
  }

  function loadSyncMeta() {
    const meta = readJson(KEYS.sync);
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
  }

  async function refreshLocalDirty(hash) {
    try {
      const current = buildLocalPayload();
      const currentHash = current ? await hashPayload(current) : null;
      state.localDirty = currentHash !== hash;
    } catch {
      state.localDirty = false;
    }
  }

  function saveSyncMeta(meta) {
    state.syncMeta = meta;
    if (meta) writeJson(KEYS.sync, meta);
    else removeKey(KEYS.sync);
  }

  function blockSync(reason, revision) {
    const meta = state.syncMeta || {};
    saveSyncMeta(Object.assign({}, meta, {
      blockedUserId: currentUserId(),
      blockedAt: Date.now(),
      blockedReason: reason || "conflict",
      blockedRevision: Number(revision) || 0
    }));
    state.syncBlocked = true;
    render();
  }

  function clearBlocked() {
    state.syncBlocked = false;
    if (state.syncMeta && state.syncMeta.blockedUserId) {
      const meta = Object.assign({}, state.syncMeta);
      delete meta.blockedUserId;
      delete meta.blockedAt;
      delete meta.blockedReason;
      delete meta.blockedRevision;
      saveSyncMeta(meta);
    }
  }

  function syncErrorMessage(error) {
    const code = errorCode(error);
    if (code === "network" || error.status === 0) return "Cannot reach the server. Changes stay on this device and will retry.";
    if (code === "guest_saves_not_allowed") return "Save sync is for accounts only.";
    if (code === "account_suspended") return "This account is suspended.";
    if (code === "payload_too_large") return "This save is too large to sync.";
    if (code === "not_authenticated") return "Sign in again to sync saves.";
    return error.message || "Save sync failed. It will retry.";
  }

  async function applyCloud(remote, options) {
    const opts = options || {};
    if (!remote || remote.status !== "ok" || !remote.payload) {
      throw new OnlineError("invalid_save", 400, "invalid_save");
    }
    const payload = remote.payload;
    if (payload.app !== "tic-tac-nought" || payload.schema !== 1 || !payload.data || typeof payload.data !== "object" || !payload.data.state) {
      throw new OnlineError("invalid_save", 400, "invalid_save");
    }
    state.suppressLocal = true;
    try {
      localStorage.setItem(KEYS.state, JSON.stringify(payload.data.state));
      if (payload.data.leaderboard != null) {
        localStorage.setItem(KEYS.leaderboard, JSON.stringify(payload.data.leaderboard));
      } else {
        localStorage.removeItem(KEYS.leaderboard);
      }
      if (payload.data.sound != null) {
        localStorage.setItem(KEYS.sound, JSON.stringify(payload.data.sound));
      } else {
        localStorage.removeItem(KEYS.sound);
      }
    } catch {
      state.suppressLocal = false;
      throw new OnlineError("Could not write the cloud save to this device.", 0, "storage");
    }
    const normalized = buildLocalPayload();
    const hash = await hashPayload(normalized || payload);
    saveSyncMeta({
      userId: currentUserId(),
      revision: Number(remote.revision) || 1,
      hash,
      updatedAt: Date.now()
    });
    state.syncBlocked = false;
    state.localDirty = false;
    state.lastSyncAt = Date.now();
    state.lastSyncError = "";
    state.pendingCloud = null;
    state.pendingConflict = null;
    toast(opts.reason === "silent" ? "Cloud save loaded." : "Cloud save loaded. Reloading…");
    render();
    setTimeout(() => {
      state.suppressLocal = false;
    }, 2500);
    setTimeout(() => {
      try {
        location.reload();
      } catch {
        /* ignore */
      }
    }, 400);
  }

  async function resolveSaveConflict(remote, local, localHash, remoteRevision) {
    const choice = await askChoice({
      title: "Save conflict",
      message: "This device and another device both changed this account's save. Choose which save to keep. Loading the cloud save reloads the game.",
      primaryLabel: "Use cloud save",
      secondaryLabel: "Upload this device",
      cancelLabel: "Not now"
    });
    if (choice === "primary") {
      await applyCloud(remote, { interactive: true });
    } else if (choice === "secondary") {
      await pushSave(local, localHash, remoteRevision, { interactive: true, retried: true });
    } else {
      blockSync("conflict", remoteRevision);
    }
  }

  async function pushSave(payload, hash, baseRevision, options) {
    const opts = options || {};
    const result = await rpc("sync_save", {
      p_base_revision: baseRevision,
      p_payload: payload,
      p_device_id: getDeviceId()
    }, { requireAuth: true });

    if (result && result.status === "ok") {
      saveSyncMeta({
        userId: currentUserId(),
        revision: Number(result.revision) || baseRevision + 1,
        hash,
        updatedAt: Date.now()
      });
      state.syncBlocked = false;
      await refreshLocalDirty(hash);
      state.lastSyncAt = Date.now();
      state.lastSyncError = "";
      state.pendingCloud = null;
      state.pendingConflict = null;
      if (opts.interactive) toast("Save synced.");
      render();
      return true;
    }

    if (result && result.status === "conflict") {
      if (opts.retried) {
        blockSync("conflict", result.revision);
        return false;
      }
      const remote = await rpc("get_save", {}, { requireAuth: true });
      if (!remote || remote.status !== "ok") {
        blockSync("conflict", result.revision);
        return false;
      }
      await resolveSaveConflict(remote, payload, hash, Number(remote.revision) || 0);
      return false;
    }

    throw new OnlineError("Unexpected save response.", 500, "invalid_save_response");
  }

  async function syncNow(options) {
    const opts = options || {};
    if (!state.enabled || !isAccount()) return null;
    if (state.syncInFlight) return state.syncInFlight;
    const userId = currentUserId();
    if (opts.interactive) clearBlocked();
    if (!opts.interactive && state.syncMeta && state.syncMeta.blockedUserId === userId) {
      render();
      return null;
    }

    const local = buildLocalPayload();
    const localHash = local ? await hashPayload(local) : null;
    const meta = state.syncMeta;
    const sameOwner = Boolean(meta && meta.userId === userId);
    const baseRevision = sameOwner && Number.isInteger(meta.revision) ? meta.revision : 0;
    const localChanged = Boolean(local && (!sameOwner || meta.hash !== localHash));

    state.syncInFlight = (async () => {
      try {
        const remote = await rpc("get_save", {}, { requireAuth: true });
        state.lastSyncError = "";

        if (!local) {
          if (remote && remote.status === "ok") {
            await applyCloud(remote, { interactive: true, reason: "cloud" });
          } else {
            saveSyncMeta({ userId, revision: 0, hash: null, updatedAt: Date.now() });
            state.localDirty = false;
          }
          return;
        }

        const remoteRevision = remote && remote.status === "ok" ? Number(remote.revision) || 0 : 0;
        const remoteChanged = sameOwner ? remoteRevision > baseRevision : remoteRevision > 0;

        if (!remote || remote.status === "empty") {
          if (!sameOwner || opts.offerUpload) {
            const choice = await askChoice({
              title: "Upload this device's save?",
              message: "This account has no cloud save yet. Upload the run, damage ledger, and sound settings from this device?",
              primaryLabel: "Upload save",
              secondaryLabel: null,
              cancelLabel: "Not now"
            });
            if (choice !== "primary") {
              blockSync("upload_declined", 0);
              return;
            }
          }
          await pushSave(local, localHash, 0, { interactive: opts.interactive });
          return;
        }

        if (!sameOwner) {
          const choice = await askChoice({
            title: "Cloud save found",
            message: "This account already has a cloud save. This device also has a local save, possibly from another account. Choose which save to keep. Loading the cloud save reloads the game.",
            primaryLabel: "Use cloud save",
            secondaryLabel: "Upload this device",
            cancelLabel: "Not now"
          });
          if (choice === "primary") {
            await applyCloud(remote, { interactive: true });
          } else if (choice === "secondary") {
            await pushSave(local, localHash, remoteRevision, { interactive: true, retried: true });
          } else {
            blockSync("cloud_choice", remoteRevision);
          }
          return;
        }

        if (!localChanged && !remoteChanged) {
          state.localDirty = false;
          state.lastSyncAt = Date.now();
          return;
        }

        if (localChanged && !remoteChanged) {
          await pushSave(local, localHash, remoteRevision, { interactive: opts.interactive });
          return;
        }

        if (!localChanged && remoteChanged) {
          if (state.currentScreen === "menu" || opts.interactive) {
            await applyCloud(remote, { interactive: true, reason: "remote" });
          } else {
            state.pendingCloud = remote;
            toast("Cloud save updated. Return to the menu to load it.");
          }
          return;
        }

        if (state.currentScreen !== "menu" && !opts.interactive) {
          state.pendingConflict = { remote, local, localHash, remoteRevision };
          blockSync("conflict", remoteRevision);
          toast("Save conflict. Resolve it from the menu.");
          return;
        }

        await resolveSaveConflict(remote, local, localHash, remoteRevision);
      } catch (error) {
        state.lastSyncError = syncErrorMessage(error);
        if (error.status === 401) {
          clearSession();
        } else if (error.status === 403) {
          blockSync("forbidden", 0);
        }
        if (opts.interactive) toast(state.lastSyncError);
        render();
      } finally {
        state.syncInFlight = null;
      }
    })();

    return state.syncInFlight;
  }

  function noteLocalChange() {
    if (!state.enabled || state.suppressLocal) return;
    state.localDirty = true;
    if (!isAccount()) return;
    if (state.syncMeta && state.syncMeta.blockedUserId === currentUserId()) return;
    if (state.localChangeTimer) clearTimeout(state.localChangeTimer);
    state.localChangeTimer = setTimeout(() => {
      state.localChangeTimer = null;
      syncNow({}).catch(() => {});
    }, 3000);
  }

  async function maybeResolvePending() {
    if (!state.enabled) return;
    if (state.pendingConflict) {
      const pending = state.pendingConflict;
      state.pendingConflict = null;
      await resolveSaveConflict(pending.remote, pending.local, pending.localHash, pending.remoteRevision);
      return;
    }
    if (state.pendingCloud) {
      const remote = state.pendingCloud;
      state.pendingCloud = null;
      await applyCloud(remote, { interactive: true, reason: "remote" });
      return;
    }
    if (isAccount() && state.localDirty && !state.syncBlocked) {
      await syncNow({});
    }
  }

  /* -----------------------------------------------------------------------
   * Score submission queue
   * --------------------------------------------------------------------- */

  function loadQueue() {
    const raw = readJson(KEYS.queue);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item.runId === "string" && Number.isFinite(Number(item.score)))
      .slice(0, 50)
      .map((item) => ({
        runId: String(item.runId).slice(0, 64),
        score: clampInt(item.score, 0, 1000000000, 0),
        round: clampInt(item.round, 1, 1000, 1),
        boardSize: clampInt(item.boardSize, 3, 50, 3),
        level: clampInt(item.level, 1, 1000, 1),
        createdAt: Number(item.createdAt) || Date.now(),
        attempts: Number(item.attempts) || 0,
        nextAttemptAt: Number(item.nextAttemptAt) || 0,
        status: typeof item.status === "string" ? item.status : "queued",
        error: typeof item.error === "string" ? item.error : "",
        intent: item.intent === "guest" ? "guest" : ""
      }));
  }

  function saveQueue() {
    writeJson(KEYS.queue, state.queue);
  }

  function loadSubmitted() {
    const raw = readJson(KEYS.submitted);
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  }

  function saveSubmitted() {
    const entries = Object.entries(state.submitted)
      .sort((a, b) => (Number(b[1] && b[1].submittedAt) || 0) - (Number(a[1] && a[1].submittedAt) || 0))
      .slice(0, 50);
    state.submitted = Object.fromEntries(entries);
    writeJson(KEYS.submitted, state.submitted);
  }

  function normalizeRun(run) {
    if (!run || typeof run !== "object") return null;
    const id = typeof run.id === "string" ? run.id.trim() : "";
    const score = Math.floor(Number(run.score));
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
    if (!Number.isFinite(score) || score <= 0) return null;
    return {
      id,
      score,
      round: clampInt(run.round, 1, 1000, 1),
      boardSize: clampInt(run.boardSize, 3, 50, 3),
      level: clampInt(run.level, 1, 1000, 1)
    };
  }

  function onRunStarted() {
    state.activeRun = null;
    state.signatures.runPanel = "";
    show(dom.runPanel, false);
  }

  function onRunEnded(run) {
    if (!state.enabled) return;
    const clean = normalizeRun(run);
    if (!clean) {
      state.activeRun = null;
      renderRunPanel(true);
      return;
    }
    state.activeRun = clean;
    if (clean.score > 1000000000) {
      clean.tooLarge = true;
      renderRunPanel(true);
      return;
    }
    if (!state.submitted[clean.id] && !state.queue.some((item) => item.runId === clean.id)) {
      state.queue.push({
        runId: clean.id,
        score: clean.score,
        round: clean.round,
        boardSize: clean.boardSize,
        level: clean.level,
        createdAt: Date.now(),
        attempts: 0,
        nextAttemptAt: 0,
        status: "queued",
        error: "",
        intent: ""
      });
      saveQueue();
    }
    renderRunPanel(true);
    if (state.session) flushQueue().catch(() => {});
  }

  async function ensureGuestSession() {
    if (state.session) return state.session;
    await signupAnonymous();
    await loadAccount();
    await refreshBoard(true);
    render();
    return state.session;
  }

  function wantsGuestSubmission() {
    return state.guestIntent || state.queue.some((item) => item.intent === "guest" && item.status !== "rejected");
  }

  async function submitAsGuest() {
    if (!state.enabled) return;
    try {
      if (!state.session) {
        if (!state.online) {
          state.guestIntent = true;
          const activeId = state.activeRun ? state.activeRun.id : "";
          const item = state.queue.find((entry) => entry.runId === activeId && entry.status !== "rejected") ||
            state.queue.find((entry) => entry.status !== "rejected");
          if (item) {
            item.intent = "guest";
            saveQueue();
          }
          toast("Offline. This run will submit as a guest when you reconnect.");
          renderRunPanel(true);
          return;
        }
        await ensureGuestSession();
      }
      state.guestIntent = false;
      await flushQueue();
    } catch (error) {
      toast(authErrorMessage(error));
      renderRunPanel(true);
    }
  }

  async function flushQueue() {
    if (!state.enabled || !state.session) return;
    if (state.flushing) {
      state.flushAgain = true;
      return;
    }
    if (!state.online) return;
    state.flushing = true;
    renderRunPanel(true);
    try {
      for (const item of state.queue.slice().sort((a, b) => a.createdAt - b.createdAt)) {
        if (!state.queue.includes(item)) continue;
        if (item.status === "rejected") continue;
        if (item.nextAttemptAt && item.nextAttemptAt > Date.now()) continue;
        if (!navigator.onLine) break;

        try {
          const result = await rpc("submit_score", {
            p_run_id: item.runId,
            p_score: item.score,
            p_round: item.round,
            p_board_size: item.boardSize,
            p_level: item.level
          }, { requireAuth: true });

          state.submitted[item.runId] = {
            submittedAt: Date.now(),
            accepted: Boolean(result && result.accepted),
            duplicate: Boolean(result && result.duplicate),
            improved: Boolean(result && result.improved),
            best: result && result.best ? result.best : null,
            rank: result && result.rank != null ? result.rank : null,
            flagged: Boolean(result && result.flagged),
            isGuest: Boolean(result && result.is_guest),
            handle: result && result.handle ? result.handle : handleForDisplay()
          };
          if (state.account) {
            if (result && result.best) state.account.best = result.best;
            if (result && result.rank != null) state.account.rank = result.rank;
          }
          state.queue = state.queue.filter((entry) => entry.runId !== item.runId);
          saveSubmitted();
          saveQueue();
          if (state.activeRun && state.activeRun.id === item.runId) renderRunPanel(true);
          if (result && result.improved) toast("New global best: " + formatNumber(item.score) + " damage.", "rare");
          refreshBoard(true).catch(() => {});
        } catch (error) {
          const code = errorCode(error);
          item.attempts += 1;
          if (error.status === 429 || code === "rate_limited") {
            item.nextAttemptAt = Date.now() + 31000;
            item.error = "Rate limited. Retrying shortly.";
            saveQueue();
            break;
          }
          if (code === "daily_limit") {
            item.status = "rejected";
            item.error = "Daily submission limit reached.";
            saveQueue();
            break;
          }
          if (code === "score_out_of_bounds" || code === "invalid_round" || code === "invalid_board_size" || code === "invalid_level" || code === "invalid_run_id") {
            item.status = "rejected";
            item.error = "This run is outside the pre-alpha board limits.";
            saveQueue();
            continue;
          }
          if (code === "account_suspended" || code === "profile_missing") {
            item.status = "rejected";
            item.error = "This account cannot submit scores.";
            saveQueue();
            break;
          }
          if (error.status === 401 || code === "not_authenticated") {
            clearSession();
            item.error = "Sign in again to submit this run.";
            saveQueue();
            break;
          }
          item.nextAttemptAt = Date.now() + 15000;
          item.error = error.status === 0 ? "Offline. Will retry." : "Could not submit. Will retry.";
          saveQueue();
          break;
        }
      }
    } finally {
      state.flushing = false;
      renderRunPanel(true);
      render();
      if (state.flushAgain) {
        state.flushAgain = false;
        flushQueue().catch(() => {});
      }
    }
  }

  /* -----------------------------------------------------------------------
   * Global leaderboard
   * --------------------------------------------------------------------- */

  async function refreshBoard(force) {
    if (!state.enabled || state.board.loading) return;
    state.board.loading = true;
    state.board.dirty = true;
    if (force) state.board.error = "";
    renderBoard();
    try {
      const args = !force && state.board.version != null ? { p_version: state.board.version } : {};
      const result = await rpc("get_leaderboard", args);
      if (result && result.changed) {
        state.board.version = result.version;
        state.board.rows = Array.isArray(result.rows) ? result.rows : [];
        state.board.me = result.me || null;
        state.board.updatedAt = Date.now();
        state.board.error = "";
        writeJson(KEYS.board, {
          version: state.board.version,
          rows: state.board.rows,
          me: state.board.me,
          updatedAt: state.board.updatedAt
        });
      } else if (result && result.changed === false) {
        state.board.version = result.version;
        state.board.updatedAt = Date.now();
        state.board.error = "";
      }
    } catch (error) {
      state.board.error = error.status === 0 || errorCode(error) === "network"
        ? "Offline — showing the last known board."
        : "Global board unavailable.";
      if (!state.board.rows.length) {
        const cached = readJson(KEYS.board);
        if (cached && Array.isArray(cached.rows)) {
          state.board.rows = cached.rows;
          state.board.version = cached.version;
          state.board.me = cached.me;
        }
      }
    } finally {
      state.board.loading = false;
      state.board.dirty = true;
      renderBoard();
    }
  }

  /* -----------------------------------------------------------------------
   * Modals
   * --------------------------------------------------------------------- */

  function askChoice(options) {
    const opts = options || {};
    return new Promise((resolve) => {
      if (!dom.choiceModal) {
        resolve("cancel");
        return;
      }
      if (state.choiceResolver) {
        const previous = state.choiceResolver;
        state.choiceResolver = null;
        previous("cancel");
      }
      setText(dom.choiceTitle, opts.title || "Choose");
      setText(dom.choiceMessage, opts.message || "");
      setText(dom.choicePrimary, opts.primaryLabel || "Continue");
      setText(dom.choiceSecondary, opts.secondaryLabel || "");
      setText(dom.choiceCancel, opts.cancelLabel || "Cancel");
      show(dom.choicePrimary, Boolean(opts.primaryLabel));
      show(dom.choiceSecondary, Boolean(opts.secondaryLabel));
      show(dom.choiceCancel, opts.cancelLabel !== null);
      dom.choicePrimary.classList.toggle("online-choice-danger", Boolean(opts.danger));
      dom.choiceModal.hidden = false;
      state.choiceResolver = (value) => {
        dom.choiceModal.hidden = true;
        resolve(value);
      };
    });
  }

  function resolveChoice(value) {
    const resolver = state.choiceResolver;
    state.choiceResolver = null;
    if (resolver) resolver(value);
  }

  function setAuthMode(mode, context) {
    state.authMode = mode === "register" ? "register" : "login";
    state.authContext = context === "claim" ? "claim" : null;
    const claim = state.authContext === "claim";
    const register = state.authMode === "register";
    if (dom.authTitle) dom.authTitle.textContent = claim ? "Claim your guest score" : register ? "Create account" : "Sign in";
    if (dom.authNote) {
      dom.authNote.textContent = claim
        ? "Create a permanent account. Your guest best score moves with you, and you can sync saves."
        : register
          ? "Handles are 3–20 letters, numbers, underscores, or hyphens. No email is required."
          : "Sign in with your handle and password. Accounts use no email address.";
    }
    show(dom.authTabs, !claim);
    show(dom.confirmRow, register);
    if (dom.passwordInput) {
      dom.passwordInput.autocomplete = register ? "new-password" : "current-password";
      dom.passwordInput.value = "";
    }
    if (dom.passwordConfirm) dom.passwordConfirm.value = "";
    if (dom.handleInput) dom.handleInput.value = "";
    if (dom.authError) dom.authError.textContent = "";
    if (dom.authSubmit) {
      dom.authSubmit.textContent = claim ? "Create account and claim" : register ? "Create account" : "Sign in";
      dom.authSubmit.disabled = false;
    }
    if (dom.authTabLogin) {
      dom.authTabLogin.classList.toggle("active", !register && !claim);
      dom.authTabLogin.setAttribute("aria-selected", String(!register && !claim));
    }
    if (dom.authTabRegister) {
      dom.authTabRegister.classList.toggle("active", register && !claim);
      dom.authTabRegister.setAttribute("aria-selected", String(register && !claim));
    }
  }

  function openAuth(mode, context) {
    if (!state.enabled) return;
    if (context === "claim" && !isGuest()) {
      toast("Only a guest can claim a guest score.");
      return;
    }
    if (state.session && isGuest() && context !== "claim") {
      openAccount();
      return;
    }
    if (state.session && !isGuest() && context !== "claim") {
      openAccount();
      return;
    }
    setAuthMode(mode, context);
    if (dom.authModal) dom.authModal.hidden = false;
    setTimeout(() => {
      if (dom.handleInput) dom.handleInput.focus();
    }, 60);
  }

  function closeAuth() {
    if (dom.authModal) dom.authModal.hidden = true;
    state.authBusy = false;
  }

  function openAccount() {
    if (!state.enabled) return;
    if (!state.session) {
      openAuth("login");
      return;
    }
    renderAccountModal();
    if (dom.accountModal) dom.accountModal.hidden = false;
  }

  function closeAccount() {
    if (dom.accountModal) dom.accountModal.hidden = true;
    show(dom.deleteRow, false);
    if (dom.deleteInput) dom.deleteInput.value = "";
    if (dom.accountError) dom.accountError.textContent = "";
  }

  function renderAccountModal() {
    if (!dom.accountModal) return;
    const guest = isGuest();
    const handle = handleForDisplay();
    setText(dom.accountTitle, guest ? "Guest account" : "Account");
    setText(dom.accountIdentity, handle + (guest ? " · GUEST" : ""));
    if (state.account && state.account.best) {
      const best = state.account.best;
      const rank = state.account.rank != null ? " · rank #" + state.account.rank : "";
      setText(dom.accountBest, "Best " + formatNumber(best.score) + " damage · Round " + best.round + " · " + best.board_size + "×" + best.board_size + rank + (best.flagged ? " · held for review" : ""));
    } else {
      setText(dom.accountBest, "No global score submitted yet.");
    }
    let syncText = "Not synced yet.";
    if (guest) {
      syncText = "Save sync is for accounts. Claim this guest to sync saves.";
    } else if (state.syncBlocked || (state.syncMeta && state.syncMeta.blockedUserId === currentUserId())) {
      syncText = "Sync paused. Use Sync now to choose a save.";
    } else if (state.lastSyncError) {
      syncText = state.lastSyncError;
    } else if (state.syncMeta && state.syncMeta.revision) {
      syncText = "Cloud save revision " + state.syncMeta.revision + " · synced " + timeAgo(state.lastSyncAt || state.syncMeta.updatedAt) + ".";
    } else if (state.account && state.account.save) {
      syncText = "Cloud save revision " + state.account.save.revision + ".";
    }
    setText(dom.accountSync, syncText);
    show(dom.accountClaim, guest);
    if (dom.accountSyncNow) dom.accountSyncNow.disabled = guest;
    if (dom.accountDelete) dom.accountDelete.textContent = guest ? "Delete guest identity" : "Delete account";
    if (dom.accountError) dom.accountError.textContent = "";
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (state.authBusy) return;
    const handle = dom.handleInput ? dom.handleInput.value.trim() : "";
    const password = dom.passwordInput ? dom.passwordInput.value : "";
    const confirm = dom.passwordConfirm ? dom.passwordConfirm.value : "";
    const register = state.authMode === "register";
    const context = state.authContext;

    if (!/^[A-Za-z0-9_-]{3,20}$/.test(handle)) {
      if (dom.authError) dom.authError.textContent = "Use 3–20 letters, numbers, underscores, or hyphens.";
      return;
    }
    if (password.length < 8 || password.length > 128) {
      if (dom.authError) dom.authError.textContent = "Use a password of 8–128 characters.";
      return;
    }
    if (register && password !== confirm) {
      if (dom.authError) dom.authError.textContent = "The passwords do not match.";
      return;
    }

    state.authBusy = true;
    if (dom.authSubmit) {
      dom.authSubmit.disabled = true;
      dom.authSubmit.textContent = "Working…";
    }
    if (dom.authError) dom.authError.textContent = "";

    try {
      if (context === "claim") {
        await claimGuestAccount(handle, password);
        closeAuth();
        toast("Guest score claimed. You are signed in as " + handle + ".");
      } else if (register) {
        await registerAccount(handle, password);
        closeAuth();
        toast("Account created. Signed in as " + handle + ".");
      } else {
        await loginWithPassword(handle, password);
        closeAuth();
        toast("Signed in as " + handle + ".");
      }
      await afterAuth({ offerUpload: context === "claim" });
    } catch (error) {
      if (dom.authError) dom.authError.textContent = authErrorMessage(error);
    } finally {
      state.authBusy = false;
      if (dom.authSubmit) {
        dom.authSubmit.disabled = false;
        const claim = state.authContext === "claim";
        dom.authSubmit.textContent = claim ? "Create account and claim" : state.authMode === "register" ? "Create account" : "Sign in";
      }
    }
  }

  async function afterAuth(options) {
    const opts = options || {};
    try {
      await loadAccount();
    } catch (error) {
      toast(authErrorMessage(error));
      render();
      return;
    }
    state.localDirty = true;
    refreshBoard(true).catch(() => {});
    flushQueue().catch(() => {});
    if (isAccount()) {
      await syncNow({ afterAuth: true, offerUpload: Boolean(opts.offerUpload), interactive: Boolean(opts.offerUpload) }).catch(() => {});
    }
    render();
  }

  async function signOut() {
    if (isGuest()) {
      const choice = await askChoice({
        title: "Sign out of this guest?",
        message: "The guest score stays on the global board, but you will not be able to claim it later. Create an account first if you want to keep it.",
        primaryLabel: "Sign out",
        cancelLabel: "Cancel"
      });
      if (choice !== "primary") return;
    }
    try {
      await logoutSession();
    } catch {
      clearSession();
    }
    closeAccount();
    toast("Signed out.");
    refreshBoard(true).catch(() => {});
    render();
  }

  async function deleteAccount() {
    if (!state.session) return;
    const confirmation = dom.deleteInput ? dom.deleteInput.value.trim() : "";
    if (confirmation !== "DELETE") {
      if (dom.accountError) dom.accountError.textContent = "Type DELETE exactly to confirm.";
      return;
    }
    const guest = isGuest();
    if (dom.deleteConfirm) dom.deleteConfirm.disabled = true;
    if (dom.accountError) dom.accountError.textContent = "";
    try {
      await callFunction("delete-account", { confirm: "DELETE" });
      clearSession();
      closeAccount();
      toast(guest ? "Guest identity deleted." : "Account deleted.");
      refreshBoard(true).catch(() => {});
      render();
    } catch (error) {
      if (dom.accountError) dom.accountError.textContent = authErrorMessage(error);
    } finally {
      if (dom.deleteConfirm) dom.deleteConfirm.disabled = false;
    }
  }

  /* -----------------------------------------------------------------------
   * Rendering
   * --------------------------------------------------------------------- */

  function render() {
    if (!state.enabled) return;
    if (state.renderScheduled) return;
    state.renderScheduled = true;
    requestAnimationFrame(() => {
      state.renderScheduled = false;
      renderBar();
      renderBoard();
      renderRunPanel(false);
      renderOptions();
      if (dom.accountModal && !dom.accountModal.hidden) renderAccountModal();
    });
  }

  function renderBar() {
    if (!dom.bar) return;
    const signed = Boolean(state.session);
    const guest = isGuest();
    const signature = signed ? "in:" + currentUserId() + ":" + handleForDisplay() + ":" + guest : "out";
    if (state.signatures.bar === signature) return;
    state.signatures.bar = signature;
    show(dom.bar, true);
    setText(dom.barIdentity, signed ? handleForDisplay() : "Local only");
    if (dom.barIdentity) dom.barIdentity.classList.toggle("guest", guest);
    if (dom.barAction) dom.barAction.textContent = signed ? "Account" : "Sign in";
  }

  function renderBoard() {
    if (!dom.globalBoardList) return;
    show(dom.globalBoardPanel, true);
    const rows = state.board.rows || [];
    const signature = JSON.stringify({
      version: state.board.version,
      loading: state.board.loading,
      error: state.board.error,
      updatedAt: state.board.updatedAt,
      me: state.board.me,
      user: currentUserId(),
      rows: rows.map((row) => [row.rank, row.handle, row.score, row.is_guest, row.is_me])
    });
    if (!state.board.dirty && state.signatures.board === signature) return;
    state.signatures.board = signature;
    state.board.dirty = false;

    setText(dom.globalBoardCount, rows.length ? "(" + rows.length + ")" : "");
    if (dom.globalBoardHint) {
      if (state.board.loading && !rows.length) dom.globalBoardHint.textContent = "Loading the global board…";
      else if (state.board.error) dom.globalBoardHint.textContent = state.board.error;
      else if (!rows.length) dom.globalBoardHint.textContent = "No global scores yet. Finish an Endless run to open the board. Refreshes every 30s while visible.";
      else dom.globalBoardHint.textContent = "Top 50 · updated " + timeAgo(state.board.updatedAt) + " · refreshes every 30s while visible";
    }
    dom.globalBoardList.textContent = "";

    if (!rows.length) {
      const empty = document.createElement("li");
      empty.className = "lb-empty";
      empty.textContent = state.board.loading ? "Loading…" : "No global scores yet.";
      dom.globalBoardList.appendChild(empty);
      return;
    }

    for (const row of rows) {
      dom.globalBoardList.appendChild(boardRow(row, false));
    }

    if (state.board.me && state.board.me.rank != null && !rows.some((row) => row.is_me)) {
      const divider = document.createElement("li");
      divider.className = "online-board-divider";
      divider.textContent = "Your rank";
      dom.globalBoardList.appendChild(divider);
      dom.globalBoardList.appendChild(boardRow(state.board.me, true));
    }
  }

  function boardRow(row, isMeOutside) {
    const li = document.createElement("li");
    li.className = "lb-row online-board-row" + (row.is_me || isMeOutside ? " is-me" : "");

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = row.rank != null ? row.rank + "." : "—";

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = row.handle || "Unknown";
    if (row.is_guest) {
      const badge = document.createElement("span");
      badge.className = "online-guest-badge";
      badge.textContent = "GUEST";
      name.appendChild(document.createTextNode(" "));
      name.appendChild(badge);
    }

    const score = document.createElement("span");
    score.className = "lb-score";
    score.textContent = formatNumber(row.score);

    const meta = document.createElement("span");
    meta.className = "lb-meta";
    meta.textContent = "Lv " + (row.level || 1) + " · Round " + (row.round || 1) + " · " + (row.board_size || row.boardSize || 3) + "×" + (row.board_size || row.boardSize || 3);

    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(score);
    li.appendChild(meta);
    return li;
  }

  function renderRunPanel(force) {
    if (!dom.runPanel || !dom.runActions) return;
    const run = state.activeRun;
    if (!run) {
      show(dom.runPanel, false);
      state.signatures.runPanel = "";
      return;
    }
    const submitted = state.submitted[run.id] || null;
    const queued = state.queue.find((item) => item.runId === run.id) || null;
    const signature = JSON.stringify({
      id: run.id,
      tooLarge: Boolean(run.tooLarge),
      submitted: submitted ? [submitted.rank, submitted.flagged, submitted.isGuest, submitted.improved, submitted.best && submitted.best.score] : null,
      queued: queued ? [queued.status, queued.error, queued.nextAttemptAt, state.flushing] : null,
      session: state.session ? [currentUserId(), isGuest(), handleForDisplay()] : null,
      online: state.online
    });
    if (!force && state.signatures.runPanel === signature) return;
    state.signatures.runPanel = signature;

    show(dom.runPanel, true);
    dom.runActions.textContent = "";
    let status = "";

    if (run.tooLarge) {
      status = "This run's damage is above the 1,000,000,000 pre-alpha board cap, so it cannot be submitted.";
      addRunButton("Dismiss", "mini ghost", () => dismissRunPanel());
    } else if (submitted) {
      const best = submitted.best;
      if (submitted.flagged) {
        status = "Run submitted but held for review. It will appear on the global board after moderation.";
      } else if (submitted.improved) {
        status = "New global best: " + formatNumber(run.score) + " damage" + (submitted.rank != null ? " · rank #" + submitted.rank : "") + ".";
      } else {
        status = "Run submitted. Best: " + formatNumber(best && best.score != null ? best.score : run.score) + " damage" + (submitted.rank != null ? " · rank #" + submitted.rank : "") + ".";
      }
      if (submitted.isGuest || isGuest()) {
        status += " Guest score — create an account to keep it.";
        addRunButton("Claim score", "mini", () => openAuth("register", "claim"));
      }
      addRunButton("Dismiss", "mini ghost", () => dismissRunPanel());
    } else if (queued) {
      if (queued.status === "rejected") {
        status = queued.error || "This run could not be submitted.";
      } else if (queued.intent === "guest" && !state.online) {
        status = "Queued to submit as a guest when you reconnect.";
      } else if (!state.session) {
        status = "This run is not on the global board yet. Submit it as a guest, or create an account first.";
      } else if (state.flushing) {
        status = "Submitting " + formatNumber(run.score) + " damage…";
      } else if (queued.nextAttemptAt && queued.nextAttemptAt > Date.now()) {
        status = (queued.error || "Waiting to retry") + " Next attempt in " + Math.max(1, Math.ceil((queued.nextAttemptAt - Date.now()) / 1000)) + "s.";
      } else if (queued.error) {
        status = queued.error;
      } else {
        status = "Queued for the global board as " + (isGuest() ? handleForDisplay() + " (guest)" : handleForDisplay()) + ".";
      }

      if (!state.session) {
        addRunButton("Submit as guest", "mini", () => submitAsGuest());
        addRunButton("Create account", "mini ghost", () => openAuth("register"));
      } else if (queued.status !== "rejected") {
        addRunButton("Retry now", "mini ghost", () => {
          queued.nextAttemptAt = 0;
          saveQueue();
          flushQueue().catch(() => {});
        });
      }
      addRunButton("Dismiss", "mini ghost", () => dismissRunPanel());
    } else {
      status = "This run was not submitted.";
      addRunButton("Dismiss", "mini ghost", () => dismissRunPanel());
    }

    setText(dom.runStatus, status);
    renderRunPanelRetry();
  }

  let runPanelRetryTimer = null;
  function renderRunPanelRetry() {
    if (runPanelRetryTimer) clearTimeout(runPanelRetryTimer);
    runPanelRetryTimer = null;
    const queued = state.activeRun ? state.queue.find((item) => item.runId === state.activeRun.id) : null;
    if (!queued || !queued.nextAttemptAt || queued.nextAttemptAt <= Date.now()) return;
    runPanelRetryTimer = setTimeout(() => {
      runPanelRetryTimer = null;
      renderRunPanel(true);
    }, Math.min(5000, Math.max(500, queued.nextAttemptAt - Date.now() + 100)));
  }

  function addRunButton(label, className, handler) {
    if (!dom.runActions) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "mini";
    button.textContent = label;
    button.addEventListener("click", handler);
    dom.runActions.appendChild(button);
  }

  function dismissRunPanel() {
    state.activeRun = null;
    state.signatures.runPanel = "";
    show(dom.runPanel, false);
  }

  function renderOptions() {
    if (!dom.optionsAccountRow) return;
    const signed = Boolean(state.session);
    const guest = isGuest();
    const signature = JSON.stringify({
      signed,
      guest,
      handle: handleForDisplay(),
      blocked: state.syncBlocked,
      error: state.lastSyncError,
      revision: state.syncMeta && state.syncMeta.revision,
      accountRevision: state.account && state.account.save && state.account.save.revision,
      lastSyncAt: state.lastSyncAt
    });
    if (state.signatures.options === signature) return;
    state.signatures.options = signature;

    show(dom.optionsAccountRow, true);
    show(dom.optionsSyncRow, true);
    setText(dom.optionsAccountValue, signed ? handleForDisplay() + (guest ? " (guest)" : "") : "Not signed in");
    if (dom.optionsAccountBtn) dom.optionsAccountBtn.textContent = signed ? "Account" : "Sign in";

    let syncText = "Sign in to sync saves.";
    if (signed && guest) syncText = "Accounts only. Claim this guest to sync.";
    else if (signed && state.syncBlocked) syncText = "Paused — resolve the save conflict.";
    else if (signed && state.lastSyncError) syncText = state.lastSyncError;
    else if (signed && state.syncMeta && state.syncMeta.revision) syncText = "Synced · revision " + state.syncMeta.revision + " · " + timeAgo(state.lastSyncAt || state.syncMeta.updatedAt);
    else if (signed && state.account && state.account.save) syncText = "Cloud save revision " + state.account.save.revision;
    else if (signed) syncText = "Not synced yet.";
    setText(dom.optionsSyncValue, syncText);
    if (dom.syncNowBtn) dom.syncNowBtn.disabled = !signed || guest;
    setText(dom.syncHint, signed && !guest
      ? "Save sync uses revisions and asks before replacing a run. Local play always works offline."
      : "Guests can submit scores but cannot sync saves. Accounts are handle + password, no email.");
    show(dom.syncHint, true);
  }

  /* -----------------------------------------------------------------------
   * DOM wiring and boot
   * --------------------------------------------------------------------- */

  function cacheDom() {
    dom.bar = byId("onlineBar");
    dom.barIdentity = byId("onlineBarIdentity");
    dom.barAction = byId("onlineBarAction");

    dom.globalBoardPanel = byId("globalBoardPanel");
    dom.globalBoardCount = byId("globalBoardCount");
    dom.globalBoardHint = byId("globalBoardHint");
    dom.globalBoardList = byId("globalBoardList");
    dom.globalBoardRefresh = byId("globalBoardRefresh");

    dom.runPanel = byId("onlineRunPanel");
    dom.runStatus = byId("onlineRunStatus");
    dom.runActions = byId("onlineRunActions");

    dom.optionsAccountRow = byId("onlineOptionsAccountRow");
    dom.optionsSyncRow = byId("onlineOptionsSyncRow");
    dom.optionsAccountValue = byId("onlineOptionsAccountValue");
    dom.optionsAccountBtn = byId("onlineOptionsAccountBtn");
    dom.optionsSyncValue = byId("onlineOptionsSyncValue");
    dom.syncNowBtn = byId("onlineSyncNow");
    dom.syncHint = byId("onlineSyncHint");

    dom.authModal = byId("onlineAuthModal");
    dom.authTitle = byId("onlineAuthTitle");
    dom.authNote = byId("onlineAuthNote");
    dom.authTabs = byId("onlineAuthTabs");
    dom.authTabLogin = byId("onlineAuthTabLogin");
    dom.authTabRegister = byId("onlineAuthTabRegister");
    dom.authForm = byId("onlineAuthForm");
    dom.handleInput = byId("onlineHandle");
    dom.passwordInput = byId("onlinePassword");
    dom.passwordConfirm = byId("onlinePasswordConfirm");
    dom.confirmRow = byId("onlineConfirmRow");
    dom.authError = byId("onlineAuthError");
    dom.authSubmit = byId("onlineAuthSubmit");
    dom.authCancel = byId("onlineAuthCancel");
    dom.authClose = byId("onlineAuthClose");

    dom.accountModal = byId("onlineAccountModal");
    dom.accountTitle = byId("onlineAccountTitle");
    dom.accountIdentity = byId("onlineAccountIdentity");
    dom.accountBest = byId("onlineAccountBest");
    dom.accountSync = byId("onlineAccountSync");
    dom.accountClaim = byId("onlineAccountClaim");
    dom.accountSyncNow = byId("onlineAccountSyncNow");
    dom.accountSignOut = byId("onlineAccountSignOut");
    dom.accountDelete = byId("onlineAccountDelete");
    dom.accountClose = byId("onlineAccountClose");
    dom.accountError = byId("onlineAccountError");
    dom.deleteRow = byId("onlineDeleteRow");
    dom.deleteInput = byId("onlineDeleteInput");
    dom.deleteConfirm = byId("onlineDeleteConfirm");
    dom.deleteCancel = byId("onlineDeleteCancel");

    dom.choiceModal = byId("onlineChoiceModal");
    dom.choiceTitle = byId("onlineChoiceTitle");
    dom.choiceMessage = byId("onlineChoiceMessage");
    dom.choicePrimary = byId("onlineChoicePrimary");
    dom.choiceSecondary = byId("onlineChoiceSecondary");
    dom.choiceCancel = byId("onlineChoiceCancel");
  }

  function wireDom() {
    if (dom.barAction) {
      dom.barAction.addEventListener("click", () => {
        if (state.session) openAccount();
        else openAuth("login");
      });
    }
    if (dom.barIdentity) {
      dom.barIdentity.addEventListener("click", () => {
        if (state.session) openAccount();
        else openAuth("login");
      });
    }
    if (dom.globalBoardRefresh) {
      dom.globalBoardRefresh.addEventListener("click", () => refreshBoard(true));
    }
    if (dom.optionsAccountBtn) {
      dom.optionsAccountBtn.addEventListener("click", () => {
        if (state.session) openAccount();
        else openAuth("login");
      });
    }
    if (dom.syncNowBtn) {
      dom.syncNowBtn.addEventListener("click", () => syncNow({ interactive: true }).catch(() => {}));
    }

    if (dom.authForm) dom.authForm.addEventListener("submit", handleAuthSubmit);
    if (dom.authTabLogin) dom.authTabLogin.addEventListener("click", () => setAuthMode("login"));
    if (dom.authTabRegister) dom.authTabRegister.addEventListener("click", () => setAuthMode("register"));
    if (dom.authCancel) dom.authCancel.addEventListener("click", closeAuth);
    if (dom.authClose) dom.authClose.addEventListener("click", closeAuth);

    if (dom.accountClose) dom.accountClose.addEventListener("click", closeAccount);
    if (dom.accountClaim) dom.accountClaim.addEventListener("click", () => {
      closeAccount();
      openAuth("register", "claim");
    });
    if (dom.accountSyncNow) dom.accountSyncNow.addEventListener("click", () => syncNow({ interactive: true }).catch(() => {}));
    if (dom.accountSignOut) dom.accountSignOut.addEventListener("click", signOut);
    if (dom.accountDelete) {
      dom.accountDelete.addEventListener("click", () => {
        show(dom.deleteRow, true);
        if (dom.deleteInput) {
          dom.deleteInput.value = "";
          dom.deleteInput.focus();
        }
      });
    }
    if (dom.deleteCancel) dom.deleteCancel.addEventListener("click", () => show(dom.deleteRow, false));
    if (dom.deleteConfirm) dom.deleteConfirm.addEventListener("click", deleteAccount);

    if (dom.choicePrimary) dom.choicePrimary.addEventListener("click", () => resolveChoice("primary"));
    if (dom.choiceSecondary) dom.choiceSecondary.addEventListener("click", () => resolveChoice("secondary"));
    if (dom.choiceCancel) dom.choiceCancel.addEventListener("click", () => resolveChoice("cancel"));

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (dom.choiceModal && !dom.choiceModal.hidden) {
        event.preventDefault();
        event.stopPropagation();
        resolveChoice("cancel");
        return;
      }
      if (dom.authModal && !dom.authModal.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeAuth();
        return;
      }
      if (dom.accountModal && !dom.accountModal.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeAccount();
      }
    }, true);

    window.addEventListener("online", () => {
      state.online = true;
      toast("Back online. Retrying the score queue.");
      if (!state.session && wantsGuestSubmission()) {
        ensureGuestSession().then(() => flushQueue()).catch(() => {});
      } else {
        flushQueue().catch(() => {});
      }
      refreshBoard(false).catch(() => {});
      if (isAccount() && state.localDirty && !state.syncBlocked) syncNow({}).catch(() => {});
      render();
    });

    window.addEventListener("offline", () => {
      state.online = false;
      toast("Offline. Local play and score submission queue continue.");
      render();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      refreshBoard(false).catch(() => {});
      flushQueue().catch(() => {});
      maybeResolvePending().catch(() => {});
    });
  }

  function bootFromStorage() {
    const session = readJson(KEYS.session);
    if (session && session.accessToken && session.user && session.user.id) {
      state.session = session;
    } else {
      state.session = null;
    }
    state.syncMeta = loadSyncMeta();
    state.syncBlocked = Boolean(
      state.syncMeta &&
      state.syncMeta.blockedUserId &&
      state.session &&
      state.syncMeta.blockedUserId === state.session.user.id
    );
    state.queue = loadQueue();
    state.submitted = loadSubmitted();
    const cachedBoard = readJson(KEYS.board);
    if (cachedBoard && Array.isArray(cachedBoard.rows)) {
      state.board.rows = cachedBoard.rows;
      state.board.version = cachedBoard.version;
      state.board.me = cachedBoard.me;
      state.board.updatedAt = Number(cachedBoard.updatedAt) || 0;
    }
  }

  function init() {
    cacheDom();
    if (!state.enabled) {
      document.querySelectorAll(".online-only").forEach((el) => {
        el.hidden = true;
      });
      return;
    }
    bootFromStorage();
    wireDom();
    render();
    setTimeout(() => {
      refreshBoard(true).catch(() => {});
      if (!state.session && wantsGuestSubmission() && state.online) {
        ensureGuestSession().then(() => flushQueue()).catch(() => {});
      }
      if (state.session) {
        ensureSession()
          .then((session) => {
            if (!session) {
              render();
              return null;
            }
            return loadAccount()
              .then(() => {
                flushQueue().catch(() => {});
                if (isAccount()) syncNow({ afterAuth: true }).catch(() => {});
                render();
              })
              .catch((error) => {
                if (error.status === 401 || error.status === 403) clearSession();
                render();
              });
          })
          .catch(() => {});
      }
    }, 350);

    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshBoard(false).catch(() => {});
    }, 30000);

    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      flushQueue().catch(() => {});
      if (isAccount() && state.localDirty && !state.syncBlocked) syncNow({}).catch(() => {});
    }, 15000);
  }

  /* -----------------------------------------------------------------------
   * Public hooks
   * --------------------------------------------------------------------- */

  function onScreenChange(name) {
    state.currentScreen = name === "game" || name === "options" || name === "menu" ? name : "menu";
    if (name === "menu") {
      // The game saves after switching screens. Defer so the save for this
      // transition is written before a sync snapshots the local payload.
      setTimeout(() => {
        maybeResolvePending().catch(() => {});
        refreshBoard(false).catch(() => {});
      }, 0);
    }
    render();
  }

  window.TTNOnline = {
    enabled,
    noteLocalChange,
    onRunStarted,
    onRunEnded,
    onScreenChange,
    render,
    openAuth,
    openAccount,
    refreshBoard,
    flushQueue,
    syncNow,
    submitAsGuest,
    debug: {
      session: () => state.session,
      account: () => state.account,
      board: () => state.board,
      queue: () => state.queue.slice(),
      submitted: () => Object.assign({}, state.submitted),
      sync: () => state.syncMeta,
      syncBlocked: () => state.syncBlocked,
      screen: () => state.currentScreen
    }
  };

  init();
})();
