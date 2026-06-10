import path from "node:path";
import fs from "node:fs";
import { findSkill, loadCatalog, Skill } from "../catalog.js";
import { TARGETS, resolveTarget, copyDir, TargetScope } from "../targets.js";
import { log, c } from "../util/log.js";
import { filter } from "./list.js";

export interface InstallOptions {
  target: string;
  scope?: TargetScope;
  dir?: string;
  category?: string;
  source?: string;
  all?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

export async function installCommand(skillArgs: string[], opts: InstallOptions): Promise<void> {
  if (!opts.target) {
    log.err(`--target required. Available: ${Object.keys(TARGETS).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const target = resolveTarget(opts.target);
  const scope: TargetScope = opts.scope || "project";
  const targetDir = opts.dir
    ? path.resolve(opts.dir)
    : target.skillsDir(scope, process.cwd());

  const skills = await loadCatalog();
  const picked = pickSkills(skills, skillArgs, opts);

  if (picked.length === 0) {
    log.warn("No skills selected. Pass skill names, or use --category / --source / --all.");
    process.exitCode = 1;
    return;
  }

  log.info(
    `Installing ${c.bold(String(picked.length))} skill${picked.length === 1 ? "" : "s"} → ${c.bold(target.label)} (${scope})`,
  );
  log.dim(`Target: ${targetDir}`);

  if (opts.dryRun) {
    for (const s of picked) {
      log.raw(`  ${c.dim("would copy")} ${s.source}/${s.name}`);
    }
    log.dim(`\nDry run. Re-run without --dry-run to apply.`);
    return;
  }

  if (!opts.yes && picked.length > 20) {
    log.warn(`About to install ${picked.length} skills. Re-run with --yes to confirm.`);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  let totalWritten = 0;
  let totalSkipped = 0;
  const installed: string[] = [];
  const errors: { skill: string; err: string }[] = [];

  for (const s of picked) {
    const dst = path.join(targetDir, s.name);
    try {
      const { written, skipped } = copyDir(s.path, dst, { overwrite: opts.overwrite });
      totalWritten += written;
      totalSkipped += skipped;
      installed.push(s.name);
      log.raw(
        `  ${c.green("✓")} ${pad(s.name, 36)} ${c.dim(`${s.source} · ${s.category}`)} ${
          written ? c.dim(`(+${written}${skipped ? `, ~${skipped} skipped` : ""})`) : c.dim("(no changes)")
        }`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ skill: s.name, err: msg });
      log.raw(`  ${c.red("✗")} ${s.name}  ${c.dim(msg)}`);
    }
  }

  log.raw("");
  log.ok(
    `${installed.length} installed · ${totalWritten} files written${
      totalSkipped ? ` · ${totalSkipped} skipped` : ""
    }${errors.length ? ` · ${errors.length} failed` : ""}`,
  );

  if (target.postInstallHint) log.dim(target.postInstallHint);
  if (errors.length) process.exitCode = 1;
}

function pickSkills(skills: Skill[], names: string[], opts: InstallOptions): Skill[] {
  if (opts.all) {
    return filter(skills, opts);
  }
  if (names.length === 0 && (opts.category || opts.source)) {
    return filter(skills, opts);
  }

  const result: Skill[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const found = findSkill(skills, n);
    if (!found) {
      log.warn(`Skill "${n}" not found.`);
      continue;
    }
    const key = `${found.source}/${found.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(found);
  }
  return result;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
