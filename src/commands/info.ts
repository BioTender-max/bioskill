import fs from "node:fs";
import path from "node:path";
import { findSkill, loadCatalog } from "../catalog.js";
import { log, c } from "../util/log.js";

export async function infoCommand(query: string): Promise<void> {
  const skills = await loadCatalog();
  const s = findSkill(skills, query);
  if (!s) {
    log.err(`Skill "${query}" not found. Try: bioskill search ${query}`);
    process.exitCode = 1;
    return;
  }

  log.raw(c.bold(s.name));
  log.raw(`  ${c.dim("source")}     ${s.source}`);
  log.raw(`  ${c.dim("category")}   ${s.category}`);
  log.raw(`  ${c.dim("files")}      ${s.fileCount}`);
  log.raw("");
  if (s.description) {
    log.raw(s.description);
    log.raw("");
  }

  const skillMd = path.join(s.path, "SKILL.md");
  if (fs.existsSync(skillMd)) {
    log.dim(`SKILL.md: ${skillMd}`);
  }
}
