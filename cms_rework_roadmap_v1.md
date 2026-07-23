# CMS Rework — Implementation Roadmap v1

> **Authoritative implementation plan.** Where this document and
> [`cms_rework_concept.md`](cms_rework_concept.md) disagree, **this one wins**.
> Locked Decisions (§2) override both.
>
> **Drafted:** 2026-07-22, from six interview rounds with the project owner.
> **Not yet started** — no code has been written.

---

## 1. Implementation Status

| Phase | Title | Status |
|---|---|---|
| — | Owner review of this plan + concept doc | ✅ Approved 2026-07-22 |
| 0 | Groundwork, snapshots, branch | ✅ Done 2026-07-22 (5828a2e) |
| 1 | Shared vocabulary — the CMS reads the game's registries | ✅ Done 2026-07-22 (5bbff00) |
| 2 | Round-trip import (game → CMS) | ✅ Done 2026-07-22 |
| 3 | Field-level merge sync (CMS → game) | ✅ Done 2026-07-22 (bb37fcc) |
| 4 | Unified card model + content-derived type | 🟡 In progress — inferCardType (3cd41cf) + CardEditor w/ quiet label & enemy link (466f4c4) done & verified live; remaining: token picker, write derived→cardType, hard ambush guard, station/recipe link, sync re-check |
| 5 | Chain-first authoring | 🔴 Not started |
| 6 | Economic engine rebuilt on 15 real skills | 🔴 Not started |
| 7 | Deck slot template editor | 🔴 Not started |
| 8 | Area editor split + sidebar performance | 🔴 Not started |
| 9 | Documentation sweep + baseline tag | 🔴 Not started |

**Update this table as work lands.** 🔴 Not started · 🟡 In progress · ✅ Verified

---

## 2. Locked Decisions

Established across six interview rounds, 2026-07-22. **Do not re-litigate.**
Where the concept doc or the old `.agent/guides` CMS docs disagree, these win.

### Scope & shape

- **L1** — Substantial rework, **same stack** (React 18 + Vite + Zustand +
  TailwindCSS v4). Not a rebuild, not a patch-up.
- **L2** — The **sprite/recolor suite is out of scope and untouched.**
  `RecolorEditor.jsx`, `SpriteAuditDashboard.jsx`, `SpritePickerModal.jsx`,
  palette endpoints and all saved palette data are preserved as-is.
- **L3** — The **AI generator is parked.** `GenerateModal.jsx` /
  `contentGenerator.js` are left alone, revisited after the core is sound.
- **L4** — **Combat balance simulation is descoped** to its own future project.
  `mockBattle.js` and the enemy battle readouts are left in place and **clearly
  marked stale in the UI** so their numbers are never trusted.
- **L5** — No save migration. Consistent with the other reworks.

### The governing principle

- **L6** — **Engine logic lives in the game; the CMS provides content.** The
  game owns definitions (what a skill is, what card types exist, the formulas).
  The CMS owns content (names, values, times, restore amounts, drop chances).
- **L7** — **The CMS imports the game's vocabulary** — skills, card types,
  presets, tags, equipment slots — directly from `src/config/registries/`.
  Definitions flow game → CMS; content flows CMS → game. Neither direction
  carries the other's kind of data, so there is no cycle. Coupling is the
  accepted cost.

### Sync & data flow

- **L8** — The CMS is the **source of truth for content**, and round-trips: it
  reads `data/` and writes back to it.
- **L9** — **Sync is a field-level merge, never a file replacement.** Read the
  existing file, apply only CMS-modelled fields, leave everything else exactly
  as found. This generalizes the `deckSlots` merge guard into the universal rule
  and retires that special case.
- **L10** — **CMS wins conflicts; silence preserves.** Where both sides have a
  value for a CMS-modelled field, the CMS's wins. Where the CMS has no concept
  of a field or entity, the game's data passes through untouched.
- **L11** — **Deletion is explicit and staged.** Deleting in the CMS records a
  pending deletion carried out on the next sync. Absence from the CMS store is
  never itself a deletion.

### Authoring

- **L12** — The authoring unit is the **production chain**. Creating an unknown
  input offers "where does this come from?" inline, recursing until a root
  resource is reached — without leaving the screen.
- **L13** — **Card type is strictly inferred from card content. No manual
  override.** The editor shows the derived type and its reason.
- **L14** — **Cards are single-purpose.** Variety comes from the deck mix.
  Ambush cards (task + combat on one card) are retired going forward.
