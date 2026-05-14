import { readFile } from "node:fs/promises";

const token = process.env.SCREEPS_TOKEN;
const branch = process.env.SCREEPS_BRANCH || "default";

if (!token) {
  throw new Error("SCREEPS_TOKEN is required. Add it as a GitHub Actions secret.");
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
