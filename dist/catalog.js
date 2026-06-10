import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { parse as parseYaml } from "yaml";
import { CACHE_DIR, REPO_DIR, REPO_URL, SKILLS_SUBDIR, ensureDir } from "./util/paths.js";
import { log } from "./util/log.js";
// Derive the codeload tarball URL from REPO_URL.
// Default: https://github.com/BioTender-max/awesome-bio-agent-skills.git
//      -> https://codeload.github.com/BioTender-max/awesome-bio-agent-skills/tar.gz/main
function tarballUrl() {
    const m = REPO_URL.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!m) {
        throw new Error(`Cannot derive tarball URL from REPO_URL=${REPO_URL}`);
    }
    const branch = process.env.BIOSKILL_REPO_BRANCH || "main";
    return `https://codeload.github.com/${m[1]}/${m[2]}/tar.gz/${branch}`;
}
export async function syncRepo(opts = {}) {
    ensureDir(CACHE_DIR);
    // We treat the cache as "populated" if the skills/ subdir exists.
    const skillsDir = path.join(REPO_DIR, SKILLS_SUBDIR);
    const populated = fs.existsSync(skillsDir);
    if (populated && !opts.force)
        return;
    await downloadAndExtract();
}
async function downloadAndExtract() {
    const url = tarballUrl();
    log.info(`Downloading skill catalog from ${url}`);
    const tmpFile = path.join(os.tmpdir(), `bioskill-${Date.now()}-${process.pid}.tar.gz`);
    // Stream download to tmp file. Native fetch in Node 18+.
    const res = await fetch(url, {
        headers: { "User-Agent": "bioskill-cli" },
        redirect: "follow",
    });
    if (!res.ok || !res.body) {
        throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    }
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmpFile));
    // Extract into a clean staging dir, then atomically swap REPO_DIR.
    const stagingDir = path.join(CACHE_DIR, `.staging-${Date.now()}-${process.pid}`);
    ensureDir(stagingDir);
    try {
        // System tar exists on macOS, Linux, and Windows 10 1803+.
        execSync(`tar -xzf "${tmpFile}" -C "${stagingDir}"`, { stdio: ["ignore", "ignore", "pipe"] });
    }
    catch (e) {
        cleanup(tmpFile, stagingDir);
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`tar extraction failed: ${msg}\n` +
            `Make sure 'tar' is installed and on PATH. On Windows, use Windows 10 1803+ which ships tar.exe.`);
    }
    // The tarball extracts to <repo>-<branch>/. Find it.
    const entries = fs.readdirSync(stagingDir).filter((n) => !n.startsWith("."));
    if (entries.length !== 1) {
        cleanup(tmpFile, stagingDir);
        throw new Error(`Unexpected tarball layout in ${stagingDir}: ${entries.join(", ")}`);
    }
    const extractedDir = path.join(stagingDir, entries[0]);
    // Swap into place.
    if (fs.existsSync(REPO_DIR)) {
        fs.rmSync(REPO_DIR, { recursive: true, force: true });
    }
    fs.renameSync(extractedDir, REPO_DIR);
    cleanup(tmpFile, stagingDir);
    log.ok("Catalog ready.");
}
function cleanup(...paths) {
    for (const p of paths) {
        try {
            if (!fs.existsSync(p))
                continue;
            const st = fs.statSync(p);
            if (st.isDirectory())
                fs.rmSync(p, { recursive: true, force: true });
            else
                fs.unlinkSync(p);
        }
        catch {
            /* ignore */
        }
    }
}
function parseCsv(text) {
    // Naive CSV parser sufficient for this file (no embedded newlines in fields).
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
    if (lines.length === 0)
        return [];
    const header = splitCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
        const cells = splitCsvLine(line);
        const row = {};
        header.forEach((h, i) => (row[h] = cells[i] ?? ""));
        return row;
    });
}
function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (ch === "," && !inQuotes) {
            out.push(cur);
            cur = "";
        }
        else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}
function readFrontmatter(skillMdPath) {
    try {
        const text = fs.readFileSync(skillMdPath, "utf8");
        const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!m)
            return {};
        const data = parseYaml(m[1]);
        if (typeof data !== "object" || data === null)
            return {};
        const d = data;
        return {
            name: typeof d.name === "string" ? d.name : undefined,
            description: typeof d.description === "string" ? d.description.trim() : undefined,
            category: typeof d.category === "string" ? d.category : undefined,
        };
    }
    catch {
        return {};
    }
}
let cached = null;
export async function loadCatalog(opts = {}) {
    if (cached && !opts.update)
        return cached;
    await syncRepo({ force: opts.update });
    // Build a metadata map from the CSV (best-effort, may be incomplete).
    const csvPath = path.join(REPO_DIR, "bioskill_index_v2.csv");
    const meta = new Map();
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
    const skills = [];
    for (const source of fs.readdirSync(skillsRoot)) {
        const sourceDir = path.join(skillsRoot, source);
        const st = fs.statSync(sourceDir);
        if (!st.isDirectory())
            continue;
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
            let s;
            try {
                s = fs.statSync(skillDir);
            }
            catch {
                continue;
            }
            if (!s.isDirectory())
                continue;
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
        if (a.category !== b.category)
            return a.category.localeCompare(b.category);
        if (a.source !== b.source)
            return a.source.localeCompare(b.source);
        return a.name.localeCompare(b.name);
    });
    cached = skills;
    return skills;
}
function hasChildSkills(dir) {
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                const childSkill = path.join(dir, entry.name, "SKILL.md");
                if (fs.existsSync(childSkill))
                    return true;
            }
        }
    }
    catch {
        /* ignore */
    }
    return false;
}
function countFiles(dir) {
    let n = 0;
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            if (e.isDirectory())
                walk(path.join(d, e.name));
            else
                n++;
        }
    };
    try {
        walk(dir);
    }
    catch {
        /* ignore */
    }
    return n;
}
export function findSkill(skills, query) {
    // Exact name match wins.
    const exact = skills.find((s) => s.name === query);
    if (exact)
        return exact;
    // Allow "source/name" syntax.
    if (query.includes("/")) {
        const [source, name] = query.split("/");
        return skills.find((s) => s.source === source && s.name === name);
    }
    // Case-insensitive name match.
    const ci = skills.find((s) => s.name.toLowerCase() === query.toLowerCase());
    return ci;
}
