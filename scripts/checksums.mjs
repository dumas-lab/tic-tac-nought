import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "dist", "desktop");
const output = path.join(root, "SHA256SUMS");
const extensions = [".AppImage", ".deb", ".exe", ".zip"];

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

let entries;
try {
  entries = await readdir(root, { withFileTypes: true });
} catch (err) {
  console.error(`No build directory at ${root}. Run a dist command first.`);
  process.exit(1);
}

const files = entries
  .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
  .map((entry) => entry.name)
  .sort();

if (!files.length) {
  console.error(`No release artifacts found in ${root}.`);
  process.exit(1);
}

const lines = [];
for (const file of files) {
  lines.push(`${await sha256(path.join(root, file))}  ${file}`);
}
await writeFile(output, lines.join("\n") + "\n");
console.log(`Wrote ${output}`);
console.log(lines.join("\n"));
