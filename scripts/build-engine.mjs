import { build } from "esbuild";
import path from "node:path";

const root = process.cwd();
const dev = process.argv.includes("--dev");

await build({
  entryPoints: [path.join(root, "src", "canvas", "main.js")],
  bundle: true,
  outfile: path.join(root, "canvas.js"),
  format: "esm",
  platform: "browser",
  target: ["chrome120", "edge120", "firefox120", "safari17"],
  sourcemap: dev ? "inline" : false,
  minify: !dev,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production")
  },
  logLevel: "warning"
});

console.log(`Canvas engine built${dev ? " (dev)" : ""}: canvas.js`);
