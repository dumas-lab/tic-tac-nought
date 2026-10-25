"use strict";

const { app, BrowserWindow, Menu, dialog, net, protocol, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PRODUCT_NAME = "Tic Tac Nought";
const APP_ID = "io.github.dumas-lab.tictacnought";
const APP_SCHEME = "app";
const APP_HOST = "tic-tac-nought";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const WEB_ROOT = path.resolve(__dirname, "..", "dist", "web");
const CSP_FILE = path.join(WEB_ROOT, "csp.txt");

app.setName(PRODUCT_NAME);

if (process.env.TTR_USER_DATA_DIR) {
  const userDataDir = path.resolve(process.env.TTR_USER_DATA_DIR);
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath("userData", userDataDir);
  app.setPath("sessionData", userDataDir);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

let mainWindow = null;
let contentSecurityPolicy = "";

function readCsp() {
  try {
    return fs.readFileSync(CSP_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

function resolveAssetPath(requestUrl) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${APP_SCHEME}:` || parsed.host !== APP_HOST) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  if (!pathname || pathname === "/") pathname = "/index.html";
  if (pathname.includes("\0")) return null;

  const relative = pathname.replace(/^\/+/, "");
  const fullPath = path.resolve(WEB_ROOT, relative);
  if (fullPath !== WEB_ROOT && !fullPath.startsWith(WEB_ROOT + path.sep)) return null;

  try {
    if (fs.statSync(fullPath).isDirectory()) return path.join(fullPath, "index.html");
  } catch {
    return null;
  }

  return fullPath;
}

async function handleAppRequest(request) {
  const filePath = resolveAssetPath(request.url);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (contentSecurityPolicy) headers.set("Content-Security-Policy", contentSecurityPolicy);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: "#14100f",
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_ORIGIN + "/")) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    contentSecurityPolicy = readCsp();

    if (!fs.existsSync(path.join(WEB_ROOT, "index.html"))) {
      dialog.showErrorBox(PRODUCT_NAME, "The game files are missing. Please reinstall the app.");
      app.quit();
      return;
    }

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    protocol.handle(APP_SCHEME, handleAppRequest);
    Menu.setApplicationMenu(null);
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  app.quit();
});
