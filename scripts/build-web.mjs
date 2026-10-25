import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist", "web");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(path.join(root, "index.html"), path.join(dist, "index.html"));
await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "web", "manifest.json"), path.join(dist, "manifest.json"));
await cp(path.join(root, "web", "pwa.js"), path.join(dist, "pwa.js"));

await mkdir(path.join(dist, "icons"), { recursive: true });
for (const icon of ["icon-32.png", "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  await cp(path.join(root, "web", "icons", icon), path.join(dist, "icons", icon));
}

let index = await readFile(path.join(dist, "index.html"), "utf8");
const scriptHashes = [];
const inlineScript = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
for (const match of index.matchAll(inlineScript)) {
  if (!match[1].trim()) continue;
  scriptHashes.push(`sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}`);
}

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' ${scriptHashes.map((hash) => `'${hash}'`).join(" ")}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests"
];
const csp = cspDirectives.join("; ");
const headerCsp = [...cspDirectives, "frame-ancestors 'none'"].join("; ");

const escapedCsp = csp.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${escapedCsp}">`;
if (!index.includes('http-equiv="Content-Security-Policy"')) {
  index = index.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${cspMeta}`);
}
await writeFile(path.join(dist, "index.html"), index);
await writeFile(path.join(dist, "csp.txt"), headerCsp + "\n");
await writeFile(path.join(dist, "_headers"), `/*
  Content-Security-Policy: ${headerCsp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
`);
await writeFile(path.join(dist, ".nojekyll"), "");

const files = [];
async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel);
    else files.push(rel);
  }
}
await walk(dist);
files.sort();

const skipped = new Set(["sw.js", "_headers", "csp.txt", ".nojekyll"]);
const precache = ["./", ...files.filter((file) => !skipped.has(file)).map((file) => `./${file}`)];
const swTemplate = await readFile(path.join(root, "web", "sw.template.js"), "utf8");
const sw = swTemplate
  .replaceAll("__VERSION__", pkg.version)
  .replace("__PRECACHE__", JSON.stringify(precache, null, 2));
await writeFile(path.join(dist, "sw.js"), sw);

const total = (await Promise.all(files.map(async (file) => (await stat(path.join(dist, file))).size))).reduce((a, b) => a + b, 0);
console.log(`Web build ${pkg.version}: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB, ${precache.length} precached.`);
console.log(`CSP script hashes: ${scriptHashes.length}`);
