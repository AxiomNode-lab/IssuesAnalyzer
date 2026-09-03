import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../apps/web/src/", import.meta.url));
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const serverSecret = /(?:DATABASE_URL|REDIS_URL|GITHUB_TOKEN|SESSION_SECRET|CLIENT_SECRET)/;
const publicSecret = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|DATABASE|REDIS)/;
const violations = [];

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (sourceExtensions.has(extname(entry.name))) {
      const source = await readFile(path, "utf8");
      if (/^[\s\r\n]*["']use client["'];/m.test(source) && serverSecret.test(source)) {
        violations.push(`${path}: client module references a server-only secret name`);
      }
      if (publicSecret.test(source)) violations.push(`${path}: sensitive NEXT_PUBLIC variable`);
    }
  }
}

await inspect(sourceRoot);
if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Server/client secret boundary check passed.");
}