- **L15** — Existing ambush content is **left working**. `task_berry_bush_patch`
  keeps its `combat_trigger`; we simply author no more. Its reclassification is
  handled by the inference ruleset's stated exception (§4, R6).
- **L16** — Card types authored in the CMS: **task, combat, recipe, station,
  action/mutator, and quest.** All other types are **preserve-only** — never
  edited, never destroyed. (Quest added per owner, 2026-07-22: quests are partly
  game-generated but still need manual authoring for tutorial and skill-gate
  content.)
- **L17** — Heroes: **equipment side only.** Fix equip slots to the Hero Dock's
  six. No hero, class or roster authoring.
- **L18** — The deck slot editor shows the **authored template only**: blank
  slots and locked hazard cards. Player-placed cards are out of scope for it.
- **L21** — **Explore cards are retired** (owner, 2026-07-22) — no longer a
  feature. The three in `data/cards/explore/` are removed as game-side cleanup,
  like the ambush trigger (L15). The CMS never authors the `explore` type.
- **L22** — **`effects.json` entries exist in name only** (owner, 2026-07-22).
  They were early concepts for the status-effect system and will be reworked
  later. The CMS preserves them as named placeholders and does **not** model
  their mechanics or claim to own the status-effect registry.
- **L23** — **Fictional-skill remap has latitude** (owner, 2026-07-22). The
  implementing session picks the best-fit real skill for each of `industry`,
  `culinary`, `nautical`. It's a best-fit remap, not a permanent binding — the
  15-skill list may change later — so no owner sign-off is required mid-phase.
- **L24** — **The CMS reflects moving frameworks; it does not encode copies**
  (owner, 2026-07-22). The 7-stat combat engine and the 15-skill list are both
  still in development and subject to change. The CMS reads them live from the
  game (L7) rather than hardcoding, and does not build fixed logic against the
  combat framework (reinforces L4). "A mutator card carries a token it applies to
  other cards; card types are primarily a *pedagogical* separation of purpose"
  is the settled framing (owner, 2026-07-22) — see §4 R1.
- **L25** — **Optimization is welcome as a general rule** (owner, 2026-07-22).
  The headline pain is steps-per-task, not lag (F11/F12), but performance
  improvements are fine to make opportunistically, not only in Phase 8.

### Balance engine

- **L19** — The balance engine is **economic only**: value propagation through
  chains, XP curves against the 15 real skills, and gold/XP-per-hour velocity
  targets. Combat is excluded per L4.

### Process

- **L20** — **Finish `hero-dock` Phase 9 first**, merge to `main`, tag a
  baseline, then branch for this work. Do not bundle the two.

---

## 3. Verified Architecture Findings

Each was confirmed against the code on 2026-07-22. **Re-verify before relying on
one** — the codebase moves.

**F1 — The CMS can already import game source.**
[`Sidebar.jsx:7`](cms/src/components/layout/Sidebar.jsx:7) imports
`../../../../src/utils/AssetManager.js` from the game project. Cross-boundary
imports are proven, not theoretical. **L7 depends on this.**

**F2 — The game loads `data/` via build-time glob.**
[`DatabaseManager.js:6`](src/config/DatabaseManager.js:6) uses
`import.meta.glob('/data/cards/**/*.json', { eager: true })`. Most registries
accept **both** a single file and a directory glob (`items.json` *or*
`items/**/*.json`), which leaves file layout flexible if we ever want it.

**F3 — Sync is whole-file replacement, and there is no import path.**
`buildGamePackage()` ([`fileUtils.js:56`](cms/src/engine/fileUtils.js:56))
reconstructs every file from the store; `/api/sync-game-data`
([`vite-plugin-cms-api.js:517`](cms/vite-plugin-cms-api.js:517)) `writeFileSync`s
them over the originals. Grep confirms **nothing** reads `data/` back into the
CMS. This is the root cause of §2.2 in the concept doc.

**F4 — One field is special-cased.**
[`vite-plugin-cms-api.js:551`](cms/vite-plugin-cms-api.js:551) re-attaches
`deckSlots` to areas when the CMS omits it. The only thing standing between the
current design and data loss. **Phase 3 retires it by making it universal.**

