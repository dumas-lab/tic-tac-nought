import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const userDataDir = await mkdtemp(path.join(os.tmpdir(), "ttn-electron-"));
const errors = [];

function wireErrors(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
}

async function launch() {
  const args = process.platform === "linux" ? ["--no-sandbox", "."] : ["."];
  const app = await electron.launch({
    args,
    cwd: process.cwd(),
    env: { ...process.env, TTR_USER_DATA_DIR: userDataDir, TTR_TEST: "1" }
  });
  const page = await app.firstWindow();
  wireErrors(page);
  await page.waitForSelector("#menuScreen:not([hidden])");
  return { app, page };
}

try {
  const first = await launch();
  const title = await first.page.title();
  if (title !== "Tic Tac Nought") throw new Error(`unexpected title: ${title}`);

  const cells = await first.page.locator("#board button").count();
  if (cells !== 9) throw new Error(`expected 9 board cells, got ${cells}`);

  await first.page.click('[data-start="endless"]');
  await first.page.waitForSelector("#gameScreen:not([hidden])");
  await first.page.locator("#board button").first().click();
  await first.page.waitForTimeout(250);

  const saved = await first.page.evaluate(() => localStorage.getItem("ttn-state-v2"));
  if (!saved) throw new Error("state was not saved after a move");
  const parsed = JSON.parse(saved);
  if (parsed.mode !== "endless") throw new Error(`unexpected saved mode: ${parsed.mode}`);

  await first.page.screenshot({ path: "/tmp/opencode/ttn-electron-smoke.png", fullPage: true });
  await first.app.close();

  const second = await launch();
  const restored = await second.page.evaluate(() => localStorage.getItem("ttn-state-v2"));
  if (!restored) throw new Error("state did not survive an app restart");
  if (JSON.parse(restored).mode !== "endless") throw new Error("restored state has the wrong mode");
  await second.app.close();

  if (errors.length) throw new Error("renderer errors:\n" + errors.join("\n"));
  console.log("Electron smoke test passed: title, board, save, restart persistence.");
} finally {
  await rm(userDataDir, { recursive: true, force: true });
}
