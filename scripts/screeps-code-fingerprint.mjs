import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

const file = args.file || args._[0] || "dist/main.js";
const code = await readFile(file, "utf8");
const sha256 = createHash("sha256").update(code).digest("hex");

if (args.format === "env") {
  console.log(`SCREEPS_CODE_SHA256=${sha256}`);
} else if (args.format === "json") {
  console.log(JSON.stringify({ file, sha256 }));
} else {
  console.log(sha256);
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
    if (rawKey === "help") {
      parsed[rawKey] = true;
      continue;
    }

    parsed[rawKey] = inlineValue ?? argv[++index];
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage:
  npm run code:fingerprint -- [dist/main.js]

Options:
  --file <path>      File to hash (default: dist/main.js)
  --format <format>  Output format: plain, env, or json (default: plain)
`);
}
