/*
 * Browser-level online tests for 0.3.1.
 *
 * Run against a test build:
 *   npm run build:web:test
 *   npm run test:online-browser
 *
 * The test starts a local static server on 127.0.0.1:8080 because the Edge
 * Functions CORS allowlist includes that origin. It cleans up the accounts and
 * guests it creates through the test project's service-role key.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const envPath = process.env.TTN_ENV_FILE || path.join(root, ".env.supabase.local");

async function loadEnv() {
  const env = { ...process.env };
  try {
    const text = await readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const at = trimmed.indexOf("=");
      const key = trimmed.slice(0, at);
      if (env[key] === undefined) env[key] = trimmed.slice(at + 1);
    }
  } catch {
    /* env vars may be supplied directly */
  }
  return env;
}

const env = await loadEnv();
const url = String(process.env.TTN_SUPABASE_URL || env.TTN_TEST_SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = process.env.TTN_SUPABASE_KEY || env.TTN_TEST_SUPABASE_KEY;
const serviceKey = process.env.TTN_SERVICE_ROLE_KEY || env.TTN_TEST_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing Supabase test configuration. Set TTN_TEST_SUPABASE_URL, TTN_TEST_SUPABASE_KEY, and TTN_TEST_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const dist = path.join(root, "dist", "web");
try {
  const config = await readFile(path.join(dist, "online-config.js"), "utf8");
  if (!config.includes('"enabled": true') || !config.includes(url)) {
    throw new Error("dist/web is not a test online build. Run npm run build:web:test first.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const password = "correct-horse-battery-staple";
const accountHandle = (`bt${suffix}`).slice(0, 20);
const claimHandle = (`bc${suffix}`).slice(0, 20);
const createdUserIds = new Set();
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
}

function serviceHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function adminFetch(pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: serviceHeaders(options.headers || {})
  });
  return response;
}

async function clearRateLimits() {
  await adminFetch("/rest/v1/registration_events?created_at=gte.1970-01-01", { method: "DELETE" });
}

async function deleteUser(id) {
  if (!id) return;
  try {
    await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* best-effort cleanup */
  }
}

async function findUserIdByHandle(handle) {
  try {
    const response = await adminFetch(`/rest/v1/profiles?select=id&handle_norm=eq.${encodeURIComponent(handle.toLowerCase())}`);
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows.map((row) => row.id) : [];
  } catch {
    return [];
  }
}

async function cleanup() {
  for (const id of createdUserIds) await deleteUser(id);
  for (const handle of [accountHandle, claimHandle]) {
    for (const id of await findUserIdByHandle(handle)) await deleteUser(id);
  }
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const relative = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const file = path.join(dist, decodeURIComponent(relative));
    if (!file.startsWith(dist)) {
      response.writeHead(403).end("forbidden");
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end("not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(8080, "127.0.0.1", resolve);
});
const base = "http://127.0.0.1:8080/";

const browser = await chromium.launch({ headless: true });
const contexts = [];

async function newPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  contexts.push(context);
  const page = await context.newPage();
  if (options.trackIntervals) {
    await page.addInitScript(() => {
      window.__ttnIntervals = [];
      const original = window.setInterval;
      window.setInterval = function (fn, ms, ...args) {
        window.__ttnIntervals.push(ms);
        return original.call(this, fn, ms, ...args);
      };
    });
  }
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text())) {
      errors.push("console: " + message.text());
    }
  });
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  page.__errors = errors;
  return page;
}

async function signIn(page, handle, passwordValue, { register = false } = {}) {
  await page.locator("#onlineBarAction").click();
  await page.waitForTimeout(200);
  if (register) await page.locator("#onlineAuthTabRegister").click();
  await page.locator("#onlineHandle").fill(handle);
  await page.locator("#onlinePassword").fill(passwordValue);
  if (register) await page.locator("#onlinePasswordConfirm").fill(passwordValue);
  await page.locator("#onlineAuthSubmit").click();
  await page.waitForTimeout(4000);
  if (await page.locator("#onlineChoiceModal").isVisible()) {
    await page.locator("#onlineChoiceCancel").click();
    await page.waitForTimeout(300);
  }
}

async function dismissChoice(page, label = "Cancel") {
  if (await page.locator("#onlineChoiceModal").isVisible()) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(300);
  }
}

async function startEndless(page) {
  await page.locator('[data-start="endless"]').click();
  await page.waitForTimeout(400);
  if (await page.locator("#continueModal").isVisible()) {
    await page.locator("#continueNo").click();
    await page.waitForTimeout(300);
  }
}

async function toMenu(page) {
  if (await page.locator("#toMenu").isVisible()) {
    await page.locator("#toMenu").click();
    await page.waitForTimeout(300);
  }
}

async function deleteCurrentAccount(page) {
  await toMenu(page);
  if (!(await page.locator("#onlineBarIdentity").isVisible())) return;
  await page.locator("#onlineBarIdentity").click();
  await page.waitForTimeout(250);
  if (!(await page.locator("#onlineAccountModal").isVisible())) return;
  await page.locator("#onlineAccountDelete").click();
  await page.locator("#onlineDeleteInput").fill("DELETE");
  await page.locator("#onlineDeleteConfirm").click();
  await page.waitForTimeout(3000);
}

