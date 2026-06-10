import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { CACHE_DIR, REPO_DIR, REPO_URL, SKILLS_SUBDIR, ensureDir } from "./util/paths.js";
import { log } from "./util/log.js";

export type Skill = {
  name: string;          // skill folder name (the identifier)
  source: string;        // upstream source repo dir (e.g. "adaptyv")
  category: string;      // e.g. "proteomics"
  description: string;   // first paragraph or frontmatter description
  path: string;          // absolute path to skill folder in cache
  fileCount: number;
};

type CsvRow = {
  skill_name: string;
  folder_name: string;
  source_repo: string;
  category: string;
  description: string;
  file_count: string;
  archive_path: string;
};

function run(cmd: string, opts: { cwd?: string; silent?: boolean } = {}): string {
  return execSync(cmd, {
    cwd: opts.cwd,
    stdio: opts.silent ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
}

export async function syncRepo(opts: { force?: boolean } = {}): Promise<void> {
  ensureDir(CACHE_DIR);

  const gitDir = path.join(REPO_DIR, ".git");

  if (!fs.existsSync(gitDir)) {
    log.info(`Cloning skill catalog into ${REPO_DIR}`);
    run(`git clone --depth=1 ${REPO_URL} ${REPO_DIR}`);
    log.ok("Catalog ready.");
    return;
  }

  if (opts.force) {
    log.info("Updating skill catalog");
    try {
      run(`git fetch --depth=1 origin main`, { cwd: REPO_DIR, silent: true });
      run(`git reset --hard origin/main`, { cwd: REPO_DIR, silent: true });
      log.ok("Catalog updated.");
    } catch (e) {
      log.warn("Catalog update failed, using cached copy.");
    }
  }
}

function parseCsv(text: string): CsvRow[] {
  // Naive CSV parser sufficient for this file (no embedded newlines in fields).
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row as unknown as CsvRow;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readFrontmatter(skillMdPath: string): { name?: string; description?: string; category?: string } {
  try {
    const text = fs.readFileSync(skillMdPath, "utf8");
    const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) return {};
    const data = parseYaml(m[1]);
    if (typeof data !== "object" || data === null) return {};
    const d = data as Record<string, unknown>;
    return {
      name: typeof d.name === "string" ? d.name : undefined,
      description: typeof d.description === "string" ? d.description.trim() : undefined,
      category: typeof d.category === "string" ? d.category : undefined,
    };
  } catch {
    return {};
  }
}

let cached: Skill[] | null = null;

export async function loadCatalog(opts: { update?: boolean } = {}): Promise<Skill[]> {
  if (cached && !opts.update) return cached;

  await syncRepo({ force: opts.update });

  // Build a metadata map from the CSV (best-effort, may be incomplete).
  const csvPath = path.join(REPO_DIR, "bioskill_index_v2.csv");
  const meta = new Map<string, CsvRow>();
  if (fs.existsSync(csvPath)) {
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
    for (const r of rows) {
      meta.set(`${r.source_repo}/${r.folder_name}`, r);
    }
  }

  // Source of truth: walk skills/ on disk.
  const skillsRoot = path.join(REPO_DIR, SKILLS_SUBDIR);
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Skills directory not found at ${skillsRoot}. Try: bioskill sync`);
  }

  const skills: Skill[] = [];
  for (const source of fs.readdirSync(skillsRoot)) {
    const sourceDir = path.join(skillsRoot, source);
    const st = fs.statSync(sourceDir);
    if (!st.isDirectory()) continue;

    // Handle case like bio-agent-skills-hub which is a single skill (has SKILL.md directly).
    if (fs.existsSync(path.join(sourceDir, "SKILL.md")) && !hasChildSkills(sourceDir)) {
      const fm = readFrontmatter(path.join(sourceDir, "SKILL.md"));
      skills.push({
        name: source,
        source: source,
        category: fm.category || "other",
        description: fm.description || "",
        path: sourceDir,
        fileCount: countFiles(sourceDir),
      });
      continue;
    }

    for (const name of fs.readdirSync(sourceDir)) {
      const skillDir = path.join(sourceDir, name);
      let s: fs.Stats;
      try {
        s = fs.statSync(skillDir);
      } catch {
        continue;
      }
      if (!s.isDirectory()) continue;

      const key = `${source}/${name}`;
      const row = meta.get(key);
      const skillMd = path.join(skillDir, "SKILL.md");
      const hasSkillMd = fs.existsSync(skillMd);
      const fm = hasSkillMd ? readFrontmatter(skillMd) : {};

      skills.push({
        name,
        source,
        category: (row?.category || fm.category || "other").toLowerCase(),
        description: row?.description && row.description !== ">"
          ? row.description
          : (fm.description || ""),
        path: skillDir,
        fileCount: row?.file_count ? Number(row.file_count) : countFiles(skillDir),
      });
    }
  }

  skills.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.name.localeCompare(b.name);
  });

  cached = skills;
  return skills;
}

function hasChildSkills(dir: string): boolean {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const childSkill = path.join(dir, entry.name, "SKILL.md");
        if (fs.existsSync(childSkill)) return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

function countFiles(dir: string): number {
  let n = 0;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else n++;
    }
  };
  try {
    walk(dir);
  } catch {
    /* ignore */
  }
  return n;
}

export function findSkill(skills: Skill[], query: string): Skill | undefined {
  // Exact name match wins.
  const exact = skills.find((s) => s.name === query);
  if (exact) return exact;

  // Allow "source/name" syntax.
  if (query.includes("/")) {
    const [source, name] = query.split("/");
    return skills.find((s) => s.source === source && s.name === name);
  }

  // Case-insensitive name match.
  const ci = skills.find((s) => s.name.toLowerCase() === query.toLowerCase());
  return ci;
}
