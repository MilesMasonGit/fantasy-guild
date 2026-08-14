# CMS Rework v2 — Roadmap

> **Companion doc:** [`cms_rework_v2_decisions.md`](cms_rework_v2_decisions.md) —
> now 87 numbered decisions (CMS-1 through CMS-87). This roadmap sequences
> building against them and is not itself authoritative on *what* to build — if
> this document and the decisions log disagree, the decisions log wins and this
> doc needs updating.

**Status: reviewed and signed off (2026-08-13).** The preliminary draft was
checked by reading `cms/src/` and the game's loading code rather than by file
name and line count. That review changed the plan substantially and produced
six new decisions (CMS-82 through CMS-87). What changed:

1. **Tokens and Maps were never in `data/` at all** — they are hardcoded JS
   registries, so CMS-53's "the CMS writes `data/` wholesale" had nothing to
   write into. Fixing that moved from Phase 8 to Phase 0 (CMS-82).
2. **The roadmap contained no game-side engine work**, while the decisions log
   names at least six engine changes. They are now interleaved into the phases
   that need them (CMS-84), which is why the old Phase 4 became four phases.
3. **Several "adapt" claims were wrong** once the files were read — corrected
   in the table below.
4. **~3,000 lines of `cms/src/` were missing from the table**, including three
   real reuse wins that make the solver phase smaller than billed.

---

## 0. Before anything: the CMS build break is pending, not shipped

`cms/src/utils/constants.js` imports `SUB_SKILL_TO_PARENT` from the game's
`skillRegistry.js`. On `main` that export still exists and **the CMS builds
fine**. On the `skill-class-rework` branch (11 commits ahead, not yet merged)
it is deliberately gone — sub-skills were retired by that rework. So the CMS
is broken on that branch today and will break `main` the moment it merges.

Verified by stubbing the symbol and rebuilding: **that one symbol is the only
break** — the other 1,954 modules compile.

