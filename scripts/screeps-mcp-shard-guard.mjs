#!/usr/bin/env node
// Wraps the screeps-mcp stdio server and fills in a missing `shard` argument on
// shard-scoped tool calls.
//
// screeps-mcp parses `shardDefault` from .screeps-mcp/config.json but never
// applies it: `dist/tools/world.js` forwards `input.shard` straight to the API,
// so an omitted shard silently resolves to shard0. That is not a loud failure --
// most room names exist on every shard, so a wrong-shard read returns a
// stranger's coherent, fully-built room instead of an error.
//
// Both MCP clients here launch the server through scripts/screeps-mcp.sh, which
// makes this the one place that can enforce the default. Claude Code could do it
// with a PreToolUse hook; Codex (0.125.0) has no hook mechanism at all, so the
// shared launcher is the only chokepoint that covers both.
//
// An explicit `shard` argument always wins, so cross-shard reads still work.
//
// Delete this wrapper once screeps-mcp applies `shardDefault` itself. Verified
// absent as of 2026.4.91656; re-check `dist/tools/world.js` after upgrading.
//
// Residual hole: a profile with no `shardDefault` injects nothing and falls back
// to shard0. The warning below goes to stderr, which agents do not read, so a
// shard-scoped response echoing `"shard": null` is the tell that this never ran.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Tools whose input schema accepts `shard`. Everything else (whoami, get_cpu,
// get_shard_info, branch/code tools) is account-scoped and must pass through.
const SHARD_SCOPED_TOOLS = new Set([
  "execute_console",
  "get_encoded_room_image",
  "get_map_stats",
  "get_memory",
  "get_room_objects",
  "get_room_overview",
  "get_room_status",
  "get_room_terrain",
  "set_memory",
]);

function readDefaultShard() {
  const configPath = resolve(repoRoot, process.env.SCREEPS_MCP_CONFIG ?? ".screeps-mcp/config.json");
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const profile = config.profiles?.[config.defaultProfile];
    const shard = profile?.shardDefault;
    return typeof shard === "string" && shard.trim() ? shard.trim() : null;
  } catch {
    return null;
  }
}

const defaultShard = readDefaultShard();

if (!defaultShard) {
  process.stderr.write(
    "[shard-guard] no shardDefault resolved; shard-scoped calls will fall back to shard0\n",
  );
}

/**
 * Rewrite one line of JSON-RPC. Any line we cannot confidently parse and
 * classify is forwarded byte-for-byte, so a bad assumption here degrades to
 * today's behavior rather than breaking the transport.
 */
function rewrite(line) {
  if (!defaultShard || !line.trim()) return line;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return line;
  }

  if (message?.method !== "tools/call") return line;

  const params = message.params;
  if (!params || !SHARD_SCOPED_TOOLS.has(params.name)) return line;

  const args = params.arguments;
  if (!args || typeof args !== "object" || Array.isArray(args)) return line;
  if (typeof args.shard === "string" && args.shard.trim()) return line;

  args.shard = defaultShard;
  process.stderr.write(`[shard-guard] ${params.name}: defaulted shard to ${defaultShard}\n`);

  try {
    return JSON.stringify(message);
  } catch {
    return line;
  }
}

const child = spawn("npx", ["-y", "screeps-mcp@latest"], {
  cwd: repoRoot,
  env: process.env,
  stdio: ["pipe", "inherit", "inherit"],
});

child.on("error", (error) => {
  process.stderr.write(`[shard-guard] failed to start screeps-mcp: ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});

// MCP stdio framing is newline-delimited JSON, one message per line.
let buffer = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    child.stdin.write(`${rewrite(line)}\n`);
    newline = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => {
  if (buffer) child.stdin.write(rewrite(buffer));
  child.stdin.end();
});
