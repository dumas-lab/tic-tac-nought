import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const defaultExecutable =
  process.platform === "win32"
    ? path.join(process.cwd(), "dist", "desktop", "win-unpacked", "Tic Tac Nought.exe")
    : path.join(process.cwd(), "dist", "desktop", "linux-unpacked", "tic-tac-nought");

const executablePath = path.resolve(process.argv[2] || defaultExecutable);
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "ttn-packaged-"));
const errors = [];
let app;

try {
  app = await electron.launch({
    executablePath,
    // The packaged smoke test drives the DOM fallback, so keep the compositor
    // off the GPU. Headless CI runners otherwise hang on shared-image
    // allocation before the first window is ready.
    args: process.platform === "linux"
      ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
      : [],
    env: { ...process.env, TTR_USER_DATA_DIR: userDataDir, TTR_TEST: "1" }
  });

  const page = await app.firstWindow({ timeout: 30000 });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.waitForSelector("#menuScreen:not([hidden])", { timeout: 30000 });
  const title = await page.title();
  if (title !== "Tic Tac Nought") throw new Error(`unexpected title: ${title}`);
  if (!page.url().startsWith("app://tic-tac-nought/")) throw new Error(`unexpected origin: ${page.url()}`);

  const cells = await page.locator("#board button").count();
  if (cells !== 9) throw new Error(`expected 9 board cells, got ${cells}`);

  await page.click('[data-start="endless"]');
  await page.waitForSelector("#gameScreen:not([hidden])");
  await page.locator("#board button").first().click();
  await page.waitForTimeout(300);

  const saved = await page.evaluate(() => localStorage.getItem("ttn-state-v2"));
  if (!saved) throw new Error("state was not saved after a move");
  if (JSON.parse(saved).mode !== "endless") throw new Error("saved state has the wrong mode");

  if (errors.length) throw new Error("renderer errors:\n" + errors.join("\n"));
  console.log(`Packaged smoke test passed: ${executablePath}`);
} finally {
  if (app) await app.close().catch(() => {});
  await rm(userDataDir, { recursive: true, force: true });
}
