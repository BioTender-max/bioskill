# bioskill

One command to install bio agent skills into your AI coding agent.

Powered by [awesome-bio-agent-skills](https://github.com/BioTender-max/awesome-bio-agent-skills) — a curated catalog of 1,600+ `SKILL.md` folders for biomedical research, aggregated from 20+ open-source skill repos.

Maintained by [BioTender](https://biotender.online).

```
npm install -g bioskill
```

## Quick start

```bash
# Browse the catalog
bioskill list
bioskill list --category proteomics
bioskill list --source adaptyv --long

# Search by name or description
bioskill search alphafold
bioskill search "single cell"

# Inspect one skill
bioskill info alphafold

# Install into Claude Code (project-local)
bioskill install alphafold proteinmpnn --target claude-code

# Install a whole category into MiMo-Code (global)
bioskill install --category protein-design --target mimocode --scope global

# Install everything from one upstream source
bioskill install --source adaptyv --target claude-code --yes

# Preview without writing
bioskill install --category proteomics --target mimocode --dry-run
```

## What it does

- Clones (and updates) the awesome-bio-agent-skills repo into `~/.bioskill/cache/`.
- Enumerates every `skills/<source>/<name>/SKILL.md` folder on disk (so all 1,600+ skills are visible even if the CSV index lags).
- Copies the selected skill folders into the target agent's skill directory.

## Supported targets

| Target        | Project scope            | Global scope                              |
| ------------- | ------------------------ | ----------------------------------------- |
| `claude-code` | `./.claude/skills/`      | `~/.claude/skills/`                       |
| `mimocode`    | `./.mimocode/skills/`    | `~/.config/mimocode/skills/`              |
| `opencode`    | `./.opencode/skills/`    | `~/.config/opencode/skills/`              |
| `generic`     | `./skills/` or `--dir`   | `~/bio-skills/` or `$BIOSKILL_TARGET_DIR` |

Adding a new target is one file under `src/targets.ts` — PRs welcome.

## Commands

| Command                       | What it does                                  |
| ----------------------------- | --------------------------------------------- |
| `bioskill list [--category --source --long]` | Browse the catalog |
| `bioskill search <query>`     | Full-text search                              |
| `bioskill info <skill>`       | Show one skill's metadata + SKILL.md location |
| `bioskill install [skills…]`  | Copy skill folders into a target              |
| `bioskill targets`            | List supported agent targets                  |
| `bioskill sync`               | Force-refresh the cached catalog              |

## Environment variables

- `BIOSKILL_CACHE_DIR` — override `~/.bioskill/cache/`
- `BIOSKILL_REPO_URL` — point at a fork of awesome-bio-agent-skills
- `BIOSKILL_TARGET_DIR` — default install dir for the `generic` target

## License

MIT — see [LICENSE](./LICENSE).

The skill catalog itself is licensed under [CC0](https://github.com/BioTender-max/awesome-bio-agent-skills/blob/main/LICENSE) by the awesome-bio-agent-skills maintainers. Individual upstream skill sources may carry their own licenses; see each `SKILL.md` for attribution.
