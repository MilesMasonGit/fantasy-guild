# Tabletop Guild CMS

The content editor for Tabletop Guild: the **only** place Tokens, items,
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
| `pack numbers --out=<pack.json> [--rows=<solved.json>] [--dials=<dials.json>] [--unclear=<file>]` | The number pack writer (`src/engine/numberPack.js`): the balance solver's rows (`.claude/skills/balancer/balance_solver.cjs`, keyed by catalogue id) onto the plan's Planned entries, matched by their `plan.catalogueId`, as a change pack written to `--out` (refused inside `cms/incoming/`: the balancer stages it, runs `pack check` and the gate, and copies it in). A made item gets a new Planned recipe in its skill's pool (`recipe_<item>`: level, seconds, XP, inputs with counts matched to the plan's `madeWith` by name, what one craft makes; any station of the skill); a gathering Token gets its cycle on its own record (`config`: skill, level, cycle time, XP, what it gives); a Planned crop recipe gets its level, time, XP and output, its seeds and grow time left as they are. The items and Tokens stay Planned, and so does every recipe it writes. `--rows` reads a solver output (`{ rows }` or a list); without it the solver runs on `docs/active/content_catalogue.json` with its own dials, or `--dials`. Entries with no clear recipe or Token cycle (ingredients that do not match the plan, several things from one cycle, a summon, no solver row) are listed for the content session and in `--unclear`, never written; enemies, buildings and entries with no work of their own are skipped, with the reason counted. Reads the workspace and never saves it (a worktree reads the main checkout's). A gathering Token it writes also gets its uses and rest by the rest rule (BALANCE_RULES section 2: about 15 s of work, back in about a minute; `REST_RULE` in `src/engine/balanceRules.js`): an `endChance` of 100 × cycle ÷ 15 s, one decimal, in place of its `uses`, and a refill that needs no owner a 60 s `respawn.afterMs`; a regrow's rest is its Stump's growth, so a Planned (or, live, any) Stump gets `grows.afterMs` 60 s; a refill that rests only beside its owner gets the end chance only and is listed, and one with no respawn gets neither and is listed. A Token's `plan.split` (`[{ itemId, share }]`) gives its outputs, one line a share: a whole share that many every cycle, a share under 1 one at that chance. |
| `pack numbers --live --out=<pack.json> [--ids=<ids.json>] [--catalogue=<catalogue.json>] [--rows=...] [--unclear=<file>]` | The live mode: its own pack, apart from the Planned one. Each Live recipe and gathering Token the content session's id map (`docs/active/content_cms_ids.json`, its entries marked live; a recipe by its own id or by what it makes) matches to one catalogue entry (`docs/active/content_catalogue.json`) gets a fingerprinted edit: level, time, XP pinned (`sim.xpPinned`, so Recalculate keeps it), its inputs' counts, its sure output's count (chance extras kept as they are, or the plan's split), and a Token its uses and rest as above. A Live entry with no match, several, ingredients or an output other than the catalogue's, or several sure outputs and no split, is listed and left alone. ⚠️ Recalculate still derives the cycle time and output counts of a record with a Tempo and a Purpose; only the XP has a pin, and the command counts the edits that meet it. |
| `pack boosts --out=<pack.json> [--unclear=<file>]` | The boosts pack writer (`src/engine/boostPack.js`, T-736): every effect statement that moves work time, XP, yield or doubles, rare finds or regrowth, sized by its source by the boost budget (BALANCE_RULES section 5), as a change pack written to `--out` (refused inside `cms/incoming/`). A placed building (a `buff` Token, or a station's rule on its neighbours) 5 % off work time, +2.5 % XP, +50 % yield or doubles, +12.5 % rare finds, 10 % off regrowth, the coin building +10 %; a station's own upgrade (its rule on itself) 5 % a step, a step one scale of its reference; a skill's speed perks to a quarter of the speed total of the tier each perk's level falls in (15 % by darkmetal); a Guild Hall star's ranks to 10 % of its kind at the top rank, in even steps; the one consumable (what a drink or work potion applies at a work moment) a quarter of its tier's speed total, its tier's XP total, yield by tier (+10 % at copper to +50 % at darkmetal), rare finds +100 % (+200 % from adamantine). Tier totals are the Maxed cells of the ledger's boost budget row for the tier; an item's tier is its plan's, else the tier the ledger first reaches it at. Growth time is speed on a Field's crop and regrowth on a resting Token. Only the number moves. A camp variant's own boost is one building's worth of its kind (it stands in the camp's place), and a station's own XP or yield step one building's worth of that kind. A skill's yield perks take five times the speed perks' slice (+25 % where speed is 5 %), cumulative by tier the same way. Work boosts on tools and worn gear, and XP perks, have no share of the work budget (the owner, 2026-11-26): they are not sized but listed in `<id>-needs-effect.txt` beside the pack, for the content session (the ledger's budget check still counts tools and gear). What fits no source (spawners, nodes), mixes kinds, or is shared by bearers sized differently is listed (and in `--unclear`), never written. Skipped: a Parked bearer's statement, one nothing carries, and what the budget leaves unsized: world events, bonus drops and mastery ranks (the ledger's boost budget check leaves world-event Tokens and bonus-drop-only factors out too, and rates no mastery). Reads the workspace and never saves it. |
| `recalc [--all]` | Runs Recalculate (`src/engine/recalculate.js`) on the workspace, saves it, and prints the audit. |
| `sync [--confirm-removals] [--no-commit]` | Recalculates, then writes `data/` exactly as Sync to Game does (`gameData.js`, shared with the page's route) and commits only the files it wrote. A Sync that would remove content the game has is refused until `--confirm-removals` (the refusal also lists the entries it would change). Off `main` it warns and goes ahead; the page's Sync refuses there. |
| `restore` | Rebuilds the workspace from `data/` and `cms/plan/plan.json` (Restore from Game); the old one is kept in Backups as `before-restore_<time>`. `npm run cms:restore` runs it. |
| `ledger [--json=<file>] [--one-layout] [--with-planned]` | The ledger's read-out for the balancer (`src/engine/ledgerReadout.js`, over `ledgerReport.js`): each skill's pace (the minutes each level 1 to 99 takes, hero time, guild time and the gatherers its work needs) at the ledger's Maxed (`opt`, the curve's player), Typical (`typ`) and Bare (`bare`) players, each entry's numbers (XP and seconds an action, ingredient counts) and arrival at Maxed and Typical, Planned entries listed and marked, each stage's way out (the next place's level and price, with the stage's heroes: what its budget times) and its full content beside it as information (the path side by side and the heroes' work), each work's site (its buildings in what its camp, nodes and spawners leave of its places), both layouts' days to 99 with the layout warnings, the boost budget and its over-budget totals, and the ledger's checks. Keys and units follow the balancer's solver; the JSON's `notes` say where they cannot. Reads the workspace and never saves it (run from a git worktree with no workspace of its own, it reads the main checkout's and says so); about a minute on today's content, half that with `--one-layout` (the second layout left out). `--with-planned` times Planned work as if it were live, in the read-out only: each Planned row stays marked Planned (`planned: true`, status Planned) and gets its arrival, the pace, stages and checks read the Planned entries as live, the JSON says `withPlanned: true` and counts how many Planned entries were timed (`counts.plannedTimed`), and nothing is saved; without the flag the read-out is the plain one, timing nothing Planned. |

Options on every command: `--workspace=<file>`, `--data=<dir>` (the plan then
sits in `<dir>/../plan`), `--plan=<dir>`, `--backups=<dir>`, or
`--sandbox=<dir>` (a throwaway folder holding `data/`, `plan/`, `workspace/`
and `backups/`). Only the project's own `data/` and plan are ever committed.

The change-pack helper `changePackTool.mjs` (`stamp`, `gate`, `world`,
`balance`, `coins`; `incoming/README.md`) runs beside it and reads the same workspace
file by default. `balance --out <pack>` writes every proposal; `--levers=<a,b>`
(`xp`, `cost`, `time`, `boost`, `coins`) keeps only those levers in the pack
(the printed text and `--json` still show everything; an unknown lever is refused).

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
  `skillPerks.json`, `hallStars.json`, `world.json`, `events.json` when the
  workspace holds them) after a Recalculate, writes the plan to `cms/plan/plan.json`, then
  commits **only the files it wrote** onto whatever branch is checked out (a
  Studio palette edit waiting in `data/palettes/` is never swept in).
  Anything written into those files by hand is lost on the next sync.
- **Renames.** An item's, Token's or effect's id follows its name, so the
  workspace keeps a record of what was renamed since the last Sync (`renames`,
  `src/engine/renames.js`), one entry per thing renamed, however many keys the
  new name took. Sync **adds** it to `data/renames.json` (never overwritten as
  sent: a workspace that missed an earlier rename cannot drop it), and a save
  loading in the game follows the table. Once the Sync lands the record starts
  again; Restore from Game starts it empty.
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
