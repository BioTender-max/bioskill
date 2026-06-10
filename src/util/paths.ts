import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export const CACHE_DIR =
  process.env.BIOSKILL_CACHE_DIR ||
  path.join(os.homedir(), ".bioskill", "cache");

export const REPO_DIR = path.join(CACHE_DIR, "awesome-bio-agent-skills");

export const REPO_URL =
  process.env.BIOSKILL_REPO_URL ||
  "https://github.com/BioTender-max/awesome-bio-agent-skills.git";

export const SKILLS_SUBDIR = "skills";

export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}
