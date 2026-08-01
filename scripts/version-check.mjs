import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf8"));
const appVersionSrc = readFileSync(join(ROOT, "src", "companion", "app-version.ts"), "utf8");
const userScript = readFileSync(join(ROOT, "scripts", "Companion.user.js"), "utf8");
const arenaScript = readFileSync(join(ROOT, "scripts", "Companion.arena.user.js"), "utf8");

const expected = pkg.version;
const appVersionMatch = appVersionSrc.match(/APP_VERSION\s*=\s*"v([^"]+)"/);
const userVersion = userScript.match(/@version\s+([^\s]+)/)?.[1];
const arenaVersion = arenaScript.match(/@version\s+([^\s]+)/)?.[1];

const failures = [];
if (manifest.version !== expected) failures.push(`manifest.json version ${manifest.version} != package.json ${expected}`);
if (!appVersionMatch) failures.push("APP_VERSION constant not found");
else if (appVersionMatch[1] !== expected) failures.push(`APP_VERSION v${appVersionMatch[1]} != package.json ${expected}`);
if (userVersion !== expected) failures.push(`Companion.user.js @version ${userVersion} != package.json ${expected}`);
if (arenaVersion !== expected) failures.push(`Companion.arena.user.js @version ${arenaVersion} != package.json ${expected}`);

if (failures.length > 0) {
  console.error("Version mismatch detected:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Version check OK: all artifacts report ${expected}`);