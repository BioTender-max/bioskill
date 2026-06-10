import { loadCatalog } from "../catalog.js";
import { log } from "../util/log.js";
export async function syncCommand() {
    const skills = await loadCatalog({ update: true });
    log.ok(`${skills.length} skills available.`);
}
