import { Command } from "commander";
import { listCommand } from "./commands/list.js";
import { searchCommand } from "./commands/search.js";
import { infoCommand } from "./commands/info.js";
import { installCommand } from "./commands/install.js";
import { targetsCommand } from "./commands/targets.js";
import { syncCommand } from "./commands/sync.js";
import { log } from "./util/log.js";
const program = new Command();
program
    .name("bioskill")
    .description("Install bio agent skills into your AI coding agent. Powered by awesome-bio-agent-skills.")
    .version("0.1.0");
program
    .command("list")
    .description("List skills, optionally filtered by category or source")
    .option("-c, --category <name>", "filter by category (e.g. proteomics)")
    .option("-s, --source <name>", "filter by source repo (e.g. adaptyv)")
    .option("-l, --long", "show descriptions")
    .option("--update", "refresh catalog from GitHub before listing")
    .action(async (opts) => {
    await listCommand(opts).catch(handle);
});
program
    .command("search <query>")
    .description("Full-text search across skill names and descriptions")
    .option("-c, --category <name>", "narrow by category")
    .option("-s, --source <name>", "narrow by source")
    .option("--limit <n>", "max results", "50")
    .action(async (query, opts) => {
    await searchCommand(query, opts).catch(handle);
});
program
    .command("info <skill>")
    .description("Show metadata for a single skill")
    .action(async (skill) => {
    await infoCommand(skill).catch(handle);
});
program
    .command("install [skills...]")
    .description("Install one or more skills into a target agent")
    .requiredOption("-t, --target <id>", "target agent: claude-code | mimocode | opencode | generic")
    .option("--scope <s>", "project | global", "project")
    .option("--dir <path>", "override target skills dir")
    .option("-c, --category <name>", "install all skills in this category")
    .option("-s, --source <name>", "install all skills from this source")
    .option("--all", "install everything (use with caution)")
    .option("--overwrite", "overwrite existing files in target")
    .option("--dry-run", "show what would be installed without copying")
    .option("-y, --yes", "skip confirmation for large installs")
    .action(async (skills, opts) => {
    await installCommand(skills, opts).catch(handle);
});
program
    .command("targets")
    .description("List available agent targets and their skill directories")
    .action(async () => {
    await targetsCommand().catch(handle);
});
program
    .command("sync")
    .description("Refresh the cached skill catalog from GitHub")
    .action(async () => {
    await syncCommand().catch(handle);
});
function handle(err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.err(msg);
    process.exit(1);
}
program.parseAsync(process.argv).catch(handle);