**F5 — Skills.** [`skillRegistry.js:17`](src/config/registries/skillRegistry.js:17)
defines 19 keys (`SKILL_COUNT = 15` hero skills; the rest are meta groupings).
[`cms/src/utils/constants.js:2`](cms/src/utils/constants.js:2) lists 9, of which
only 6 exist in the game. **`industry`, `culinary` and `nautical` are fictional.**
13 real skills are unreachable, including `aquatic` — used by
`action_chum_the_waters`.

**F6 — Card types.** Game: 16 in
[`cardConstants.js:26`](src/config/registries/cardConstants.js:26), 11 presets in
[`card-presets.js`](src/config/cards/card-presets.js). CMS: 3
(`Task | Crafting | Combat`), with recipes/stations/encounters split into
unrelated collections.

**F7 — Equipment slots.**
[`equipmentConstants.js:37`](src/config/registries/equipmentConstants.js:37)
defines `SLOT_ORDER = ['hand1','hand2','hat','chest','trinket1','trinket2']`.
The CMS lists 8 entirely different ones.

**F8 — Combat formulas have fully diverged.** Game
([`FormulaRegistry.js:110`](src/config/FormulaRegistry.js:110)):
`75 + 0.25·(attackerSkill − defenderDefense) + accuracy − block ± RPS`, with
per-style skills and gear block. CMS `mockBattle.js`:
`50 + (atk − def)×2` against a single `combatStat`. Not variants of one model.
**Descoped by L4 — recorded so nobody assumes the sim is close.**

**F9 — Mutators and tokens are invisible to the CMS.**
[`TokenRegistry.js:87`](src/config/registries/TokenRegistry.js:87) defines
`TOKENS`; `data/cards/action/mutators.json` holds 3 cards
(`cardType: "action"`, `preset: "MUTATOR"`, carrying `config.tokenId`). The CMS
models none of it. **Currently destroyed by any sync.**

**F10 — Card tags.**
[`tagRegistry.js:41`](src/config/registries/tagRegistry.js:41) defines
`FLAVOUR_TAGS = ['Aquatic','Gathering','Social','Hazard']` plus
`CARD_TAG_OVERRIDES`. Tokens target cards by these tags.

**F11 — Content is small.** `data/`: 58 items, 33 cards (24 task, 6 combat,
3 explore), 4 enemies, 21 recipes, 4 areas, 10 quests, 5 stations, 56 effects,
3 mutators. **Items are in perfect parity with the CMS store** — 0 divergence in
either direction — so seeding is low-risk. Nothing here justifies a performance-
first approach.

**F12 — A real but secondary performance bug.**
[`Sidebar.jsx:45`](cms/src/components/layout/Sidebar.jsx:45) calls
`useEntityStore()` with no selector, subscribing to the entire store; every
keystroke re-renders all tabs and re-runs `getEntityStatus` per row — which runs
full combat sims for enemies. At F11's data sizes this is a stutter, not a wall.
**Phase 8, not Phase 0.**

**F13 — A pre-existing data inconsistency.** `gather_berry_bramble` in
`data/cards/tasks/forest.json` has **no `preset` field**. The current sync would
propagate this silently. Phase 2's importer must surface such gaps rather than
normalize them away.

**F14 — The live workspace is unreadable from a coding session.** The CMS store
persists to browser `localStorage` (`fantasy-guild-cms-entities`). The newest
file backup is `cms/backups/playmat.json`, dated **June 21** — a month stale.
**Blocking: the owner must export a fresh backup before Phase 0.**

**F15 — One ambush card exists.** `task_berry_bush_patch`
(`data/cards/tasks/area_guild_hall.json`): `cardType: task`, 0 inputs, 4 outputs,
one of which is a `combat_trigger` for `enemy_thorn_elemental` at 30%. It also
carries `config.enemyId`. **The sole counterexample to naive type inference** —
see R6 below.

---

## 3a. Follow-ups logged during implementation

Surfaced while building, deferred deliberately. Don't lose these.

- **FU1 (from Phase 1) — AI generator still names fictional skills.**
  `cms/src/engine/contentGenerator.js:88,227` hardcode `industry`/`culinary` in
  the Gemini prompt. Left untouched because the generator is parked (L3); the
  Phase 1 remap catches its output on reload, but live-generated content could
  momentarily carry a fictional skill. Fix when the generator is un-parked.
- **FU2 (from Phase 1) — `combat` skill-requirement retired for items/recipes.**
  `combat` is a category, not one of the 15 skills, so it's gone from the item
  and recipe skill dropdowns. If any content gated on a "combat requirement,"
  that concept must move to a real combat skill (melee/ranged/magic/defense).
  Resolve during Phase 4's card-model work. (The Phase 2 import surfaces two
  combat cards — `task_cow_pasture`, `task_skelly_fight` — that still carry
  `skill: "combat"`, as expected.)
