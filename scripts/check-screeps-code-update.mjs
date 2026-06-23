import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const DEFAULT_HOST = "https://screeps.com";
const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

await loadDotEnv();
const DEFAULT_BRANCH = process.env.SCREEPS_BRANCH || "default";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

const expected = await getExpected(args);
if (!expected) {
  console.error("CHECK_UPDATE_ERROR missing required --fingerprint, --sha256, or --file");
  printUsage();
  process.exit(2);
}

const token = process.env.SCREEPS_TOKEN || process.env.SCREEPS_MMO_TOKEN;
if (!token) {
  console.error("CHECK_UPDATE_ERROR SCREEPS_TOKEN or SCREEPS_MMO_TOKEN is required");
  process.exit(3);
}

const branch = args.branch || DEFAULT_BRANCH;
const host = args.host || DEFAULT_HOST;
const moduleName = args.module || "main";
const timeoutMs = parsePositiveInt(args["timeout-ms"], DEFAULT_TIMEOUT_MS);
const intervalMs = parsePositiveInt(args["interval-ms"], DEFAULT_INTERVAL_MS);
const startedAt = Date.now();
let attempts = 0;

while (Date.now() - startedAt <= timeoutMs) {
  attempts += 1;
  const code = await getCode({ branch, host, moduleName, token });

  if (matchesExpected(code, expected)) {
    console.log(
      `CHECK_UPDATE_OK mode=${expected.mode} branch=${branch} module=${moduleName} attempts=${attempts} elapsedMs=${
        Date.now() - startedAt
      }`,
    );
    process.exit(0);
  }

  if (args.once) {
    break;
  }

  await sleep(intervalMs);
}

console.error(
  `CHECK_UPDATE_TIMEOUT mode=${expected.mode} branch=${branch} module=${moduleName} attempts=${attempts} elapsedMs=${
    Date.now() - startedAt
  } expected=${JSON.stringify(expected.value)}`,
);
process.exit(1);

async function getExpected(args) {
  if (args.file) {
    return {
      mode: "sha256",
      value: await hashFile(args.file),
    };
  }

  if (args.sha256) {
    return {
      mode: "sha256",
      value: args.sha256,
    };
  }

  const fingerprint = args.fingerprint || args._[0];
  if (fingerprint) {
    return {
      mode: "fingerprint",
      value: fingerprint,
    };
  }

  return null;
}

function matchesExpected(code, expected) {
  if (expected.mode === "sha256") {
    return hashText(code) === expected.value;
  }

  return code.includes(expected.value);
}

async function hashFile(file) {
  return hashText(await readFile(file, "utf8"));
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function getCode({ branch, host, moduleName, token }) {
  const url = new URL("/api/user/code", host);
  url.searchParams.set("branch", branch);

  const response = await fetch(url, {
    headers: {
      "X-Token": token,
    },
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Screeps code read failed with HTTP ${response.status}: ${responseText}`);
  }

  const result = JSON.parse(responseText);
  const modules = result.modules || result.branch?.modules || result.code?.modules;
  const code = modules?.[moduleName];

  if (typeof code !== "string") {
    const moduleNames = modules && typeof modules === "object" ? Object.keys(modules).join(",") : "none";
    throw new Error(
      `Screeps branch "${branch}" did not include module "${moduleName}". Available modules: ${moduleNames}`,
    );
  }

  return code;
}

async function loadDotEnv() {
  let text;
  try {
    text = await readFile(".env", "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (rawKey === "help" || rawKey === "once") {
      parsed[rawKey] = true;
      continue;
    }

    parsed[rawKey] = inlineValue ?? argv[++index];
  }

  return parsed;
}

function parsePositiveInt(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${JSON.stringify(value)}`);
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage:
  npm run check:update -- --file dist/main.js
  npm run check:update -- --sha256 "<expected sha256>"
  npm run check:update -- --fingerprint "<unique deployed code text>"

Options:
  --file <path>          Hash this local file and wait for deployed code to match
  --sha256 <hash>        Expected SHA-256 hash of the deployed Screeps module
  --fingerprint <text>    Text expected in the deployed Screeps module
  --branch <name>         Screeps branch to inspect (default: SCREEPS_BRANCH or default)
  --module <name>         Screeps module to inspect (default: main)
  --timeout-ms <number>   Maximum wait time (default: 300000)
  --interval-ms <number>  Poll interval (default: 10000)
  --once                  Check once and exit
  --host <url>            Screeps API host (default: https://screeps.com)
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