**The fix is deletion, not restoration.** The only thing using it is the CMS's
fictional-skill remap machinery (`remapSkillId`, `FICTIONAL_SKILLS`, and
`useEntityStore`'s `remapEntitySkills`), which existed to rewrite the retired
`industry`/`culinary`/`nautical` ids on import. Under CMS-4 (no import path)
and CMS-36 (subskills deleted) that machinery is obsolete anyway — Phase 0
removes it rather than propping it up. See the CMS-5 note in the decisions log
for why this class of break happens and what it costs.

---

## 1. The reuse picture, in one table

The old CMS is ~16,600 lines across `cms/src/`. After reading the files, the
honest summary is **less reuse than the preliminary draft claimed for the
editors, and more than it claimed for the audit/solver engines**. Roughly:
~2,200 lines kept untouched (recolor/palette), ~1,500 genuinely reusable,
~6,000 deleted, the remainder rewritten.

| Old CMS asset | Fate | Changed from draft? |
| :--- | :--- | :--- |
| `RecolorEditor.jsx`, palette API routes, `SpriteAuditDashboard.jsx` | **Keep, untouched** (CMS-52) | — |
| App shell: `vite.config.js`, `index.html`, `vite-plugin-cms-api.js` | **Keep, trim** — drop the import route (CMS-4), rewrite sync (CMS-53) | — |
| `EditorLayout.jsx`, `EntitySelect.jsx`, `SpritePickerModal.jsx` | **Keep as-is** — generic UI kit | — |
| `idGenerator.js` | **Keep as-is** — slug/id generation (CMS-71) | — |
| `connectivityAuditor.js` (267) | **Keep, retarget** — already emits Data Integrity / Economic Blocker issues; this *is* CMS-10's chain-reachability checker | ⚠️ **was missing from the draft** |
| `evCalculator.js` (327) | **Adapt** — gold/XP-per-minute math, i.e. CMS-10's velocity check | ⚠️ **was missing from the draft** |
| `SettingsModal.jsx` (426) + `useGlobalStore.js` (89) | **Adapt** — a working global-dials editor; CMS-15's dial UI has prior art | ⚠️ **was missing from the draft** |
| `AuditPanel.jsx` (403) | **Keep ~40%** — the audit list is genuinely generic; the Progression and Pacing tabs die with `progressionEngine`/`xpPrescriber`, and it imports the deleted `ProposalReviewModal` | ⚠️ draft said "keep, reconnect" |
| `SupplyChainLayout.jsx` (440) / `SupplyChainColumn.jsx` | **Keep the ~30-line render shell, rewrite the rest** — ~350 lines are a per-entity-type if-chain for task/area/quest/station/lootTable/encounter, all deleted | ⚠️ draft said "adapt" |
| `ItemEditor.jsx` (479) | **Rewrite, keeping the layout and sprite picker** — it is written against the old value model throughout (manual `trueCost`/`sellPrice`, `isRoot` anchors, `assignedEffect`, the deleted `tags` collection), and CMS-86/44 invalidate all of it | ⚠️ **corrected in Phase 0** — was "adapt" |
| `valuePropagator.js` (418) | **Rewrite, old file as reference** — `updateDerivedStats` (~100 lines) is old-model derivations; `sumInputCosts` supports tag-inputs CMS-43 rules out; `calcLaborCost` uses `gpt`/`baseTickTime` Tokens don't have; `findMatchingTool` is dead; the enemy branch calls shelved `mockBattle`. ~40 lines of loop shape survive | ⚠️ draft said "adapt" |
| `runSimulation.js` (237) | **Rewrite, old file as reference** — the iterative loop skeleton is ~15 lines; the rest orchestrates tasks/encounters/quests/xpPrescriber/progressionEngine, all deleted | ⚠️ draft implied a bigger reuse win |
| `taskSolver.js` (404) | **Reference for CMS-10's velocity check, not CMS-14** — it tunes drop chances and tick times against EV curves; it never auto-corrected item values. Depends on `evCalculator` + `mockBattle` | ⚠️ draft mislabelled its purpose |
| `RecipeEditor.jsx` (352) | **Delete and rewrite** — there is no context-tag gating in the CMS anywhere; it is keyed on `subskillId`, and subskills are deleted (CMS-36). Context gating only ever existed in the game | ⚠️ draft said "adapt heavily" |
| `EnemyEditor.jsx` (561) | **Delete** — CMS-85 makes Enemy a filtered view of the Token list; the Drops list is just CMS-41's output shape, built once in Phase 2 | ⚠️ draft said "adapt" |
| `mockBattle.js` / `simulateCombat` | **Shelve, keep on disk** — the future home for CMS-2's eventual lift (CMS-69) | — |
| `components/graph/` | **Skip for this rework** — `AuditPanel`'s text warnings cover the functional need | — |
| `StationEditor.jsx`, `CardEditor.jsx`, `AreaEditor.jsx`, `EncounterEditor.jsx`, `EncounterTableEditor.jsx`, `EffectEditor.jsx`, `LootTableEditor.jsx`, `SubskillEditor.jsx`, `SubskillManager.jsx`, `TagEditor.jsx`, `cardType.js` | **Delete** — superseded per CMS-36/37/38/42/43 | — |
| `gameImporter.js`, `syncMerge.js`, `ImportSummaryModal.jsx`, `SyncPreviewModal.jsx`, `ProposalReviewModal.jsx` | **Delete** — merge/import model reversed (CMS-4, CMS-53, CMS-75) | — |
| `xpPrescriber.js`, `progressionEngine.js` | **Shelve** — tied to heroes/skills/quests, out of CMS-1's scope | — |
| `Sidebar.jsx` (473), `TopBar.jsx` (393), `AppShell.jsx` | **Adapt** — nav/toolbar; Sidebar's tab list is CMS-36's deletion target, TopBar hosts Recalculate/Sync | ⚠️ **was missing from the draft** |
| `fileUtils.js` (383), `FileManagerModal.jsx` (203) | **Adapt** — serialization and backups; matters for CMS-53's write path | ⚠️ **was missing from the draft** |
| `contentGenerator.js`, `GenerateModal.jsx` (AI generator) | **Untouched, parked** | — |

---

## 2. Phases

Per **CMS-84**, every phase carries its own game-side engine work. A phase is
done when you can author something in the CMS *and* see the game consume it.

### Phase 0 — Make the data pipeline real, and revive the shell ✅ **DONE**
The phase the draft didn't have.

**Delivered:** Tokens and Maps load from `data/tokens.json` / `data/maps.json`
(41 Tokens, 2 Maps) with the registries reduced to loaders — 910 lines of
hand-authored JS gone, game verified running unchanged. The CMS builds again,
carries three collections instead of thirteen (1,997 → ~340 lines of store),
and its nav is Items / Tokens / Maps with enemies reached by the Token type
filter (CMS-85). Design commentary preserved in `token_content_notes.md`
(CMS-88); Token vocabulary declared game-side and test-enforced (CMS-89).

**Deliberately NOT delivered:** any editor. All three route to labelled
placeholders — Phase 0 is the shell, the schema and the pipeline. There is also
no way to write to `data/` until Phase 10, which is CMS-53's intended workflow.

**Engine half (CMS-82):**
- Move `tokenRegistry.js`'s Token bodies into `data/tokens.json` and
  `mapRegistry.js`'s Maps into `data/maps.json`, content verbatim. The
  registries become thin loaders reading a `DatabaseManager` glob, exactly as
  `itemRegistry.js` already does.
- *This is not an importer and does not contradict CMS-4.* CMS-4 rejects
  building a game→CMS import path; this moves the game's own content from JS
  to JSON while staying entirely outside the CMS. The game needs working
  content in the meantime; the CMS still re-authors from scratch, and its
  first full sync (Phase 10) replaces these files wholesale.
- **Verify:** the game boots and plays identically. *(session split)*

**CMS half:**
- Fix the `SUB_SKILL_TO_PARENT` build break.
- Delete the obsolete editors and engines listed above so the codebase reflects
  CMS-36/37 from day one.
- Rewrite `useEntityStore.js` (1,997 lines) for the new entity set: `items`,
  `tokens` (**one** collection — enemies are a filter, CMS-85), `maps`,
  `globalValues`. Drop staged deletion and the fictional-skill remap, both
  obsolete under CMS-53/CMS-4.
- Trim `vite-plugin-cms-api.js`: remove `load-game-data` (CMS-4). Sync is
  rewritten in Phase 10, not now.
- **Depends on:** nothing. **Blocks:** everything.

### Phase 1 — Item editor ✅ **DONE**

**Delivered:** CMS-13's field set — identity with auto-syncing id, sprite
picker (reused unchanged), classification, and conditional Consumable /
Equipment sections that appear only when the type warrants them. The value
field is read-only and reads "not yet derived" (CMS-86); there is no way to
type a value anywhere. Tags are free-form with autocomplete over tags already
in use (CMS-91).

**Engine half (unplanned, three vocabulary corrections):**
- `ITEM_TYPES` extended with `ingredient` and `drink` and made canonical
  (CMS-90).
- Item tags investigated and confirmed vestigial (CMS-91) — the owner's
  hypothesis, verified against the code.
- ⚠️ **`equipSlot` was reading the wrong symbol entirely.** The CMS imported
  `SLOT_ORDER`, which is `[0..8]` — the hero dock's grid *indices* since the
  dock rework — and rendered an equip dropdown offering the numbers 0 to 8. An
  item names an equipment **category** (`hand`, `hat`, `chest`, `trinket`,
  `food`, `drink`, `consumable`), checked by `isEquipCategory`. Now imports
  `EQUIPMENT_CATEGORY_DEFS` and shows labels, icons and caps.

**Depends on:** Phase 0. **Blocks:** Phase 2.

### Phase 2 — Token editor core, output shape, and Enemy ✅ **DONE**
Absorbs the draft's Phase 7 almost entirely, per CMS-85.

**Delivered:** CMS-71's three header clusters, `tokenType` as a secondary
dropdown (CMS-62), editable Inputs/Outputs in the sidebars (CMS-59), inline Item
creation (CMS-63), and the Enemy view — same editor, sidebars relabelled
Consumes/Drops, with a visible-but-disabled Combat Stats section (CMS-68/69).
Production `config` is created lazily on the first input or output, so a pure
context or buff Token has none at all (CMS-58). Authoring guards surface D-164's
10–30s cycle band and D-116's strictly-worse rule inline.

**Engine half (CMS-41) — smaller than the roadmap assumed.** Per-entry `chance`
with independent rolls was **already implemented** in `BoardRunner`; only the
quantity *range* was missing. Added `outputRange`/`rollOutputQuantity`/
`expectedOutputQuantity` to `tokenRegistry.js`, shared between the runtime (which
samples) and `ContentRules.test.js` (which needs expected value). Fully
backwards compatible — a `quantity`-only entry reads as the range `{q, q}`, so
no content needed migrating. Four new tests in `TokenCycle.test.js` cover
bounds, variance and mean.
- Rebuild the sidebar logic on `SupplyChainLayout.jsx`'s render shell: literal
  Inputs/Outputs (CMS-59) when a Token has production.
- Header clusters (CMS-71), `tokenType` as a secondary field (CMS-62), auto-id.
- Outputs take CMS-41's shape: per-entry chance, min/max quantity, independent
  rolls, no clusters.
- Inline Item creation from an unknown reference (CMS-63) — genuinely new.
- Enemy is the same editor filtered by `tokenType` (CMS-85), with the disabled
  Combat Stats section (CMS-69).
- **Engine half (CMS-41):** the runtime uses a single fixed `quantity` per
  output today; it needs per-entry chance and min/max.
- **Depends on:** Phase 1. **Blocks:** Phases 3–7.

### Phase 3 — Recipes: pooled and private ✅ **DONE**

**Delivered:** a new Recipes screen (CMS-40) — skill list doubling as the
cross-skill review, N context tags per recipe sourced live from what Tokens
actually `provide` (CMS-6), per-recipe cycle time and XP (CMS-70), and the
pooling toggle on the Token editor (CMS-76). CMS-77 is enforced *structurally*:
opting into a pool deletes the Token's private recipes, so the two can never
coexist. The review surfaces both failure directions — recipes no station can
make, and stations drawing an empty pool.

**Engine half — again smaller than assumed.** CMS-6's multi-tag context gating
was **already implemented**: `requiresContext` was always an array resolved with
`.every()`, so combinations worked and no content had ever used one. The real
work was CMS-39's pooling: a new `recipePoolRegistry.js` reading
`data/tokenRecipes.json`, `recipesForToken()` as the single place pooled/private
is decided, and `effectiveIO` now returning the active recipe's `cycleTimeMs`
and `xp` so `BoardRunner` uses them. `productionRoutes` includes pooled recipes,
without which opting a station into a pool would silently exempt everything it
makes from rule 1's tool-free-source check. Two new content assertions enforce
CMS-77 and that every pool names a real skill.

**Verification:** 10 new engine tests (887 total) covering pooled resolution,
pool sharing between two stations, per-recipe timing and XP, private fallback,
and the Tool × Cookbook two-tag gate resolving cleanly rather than conflicting.

- **Rewrite** the Recipe editor (nothing to adapt — see the table).
- N context tags per recipe (CMS-6), the opt-in pooling toggle (CMS-76), the
  strict pooled-XOR-private rule (CMS-77), and the resulting dual cycle-time
  shape: per-recipe when pooled (CMS-70), flat header `cycleTimeMs` when
  private (CMS-79).
- One surface for authoring *and* cross-skill review (CMS-40).
- **Engine half (CMS-39, CMS-6):** `BoardRunner`/`WorkProcessor` must resolve
  "which recipes can this Token attempt" by skill lookup instead of reading an
  inline `recipes[]`; `RecipeResolver` must gate on a *combination* of context
  tags rather than a single `requiresContext`.
- **Depends on:** Phase 2.

### Phase 4 — Modifier palette and targeting
First of the three phases the draft compressed into one.
- Authorable effect types (CMS-20/22) and palette additions (CMS-27:
  `BONUS_DROP`, `CHARGE_EXTEND`, `SELL_BONUS`).
- The deterministic/proc shape split (CMS-25) — the editor branches on shape.
- Target-mode selector: tag / exact id / `tokenType` (CMS-18).
- **Engine half (CMS-21, CMS-23):** split `SPEED` into `WORK_SPEED` and
  `COMBAT_SPEED` across every consumer; build tag- and id-level targeting in
  `TileModifiers.js`/`ModifierAggregator`, which today applies every adjacent
  buff unconditionally and can only filter by skill category.
- **Depends on:** Phase 2.

### Phase 5 — Effect blocks
- The stackable block container (CMS-59/61), presets that pre-open likely
  sections (CMS-64), free repeatability (CMS-65).
- Per-block cost and cadence, independent of the production cycle (CMS-60).
- `CONVERT`/`BONUS_DROP` routed through Modifiers, not a new section (CMS-72).
- **Engine half:** independent per-block upkeep timers (CMS-60); the `CONVERT`
  modifier type; CMS-19's no-stack default for large targeted buffs.
- **Depends on:** Phase 4.

### Phase 6 — Triggered Tokens
The largest engine phase, and entirely invisible in the draft.
- **Engine half:** a fifth Token category (CMS-29) — event-driven, no work
  cycle, no hero, cooldown-limited. An extensible event/action registry
  (CMS-32); subscriptions to `CYCLE_COMPLETE`, `TOKEN_DEPLETED` and
  `COMBAT_RESOLVED` (CMS-33); success-only firing (CMS-34); global scope via
  the existing `inventory_updated` event plus a threshold check (CMS-35);
  charge burn on service regardless of proc (CMS-26).
- **CMS half:** the trigger section — event type plus per-Token scope
  (CMS-30). CMS-80's rule that a Token with any staffed production loses
  CMS-31's D-116 exemption.
- **Depends on:** Phase 5.

### Phase 7 — Map editor
- Pool entry picker: flat searchable Token list, no theme filter (CMS-56);
  weight as free numeric input (CMS-54).
- No live ROI feedback (CMS-55); Map price has no pass/fail check, only
  computed read-outs after a recalculate (CMS-57).
- No engine half — Phase 0 already made Maps data-driven.
- **Depends on:** Phase 2. Could slide earlier if Map content is wanted sooner.

### Phase 8 — Global Values and the balance engine
Smaller than the draft claimed on the UI side, unchanged on the math side.
- **Reuse:** `connectivityAuditor.js` retargeted for CMS-10's reachability
  gaps; `evCalculator.js` for the velocity bands; `SettingsModal.jsx` +
  `useGlobalStore.js` as the dial UI's starting point (CMS-15).
- **Rewrite:** the anchor. CMS-44's Map-derived chain and CMS-48's
  aggregate-first, rarity-weighted allocation replace `isRoot`/manual
  `trueCost` seeding entirely. This is new math, not a port — budget real time,
  and see the unresolved arithmetic in §4.
- Iterative solving retained (CMS-47); recompute on demand only (CMS-16/55);
  auto-correction applies without review (CMS-14/75).
- Wire `AuditPanel.jsx`'s list view to the new output; strip its Progression
  and Pacing tabs; confirm `ProposalReviewModal` is gone, not dangling.
  Unreachable Items raise Critical rows (CMS-86).
- **Depends on:** Phases 1, 2, 3, 7.

### Phase 9 — Description dictionary
- The phrase-template system composing one description per Token from the
  recipe shape *and* every effect block (CMS-66/81), with per-Token manual
  override (CMS-67).
- Output is a plain string baked into `data/` at sync time; the dictionary
  lives only in the CMS and the game gains no composition code (CMS-87).
- **Depends on:** Phases 3–6 (needs every authored shape to generate against).

### Phase 10 — Sync rewrite and cutover
- Rewrite `vite-plugin-cms-api.js`'s sync route for one-way full-file write
  (CMS-53); delete `syncMerge.js` and `gameImporter.js`.
- **Empty the hardcoded registries** (CMS-83) so `data/` is genuinely the only
  source and deletion actually works.
- Re-author the full content set inside the CMS (CMS-4: manual, not migrated).
- First real sync is a deliberate full-replacement event, not a routine save.
- **Depends on:** everything.

---

## 3. Build order

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
```

Phase 7 (Maps) only needs Phase 2, so it can slide earlier if Map content is
wanted before the effect/trigger work. Phase 8 needs Phases 1–3 and 7 but not
4–6 to *begin* — it just can't cover effect-block balance until they land.

---

## 4. What this roadmap still doesn't resolve

Down from six items to four, and each is now placed where it actually blocks:

- **CMS-48's exact rarity-allocation arithmetic** — how `weight` translates
  into each entry's slice of the anchored total. *Needed before Phase 8
  starts, not during.*
- **CMS-44's chain-step composition** (cost per charge → cost per item),
  re-verified end to end against CMS-48's corrected per-Token value. *Needed
  before Phase 8 starts.*
- **The description dictionary's actual phrase templates** (CMS-66) — the
  mechanism and the storage question are both settled (CMS-87); only the
  template set per event/modifier type is unwritten. *Phase 9, genuinely.*
- **Whether CMS-72's PRODUCE/CONVERT modifiers need an effect-size budget** —
  confirmed during review as a balance number, not a schema shape. *Phase 5,
  genuinely.*

### Blocked, not scheduled

- **CMS-28 (`RANGE_EXTEND`)** is a confirmed direction, not a buildable
  mechanic: which of adjacency's three jobs an extended reach applies to, how
  far it goes, and whether it stacks all need their own design pass, and it
  reopens D-81. **Deliberately absent from Phase 4's palette** — it needs an
  interview session before it can be scheduled at all.
