import { listTargets } from "../targets.js";
import { log, c } from "../util/log.js";
export async function targetsCommand() {
    log.raw(c.bold("Available targets"));
    for (const t of listTargets()) {
        log.raw(`  ${c.bold(t.id)}  ${c.dim(t.label)}`);
        log.raw(`    project: ${t.skillsDir("project")}`);
        log.raw(`    global:  ${t.skillsDir("global")}`);
        log.raw("");
    }
    log.dim("Use --scope global to install into your home dir instead of cwd.");
}
