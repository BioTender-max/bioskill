import pc from "picocolors";

export const log = {
  info: (msg: string) => console.log(pc.cyan("ℹ"), msg),
  ok: (msg: string) => console.log(pc.green("✓"), msg),
  warn: (msg: string) => console.log(pc.yellow("⚠"), msg),
  err: (msg: string) => console.error(pc.red("✗"), msg),
  dim: (msg: string) => console.log(pc.dim(msg)),
  raw: (msg: string) => console.log(msg),
};

export const c = pc;
