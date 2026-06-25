#!/usr/bin/env node

import { lstat, mkdir, readdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const codexSkillsDir = path.join(root, ".agents", "skills");
const claudeSkillsDir = path.join(root, ".claude", "skills");

function usage() {
  console.log(`Usage:
  node scripts/sync-claude-skills.mjs [--dry-run] [--check]

Creates .claude/skills/<skill> symlinks to .agents/skills/<skill>.
Refuses to overwrite non-symlink files or symlinks that do not point into .agents/skills.

Options:
  --dry-run  Print changes without applying them
  --check    Print needed changes and exit non-zero if links are stale`);
}

function parseArgs(argv) {
  const args = { dryRun: false, check: false };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--check") {
      args.check = true;
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function listCodexSkills() {
  const entries = await readdir(codexSkillsDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(codexSkillsDir, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (await pathExists(skillFile)) {
      skills.push({ name: entry.name, skillDir });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function expectedTarget(skillDir) {
  return path.relative(claudeSkillsDir, skillDir);
}

function pointsIntoCodexSkills(linkTarget) {
  const absoluteTarget = path.resolve(claudeSkillsDir, linkTarget);
  const relativeTarget = path.relative(codexSkillsDir, absoluteTarget);
  return relativeTarget && !relativeTarget.startsWith("..") && !path.isAbsolute(relativeTarget);
}

async function syncSkill(skill, args) {
  const linkPath = path.join(claudeSkillsDir, skill.name);
  const linkTarget = expectedTarget(skill.skillDir);

  try {
    const stat = await lstat(linkPath);
    if (!stat.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite non-symlink: ${path.relative(root, linkPath)}`);
    }

    const currentTarget = await readlink(linkPath);
    if (currentTarget === linkTarget) {
      console.log(`ok ${path.relative(root, linkPath)} -> ${currentTarget}`);
      return false;
    }

    if (!pointsIntoCodexSkills(currentTarget)) {
      throw new Error(
        `Refusing to replace symlink outside .agents/skills: ${path.relative(root, linkPath)} -> ${currentTarget}`,
      );
    }

    console.log(`update ${path.relative(root, linkPath)} -> ${linkTarget}`);
    if (!args.dryRun) {
      await unlink(linkPath);
      await symlink(linkTarget, linkPath);
    }
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    console.log(`create ${path.relative(root, linkPath)} -> ${linkTarget}`);
    if (!args.dryRun) {
      await symlink(linkTarget, linkPath);
    }
    return true;
  }
}

async function removeStaleLinks(skills, args) {
  const wanted = new Set(skills.map((skill) => skill.name));
  let changed = false;
  let entries = [];

  try {
    entries = await readdir(claudeSkillsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const entry of entries) {
    if (!entry.isSymbolicLink() || wanted.has(entry.name)) {
      continue;
    }

    const linkPath = path.join(claudeSkillsDir, entry.name);
    const linkTarget = await readlink(linkPath);
    if (!pointsIntoCodexSkills(linkTarget)) continue;

    console.log(`remove stale ${path.relative(root, linkPath)} -> ${linkTarget}`);
    if (!args.dryRun) {
      await unlink(linkPath);
    }
    changed = true;
  }

  return changed;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const skills = await listCodexSkills();
  if (!args.check) {
    await mkdir(claudeSkillsDir, { recursive: true });
  }

  let changed = false;
  for (const skill of skills) {
    changed = (await syncSkill(skill, args)) || changed;
  }

  changed = (await removeStaleLinks(skills, args)) || changed;

  if (args.check && changed) {
    console.error("Claude skill links are stale. Run: npm run skills:sync:claude");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