try {
  await clearRateLimits();

  /* Local-only build hides every online element. */
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contexts.push(context);
    const page = await context.newPage();
    const localErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource/.test(message.text())) {
        localErrors.push("console: " + message.text());
      }
    });
    page.on("pageerror", (error) => localErrors.push("pageerror: " + error.message));
    await page.route("**/online-config.js", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: 'window.TTN_ONLINE_CONFIG = Object.freeze({ enabled: false, supabaseUrl: "", supabaseAnonKey: "", version: "0.3.1" });'
      })
    );
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    assert(await page.locator("#onlineBar").isHidden(), "local build hides the account bar");
    assert(await page.locator("#globalBoardPanel").isHidden(), "local build hides the global board");
    assert(await page.locator("#onlineAuthModal").isHidden(), "local build hides auth");
    assert(await page.evaluate(() => window.TTNOnline.enabled === false), "local build disables TTNOnline");
    assert(localErrors.length === 0, "local build has no console errors");
  }

  /* Registration, login, board polling, and account summary. */
  const accountPage = await newPage({ trackIntervals: true });
  await signIn(accountPage, accountHandle, password, { register: true });
  const accountId = await accountPage.evaluate(() => window.TTNOnline.debug.session()?.user?.id || null);
  if (accountId) createdUserIds.add(accountId);
  assert((await accountPage.locator("#onlineBarIdentity").textContent()) === accountHandle, "registration signs in with the handle");
  assert((await accountPage.locator("#globalBoardPanel").isVisible()), "global board is visible on the menu");
  assert(await accountPage.evaluate(() => window.__ttnIntervals.includes(30000)), "global board polls every 30 seconds");
  assert((await accountPage.locator("#globalBoardHint").textContent()).includes("30s"), "board hint explains polling");

  await accountPage.locator("#onlineBarIdentity").click();
  await accountPage.waitForTimeout(250);
  assert(await accountPage.locator("#onlineAccountModal").isVisible(), "account modal opens");
  assert((await accountPage.locator("#onlineAccountIdentity").textContent()) === accountHandle, "account modal shows the handle");
  assert((await accountPage.locator("#onlineAccountBest").textContent()).includes("No global score"), "new account has no score yet");
  await accountPage.locator("#onlineAccountClose").click();
  await accountPage.waitForTimeout(200);

  await accountPage.locator("#onlineBarIdentity").click();
  await accountPage.locator("#onlineAccountSignOut").click();
  await accountPage.waitForTimeout(1500);
  assert((await accountPage.locator("#onlineBarIdentity").textContent()) === "Local only", "sign out clears the account bar");

  await accountPage.locator("#onlineBarAction").click();
  await accountPage.locator("#onlineHandle").fill(accountHandle);
  await accountPage.locator("#onlinePassword").fill("wrong-password");
  await accountPage.locator("#onlineAuthSubmit").click();
  await accountPage.waitForTimeout(1500);
  assert((await accountPage.locator("#onlineAuthError").textContent()).toLowerCase().includes("wrong"), "wrong password shows an error");
  await accountPage.locator("#onlinePassword").fill(password);
  await accountPage.locator("#onlineAuthSubmit").click();
  await accountPage.waitForTimeout(3500);
  assert((await accountPage.locator("#onlineBarIdentity").textContent()) === accountHandle, "login restores the account");
  assert(accountPage.__errors.length === 0, "account flow has no console errors");

  /* Save upload, pull on another device, and conflict resolution. */
  await startEndless(accountPage);
  await toMenu(accountPage);
  const pushed = await accountPage.evaluate(async () => {
    await window.TTNOnline.syncNow({ interactive: true });
    return window.TTNOnline.debug.sync();
  });
  assert(pushed && pushed.revision >= 1, "local save uploads to the cloud");

  const secondPage = await newPage();
  await signIn(secondPage, accountHandle, password);
  await secondPage.waitForTimeout(1500);
  const pulled = await secondPage.evaluate(() => ({
    sync: window.TTNOnline.debug.sync(),
    state: localStorage.getItem("ttn-state-v2") ? "present" : "missing"
  }));
  assert(pulled.state === "present", "cloud save is written to the second device");
  assert(pulled.sync && pulled.sync.revision === pushed.revision, "second device receives the cloud revision");

  await accountPage.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("ttn-state-v2"));
    state.__conflict = "first";
    localStorage.setItem("ttn-state-v2", JSON.stringify(state));
    return window.TTNOnline.syncNow({ interactive: true });
  });
  await accountPage.waitForTimeout(1200);
  const afterFirst = await accountPage.evaluate(() => window.TTNOnline.debug.sync());

  await secondPage.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("ttn-state-v2"));
    state.__conflict = "second";
    localStorage.setItem("ttn-state-v2", JSON.stringify(state));
    window.TTNOnline.syncNow({ interactive: true });
  });
  await secondPage.waitForTimeout(1500);
  assert(await secondPage.locator("#onlineChoiceModal").isVisible(), "concurrent saves open the conflict modal");
  assert((await secondPage.locator("#onlineChoiceTitle").textContent()) === "Save conflict", "conflict modal has the right title");
  await secondPage.locator("#onlineChoiceSecondary").click();
  await secondPage.waitForTimeout(3000);
  const afterSecond = await secondPage.evaluate(() => ({
    sync: window.TTNOnline.debug.sync(),
    marker: JSON.parse(localStorage.getItem("ttn-state-v2")).__conflict
  }));
  assert(afterSecond.marker === "second", "uploading this device keeps its save");
  assert(afterSecond.sync.revision > afterFirst.revision, "conflict upload creates a new revision");

  /* Guest submission, GUEST badge, and claim. */
  const guestPage = await newPage();
  await startEndless(guestPage);
  const guestRun = `guest-${Date.now()}`;
  await guestPage.evaluate((runId) => {
    window.TTNOnline.onRunEnded({ id: runId, score: 5000000, round: 10, boardSize: 3, level: 5 });
  }, guestRun);
  await guestPage.waitForTimeout(250);
  await guestPage.getByRole("button", { name: "Submit as guest" }).click();
  await guestPage.waitForTimeout(4500);
  const guestSession = await guestPage.evaluate(() => window.TTNOnline.debug.session());
  if (guestSession?.user?.id) createdUserIds.add(guestSession.user.id);
  assert(guestSession?.user?.isAnonymous === true, "guest submission creates an anonymous identity");
  assert((await guestPage.locator("#onlineBarIdentity").textContent()).startsWith("Guest-"), "guest gets an auto-generated name");
  assert((await guestPage.locator("#onlineRunStatus").textContent()).includes("Guest score"), "guest run offers a claim");
  assert((await guestPage.locator(".online-guest-badge").count()) > 0, "global board marks guest scores");

  await guestPage.getByRole("button", { name: "Claim score" }).click();
  await guestPage.waitForTimeout(250);
  assert((await guestPage.locator("#onlineAuthTitle").textContent()) === "Claim your guest score", "claim opens the claim form");
  await guestPage.locator("#onlineHandle").fill(claimHandle);
  await guestPage.locator("#onlinePassword").fill(password);
  await guestPage.locator("#onlinePasswordConfirm").fill(password);
  await guestPage.locator("#onlineAuthSubmit").click();
  await guestPage.waitForTimeout(4500);
  await dismissChoice(guestPage, "Not now");
  const claimedId = await guestPage.evaluate(() => window.TTNOnline.debug.session()?.user?.id || null);
  if (claimedId) createdUserIds.add(claimedId);
  assert((await guestPage.locator("#onlineBarIdentity").textContent()) === claimHandle, "claim signs in to the permanent account");
  assert((await guestPage.locator("#onlineRunStatus").textContent()).includes("New global best"), "claimed run keeps its global best");
  const claimBest = await guestPage.evaluate(() => window.TTNOnline.debug.account()?.best?.score);
  assert(claimBest === 5000000, "claim transfers the guest best score");
  await deleteCurrentAccount(guestPage);
  assert((await guestPage.locator("#onlineBarIdentity").textContent()) === "Local only", "claimed account can be deleted");
  assert(guestPage.__errors.length === 0, "guest and claim flow has no console errors");

  /* Offline queue retries when the connection returns. */
  const offlinePage = await newPage();
  await startEndless(offlinePage);
  const offlineRun = `offline-${Date.now()}`;
  await offlinePage.evaluate((runId) => {
    window.TTNOnline.onRunEnded({ id: runId, score: 6000000, round: 12, boardSize: 3, level: 6 });
  }, offlineRun);
  await offlinePage.waitForTimeout(250);
  await offlinePage.context().setOffline(true);
  await offlinePage.waitForTimeout(300);
  await offlinePage.getByRole("button", { name: "Submit as guest" }).click();
  await offlinePage.waitForTimeout(500);
  assert((await offlinePage.locator("#onlineRunStatus").textContent()).includes("Queued"), "offline guest run is queued");
  await offlinePage.context().setOffline(false);
  await offlinePage.waitForTimeout(6000);
  const offlineSession = await offlinePage.evaluate(() => window.TTNOnline.debug.session());
  if (offlineSession?.user?.id) createdUserIds.add(offlineSession.user.id);
  assert((await offlinePage.locator("#onlineRunStatus").textContent()).includes("New global best"), "offline guest run submits when online");
  await deleteCurrentAccount(offlinePage);
  assert((await offlinePage.locator("#onlineBarIdentity").textContent()) === "Local only", "offline guest can be deleted");
  assert(offlinePage.__errors.length === 0, "offline flow has no console errors");

  console.log(`Online browser tests passed: ${passed} assertions.`);
} catch (error) {
  failed += 1;
  console.error("Online browser test failed:", error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  if (failed) console.error(`Online browser tests: ${passed} passed, ${failed} failed.`);
}