- **FU3 (from Phase 2) — orphaned legacy card files in `data/`.** The import's
  anomaly report flagged **36 broken references** concentrated in
  `data/cards/tasks/farmland.json`, `data/cards/tasks/forest.json` and
  `data/cards/combat/{farmland,forest}.json`. These reference items by a bare-id
  scheme (`wheat`, `flour`) and enemies by a biome_tier scheme (`forest_t1_wolf`)
  that DON'T match the current `item_`-prefixed items or the `enemy_*` registry
  ids — and their areas (`farmland`, `forest`) aren't among the four live areas.
  They look like pre-current-areas leftovers. **Owner decision (2026-07-22):
  LEAVE them for now** — don't delete or repair; the import preserves them and
  just reports them as anomalies. Revisit later.
- **FU4 (from Phase 2) — a card id defined in two files. ✅ RESOLVED
  (179b938).** `task_rocky_outcrop` existed identically (bar areaId) in both
  `area_misty_mountains.json` and `area_sunken_bog.json`. Owner: it belongs to
  **Misty Mountains**; the Sunken Bog file (which held only the duplicate) was
  removed.

## 4. The Card Type Inference Ruleset

L13 forbids a manual override, so these rules must be **total and unambiguous**
over the five authored **card** types — task, combat, recipe, station,
action/mutator. (Quests are a separate entity in `quests.json`, not a card, so
they sit outside this ruleset; see Phase 4 step 4.) Evaluated in order; first
match wins.

