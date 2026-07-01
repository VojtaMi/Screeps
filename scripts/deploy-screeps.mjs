import { readFile } from "node:fs/promises";

await loadDotEnv();

const token = process.env.SCREEPS_TOKEN || process.env.SCREEPS_MMO_TOKEN;
const branch = process.env.SCREEPS_BRANCH || "default";

if (!token) {
  throw new Error("SCREEPS_TOKEN or SCREEPS_MMO_TOKEN is required.");
}

const main = await readFile("dist/main.js", "utf8");
const response = await fetch("https://screeps.com/api/user/code", {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "X-Token": token,
  },
  body: JSON.stringify({
    branch,
    modules: {
      main,
    },
  }),
});

const responseText = await response.text();

if (!response.ok) {
  throw new Error(`Screeps deploy failed with HTTP ${response.status}: ${responseText}`);
}

const result = JSON.parse(responseText);
if (result.ok !== 1) {
  throw new Error(`Screeps deploy failed: ${responseText}`);
}

console.log(`Deployed dist/main.js to Screeps branch "${branch}".`);

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
