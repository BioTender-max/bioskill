import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export type TargetScope = "project" | "global";

export type Target = {
  id: string;
  label: string;
  // Resolve the absolute skills directory for a given scope.
  skillsDir(scope: TargetScope, projectRoot?: string): string;
  // Optional: post-install hint shown to the user.
  postInstallHint?: string;
};

const home = os.homedir();
const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");

export const TARGETS: Record<string, Target> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    skillsDir(scope, projectRoot) {
      return scope === "global"
        ? path.join(home, ".claude", "skills")
        : path.join(projectRoot || process.cwd(), ".claude", "skills");
    },
    postInstallHint:
      "Restart Claude Code or run `/skill reload` to pick up the new skills.",
  },
  mimocode: {
    id: "mimocode",
    label: "MiMo-Code",
    skillsDir(scope, projectRoot) {
      return scope === "global"
        ? path.join(xdgConfig, "mimocode", "skills")
        : path.join(projectRoot || process.cwd(), ".mimocode", "skills");
    },
    postInstallHint: "Open MiMo-Code in this directory and the skills will be loaded automatically.",
  },
  opencode: {
    id: "opencode",
    label: "OpenCode",
    skillsDir(scope, projectRoot) {
      return scope === "global"
        ? path.join(xdgConfig, "opencode", "skills")
        : path.join(projectRoot || process.cwd(), ".opencode", "skills");
    },
  },
  generic: {
    id: "generic",
    label: "Generic (custom path)",
    skillsDir(scope, projectRoot) {
      const custom = process.env.BIOSKILL_TARGET_DIR;
      if (custom) return custom;
      return scope === "global"
        ? path.join(home, "bio-skills")
        : path.join(projectRoot || process.cwd(), "skills");
    },
    postInstallHint:
      "Set $BIOSKILL_TARGET_DIR to point at your agent's skill directory, or pass --dir.",
  },
};

export function listTargets(): Target[] {
  return Object.values(TARGETS);
}

export function resolveTarget(id: string): Target {
  const t = TARGETS[id];
  if (!t) {
    throw new Error(
      `Unknown target "${id}". Available: ${Object.keys(TARGETS).join(", ")}`,
    );
  }
  return t;
}

export function copyDir(src: string, dst: string, opts: { overwrite?: boolean } = {}): { written: number; skipped: number } {
  let written = 0;
  let skipped = 0;

  const walk = (s: string, d: string) => {
    fs.mkdirSync(d, { recursive: true });
    for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
      const sp = path.join(s, entry.name);
      const dp = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(sp, dp);
      } else if (entry.isFile()) {
        if (fs.existsSync(dp) && !opts.overwrite) {
          skipped++;
          continue;
        }
        fs.copyFileSync(sp, dp);
        written++;
      }
    }
  };

  walk(src, dst);
  return { written, skipped };
}
