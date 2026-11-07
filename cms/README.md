# Fantasy Guild CMS

The content editor for Fantasy Guild: the **only** place Tokens, items,
recipes, effects, perks, the Guild Hall's sky and the world tables are
authored. A separate local React app, never shipped with the game. Agents
mostly prepare content for it from the command line; the owner reviews and
pokes around in the page.

## The workspace on disk

- **`cms/workspace/workspace.json`** is the workspace: everything authored
  between one Sync to Game and the next, plus the simulator's dials. It is the
  one authoritative copy (`cms/workspace/README.md`); git-ignored, like the
  browser copy it replaced.
- The page reads it on start and writes it about a second after each change
  (`src/engine/diskWorkspace.js`; server side `workspaceFile.js`, route
  `/api/workspace`). The browser's localStorage is only a cache.
- The File Manager (Backups) says **Workspace: on disk, saved HH:MM**, and so
  does the Backups button's tooltip (the top bar is full). Every write bumps the
  file's `revision`; a write made from an older revision (another tab, or the
  command line wrote since) is refused, and the page shows **"The workspace on
  disk changed elsewhere; reload to see it"**, keeping that tab's edits in
  Backups as `refused_<time>`. It also checks when the page comes back into
  view.
- The first start after the move found no file and seeded it from the
  browser's copy, with a `migrated_<time>` backup first. Edits a closed tab
  never sent are sent on the next start when the disk has not moved, otherwise
  kept as `unsent_<time>`; a browser copy that differs from the disk is kept as
  `browser_<time>` before the disk's copy opens.
- **New workspace** (File Manager) backs the workspace up as `before-new_<time>`
  and empties only the workspace; the dials, the API key and the change-pack
  reviews stay.

## The command line

`npm run cms -- <command>` from the repo root (`cli.mjs`, commands in
`cliCommands.mjs`). Every command reads and writes the same workspace file
with the same revision guard as the page, and runs the page's own code.

| Command | What it does |
|---|---|
| `validate` | Checks the workspace against `cms/schemas/`. Exit 1 on errors; unknown keys are warnings. |
| `validate --data` | The same for `data/`. |
| `pack check <pack.json>` | Will the CMS accept the change pack (`incoming/README.md`)? Lists the entries that conflict with the workspace. |
| `pack apply <pack.json> [--yes]` | Applies the pack to the workspace as the review page's Finish does (`src/engine/packReview.js`) and moves it to `applied/` beside it with the review record, so the Changes page can undo it. A conflict refuses the whole pack unless `--yes` (the page's Apply anyway). |
| `recalc [--all]` | Runs Recalculate (`src/engine/recalculate.js`) on the workspace, saves it, and prints the audit. |
| `sync [--confirm-removals] [--no-commit]` | Recalculates, then writes `data/` exactly as Sync to Game does (`gameData.js`, shared with the page's route) and commits only the files it wrote. A Sync that would remove content the game has is refused until `--confirm-removals`. |
| `restore` | Rebuilds the workspace from `data/` and `cms/plan/plan.json` (Restore from Game); the old one is kept in Backups as `before-restore_<time>`. `npm run cms:restore` runs it. |

Options on every command: `--workspace=<file>`, `--data=<dir>` (the plan then
sits in `<dir>/../plan`), `--plan=<dir>`, `--backups=<dir>`, or
`--sandbox=<dir>` (a throwaway folder holding `data/`, `plan/`, `workspace/`
and `backups/`). Only the project's own `data/` and plan are ever committed.

The change-pack helper `changePackTool.mjs` (`stamp`, `gate`, `world`,
`balance`; `incoming/README.md`) runs beside it and reads the same workspace
file by default.

**Before writing a change pack**, an agent runs `npm run cms -- validate --data`
and `npm run cms -- validate` (both should say 0 errors), reads its "before"
values from the workspace file, and after writing runs
`npm run cms -- pack check <file>` and the gate (`incoming/README.md`).

## The schemas

`cms/schemas/*.schema.json` (JSON Schema draft 2020-12): items, tokens,
effects, tokenRecipes, starterCamp, skillPerks, hallStars, world, and the
shared shapes in `common.schema.json`. Each property says which game code
reads it and which editor writes it. Word lists are copies of the game's own
lists; `src/tests/CMSSchemas.test.js` fails when one drifts. The schemas are
permissive: a key they do not list is reported as an unknown key (review
input), never an error. `schemaCheck.js` runs them (ajv).

## What the page still does

- Every editor, the Ledger, the Changes to review page, Recalculate and Sync to
  Game, as before; they now act on the disk workspace.
- **Sync to Game** overwrites `data/items.json`, `tokens.json`,
  `tokenRecipes.json` and `effects.json` (and `starterCamp.json`,
  `skillPerks.json`, `hallStars.json`, `world.json` when the workspace holds
  them) after a Recalculate, writes the plan to `cms/plan/plan.json`, then
  commits **only the files it wrote** onto whatever branch is checked out (a
  Studio palette edit waiting in `data/palettes/` is never swept in).
  Anything written into those files by hand is lost on the next sync.
- **Recalculate** runs the economic simulator, `src/engine/sim/`, through
  `src/engine/recalculate.js`.
- **Backups** (File Manager) live in `cms/backups/`: named saves, the rolling
  last five autosaves, and the backups the disk workspace writes.

## Running it

- **The CMS**: `npm --prefix cms run dev` (port 5174), or `preview_start` with
  name `cms` (see `docs/reference/TESTING.md`).
- **A throwaway CMS** for checks: `CMS_SANDBOX_DIR=<dir>` puts its data, plan,
  workspace, backups and inbox in `<dir>` (copy `data/` into `<dir>/data`
  first), and a Sync there never commits. A second server beside the owner's
  needs `PORT` and `CMS_CACHE_DIR` too.
- **The Studio** (Recolor and Animation): `npm run studio` from the repo root
  (port 5175), beside the CMS. It loads no game data, and its server refuses the
  game-data routes, `/api/workspace` included. Palette files dropped in
  `palettes-inbox/` (by agents, never into `data/palettes/`) show under the
  Recolor tab's **Import** button; see `palettes-inbox/README.md`.
- The file API lives in `vite-plugin-cms-api.js`.
- Tests for the CMS live with the game's tests (`src/tests/CMS*.test.js`).
- ⚠️ Never verify changes on the real workspace; use a sandbox (see TESTING.md,
  "The CMS").
