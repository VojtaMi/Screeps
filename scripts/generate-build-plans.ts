import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BuildPlansData,
  serializeBuildPlansToTypeScript,
  withDerivedBuildPlanFields,
} from "../shared/buildPlans";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");
const jsonPath = path.join(root, "src", "buildPlans.json");
const tsPath = path.join(root, "src", "buildPlans.ts");

function readBuildPlansJson(): BuildPlansData {
  return JSON.parse(readFileSync(jsonPath, "utf8")) as BuildPlansData;
}

function writeCanonicalJson(plans: BuildPlansData): void {
  writeFileSync(
    jsonPath,
    `${JSON.stringify(withDerivedBuildPlanFields(plans), null, 2)}\n`,
  );
}

export function generateBuildPlans(): void {
  const plans = readBuildPlansJson();
  writeCanonicalJson(plans);
  writeFileSync(tsPath, serializeBuildPlansToTypeScript(plans));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateBuildPlans();
}
