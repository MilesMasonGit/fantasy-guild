# Environment cleanup before the crunch (hygiene plan)

**Done 2026-10-07** (merged to `main` at `baf45809`). Goal: stop agents wasting
effort on stale information, poor workflows and code that no longer serves a
purpose. Evidence came from four read-only audits (2026-10-07): 56 session
transcripts mined for friction, a dead-code/data/naming sweep, a test-suite
audit, and a docs/memory/workflow audit.

## Owner rulings (2026-10-07)

- Hide `docs/archive/` from content searches (done: `.ignore`).
- A **liberal shared permission list** (done: `.claude/settings.json`, committed by
  the owner). Deny force-push,
  `git add -A`/`.`, `--no-verify`; ask before `reset --hard`/`clean`.
- **Push `main` after each verified merge**; feature branches stay local.
  `git add -A` stays forbidden (the owner keeps uncommitted work in the folder).
- **Split the changelog**: archive pre-0.8, cut a `[0.8.0]` section.
- Delete: the art one-off scripts (`count_colors`, `create_1024_anchor_64`,
  `create_640_anchor`, `create_mask_test`, `debug_colors`, `forge`,
  `make_template`, `smooth_colors`), `scripts/balancer/`, the two finished
  `migrate-*` scripts, `tools/curve_explorer.html`, the Layout Sandbox. Keep
  `process_art.cjs` and `watch_assets.js`.
- LF/CRLF warnings: document as harmless; no repo-wide conversion.
- **Flatten the doubled audio folders** (188 files), with a sound check.
- Remove unused CSS **inside** loaded stylesheets too, then an owner
  eye-check.
- Kept (defaults): `.agent/` (the owner's other-tool files), `data/stations.json`
  until T-096 is answered, the `@fontsource` packages.

## Waves

| Wave | What | Tier | Gate |
|---|---|---|---|
| **W1** | Docs, config, memory: CLAUDE.md and TESTING.md additions from the transcript audit; agent definitions; NOW.md; archive finished plans; changelog split; `.ignore` additions; eslint ignores `dist-perf/`; leftover worktree folder | director | read-through |
| **W2** | Tests: silence logger debug/info in tests and print output only for failing files; default test environment `node`, jsdom only where needed; delete tombstone skips (T-067) and the Map-burst `it.fails`; quiet `Risk13Allocation` | builder | same pass/fail counts; suite time and output lines before → after |
| **W3** | Dead code: the 7 unloaded stylesheets; `HeroDockCard`, `DockSkillsGrid`, `dockConstants` leftovers (T-044); zero-use exports (three-way grep, T-094); unused packages (`@xyflow/react`, `jszip`, `@testing-library/jest-dom`); the scripts and tools above; unused `DatabaseManager` globs; empty `src/ui/styles/index.css` | builder | merge gate; build; game boots |
| **W4** | Names that lie: `cartographer` → shop ids, `BottomFolderDrawer`, `TOKEN_SURFACE.TRAY/VAULT`, `TRAY_COLUMN`, `openingTray`, `cardUseCounts`, `largeTrayTokens`, "Heroes in Vault", "Clean Vault"; flatten the audio folders | builder | merge gate; owner sound check |
| **W5** | Unused rules inside loaded stylesheets (~3,000 lines of card-era CSS) | builder | owner eye-check |

The tile-name rename (T-057) stays its own job: it touches event strings and
rules text (RenderGolden).
