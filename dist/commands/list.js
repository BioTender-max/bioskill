import { loadCatalog } from "../catalog.js";
import { log, c } from "../util/log.js";
export async function listCommand(opts) {
    const skills = await loadCatalog({ update: opts.update });
    const filtered = filter(skills, opts);
    if (!opts.category && !opts.source) {
        summarize(skills);
        log.dim(`\nTotal: ${skills.length} skills. Use --category or --source to filter, or 'bioskill search <q>' to look up.`);
        return;
    }
    if (filtered.length === 0) {
        log.warn("No skills matched.");
        return;
    }
    for (const s of filtered) {
        if (opts.long) {
            log.raw(`${c.bold(s.name)}  ${c.dim(`(${s.source} · ${s.category})`)}`);
            if (s.description)
                log.raw(`  ${truncate(s.description, 280)}`);
            log.raw("");
        }
        else {
            log.raw(`${pad(s.name, 36)}  ${c.dim(pad(s.source, 18))}  ${c.dim(s.category)}`);
        }
    }
    log.dim(`\n${filtered.length} skills.`);
}
function summarize(skills) {
    const byCategory = group(skills, (s) => s.category);
    const bySource = group(skills, (s) => s.source);
    log.raw(c.bold("By category"));
    for (const [k, arr] of sortByCount(byCategory)) {
        log.raw(`  ${pad(k, 24)}  ${c.dim(String(arr.length))}`);
    }
    log.raw("");
    log.raw(c.bold("By source"));
    for (const [k, arr] of sortByCount(bySource)) {
        log.raw(`  ${pad(k, 24)}  ${c.dim(String(arr.length))}`);
    }
}
export function filter(skills, opts) {
    return skills.filter((s) => {
        if (opts.category && s.category.toLowerCase() !== opts.category.toLowerCase())
            return false;
        if (opts.source && s.source.toLowerCase() !== opts.source.toLowerCase())
            return false;
        return true;
    });
}
function group(items, key) {
    const m = new Map();
    for (const i of items) {
        const k = key(i);
        if (!m.has(k))
            m.set(k, []);
        m.get(k).push(i);
    }
    return m;
}
function sortByCount(m) {
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}
function pad(s, n) {
    if (s.length >= n)
        return s;
    return s + " ".repeat(n - s.length);
}
function truncate(s, n) {
    const flat = s.replace(/\s+/g, " ").trim();
    return flat.length <= n ? flat : flat.slice(0, n - 1) + "…";
}
