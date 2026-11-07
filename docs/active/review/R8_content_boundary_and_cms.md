# R8: Content boundary and CMS layer

Read 2026-11-07 on `main` 18fd3e7f (reviewer, Fable 5.1; one Sonnet survey of the CMS's
duplicated logic, validation and Sync path; two Sonnet verifiers). Area per the concept doc:
`DatabaseManager`, the registries, the `cms/` server and CLI; the questions are load-time cost,
validation gaps, and logic duplicated between the CMS's page and its command line.

## Summary for the owner

**What this area does for the player, and for the owner.** It is how the game gets its content:
the owner authors Tokens, items, recipes, effects, the Starter Camp, the perks, the Hall's stars
and the world tables in the CMS; **Sync to Game** writes them to `data/*.json` and commits; the
game bundles those files at build time and turns them into lookups when it starts; a boot audit
reports references that do not resolve. For the player it is startup time and whether a recipe
can name an item that does not exist.

**How healthy it is: good, with one place the owner should look at.** Startup work is small
(about 500 definitions walked once each, copy-on-write migrations, no runtime fetch). The CMS and
its command line share one copy of nearly every rule (the Sync, the pack apply, the restore, the
palette brightening, the game's own content rules), so the duplication the concept doc asked
about is mostly not there. The boot audit covers Token references well. The place to look is
the Sync's safety: the guard added after the owner once synced a stale browser tab over newer
content compares ids only, so the same accident with changed values instead of removed entries
would still go through silently; and the Sync writes its files one by one with no rollback.

**The three findings that matter most.**
1. **The Sync's stale-workspace guard compares ids only, and the write is not atomic**
   (CR4-078): a stale tab that changed a recipe's numbers rather than deleting it overwrites the
   newer content with no prompt; a failure part-way leaves `data/` half old, half new and
   uncommitted; nothing checks the branch the owner's rule requires.
2. **A recipe's ingredients and products are never checked against the item list** (CR4-079):
   not by the boot audit, not by the schema check, not by the command line's `validate`; only the
   CMS page's Economy Audit sees a dangling item id in a recipe. A typo there is a recipe that
   silently makes nothing.
3. **The item glob that matches nothing, a maps file nothing reads, and the Maps left in the
   CMS's words** (CR4-080, CR4-081): small, and the stale strings tell the owner the Sync still
   writes maps.

**Counts.** 4 findings: 2 `bug` (P2, P3), 1 `cleanup`, 1 `docs`; 0 `owner-decision`. Verified:
see each finding's `Verified by`.

**Measure first.** Nothing; the load-time cost is small by inspection (R12 times the whole
startup).

---

## Findings

### CR4-078  Sync to Game: the stale-workspace guard compares ids only, the write is not atomic, and no branch is checked
- **Tag**: bug
- **Priority / Effort / Risk**: P2 / S / low
- **Confidence**: verified
- **Where**: `cms/gameData.js:154-191` (`writeSync`), `:160-170` (the guard: "A stale browser workspace once synced over newer content and silently dropped it, so a Sync that would remove anything the game has writes nothing until the author confirms" → `compareSync`), `cms/src/engine/syncGuard.js:1-5` ("Only ids count: an entity whose fields changed is neither removed nor added"); `cms/src/engine/fileUtils.js:85-97` (`syncToGame` sends `{ files, plan, confirmRemovals }` built from the in-browser store, not from disk, and no revision; `diskWorkspace.js:180` sends a `baseRevision` for workspace writes only); `cms/workspaceFile.js:8-14,118-126` (the workspace file refuses a write made from an older revision: that protection exists for `workspace.json` and is not applied to the Sync, which trusts the posted body); `gameData.js:172-178` (four to eight `fs.writeFileSync` calls in a row, no temp-and-rename, no rollback; a throw mid-loop leaves the earlier files new and the later ones old, and the route's `.catch` returns 500, `cms/vite-plugin-cms-api.js:829`), against `cms/workspaceFile.js:88-96` (`writeAtomically`: temp-and-rename, with an in-place fallback on Windows) and `src-tauri/src/saves.rs:66-76` (the game's saves are); `gameData.js:70-110` (`commitSync`: `git add -- <paths>`, `git commit -- <paths>` on whatever branch is checked out; no branch check anywhere in `cms/`, `grep -rn "branch\|rev-parse --abbrev-ref" cms/*.js cms/*.mjs`: none) against `CLAUDE.md` ("The owner Syncs only on `main`")
- **What**: The Sync is the one write that can destroy the owner's content, and it has happened once. The guard written afterwards catches a stale tab that would remove an entry, and nothing else: a tab left open while the owner edited a recipe's quantities in another tab (or synced a change pack from the command line) still overwrites the newer numbers, with the same silence as before. The write itself is several whole files written in order with the commit after; a disk error or a crash between the first and the last leaves the game reading a mixed set, and the "Successfully wrote" log line is printed only at the end, so a half-write shows as an error with no word on which files landed. The branch rule that keeps content commits off feature branches is a rule the owner remembers, not one the code keeps.
- **Evidence**: As cited; the memory of the earlier loss is in the code's own comment (`gameData.js:160-161`).
- **Fix sketch**: Send the workspace revision with the Sync and refuse a body made from a revision older than the disk workspace's (the check `workspaceFile.js` already has); compare content, not ids, in `compareSync` and show changed entities in the 409 diff alongside removed ones; write each file to a temp name and rename all at the end (or write to a staging folder and move); read `git rev-parse --abbrev-ref HEAD` before committing and refuse (or warn in the response) when it is not `main`, the rule being the owner's. Must not change: the files' content or formatting (`JSON.stringify(content, null, 2)`); the command line's `sync`, which shares `writeSync` and reads the disk workspace (unaffected by a stale tab).
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed. `compareSync` keys on ids only and the page shows only removed and added entities (`SyncGuardPanel.jsx`, `TopBar.jsx`); the Sync body carries no revision; `writeSync` is a plain `writeFileSync` loop with the log line after it; `commitSync` runs no branch check (`rev-parse --short HEAD` only, after the commit). Line cites for `fileUtils.js` and `workspaceFile.js` corrected.

### CR4-079  A recipe's inputs and outputs are checked against the item list nowhere but the CMS page
- **Tag**: bug
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/systems/core/ContentAudit.js:147-163` (the item-reference walk covers a Token's `config.inputs`/`outputs` only), `:687-712` (recipes reach `findUnknownRefs` and `toolFindings`), `src/systems/core/unknownRefRule.js:224-230` (the recipe loop checks `recipe.skill` and nothing else), `src/systems/core/lifecycleAudit.js:486` (a Foundation recipe's `outputs[0].tokenId` is checked; an ordinary recipe's `inputs[].itemId` and `outputs[].itemId` are not: `grep -n "inputs\|outputs" ContentAudit.js lifecycleAudit.js unknownRefRule.js toolRule.js` finds no recipe item check), `src/systems/core/toolRule.js:79-86` (`requiresContext[].tag` is checked against the retired tool tags only; that a Token provides the tag is checked for `acceptedTokens[].tag`, `ContentAudit.js:586-597`, not for `requiresContext`); the CMS side: `cms/schemaCheck.js:61-77,96-109` with `cms/schemas/common.schema.json:7-9,34,42` (ids are `{ type: string, minLength: 1 }`; no cross-reference check in any schema), `cms/cliCommands.mjs:296-303` (`validate` runs the schema check only), `cms/src/engine/connectivityAuditor.js:185-210` (the one place a recipe's item ids are resolved, severity Critical: the Economy Audit, run by `recalculate.js:128`, which the page's Recalculate and the command line's `recalc` and `sync` also run, `cliCommands.mjs:133-138,242,254`; `sync` prints only its summary line, and nothing refuses a Sync on a Critical row); the content: 117 recipes (`data/tokenRecipes.json`), 151 items
- **What**: Every other content reference (a Token's inputs, a spawner's Token, an upkeep item, a Shop price, a Starter Camp Token, an effect, a sprite) is checked at boot and reported; a recipe's ingredients and products are not. A recipe whose output names `item_coper_ingot` passes the schema check, passes `cms validate`, passes a change pack's check, syncs (the command line's `sync` prints one summary line of the audit and goes on), boots without a word, and the station runs its cycle and produces an item the Bank has never heard of (or the Bank hides, as a deleted item's stack is hidden). The CMS page would have shown it as a Critical issue in the Economy Audit, if the owner opened that panel before syncing; `cms recalc` would have printed it.
- **Evidence**: As cited.
- **Fix sketch**: Add the recipe loop to `findUnknownRefs` (inputs and outputs `itemId` against `items`, `requiresContext[].tag` against the Tokens' provided tags), so `ContentAudit` reports it at boot and the CMS's own use of the rule (`connectivityAuditor.js:1,115-175` already calls the game's rules) gets it for free; have `cms validate` and the pack check run `findUnknownRefs` beside the schema check, and have a Sync with a Critical audit row ask before writing, as the removal guard does. Must not change: the audit's report-only contract (`ContentAudit.js:37-51`); the schema files.
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. No boot-time check resolves a recipe's item ids (`ContentAudit.js:148-163` Tokens only, `unknownRefRule.js:224-230` the skill only, `lifecycleAudit.js:482-486` Foundation outputs only, `toolRule.js:79-86` retired tool tags only); `cms validate` runs the schema check alone; `connectivityAuditor.js:185-210` resolves them as Critical. Corrected: the command line's `recalc` and `sync` do run the economy audit through `recalculate.js:128` (`sync` prints its summary line only); 117 recipes and 151 items confirmed.

### CR4-080  An item glob that matches nothing, a maps file nothing reads, a Maps dial in the simulator, and a slug rule written twice
- **Tag**: cleanup
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `src/config/DatabaseManager.js:11` (`itemFilesGlob: import.meta.glob('/data/items/**/*.json')`: there is no `data/items/` folder, `ls data`) with `src/config/registries/itemRegistry.js:59-71` (a second loop over the empty glob, with its own error handling); `data/maps.json` (two bytes, `{}`; no reader in `src/`, `cms/`, `bench/`; `src/tests/MapBurstRetired.test.js:38-42` asserts there is no loader); `cms/src/engine/sim/dials.js:86,174-177` (`mapScrapRatio` and `scrapRatioAt`, "What a Map's scrapped contents fetch": Maps are gone, CHANGELOG "brief 330 W2"; `scrapRatioAt` has no caller anywhere, `dials.js` included, and the dial is read only by the settings window) with `cms/src/components/shared/SettingsModal.jsx:336-387` (the dials still shown); `cms/src/utils/idGenerator.js:19-26` and `cms/assetNaming.js:21` (the same slug rule, lowercase, `[^a-z0-9]+` → `_`, trimmed, written twice; they agree today); `cms/vite-plugin-cms-api.js:402` (a third name filter for backups, `replace(/[^a-z0-9_-]/gi, '_')`, substituting where the pack-name rule `changePacks.js:33` and `changePackInbox.js:11` reject, and with no length cap)
- **What**: Four small leftovers. The item glob and its loop run at every startup and match nothing; the maps file is two bytes the Sync never writes and a test guards; the simulator still carries and shows a dial for a content kind that no longer exists; and the slug rule is the one piece of logic in the CMS that is written twice (everything else the concept doc asked about turned out to be one shared copy: the Sync, the pack apply, the restore, the palette brightening, the game's content rules).
- **Evidence**: grep results as cited; `cms/schemas/*` word lists are pinned to the game's by `src/tests/CMSSchemas.test.js:134-152` (not run here).
- **Fix sketch**: Drop `itemFilesGlob` and its loop; delete `data/maps.json` and adjust the guard test; remove `mapScrapRatio`, `scrapRatioAt` and the dial's rows; have `assetNaming.js` import `slugify`. Must not change: any slug the two rules produce today (they agree, so nothing renames).
- **Verified by**: Sonnet verifier, 2026-11-07: partly; corrected. No `data/items/` folder, the empty glob and its loop, `data/maps.json` as `{}` with no reader and the guard test, `scrapRatioAt` callerless and the dial read only by the settings window, the two slug rules agreeing (`.trim()` and null handling differ harmlessly), the backup-name filter substituting with no cap, the pack-name rules rejecting at 80: all confirmed. The settings window's path (`shared/`, not `editors/`) and two line cites corrected.

### CR4-081  Docs: the Sync still says it writes maps, and the map's CMS numbers
- **Tag**: docs
- **Priority / Effort / Risk**: P3 / S / low
- **Confidence**: verified
- **Where**: `cms/src/components/layout/TopBar.jsx:39` ("This will overwrite data/items.json (maps included)"), `cms/src/components/shared/FileManagerModal.jsx:83` ("items (maps included)"), `cms/src/engine/fileUtils.js:85` ("(maps and modifiers included)"): map and modifier items were retired (CHANGELOG "brief 330 W2", T-292); `cms/gameData.js:97-99` (the commit message body cites "CMS-53", a ticket id, in every content commit); what was checked and is right: `docs/reference/ARCHITECTURE.md:415-420` (eight files globbed, `data/maps.json` and `data/palettes/` read by no game code, the `data/items/**` glob matches nothing), `:433-436` ("imports 62 game modules directly … one UI file": 62 distinct modules by `grep -rhoE "from '(\.\./)+src/[^']+'" cms | sort -u` after stripping the relative prefix, and exactly one under `src/ui/`), `:421-425` (eight registries read `DatabaseManager`: 8), `:427-429` (the audit reports only, at boot and on load: `EngineBootstrap.js:149-153`)
- **What**: The confirmation the owner reads before every Sync names a content kind that was retired a week ago, in three places. The architecture map's account of the boundary is exact.
- **Evidence**: As cited.
- **Fix sketch**: Three string edits; drop the ticket id from the commit message. Must not change: nothing in code.
- **Verified by**: Sonnet verifier, 2026-11-07: confirmed: the three "maps included" strings, "CMS-53" in the commit message (`gameData.js:97`), 62 distinct game modules imported by the CMS with exactly one under `ui/`, 8 registries reading `DatabaseManager`, 9 glob calls (one the empty items glob).

---

## Notes (no `path:line` of their own, or another area's)

- **Load-time cost, checked.** `DatabaseManager` is nine eager globs (one matches nothing) over eight files, bundled at build (no fetch). At import the registries walk 146 Tokens, 151 items, 117 recipes and 92 effects once each, through copy-on-write migrations (`skillIdMigration.js:63-90`: statements mapped, spread only on a change) and `expandBearer` per Token; the perk, Hall-star, Starter Camp and world-table registries read one file each. On the order of a millisecond or two; R12 times the whole startup. Lazy lookups that scan per call (`RECIPES.filter` in `getSkillRecipePool`/`recipesForStation`, `RECIPES.find` in `getRecipe`, `toolContextTags` over all Tokens) are R2's CR4-019 (recipe pools rebuilt per call) and not refiled.
- **One copy, not two.** Sync to Game and the command line's `sync` both call `writeSync` (`cliCommands.mjs:256`, `vite-plugin-cms-api.js:816`) on files built by `syncFiles` (`recipeSync.js:27-49`); the pack apply uses the page's `packReview.js`; Restore from Game uses `loadGameData`; palette brightening is `artBrightenColor.js` imported by `paletteBrighten.js` and the art script; the Economy Audit calls the game's own `lifecycleAudit`, `unknownRefRule`, `toolRule`, `perkRule`, `gearDefenceRule` and `workSkillRule` (`connectivityAuditor.js:1,115-175`). The schema word lists (`cms/schemas/*.json`) are copies of the game's enums, pinned by a test.
- **The commit is deliberately narrow and never fails the Sync** (`gameData.js:60-70`): only the files written are staged, nothing to commit is success, a hook that rejects shows as `git commit failed` in the response with the files already written. `data/palettes/` belongs to the Studio and is never staged.
- **`legacySpriteNames.js`** (747 generated lines) is live: `AssetManager.currentSpriteName` (`:91`) reads it for every sprite path and for the save migration's renamed art, and the CMS reaches it through `spriteRenames.js`.
- **CMS exports nothing imports** were not swept export by export (knip's baseline covers `cms/` only where its config reaches); R9's job.
