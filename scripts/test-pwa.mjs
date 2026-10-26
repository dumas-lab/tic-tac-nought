import { chromium } from "playwright";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = path.join(process.cwd(), "dist", "web");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/") rel = "/index.html";
    const file = path.resolve(root, "." + rel);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error("outside root");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;
const errors = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#menuScreen:not([hidden])");
  if ((await page.title()) !== "Tic Tac Nought") throw new Error("wrong page title");

  const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
  if (manifestHref !== "manifest.json") throw new Error("manifest link missing");
  const manifest = await (await page.request.get(new URL(manifestHref, url).href)).json();
  if (manifest.name !== "Tic Tac Nought") throw new Error("manifest name is wrong");
  if (!manifest.icons || manifest.icons.length < 3) throw new Error("manifest icons are missing");

  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return !!registration.active;
  });
  const swState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      active: !!registration.active,
      controller: !!navigator.serviceWorker.controller,
      caches: await caches.keys()
    };
  });
  if (!swState.active) throw new Error("service worker is not active");
  if (!swState.caches.includes("ttn-0.3.2")) throw new Error("expected cache was not created");

  await page.click('[data-start="endless"]');
  await page.waitForSelector("#gameScreen:not([hidden])");
  await page.locator("#board button").first().click();
  await page.waitForTimeout(250);

  await page.click("#optionsTopBtn");
  await page.waitForSelector("#optionsScreen:not([hidden])");
  const downloadPromise = page.waitForEvent("download");
  await page.click("#exportSave");
  const download = await downloadPromise;
  const savePath = await download.path();
  const exported = JSON.parse(await readFile(savePath, "utf8"));
  if (exported.app !== "tic-tac-nought" || exported.schema !== 1) throw new Error("export header is wrong");
  if (!exported.data.state || exported.data.state.mode !== "endless") throw new Error("export state is missing");

  const originalState = exported.data.state;
  await page.evaluate(() => localStorage.setItem("ttn-state-v2", JSON.stringify({ mode: "two", scores: { X: 9, O: 0, draws: 0 } })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#menuScreen:not([hidden])");
  await page.click("#optionsTopBtn");
  await page.waitForSelector("#optionsScreen:not([hidden])");
  await page.setInputFiles("#importSaveFile", savePath);
  await page.waitForSelector("#confirmModal:not([hidden])");
  await page.click("#confirmYes");
  await page.waitForSelector("#menuScreen:not([hidden])");
  const importedState = await page.evaluate(() => JSON.parse(localStorage.getItem("ttn-state-v2")));
  if (importedState.mode !== "endless") throw new Error("import did not restore the run");
  if (JSON.stringify(importedState) !== JSON.stringify(originalState)) throw new Error("imported state differs from export");

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("ttt-state-v2", JSON.stringify({ mode: "two", scores: { X: 1, O: 2, draws: 3 } }));
    localStorage.setItem("ttt-sound-v1", JSON.stringify({ volume: 11, muted: true, bands: {} }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#menuScreen:not([hidden])");
  const migrated = await page.evaluate(() => ({
    state: localStorage.getItem("ttn-state-v2"),
    sound: localStorage.getItem("ttn-sound-v1")
  }));
  if (!migrated.state || !migrated.sound) throw new Error("legacy keys did not migrate");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#menuScreen:not([hidden])");
  if ((await page.title()) !== "Tic Tac Nought") throw new Error("offline reload did not restore the game");
  await context.setOffline(false);

  if (errors.length) throw new Error("browser errors:\n" + errors.join("\n"));
  console.log("PWA test passed: manifest, service worker, offline reload, export/import, legacy migration.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
