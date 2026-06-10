import { loadCatalog } from "../catalog.js";
import { log, c } from "../util/log.js";

export interface SearchOptions {
  category?: string;
  source?: string;
  limit?: string;
}

export async function searchCommand(query: string, opts: SearchOptions): Promise<void> {
  if (!query) {
    log.err("Provide a search query: bioskill search <q>");
    process.exitCode = 1;
    return;
  }

  const skills = await loadCatalog();
  const q = query.toLowerCase();
  const limit = opts.limit ? parseInt(opts.limit, 10) : 50;

  const matched = skills
    .filter((s) => {
      if (opts.category && s.category !== opts.category.toLowerCase()) return false;
      if (opts.source && s.source !== opts.source.toLowerCase()) return false;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.includes(q)
      );
    })
    .slice(0, limit);

  if (matched.length === 0) {
    log.warn(`No matches for "${query}".`);
    return;
  }

  for (const s of matched) {
    log.raw(
      `${c.bold(s.name)}  ${c.dim(`${s.source} · ${s.category}`)}`,
    );
    if (s.description) {
      log.raw(`  ${truncate(s.description, 200)}`);
    }
    log.raw("");
  }
  log.dim(`${matched.length} result${matched.length === 1 ? "" : "s"}.`);
}

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= n ? flat : flat.slice(0, n - 1) + "…";
}