| # | Rule | Type |
|---|---|---|
| R1 | The card **carries a token to apply to other cards** — `config.tokenId` is present. (This is what makes a card a mutator: its effect hands a token out to later cards in the deck sequence. The token is *not* attached to this card's own behaviour.) | **action** (mutator) |
| R2 | The card *is* a station | **station** |
| R3 | Card names a station and has inputs → outputs | **recipe** |
| R4 | The enemy is the card's subject — `config.enemyId` and no item outputs | **combat** |
| R5 | Has a skill, a tick time, and item outputs and/or inputs | **task** |
| R6 | *Exception (L15):* has `enemyId` **and** item outputs → **task** with a legacy ambush trigger. Flagged as legacy; not offered for new cards. | **task** |

R6 exists solely for F15. It is a **grandfather clause**, not a supported
pattern — the editor must refuse to add a combat trigger to a card that has item
outputs.

**Open:** R2/R3's boundary needs confirming against how stations and recipes
actually relate in `cardRegistry` — verify in Phase 4 before implementing.

---

## 5. Phases

Each phase ends with a smoke test that must be **actually run**, not inferred
from a passing type-check. UI-facing phases require the CMS dev server
(`cd cms && npm run dev` → `localhost:5175`) and, where sync is involved, a
`git diff` on `data/`.

### Phase 0 — Groundwork, snapshots, branch

**Blocked by:** `hero-dock` Phase 9 merged to `main` and tagged (L20), and the
owner's fresh workspace backup (F14).

1. Branch from a clean `main`: `cms-rework`.
2. Owner exports a fresh CMS workspace backup; commit it to `cms/backups/`.
3. Commit a known-good snapshot of `data/` (the tag from L20 covers this).
4. Add a **CMS section to `CLAUDE.md`** — it currently doesn't mention the CMS
   at all, so every session rediscovers it from scratch.
5. No behaviour change.

✅ **Smoke test:** `cd cms && npm run dev` starts clean on 5175; the game still
builds (`npm run build`); `git status` clean apart from the intended additions.

### Phase 1 — Shared vocabulary

Kills the drift at its root (L7, F5, F6, F7, F10).

1. Replace the hand-maintained lists in `cms/src/utils/constants.js` with
   re-exports from the game's registries: `SKILLS` from `skillRegistry.js`,
   `CARD_TYPES` from `cardConstants.js`, preset names from `card-presets.js`,
   `FLAVOUR_TAGS` from `tagRegistry.js`, `SLOT_ORDER`/`SLOT_INFO` from
   `equipmentConstants.js`.
2. Confirm Vite resolves these across the project boundary the way it already
   does for `AssetManager` (F1). If the CMS's own `node_modules` causes trouble,
   resolve it here — everything downstream depends on it.
3. **Remap the fictional skills** (F5, L23). Find every entity referencing
   `industry`/`culinary`/`nautical` and remap each to the best-fit real skill —
   the session has latitude (L23), so no mid-phase sign-off. Log the mapping
   chosen so it's reviewable, but don't block on it.

✅ **Smoke test:** the skill dropdown lists the 15 real skills including
`aquatic`; the equip slot dropdown shows exactly the six dock slots; no entity
still references a fictional skill, and the remap table is recorded in the phase
commit.

### Phase 2 — Round-trip import (game → CMS)

Gives the CMS eyes (L8, F3).

1. Add `GET /api/load-game-data` to `vite-plugin-cms-api.js`, reading `data/**`
   the way `DatabaseManager` globs it (F2).
2. Write the importer: game JSON → CMS entities. Every entity keeps an
   **untouched passthrough record of its original fields** — the mechanism L10
   and Phase 3 both rely on.
3. Seed rule (L10): CMS store wins on conflict; import fills anything absent.
4. Surface anomalies rather than normalizing them (F13).

✅ **Smoke test:** in a browser with `localStorage` cleared, import and confirm
all 58 items, 33 cards, 4 enemies, 21 recipes, 4 areas and **all 3 mutators**
appear. Confirm `gather_berry_bramble`'s missing preset is reported, not
invented.

### Phase 3 — Field-level merge sync — **the safety phase**

The most important phase in this plan (L9, L10, L11, F3, F4).

1. Rewrite `syncGamePackage` / `/api/sync-game-data`: read the existing file,
   apply **only** CMS-modelled fields, write back. Never reconstruct a file.
2. Unknown fields and unknown entities pass through untouched. **Delete the
   `deckSlots` special case** (F4) — it becomes redundant.
3. Implement staged deletion (L11): a pending-deletions list, applied only on
   sync.
4. Add a **sync preview** showing exactly which files and fields change, and
   what is being deleted, before anything is written.

✅ **Smoke test:** change one item's `baseValue`, sync, then `git diff data/`.
The diff must show **that one field and nothing else.** Confirm by inspection
that all 3 mutators, every `deckSlots` array, every card `preset` and all card
tags are still present. Then delete an item in the CMS, sync, and confirm it —
and only it — is removed.

### Phase 4 — Unified card model + content-derived type

Fixes the worst-offender editor (L13, L16, F6, §4).

**Agreed design (owner interview, 2026-07-22):**
- **Keep the 3-column `SupplyChainLayout`** (owner likes it): left = Inputs
  (Costs), center = the card form, right = Outputs (Rewards). It's already
  wired in `App.jsx` and adapts per entity type.
- **Center = ONE unified card form**, replacing the separate `TaskEditor` +
  `RecipeEditor` for the `tasks`/card collection. **All relevant fields present
  on one form** (owner: "everything on one form") — fill what applies, leave the
  rest blank. Fields that don't apply hide quietly (as `isEncounterOnly` already
  dims skill/tick/XP for combat cards).
- **Quiet derived-type label** (owner: "quiet label") — a small live tag reading
  the inferred type per §4. NOT a prominent banner. No manual override (L13).
- Add the content hooks the inference reads from: an **enemy link** (→combat),
  a **token picker sourced from the game's real `TOKENS`** (→mutator), a
  **station link** (→recipe).
- Left/right column behaviour for a **combat** card (its loot/enemy) and a
  **mutator** (token target tags; no real I/O) is a build-time detail.

1. Collapse the card editors into one, with the type **derived and shown as a
   quiet label** per the agreed design.
2. Implement §4's ruleset, including the R6 grandfather clause.
3. Add mutator/token authoring (F9, F10): `tokenId` (from game `TOKENS`), target
   tags, charges.
4. Keep **quest authoring** working (L16) — quests stay editable, whether that
   lives in the unified card editor or a dedicated quest view is an
   implementation call for this phase.
5. Non-authored card types (L16) render read-only and sync untouched. The
   retired `explore` type (L21) is removed from `data/`, not preserved.

✅ **Smoke test:** build a card with an enemy and no outputs → reads Combat; add
inputs and a station → reads Recipe; attach a token → reads Mutator. Open
`task_berry_bush_patch` → still reads Task, flagged legacy. Attempt to add a
combat trigger to a card with outputs → refused. Sync; `git diff` clean apart
from intended changes.

