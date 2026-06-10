import pc from "picocolors";
export const log = {
    info: (msg) => console.log(pc.cyan("ℹ"), msg),
    ok: (msg) => console.log(pc.green("✓"), msg),
    warn: (msg) => console.log(pc.yellow("⚠"), msg),
    err: (msg) => console.error(pc.red("✗"), msg),
    dim: (msg) => console.log(pc.dim(msg)),
    raw: (msg) => console.log(msg),
};
export const c = pc;
