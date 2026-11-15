#!/usr/bin/env node
// Manages the optional skin in ./skin (a separate repository, ignored by git).
//
//   node scripts/skin.mjs install <git-url>   clone the skin into ./skin
//   node scripts/skin.mjs update              pull the latest skin
//   node scripts/skin.mjs remove              delete ./skin

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIN_DIR = join(ROOT, "skin");
const [command, url] = process.argv.slice(2);

function git(...args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (command === "install") {
  const repo = url ?? process.env.SKIN_REPO;
  if (!repo) {
    console.error("Usage: pnpm skin:install <git-url>  (or set SKIN_REPO)");
    process.exit(1);
  }
  if (existsSync(SKIN_DIR)) {
    console.error("skin/ already exists. Run `pnpm skin:update`, or `pnpm skin:remove` first.");
    process.exit(1);
  }
  git("clone", "--depth", "1", repo, SKIN_DIR);
  console.log("skin installed. Restart the dev server to apply it.");
} else if (command === "update") {
  if (!existsSync(join(SKIN_DIR, ".git"))) {
    console.error("No skin installed. Run `pnpm skin:install <git-url>` first.");
    process.exit(1);
  }
  git("-C", SKIN_DIR, "pull", "--ff-only");
} else if (command === "remove") {
  rmSync(SKIN_DIR, { recursive: true, force: true });
  console.log("skin removed.");
} else {
  console.error("Usage: node scripts/skin.mjs <install <git-url> | update | remove>");
  process.exit(1);
}
