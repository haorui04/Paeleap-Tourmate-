import { readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".paeleap", "reports"].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(path);
  }
}
await visit(root);
let failed = 0;
for (const path of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (result.status !== 0) { failed++; console.error(relative(root, path), result.stderr); }
}
console.log(JSON.stringify({ check: "JavaScript syntax (JSX is checked by Next build)", total: files.length, passed: files.length - failed, failed }));
process.exitCode = failed ? 1 : 0;