### Phase 5 — Chain-first authoring

The "too many steps" fix (L12).

1. Extend ghost creation ([`EntitySelect.jsx:56`](cms/src/components/shared/EntitySelect.jsx:56))
   so a new stub immediately offers "where does this come from?" and lets the
   source card be defined inline.
2. Recurse until a root resource is reached, without leaving the screen.
3. Keep unresolved gaps visible and navigable.

✅ **Smoke test:** starting from nothing, author a three-deep chain (finished
product → intermediate → root resource) without navigating away. Confirm every
entity created is complete and correctly linked, and that the connectivity audit
reports no orphans afterwards.

### Phase 6 — Economic engine on 15 real skills

L19, F5.

1. Rebuild XP prescription, time-to-level targets and skill-gap detection
   against the real skills.
2. Verify value propagation and the gold/XP-per-hour velocity targets still hold
   with the corrected vocabulary.
3. **Mark the combat machinery stale in the UI** (L4) — battle readouts and
   enemy status dots labelled as modelling a superseded system.

✅ **Smoke test:** run a simulation; status dots reflect real skills; skill-gap
detection reports against the 15; every combat readout is visibly marked stale.

### Phase 7 — Deck slot template editor

L18.

1. Visual layout of an area's authored deck: blank slots and locked hazard
   cards, in play order, with drag to reorder.
2. Edit slot type, specialized tags, and hazard settings in place.
3. Player-placed content is explicitly **not** shown.

✅ **Smoke test:** rearrange an area's slots visually, sync, and confirm
`areas.json` `deckSlots` matches — with the rest of the area object byte-identical.

### Phase 8 — Area editor split + sidebar performance

F12, and the 785-line `AreaEditor.jsx`.

1. Split the area editor into focused views (economy / art / deck / progression).
2. Fix the whole-store subscription at
   [`Sidebar.jsx:45`](cms/src/components/layout/Sidebar.jsx:45); memoize
   `getEntityStatus` so balance sims don't re-run per keystroke.

✅ **Smoke test:** typing in an editor no longer re-renders the sidebar (verify
with React DevTools or a render counter); every area field remains reachable and
editable after the split.

### Phase 9 — Documentation sweep + baseline tag

1. Rewrite `.agent/guides/CMS_Architecture.md` and `CMS_Design_Document.md` —
   both substantially describe a CMS that no longer exists.
2. Finalize `CLAUDE.md`'s CMS section.
3. Bump the version across all five files and tag a baseline.

✅ **Smoke test:** a fresh session, given only `CLAUDE.md` and the guides, can
correctly describe the CMS's entities, sync model and scope without reading the
source.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| **A sync destroys content before Phase 3 lands.** The window between now and Phase 3 is the dangerous one. | Owner should not press "Sync to Game" until Phase 3 ships. Phase 0's snapshot is the fallback. **Flag this to the owner explicitly.** |
| Cross-project imports (L7) break under the CMS's separate `node_modules`. | Prove it in Phase 1 before anything depends on it. F1 shows one import already works. |
| Inference rules prove incomplete on real content. | §4 is validated against all 33 existing cards in Phase 4 before the old editors are removed. |
| The owner's live workspace differs from the June 21 backup. | Blocking item F14 — fresh export before Phase 0. |
| Game registry renames silently break the CMS. | Accepted cost of L7. Phase 9 documents the coupling so it's expected rather than mysterious. |

---

## 7. Session Handoff Prompt

> I'm resuming the CMS rework. Get oriented first:
>
> 1. Read `CLAUDE.md` — ground rules and working practices.
> 2. Read `cms_rework_concept.md` — the vision and the reasoning.
> 3. Read `cms_rework_roadmap_v1.md` in full — the authoritative plan. Pay
>    particular attention to the **Implementation Status** table (tell me what
>    phase we're on), the **20 Locked Decisions** in §2 (don't re-litigate
>    these), and the **Verified Findings** in §3.
> 4. Confirm you're on the `cms-rework` branch with a clean working tree.
> 5. Re-verify the §3 findings that the upcoming phase depends on — they were
>    confirmed on 2026-07-22 and the code moves.
>
> Then **stop and report back**: what phase we're starting, what it involves in
> plain language, and any gaps you found between the plan and the current code.
> I don't code myself — keep it plain.
>
> **Don't write any code yet.** Once I give the go-ahead, implement that phase,
> run its smoke test for real, update the status table, and stop before the next
> one.
