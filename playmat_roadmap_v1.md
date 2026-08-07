# Roadmap v1: The 7×7 Playmat Rework

The implementation plan for D-108's **vertical slice** — one Map's worth of
content on a working 7×7 board, with progression stubbed. Written against
[`playmat_grid_concept.md`](playmat_grid_concept.md),
[`playmat_ui_concept.md`](playmat_ui_concept.md) and
[`playmat_decisions.md`](playmat_decisions.md) (to D-214), and against the
code audit in [`playmat_gap_analysis.md`](playmat_gap_analysis.md).

> [!IMPORTANT]
> **Read [`playmat_gap_analysis.md`](playmat_gap_analysis.md) before starting any
> phase.** It supersedes grid concept §10 wherever the two disagree — §10 was
> written from design sessions rather than from reading code, and several of its
> claims are wrong. The corrections it contains are load-bearing for this plan.

> [!NOTE]
> **Decisions locked in this revision** (full reasoning in Appendix B, ids `G-1`…`G-20`):
> - **Clean break, no feature flag.** The previous rework paid 115 references
>   across 37 files to unwind one. Saves are wiped anyway (D-110), so there is
>   nothing to stay compatible with.
> - **The game must boot at the end of every phase** (`G-16`). Without a flag
>   this is the only safety net there is.
> - **Hero Speed and Efficiency are deferred** (`G-1`). Skills gate Access this
>   pass and nothing else. D-67 is knowingly unimplemented.
> - **The skills and hero reworks are not built** — the existing 15-skill and
>   hero systems port as-is. See "The skills trap" below.
> - **The loot-sprite layer is built EARLY** (`G-11`), before Token behaviour.
>   D-138, Map bursts (D-142) and crafted Tokens (D-148) all land through it.
> - **Adjacency widens three effect axes** (`G-5`). Retargeting alone is not
>   enough — see gap analysis §1.3.
> - **Energy and Quests go dormant, not deleted** (`G-8`, `G-9`).
> - **One full Map plus a deliberately cheap second** (`G-12`), resolving the
>   D-108 / risk-6 tension in risk 6's favour.
> - **Version 0.5.0; save gate 0.6.0** (`G-17`).

---

## ⚠️ The skills trap — read this before touching skills or heroes

**[`playmat_skills_concept.md`](playmat_skills_concept.md) is design-ahead. It is
NOT a build target.** Nothing in it ships this pass: not the six-slot sheet
(D-180), not the three combat skills (D-196), not the three-layer list (D-205),
not D-192 through D-214.

**[`playmat_hero_concept.md`](playmat_hero_concept.md) is out of scope too**,
apart from §4's board interactions. No job tree, no promotion, no recruitment
rework, no six-slot sheet.

Instead: **port the existing systems unchanged.**
[`skillRegistry.js`](src/config/registries/skillRegistry.js) stays as it is.
Heroes keep all 15 skills. Existing `skillRequired` tags survive into the Token
definitions untouched. Equipment stays at nine slots (D-7).

**This does not violate D-66** ("the skill list is redesigned from scratch, not
migrated"). It **postpones** it. The redesign happens in a later pass, against a
board that has been played.

A future session reading the skills doc as a build target and starting to build
it is the single most likely way this plan goes wrong. If you are that session:
stop, and read Appendix A.

---

## Implementation Status *(update this as work progresses)*

> [!TIP]
> **For future sessions: check this table first.** It is the fastest way to know
> what is already done without reading the whole roadmap. When you finish a
> phase, change its status here and note the date + branch/commit. If you start a
> phase but don't finish it in one session, mark it **In Progress** and leave a
> one-line note about where you stopped. Phases are sized to be coherent chunks,
> not single sessions — several will span two or three.

| Phase | Status | Notes |
|---|---|---|
| Planning — gap analysis | ✅ Done (2026-08-06) | [`playmat_gap_analysis.md`](playmat_gap_analysis.md); 12 owner decisions in its §6 |
| Planning — this roadmap | ✅ Done (2026-08-06) | Decisions log in Appendix B |
| 0 — Safety, Branch & Test Re-Pinning | ✅ Done (2026-08-06, `playmat-7x7-build`) | Version 0.4.2→0.5.0 across all five files; save gate 0.5.0→0.6.0 (the gate is a strict `!==` on `GAME_VERSION`, so the bump alone refuses older saves — no logic change needed, and every consumer references the constant symbolically). Two rescue suites added: `ModifierScopes.test.js` (15) re-pins D-23 additive stacking, distinct source ids and rehydration off the doomed Outpost machinery, **plus the merge-scopes-into-one-bucket rule Phase 5 §B depends on** (resolving separately gives ×1.953 where ×1.75 is correct); `BankOverflow.test.js` (5 active + 5 skipped) documents today's destroy-on-full behaviour and stages the D-138 inversion for Phase 3. Nine stale docs moved to `docs/archive/`; its README already carried the "opposite rework" warning and now lists them and flags the skills doc as design-ahead. Doc corrections landed: regen-is-constant (grid §8.1, D-136, hero §3.6, risk 14), traits kept (§10.1), `TokenAxes`/`GlobalModifiers` kept (§10.3), and the hero spec's "180 perks" claim corrected to 9 classes + 9 traits carrying no applied modifiers. **Tests 583 passed + 5 skipped across 41 files** (from 39/563 — +20 active, none broken). `npm run build` clean. Verified in browser: boots to slot select, no console errors; a save aged to 0.5.0 is **refused** with "This save is from a previous version and cannot be loaded. Please start a new game.", the SYSTEM BOOT dialog stays up, `currentSlot` stays null and the save is not overwritten. ⚠️ Testing note for future sessions: a `beforeunload` listener re-saves the current slot on navigate, so a planted old-version fixture is silently overwritten if you reload after loading a game — plant it while on the slot-select screen (`currentSlot === null`) and click through without navigating. There is no `stopAutoSave` method. |
| 1 — Demolition & Dormancy | ✅ Done (2026-08-06, `playmat-7x7-build`) | The deck loop is gone; the game boots to an inert 7×7 board with real playmat art, Guild Hall fixed at index 24. **Tests 39 files/563 → 29 files/341 + 5 skipped**, build clean, console clean. Deviations from plan, all deliberate: **(a) `CollectionManager` + `PackOpeningOverlay` deleted now rather than kept until Phase 8** — the pack mechanic differs from Maps in every particular (per-area escalating + pick-1-of-N vs flat within-theme + take-everything burst), so git history is the better reference than a 175-line area-coupled module carried eight phases; **(b) `dockActivity` re-pointed to tile vocabulary now** rather than in Phase 2 — archiving `data/cards/` emptied `areaSetRegistry`, so the Dock's area-name lookup broke and leaving it speaking areas would have been worse than fixing it; **(c) `_applyDeathPenalties` extracted to `systems/combat/DefeatPenalties.js`** — it was about to be deleted *inside* `LoopRunner`, taking D-74's rules with it; **(d) `state.board` schema + `GameState` accessors added early** so save roundtrip could be proven now. ⚠️ **Combat currently has no tick owner** — `LoopRunner._tickCombat` was its only driver; expected until Phase 6. ⚠️ **Quests turned out to be area-scoped, not separable** — `QuestBoardSystem` has 34 area references and boards are per-area, so "dormant" means "kept on disk", and reviving them is a rework, not a switch-on; §12 should know that before ruling. Verified in browser on a fresh game: 49 tiles render, Guild Hall marked, Guild Hall screen shows exactly Bank Tabs / Bank Slots / Roster Size with no Outpost or Universal sections, Bank drawer opens, hero recruits and shows in the Dock, Energy bar gone and HP bar retained, and a seeded board (tiles 0 + 48, tray, Token Bank) survives save/reload with tile 0 intact and an unlimited-use Token's `null` charges preserved — the Dock then reads "Pierce (Lv1) — Tile 0", which is the falsy-index trap proven handled end to end. |
| 2 — The Board: State, Grid & Placement | ✅ Done (2026-08-06, `playmat-7x7-build`) | The board is manipulable: place, shove, station, redeploy. **Tests 341 → 398 + 5 skipped across 31 files** (+57: Adjacency 19 exhaustive, Placement 38); build and console clean. Verified in browser with real pointer-event drags: Tray→tile places (Tray 8→7, art renders); dropping a second Token shoves the first back to the Tray intact; a hero dragged from the Dock lands on a tile and the Dock label follows ("Elric (Lv1) — Tile 10"); hero drags tile→tile in **one** drag with the abandoned cycle forfeited (4321→0); a Token dropped on a staffed tile knocks the hero to the Dock and is **not** given the hero; a second hero displaces the first (only one hero on the board after); the Guild Hall refuses everything; save/reload restores tiles, Tray, the hero's tile and an unlimited-use Token's `null` charges. ⚠️ **Risk 7 caught early by the standing check**: a full 48-tile board had **85 competing text elements**. D-85 budgets a tile at three things and makes "uses remaining" hover-only, so the per-tile charge counter was removed → **49**. The Token name label stays as an acknowledged **crutch for placeholder art** and is marked for removal when real art lands. ⚠️ **Two verification traps cost real time and are now written up** — see the Standing Checks warning: rAF never fires in the hidden pane (dnd-kit needs it, so drags silently do nothing without the shim), and `useGameState`'s third argument is `eventFilter`, **not** a default value — passing `{}` or `[]` is truthy, so the hook calls it and every subscription throws, leaving the UI permanently stale. |
| 3 — The Sprite Layer | ✅ Done (2026-08-06, `playmat-7x7-build`) | **D-138 is real.** `BankOverflow.test.js` — written skipped in Phase 0 — is enabled and passing. **Tests 398 → 409 across 31 files, zero skipped**; build and console clean. Verified in browser: sprites render and scatter 1–2 tiles from source; auto-collect routes items→Bank and Tokens→Tray (D-158); clicking collects manually with identical outcome; **grab-and-place** drags a Token straight from the floor to a tile with the Tray untouched; a full Bank leaves 7 Gold Ingots **on the board** instead of destroying them; clicking while still full leaves them put **without duplicating**; making room collects them; and a Mythic-equivalent with `null` charges survives save/reload and re-renders. ⚠️ **Bug found and fixed during the test run:** `SpriteLayer.init()` wasn't idempotent, so a second subscription doubled every overflow pile — it read as an economy bug, not a wiring one. ⚠️ **`CardFailure.test.js`'s capacity-failure cases retired** as Phase 0 predicted; its input and success cases stand. ⚠️ **D-42 is built and tested but NOT yet wired** — `consumeFromSprites` works, and Phase 4 §D connects it, since input resolution is being rewritten there anyway. **Clutter watch:** worst case is now **128 visual elements** (48 Token sprites, 49 name labels, 8 hero badges, 14 loot sprites, 9 count badges) — and the progress ring and alert marks are still to come in Phase 4. The 49 name labels are **38% of that total** and are the acknowledged placeholder-art crutch, so removing them when real Token art lands is the single highest-leverage clutter action available. |
| 4 — Token Cycles & Heroes at Work | ✅ Done (2026-08-06, `playmat-7x7-build`) | **The first playable moment: a hero stands on a Forest and Wood appears.** New: `BoardRunner` (fast-path tick, own handler), `InputAllocator` (D-24 auto-pull, D-127 first-come, D-42 floor-feeding — the sprite path is now wired), `TileProgressRing` (ref-driven, zero React renders). Token registry gains execution config. **Tests 409 → 440 across 32 files** (+31 `TokenCycle`), build and console clean. Verified live: a staffed Forest produced 2 Oak Wood **onto the board**, spent one charge, awarded XP and showed a turning ring; a Still with no wood raised the **red** mark reading *"Waiting for materials"* and **froze its progress rather than running slower** (no partial cycles); a level-1 hero on a skill-25 Deep Mine raised **red** *"skill is too low"*; an unstaffed Forest raised **no mark and dimmed quietly** (D-149); a Passive Generator ran with no hero at all (D-116); a Forest on its last charge **vanished, still paid out, and left its hero idle** (D-118/D-60); and the Dock read *"Rune (Lv1) — Fishing Hole"* / *"Crag (Lv1) — Still"*. D-42 proved itself unprompted mid-test — a Still quietly ate wood off the floor rather than starving. ⚠️ **Risk 13 is now measurable, not theoretical**: `InputAllocator.getStarvationStats()` counts blocked ticks per Token type, and a test pins the failure — with 3 wood, the Still (needs 2) ran while the Deep Kiln (needs 5) starved. ⚠️ **G-1 is pinned by a test**: a level-99 hero works a Forest at exactly the speed a level-1 hero does, so nobody "fixes" the deferred Speed/Efficiency hole by accident. **Clutter: 128 → 84** even though rings and alert marks were added — removing the Token name labels (owner decision) more than paid for both. The ring is mounted on all 48 tiles but **visible on only the 3 actually working**, and red marks appeared on exactly the 4 tiles with real problems. ⚠️ **Third environment trap found** — Chrome intensive-throttles background `setInterval`, so the engine freezes after a few minutes hidden; see the Standing Checks warning. |
| 5 — Adjacency & Effects | ✅ Done (2026-08-06, `playmat-7x7-build`) | **Placement now matters.** New: `TileModifiers` (per-tile scope, runtime-only, rebuilt on `ADJACENCY_DIRTY` and after load), `RecipeResolver` (context crafting + wear-per-cycle-served), `ConnectionLines` (hover-only). **Tests 440 → 461 across 33 files** (+21 `AdjacencyEffects`), build and console clean. ⚠️ **G-5 turned out cheap, for a reason worth recording**: the gap analysis flagged widening YIELD/WORK_TIME/INPUT_COST as significant work because they were card-local — but **Phase 4 had already replaced the consumers**, so it was three call sites in `BoardRunner`/`InputAllocator` rather than retrofitting `LootSystem`/`StatProcessor`/`WorkProcessor`. Rewriting the consumer first made the hard problem small. Verified live: a Forge with nothing beside it raised `no_recipe` and made **nothing at all**; adding a Helmet Schematic cleared it and produced, spending 1 coal and 1 schematic charge; a second, different schematic raised `conflict` and **both** recipes stopped until one was removed; one schematic between two Forges drove **both** and paid **two** charges for it (D-157's rate trade); a Sawmill (+5%) and Shrine (+10%) beside a Forest resolved to **115, not 115.5** — proving the same-bucket merge; a Tool Rack cut cycle time 12000→10800; a Sawmill 8 tiles away did nothing (reach is exactly 8). Hovering a Forge drew a **gold solid** context line, a **blue dashed** buff line and the active recipe label *"helmet"*, all clearing on leave. **Clutter at rest: 81** (connection lines contribute **0** until hovered, which is the entire point of D-84). Incidental confirmation: a test that placed 8 Sawmills around tile 17 only got 7 — tile 24 is the Guild Hall and refuses everything. |
| 6 — Combat on the Board | ⬜ Not started | |
| 7 — Banks, Managers & Guild Upgrades | ⬜ Not started | |
| 8 — The Cartographer & Maps | ⬜ Not started | |
| 9 — Content: Map 1 and Map 2 | ⬜ Not started | |
| 10 — Polish, Clutter & the First Balance Pass | ⬜ Not started | |

**Working branch:** `playmat-7x7-build`, created off `rework/playmat-7x7-grid`
(`G-13`). **Do not implement on `main`, and do not implement on
`rework/playmat-7x7-grid`** — that branch is the design record and should stay
readable as "the design as agreed".

**Every phase ends with:** `npm test` green, the game exercised in the browser,
a `CHANGELOG.md` entry under `## [Unreleased]`, and a commit. Report *what you
observed*, not that code was written.

---

## Broad Phase Overview

```
┌──────────────────────────────────────────┐
│  0: Safety, Branch & Test Re-Pinning     │ ◄── Re-pin orphaned rules BEFORE deleting their homes
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  1: Demolition & Dormancy                │ ◄── The deck loop goes. Game still BOOTS (empty board).
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  2: The Board — state, grid, placement   │ ◄── Manipulable board. Tokens do nothing yet.
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  3: The Sprite Layer                     │ ◄── EARLY (G-11). D-138 works from day one.
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  4: Token Cycles & Heroes at Work        │ ◄── The board produces. First playable moment.
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  5: Adjacency & Effects                  │ ◄── Placement starts to matter. Includes axis widening.
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  6: Combat on the Board                  │ ◄── Ported, not rebuilt (D-136).
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  7: Banks, Managers & Guild Upgrades     │ ◄── The economy plumbing. AFK story lands here.
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  8: The Cartographer & Maps              │ ◄── Progression. The headline reward beat.
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│  9: Content — Map 1 and Map 2            │ ◄── ~15 Tokens + a thin second Map (G-12).
└────────────────────┬─────────────────────┘
                     ▼
┌──────────────────────────────────────────┐
│ 10: Polish, Clutter & First Balance Pass │ ◄── Risk 7 mock; measure risk 13.
└──────────────────────────────────────────┘
```

**Sequencing notes — why this order and not another:**

* **Sprites (3) before cycles (4)** because D-138 says nothing is ever lost to a
  full Bank. Build cycles first and you build the opposite behaviour, then unwind
  it. Sprites are also how Map bursts and crafted Tokens arrive, so they are core
  infrastructure rather than presentation.
* **Placement (2) before behaviour (4)** because the design's own most uncertain
  claim is that *the board itself is enjoyable*. A board you can shove things
  around on is testable before a single Token produces anything, and it is the
  earliest possible read on that question.
* **Adjacency (5) after cycles (4)** because a context Token that redefines a
  recipe needs a recipe to redefine.
* **Content (9) last but not least.** Placeholder Tokens carry phases 4–8. Real
  content lands once the systems it must exercise all exist — and D-161's
  hand-authored numbers mean authoring twice would be expensive.

---

## Standing checks — run these at the end of every phase

> [!IMPORTANT]
> These are not a phase. They are conditions on all of them.

1. **The game boots and reaches a playable screen** (`G-16`). With no feature
   flag there is no flag-off comparison to catch collateral damage, so "it still
   boots" is the cheapest and most important signal there is. A phase that ends
   with a non-booting app is not finished.
2. **The 48-tile clutter check** (`G-15`). Any phase that adds a new thing to the
   tile — progress ring, alert mark, hero overlay, loot sprite, connection line —
   ends with a quick full-board render at 48 occupied tiles. Real playmat art
   already exists in [`public/assets/playmat/`](public/assets/playmat), so this
   costs minutes. **Risk 7 killed the previous spatial playmat**; the formal mock
   lives in Phase 10 by owner decision, but waiting until Phase 10 to *first
   look* is how that failure happens again.
3. **`npm test` green**, with any test deleted this phase accounted for in the
   commit message. See Appendix C for why raw test counts stop meaning anything.
4. **`CHANGELOG.md` updated** under `## [Unreleased]`.

> [!WARNING]
> **Verification-environment trap, found in Phase 1.** The browser pane runs
> **hidden** (`document.visibilityState === 'hidden'`), so
> **`requestAnimationFrame` callbacks never fire** and screenshots time out.
>
> `useUIModals.navToggle` defers the "open" half of every nav-bubble click into
> an `requestAnimationFrame`, so **the entire bubble menu appears completely
> dead** under automated verification while being perfectly fine for a real
> player. Half an hour went into proving this was pre-existing rather than
> caused by the demolition.
>
> **The game loop stops too.** `GameLoop` runs on `setInterval`, and Chrome
> applies **intensive throttling** to background timers after a few minutes
> hidden — cutting them to roughly once a minute. So the engine ticks normally
> just after a load and then appears to freeze, with `GameState.time.gameTimeMs`
> stuck. `GameLoop.isRunning` still reports `true`, because nothing is wrong
> with it. Drive the engine directly instead:
> ```js
> for (let i = 0; i < 30; i++) window.Game.BoardRunner.tick(100);   // 3 seconds
> ```
>
> Before reporting any rAF-deferred UI as broken, shim it first:
> ```js
> window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
> ```
> The same applies to CSS transitions and anything gated on a paint.
>
> **This also breaks drag-and-drop verification.** dnd-kit measures droppables
> and runs collision detection on rAF, so without the shim a drag *starts* (the
> ghost appears) and then silently does nothing. `left_click_drag` is unavailable
> too — it demands a prior screenshot. What works is dispatching real
> `PointerEvent`s with small delays between them: `pointerdown` on the source, a
> `pointermove` clearing dnd-kit's 8px activation distance, several stepped moves
> toward the target, then `pointerup` — all on `document` after the first.

> [!WARNING]
> **`useGameState`'s third argument is `eventFilter`, not a default value.**
> Signature: `useGameState(selector, events, eventFilter, options)`.
>
> Passing `{}` or `[]` there — the natural instinct when you want an empty
> default — is **truthy**, so the hook invokes it as a function, every
> subscription throws, and **the component silently never updates again**. It
> renders its initial value forever and looks like a state bug.
>
> Put the default inside the selector and pass `null`. Found in Phase 2, where
> it made the whole board and Tray appear frozen.

---

## Detailed Phases

### Phase 0: Safety, Branch & Test Re-Pinning

Nothing is deleted yet. This phase exists to make the demolition in Phase 1
survivable — chiefly by **rescuing two sets of rules that are currently only
recorded inside test files that are about to be deleted.**

#### A. Branch

* Create `playmat-7x7-build` off `rework/playmat-7x7-grid` (`G-13`).
* *In plain language:* a branch is a parallel copy of the project. `main` keeps
  the last working game and stays untouched, so at any point you can go back to
  it. `rework/playmat-7x7-grid` holds the twelve design commits and stays as the
  clean record of what was agreed. All the building happens on the new branch,
  and it merges back to `main` once — when the slice works.

#### B. Version Bump (`G-17`)

* Bump **0.4.2 → 0.5.0** across all five files that carry it, together:
  [`package.json`](package.json), [`package-lock.json`](package-lock.json),
  [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json),
  [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml),
  [`src-tauri/Cargo.lock`](src-tauri/Cargo.lock).

#### C. Save Gate (D-110)

* **[MODIFY]** [`StateSchema.js`](src/state/StateSchema.js): `GAME_VERSION`
  `'0.5.0'` → `'0.6.0'`. This is deliberately separate from the app version — it
  names the app version at which the save *structure* last broke.
* **[MODIFY]** [`SaveMigration.js`](src/systems/core/SaveMigration.js): saves
  predating `0.6.0` are **refused with a clear message**, not migrated. Nothing
  meaningful maps across — cards become Tokens with board state, areas cease to
  exist, heroes lose their area binding.
* Verify the refusal path leaves the slot-select screen intact rather than
  half-booting. *(This exact bug was found by the equivalent smoke test in the
  previous rework — worth re-checking rather than assuming.)*

#### D. Re-Pin the Orphaned Rules *(the real work of this phase)*

Two rule sets exist **only** as tests on systems Phase 1 deletes. Deleting the
tests deletes the rules.

* **[NEW]** `src/tests/ModifierScopes.test.js` — port the *rules* from
  [`GlobalAuras.test.js`](src/tests/GlobalAuras.test.js) (12 tests) off the
  Outpost machinery and onto bare aggregators:
  * **Duplicate sources stack additively** (D-23) — two `+25%` give `+50%`, never
    `×1.5625`. This is the bug the three-bucket rule exists to prevent, and the
    board's Guild Hall aura will hit it the moment two upgrade ranks apply.
  * **Distinct source ids per copy** — sharing a source means removing one copy
    silently strips the other.
  * **Runtime aggregators rebuild from state after a load** — a silently-empty
    aggregator post-reload is the classic failure here.
* **[NEW]** `src/tests/BankOverflow.test.js` — pin the **D-138 behaviour we are
  about to build**, as the successor to
  [`CardFailure.test.js`](src/tests/CardFailure.test.js)'s Bank-full cases. Write
  these now, mark them `it.todo` or skipped, and turn them on in Phase 3:
  * A completed cycle with a full Bank **still completes**; its output becomes a
    board sprite rather than being destroyed or refused.
  * A Mythic Token can never be lost to a full Token Bank.
  * *Note the inversion explicitly in the file header* — today
    [`CardPreflight.js`](src/systems/cards/logic/CardPreflight.js) refuses the
    cycle and [`InventoryManager.addItem()`](src/systems/inventory/InventoryManager.js)
    destroys the overflow. D-138 reverses both.

#### E. Documentation Hygiene

Stale docs at the repo root have already misled one planning session.

* Move to `docs/archive/`: `skill_mapping_concept.md`,
  `loop_mechanics_concept.md`, `deck_loop_task_list.md`,
  `area_deck_rework_concept_v3.md`, `area_deck_rework_roadmap_v1.md`,
  `hero_dock_concept.md`, `hero_dock_roadmap_v1.md`, `mutator_roadmap_v1.md`,
  `rework_cleanup_todo.md`.
* **[MODIFY]** [`docs/archive/README.md`](docs/archive/README.md) — it already
  exists and already carries the "these describe the *opposite* rework" warning,
  which is exactly right. Just extend it: list the newly-moved files above with a
  one-line reason each, and add `playmat_skills_concept.md` to its "live
  documents" table **with the design-ahead caveat attached** (see this roadmap's
  skills trap section) so nobody finds it through that table and starts building.
* Correct the three passages the gap analysis found wrong (`G-2`): §8.1 of
  [`playmat_grid_concept.md`](playmat_grid_concept.md), D-136 in
  [`playmat_decisions.md`](playmat_decisions.md), and
  [`playmat_hero_concept.md`](playmat_hero_concept.md) §134 — regen is
  **constant**, not idle-only; retreat works by removing the damage source.
  Risk 14 stays closed on the corrected reasoning.
* Correct §10.1's "Hero traits" deletion to match the brief and hero spec
  (`G-7`), and §10.3's Token-collision paragraph to exempt `TokenAxes.js`
  (`G-19`).

#### ✅ Acceptance

* `npm test` — **563 existing tests still pass**, plus the new
  `ModifierScopes.test.js` suite. `BankOverflow.test.js` present and skipped.
* Run the game: it boots and plays exactly as before (nothing has changed
  functionally). Load an existing save — it is **refused with a readable
  message**, and the slot-select screen stays usable.
* Commit.

---

### Phase 1: Demolition & Dormancy

The deck loop goes. This is the phase with no safety net, so it is scoped
deliberately: **delete, rename, mute — build nothing.** The one thing that gets
built is a placeholder so the app still boots.

> [!WARNING]
> **This phase makes the game unplayable in the ordinary sense**, and that is the
> accepted cost of the clean break. It should still *boot*. If it does not, stop
> and fix that before going further — a non-booting app makes every subsequent
> phase undiagnosable.

#### A. Delete — the loop engine

* [`src/systems/loop/`](src/systems/loop) **entirely**: `LoopRunner.js` (847),
  `DeckSlotManager.js`, `StationManager.js`, `StationSlotManager.js`,
  `OutpostManager.js`, `SlotFailures.js`, `LoopBuffs.js`, `AreaModifiers.js`.
  *(`GlobalModifiers.js` is rescued first — see §C.)*
* [`src/systems/area/`](src/systems/area) entirely: `AreaStateManager.js`,
  `HeroAssignmentManager.js`.
* [`src/systems/core/areaEvents.js`](src/systems/core/areaEvents.js).
* Progression: [`BinderManager.js`](src/systems/progression/BinderManager.js),
  [`BinderMastery.js`](src/systems/progression/BinderMastery.js). **Keep**
  `CollectionManager.js` for now — Phase 8 mines its purchase/reveal plumbing for
  the Cartographer, then retires it.

#### B. Delete — the card-mutator system

* [`src/config/registries/TokenRegistry.js`](src/config/registries/TokenRegistry.js)
  — **this is what frees the name "Token"** for board objects.
* [`src/systems/effects/SlotTokens.js`](src/systems/effects/SlotTokens.js),
  [`MutatorStamping.js`](src/systems/effects/MutatorStamping.js).
* `src/ui/components/card-modules/CardTokenOverlay.jsx`.
* ❌ **DO NOT delete
  [`src/systems/effects/TokenAxes.js`](src/systems/effects/TokenAxes.js)** —
  grid concept §10.3 groups it with the two above, and that is wrong. It is
  generic, and it is the *only* consumer path in the game for `YIELD`,
  `WORK_TIME` and `INPUT_COST`. Deleting it deletes the board's economy
  resolvers. See §C.

#### C. Rename the two rescued survivors (`G-19`)

* `src/systems/effects/TokenAxes.js` → **`src/systems/effects/EffectAxes.js`**.
  Same code; the name no longer collides with board Tokens. Update the four call
  sites (`LootSystem`, `StatProcessor`, `WorkProcessor`, `CardPreflight`).
* `src/systems/loop/GlobalModifiers.js` → **`src/systems/effects/GuildModifiers.js`**.
  It is the only proof in the codebase that an aura can reach across scopes, it
  carries D-23's additive-stacking discipline, and it is the pattern the Guild
  Hall's **Global**-reach upgrades will copy (D-121).

#### D. Delete — the deck-loop UI

* [`src/ui/components/banner/`](src/ui/components/banner) entirely (~2,900 lines
  across 15 files).
* `src/ui/components/ActiveCardFace.jsx`, `AreaUnlockOverlay.jsx`.
* `src/ui/components/fullscreen/AreaManagerScreen.jsx`.
* `src/ui/components/card-modules/CardPips.jsx` (binder copy pips — playsets are
  deleted), `RecipeSelectorModule.jsx`.
* `src/ui/modals/CollectionBinderModal.jsx`, `src/ui/modals/library/`.
* `src/ui/components/vault/ItemDurabilityBar.jsx` (durability retires, D-118).
* **Keep:** [`ReactRoot.jsx`](src/ui/ReactRoot.jsx) — its shell is already the
  right shape (nav bubbles, centre content, Hero Dock, bottom drawer). Only the
  centre slot changes.
* **Keep:** the whole of [`src/ui/dnd/`](src/ui/dnd), the Hero Dock, the drawer,
  `BubbleMenu`, `InspectionPanel`, `BankTab`, the base component library.

#### E. Delete — retired mechanics

* [`src/systems/equipment/DurabilitySystem.js`](src/systems/equipment/DurabilitySystem.js)
  — replaced by Token depletion (D-118). Remove the `assignedToolId` /
  `decrementDurability` call in
  [`WorkProcessor.js`](src/systems/cards/logic/WorkProcessor.js), and the
  `toolslot` handler in
  [`RequirementRegistry.js`](src/systems/cards/logic/RequirementRegistry.js) —
  tools are Context Tokens now (D-117).
* `card.isFleeing` in
  [`CombatProcessor.js`](src/systems/cards/logic/CombatProcessor.js) — read in
  two places, written nowhere. Retreat is just unassigning the hero (`G-3`).
* The `EFFECT_REACH.LOOP` / `NEXT_CARD` constants in
  [`effectRegistry.js`](src/config/cards/effectRegistry.js) stay for now and are
  replaced in Phase 5 — deleting them now would break `validateEffects` for no
  gain.

#### F. Mute, don't delete

* **Energy** (`G-8`, D-183/D-184). Once card draws and Outposts are gone,
  *nothing charges Energy* — the cut lands for free. Remove `ENERGY_DRAW_COST`
  and `DEFAULT_CRAFT_ENERGY` usage, hide the Energy bar in the Dock, and stop
  `ConsumptionSystem.tryDrink` being called. **Leave `hero.energy`, the Drink
  category and the 183 references in place.** The 45-file removal sweep is
  deferred cleanup with no player-visible payoff, and it is exactly the kind of
  broad change a no-flag branch cannot verify. Logged in Appendix A.
* **Quests** (`G-9`). Remove the `quest_board` tick handler from
  [`EngineBootstrap.js`](src/systems/core/EngineBootstrap.js) and hide the UI.
  Leave `QuestBoardSystem`, `QuestTracker`, `questRegistry`, `QuestProcessor` and
  the quest card traits in place. §12 has not actually decided their fate.

#### G. Trim the Guild Upgrade tree (`G-10`)

* **[MODIFY]** [`guildUpgrades.js`](src/config/guildUpgrades.js): remove the 9
  dead nodes — `universal_rest`, `outpost_slots`, and the 7 `outpost_*` station
  grants. Hide `quest_slots` (dormant with quests). **Keep** `bank_tabs`,
  `bank_slots`, `roster_size`.
* Retire `stack_size` — it adds +50 to a stack ceiling of `1e12`
  (`DEFAULT_MAX_STACK`). It has been buying a rounding error. D-137's
  "stacks are never capped" is already true in practice.
* **[MODIFY]** [`GuildUpgradeManager.js`](src/systems/progression/GuildUpgradeManager.js):
  strip `_ensureOutpostBanners()`, the `collection.universals` /
  `collection.playsets` writes, and the `unlockedAreaSets` gate in `purchase()`.
  The rank→derived-stat mechanism itself is good and stays.

#### H. Archive the card content (`G-18`)

* Move [`data/cards/`](data/cards) → `data/archive/cards/` (14 files, ~36
  entries). It is reference material for Phase 9, not live content. **Keep**
  `data/items.json`, `data/enemies.json`, `data/recipes.json` and the drop tables
  — Phase 9 mines them so the item registry and enemy registry don't need
  rebuilding.
* **[MODIFY]** [`cardRegistry.js`](src/config/registries/cardRegistry.js): stop
  loading from `data/cards/`. It becomes the Token registry's ancestor in Phase 4.

#### I. Stub the centre screen

* **[NEW]** `src/ui/components/board/BoardStub.jsx` — renders a static 7×7 grid
  of empty tiles at 128px using the existing `pm_board_*` sprites. No state, no
  interaction.
* **[MODIFY]** [`ReactRoot.jsx`](src/ui/ReactRoot.jsx): centre slot renders
  `BoardStub` instead of `AreaBannerContainer`.
* **[MODIFY]** [`BubbleMenu.jsx`](src/ui/components/nav/BubbleMenu.jsx): drop the
  Area Manager bubble; leave the rest.
* This is what keeps `G-16` true through the demolition.

#### ✅ Acceptance

* `npm test` — the surviving suites pass. **State the honest number in the commit
  message**: roughly 13 files / 166 tests are deleted here, plus ~58 of
  `Mutators.test.js`'s 130. See Appendix C. A dropping count is expected; an
  unexplained *failure* is not.
* Run the game: **it boots**, shows an empty 7×7 board with real playmat art, the
  Hero Dock and drawer still work, the Bank tab still lists items, and the
  console is clean. Report what you saw on screen.
* Confirm no import of a deleted module survives — `npm run build` completing is
  the cheapest proof.
* Commit.

---

### Phase 2: The Board — State, Grid & Placement

The first phase that builds. At the end of it the board is **manipulable but
inert**: you can put Tokens on tiles, shove them around, drag heroes onto them,
and it all survives a save. Nothing produces anything yet.

This is deliberate. The design's own stated position is that *the most uncertain
claim is that the board itself is enjoyable*. Dragging things around a 7×7 grid
is the earliest possible read on that, and it is available one phase after
demolition.

#### A. Board State Schema

* **[MODIFY]** [`StateSchema.js`](src/state/StateSchema.js) — add `state.board`:
  * `tiles` — a sparse map keyed by index `0–48` (row-major). Absent means empty;
    48 empty tiles should cost 48 nothing, not 48 objects.
  * Index **24** is the **Guild Hall** (D-106) — permanent, not placeable, not
    removable. Assert this rather than trusting content.
  * `state.tokenBank` — `{ [typeId]: [ {uses}, {uses}, … ] }`. Capped by
    **distinct types**, never by copies (D-137).
  * `state.tray` — an ordered array, ~15–20 slots (D-168).
* **[NEW]** `src/systems/board/BoardState.js` — the tile accessor layer.

**The Token instance shape** (D-79's "a card definition plus board state"):

```js
{ typeId: 'token_forest',   // → the definition in the registry
  usesRemaining: 4200,      // null when unlimited (D-176)
  heroId: null,             // who is working it (D-57, D-111)
  cycleElapsedMs: 0 }       // runtime; reset on any interruption (D-54)
```

Position is the map key, not a field. The definition is **never copied onto the
instance** — retuning a Token in the registry must take effect immediately
everywhere, the same reasoning the deck loop's flyweight slots used.

#### B. Adjacency — one function, used everywhere

* **[NEW]** `src/systems/board/adjacency.js` — `neighboursOf(index)` returning
  the surrounding 8 tile indices, clipped at edges (D-81, D-61).
* **This is the single most re-used primitive in the design.** Context recipes,
  buffs, Guild Hall aura and Manager reach all use it, unmodified. A corner
  returns 3, an edge 5, a centre 8 — the only positional difference on the board.
* Pure function, no state. **Test it exhaustively here** — all four corners, all
  four edges, the centre, and the Guild Hall's own neighbourhood.

#### C. Placement & Displacement (D-134, D-143, D-147)

One rule set, applied to everything on the board. Build it in one module so it
cannot drift apart.

* **[NEW]** `src/systems/board/Placement.js`:
  * **Token onto an occupied tile → the incoming Token shoves the old one out.**
    The displaced Token goes to the Tray. No need to clear a tile first, which
    matters on a board with no spare space to shuffle through.
  * **A hero on a shoved tile is knocked off** and returns to the Dock (D-143).
    Deliberately *not* auto-assigned to whatever arrived — the player is never
    left with someone quietly working a Token they did not choose.
  * **Hero onto an occupied tile → the occupant goes to the Dock** (D-147),
    where they sit idle until re-placed.
  * **Heroes move tile-to-tile directly**, without a trip through the Dock. This
    is the game's most frequent action and must cost one drag, not two.
  * **Any interruption forfeits the current cycle** (D-54, D-131) —
    `cycleElapsedMs = 0`. One rule for Tokens and heroes alike.
  * The Guild Hall tile refuses every placement.

#### D. The Tray and the Token Bank *(state and minimal UI)*

* The Tray is **load-bearing, not decorative** (D-107). An open Bank covers the
  board, so Tokens cannot be dragged Bank→tile directly. The flow is
  **Bank → Tray → Board**. Remove the Tray and placement stops working.
* Build the Tray panel (~25% of the screen, right-hand side per UI §2) and a
  minimal Token Bank list. **The full Bank UI, slot caps, consolidation and
  selling land in Phase 7** — this phase needs only enough to get a Token onto a
  tile.

#### E. Rendering

* **[NEW]** `src/ui/components/board/Board.jsx`, `BoardTile.jsx`.
* **128px tiles — 32px art at 4×** (D-171). Integer scaling is *required*, not
  preferred: the art is pixel art and fractional scaling blurs it. Board is
  therefore 896px.
* **Desktop only at 4×** (`G-20`). Small mode and touch are deferred (Appendix A)
  — but **the tile size is a single exported constant** and nothing hardcodes
  `128`, so a later small mode is a config change rather than a layout rewrite.
* **The grid is real but invisible** (D-143). No drawn gridlines. Tokens read as
  solid objects resting on a surface, not cells in a spreadsheet. Use the
  existing `pm_board_*` floor sprites.

#### F. Drag Integration

The existing [`src/ui/dnd/`](src/ui/dnd) system does most of this already — it is
pointer-tracked, has an animated ghost, "bloom on cross-over" between drawer and
board surfaces, spring-back on a miss, and per-target `accepts()`/`onDrop()`.

* **[MODIFY]** [`dragConstants.js`](src/ui/dnd/dragConstants.js): add
  `DRAG_KIND.TOKEN`, and an SFX mapping for it.
* Make each of the 48 tiles a drop target. Sources: Tray, board tiles, Hero Dock.
* **Tokens are weighty physical objects** (UI §5). Displacement *shoves* — the
  outgoing Token should visibly leave, not blink out.

#### G. Save Roundtrip

* Board, Tray and Token Bank serialize and rehydrate. Cycle timers are runtime
  and are **not** saved — reloading starts the cycle clean, which is consistent
  with D-54's forfeiture rule rather than a lossy shortcut.

#### ✅ Acceptance

* `npm test` — new suites: `Adjacency.test.js` (exhaustive neighbour sets),
  `Placement.test.js` (every displacement path in D-134/D-143/D-147),
  `BoardState.test.js` (Guild Hall immovable, sparse tiles).
* **Run the game and actually exercise it.** Report observations, not code:
  place a Token from the Tray onto a tile; drop a second Token on top and watch
  the first get shoved to the Tray; put a hero on a Token; drop a different Token
  on that tile and confirm the hero lands in the Dock; drag the hero directly
  from one tile to another; drop a hero on an occupied tile and confirm the
  occupant goes to the Dock; try to place on the Guild Hall and confirm refusal;
  save, reload, confirm the whole board is exactly as left.
* **Standing check 2:** fill all 48 tiles and look at it. First honest read on
  risk 7.
* Commit.

---

### Phase 3: The Sprite Layer

Built early by owner decision (`G-11`), before anything produces output. Three
later systems land through it — D-138's overflow rule, Map bursts (D-142) and
crafted Tokens (D-148) — so building it now means each of those is correct on
arrival rather than built against a stub and unwound.

> [!NOTE]
> Loot today goes **straight to the Bank** via `TransactionProcessor`, and a full
> Bank **destroys** it. This phase inverts that. `BankOverflow.test.js` from
> Phase 0 turns on here.

#### A. The Sprite Layer

* **[NEW]** `src/systems/board/SpriteLayer.js` — runtime-only registry of loose
  sprites. Sprites **float above the grid, occupy no tile**, and are not banked
  until collected (D-40).
* Sprites **must survive a save** — a Mythic sitting on the floor because the
  Bank was full cannot evaporate on reload. This is the one piece of board
  runtime state that *is* persisted.
* **[NEW]** `src/ui/components/board/SpriteLayer.jsx` — items pop out on an arc
  and **settle with a bounce** (UI §5, D-143). Loot has mass.

#### B. Routing by Kind (D-158)

* **Items go to the Bank. Tokens go to the Tray.** Items are for storing; Tokens
  are for placing, so each lands where it will next be used.
* **A Token sprite can be grabbed and placed directly** onto a tile without any
  trip through storage. Let the cursor leave without clicking and it routes
  itself to the Tray instead. *Opening a Map therefore flows straight into
  building: burst, grab what you want, let the rest tidy itself away.*

#### C. Collection (D-41, D-88)

* Manual and automatic pickup are **identical in outcome** — collection confers
  no mechanical advantage. The mechanic exists for feel and can be disabled
  entirely by a player setting.

#### D. Overflow Storage — the D-138 inversion

* **[MODIFY]** [`InventoryManager.addItem()`](src/systems/inventory/InventoryManager.js):
  when there is no free slot, **do not destroy and do not warn** — hand the item
  back to the sprite layer. Nothing is ever lost to a full Bank.
* **[MODIFY]** [`CardPreflight.js`](src/systems/cards/logic/CardPreflight.js):
  remove the "output has nowhere to go" refusal. The cycle completes; the loot
  lands on the floor.
* Same rule for the Token Bank. **This is what protects a Mythic drop** — a
  one-copy-ever Token can never be wasted because storage was full.
* *Intended consequence:* a Bank at capacity announces itself the way everything
  else on this board does — **visibly, as litter piling up across the grid**,
  rather than through an error message. Auto-collect cannot collect into a full
  Bank, so even a player running at zero visible stacks will see sprites
  accumulate at their slot cap. That is the signal, not a bug.

#### E. Sprites as Input Source (D-42)

* If the Bank lacks an item a Token needs, it is **pulled from any matching
  sprite on the board**. Loot on the ground never starves a chain.

#### F. Development Affordance

* A dev button to spawn loot sprites, so this phase is testable before anything
  produces. Fold into the existing `DevSpawnItemModal`.

#### ✅ Acceptance

* `npm test` — `BankOverflow.test.js` **enabled and passing**; new
  `SpriteLayer.test.js` (routing by kind, sprite-as-input-source, save
  roundtrip).
* Run the game: spawn loot and watch it arc and bounce; grab a Token sprite and
  drop it straight onto a tile; let one time out and confirm it routes to the
  Tray; fill the item Bank to its slot cap and confirm new drops **stay on the
  board as litter rather than vanishing**; toggle auto-collect off and confirm
  behaviour is identical in outcome; reload with sprites on the floor and confirm
  they are still there.
* **Standing check 2** — sprites are a new thing on the board. Look at 48 tiles
  with loot scattered across them.
* Commit.

---

### Phase 4: Token Cycles & Heroes at Work

**The first playable moment.** A hero stands on a Forest and Wood appears.

This is the biggest phase and the one where "port the card execution model"
stops being a simple sentence. Per the gap analysis: the *skeleton* ports —
flyweight definition, ephemeral instance, timer, complete-and-pay. The
**input and tool layers do not**, and they are roughly half of
[`WorkProcessor.js`](src/systems/cards/logic/WorkProcessor.js) and
[`RequirementRegistry.js`](src/systems/cards/logic/RequirementRegistry.js).

#### A. The Token Definition Registry

* **[NEW]** `src/config/registries/tokenRegistry.js` — descended from
  [`cardRegistry.js`](src/config/registries/cardRegistry.js). The name is free
  because Phase 1 deleted the mutator registry.
* Definition schema, adapted from the existing card JSON, which is already a
  good fit:

```jsonc
{ "id": "token_forest",
  "name": "Forest",
  "tokenType": "resource",        // resource | enemy | station | context |
                                  // passive | buff | structure | map
  "rarity": "common",             // drop-frequency label ONLY (D-175)
  "theme": "woodland",            // where power comes from (D-95)
  "uses": 5000,                   // null = unlimited (D-176)
  "config": {
    "skill": "nature", "subskill": "woodcutting",
    "skillRequired": 1,           // Access (D-67) — ported unchanged
    "cycleTimeMs": 20000,         // was baseTickTime; already in D-164's band
    "xp": 4,
    "inputs": [],                 // pulled automatically from the Bank (D-24)
    "outputs": [ { "itemId": "item_yew_log", "quantity": 2, "chance": 100 } ]
  } }
```

* **Rarity is a drop-frequency label and nothing else** (D-175). It does not
  determine behaviour, power or charges. Do not let it become a difficulty tier —
  three independent axes: **rarity = how often you find it; charges = how long it
  lasts; theme = how strong it is.**
* **Keep both dispatch mechanisms** (`G-6`) — the trait bag *and* the effect
  list. The trait bag is what `WorkProcessor` and `StatProcessor` actually read
  today; collapsing them is a rewrite in the phase that most needs to be boring.
  Logged as cleanup debt in Appendix A.

#### B. The Cycle Engine

* **[NEW]** `src/systems/board/BoardRunner.js`, registered as its own tick
  handler in [`EngineBootstrap.js`](src/systems/core/EngineBootstrap.js).
* **Keep the fast-path pattern from `LoopRunner`** — 99% of ticks only subtract
  delta from a countdown. The expensive work happens at the rare moment a timer
  hits zero. With up to 48 tiles ticking this matters more than it did with 12
  areas, not less.
* **Keep the ephemeral-instance bridge** — the preserved execution engines all
  operate on rich instances, so build one when a Token starts a cycle, hold it in
  a runtime-only map, discard it on completion. Never saved.

#### C. Heroes at Work

* **Most Tokens require a hero** (D-53). A hero works **exactly one Token and
  stands on top of it** (D-57); a hero on an empty tile does nothing.
* **One hero per Token, always** (D-111).
* **Heroes never move themselves** (D-59) — no auto-hop, no seeking, no queue.
* **A hero whose Token stops producing simply idles** (D-60) until the player
  returns. This is the accepted natural limit of an idle session.
* **A hero is primarily a gate, secondarily a modifier** (D-62). This pass
  implements **only the gate and Access**:
  * ✅ **Access** — `skillRequired` checked against the hero's skill level, using
    the existing `SkillSystem.meetsRequirement`.
  * ❌ **Speed and Efficiency are deferred** (`G-1`). Hero level does not change
    cycle time or input cost this pass. This is knowingly a hole in D-67 and is
    recorded in Appendix A. *Do not quietly implement it because it looks
    missing.*

#### D. Inputs — the part that is a rewrite, not a port

* **Inputs are pulled automatically from the global Bank** (D-24). There is no
  assignment step, no input slot to fill, no item dragged onto a Token.
* **[DELETE]** the `assignedItems` model, the `inputslot` /
  `dynamic_inputslots` / `toolslot` handlers in `RequirementRegistry.js`, the
  `card.stack` fallback, and the assignment plumbing in
  `WorkProcessor.consumeInputs()`.
* **Supply is not spatial** (D-83). A Forest in one corner supplies a Forge in
  the other exactly as well as a neighbour would. *What a Token makes is spatial;
  where its materials come from is not.*
* **[NEW]** `src/systems/board/InputAllocator.js` — **first-come allocation**
  (D-127): whichever Token's cycle completes first takes what is in the Bank;
  others wait. **No partial cycles** — a Token runs at full speed when it has its
  inputs and waits when it does not.
  * Shortfall is resolved **per item**, so a Coal shortage affects only
    coal-burners and throttling cascades downstream with no explicit cascade
    logic.
  * ⚠️ **Instrument this from the start.** Risk 13: a Token needing 1 Coal acts
    sooner than one needing 5, so under sustained shortage the *deep* chains the
    game wants players to build starve first — the opposite of §6.2's intent.
    Phase 10 measures it; make sure the data is there to measure.

#### E. Charges & Depletion (D-176, D-118)

* Every cycle decrements `usesRemaining`. At zero the **Token is gone** — the
  tile is empty and any hero on it stands idle (D-60).
* **Token depletion is the only wear mechanic in the game.** It covers resources,
  enemies, tools and everything else on the board. Hero equipment is permanent.
* Charges are a **per-Token property, independent of rarity** (D-176). A Common
  may be unlimited; a Mythic may have charges. The correlation is soft and
  deliberate.

#### F. Passive Generators (D-116)

* Produce on their own timer with no hero. **Deliberately and strictly
  inefficient** — worse output *and* often higher input cost than the same job
  staffed.
* ⚠️ **Risk 11 is a build constraint, not just a content note.** Tiles are
  abundant; if an unstaffed Token ever beats a staffed one *per tile*, the
  optimal board becomes mostly unstaffed and heroes stop being the ceiling —
  which unpicks D-115, D-181 and §6.2 at once. Check every authored Passive
  Generator against its staffed equivalent in Phase 9.

#### G. The Tile Display (UI §3)

A tile shows **exactly three things, always** (D-85):

* Token art, with the hero on it drawn on top.
* A **progress ring** for the current cycle.
* **One alert mark** if anything is wrong — several conditions collapse into a
  single "look at me", with the cause on hover.

Two marks, two colours, no overlap (D-172):

| Mark | Means | Fix |
| :--- | :--- | :--- |
| 🔴 Red, on the Token | Staffed but stuck — no inputs, conflict, or hero unqualified | Fix the supply or the layout |
| 🟡 Bright yellow, on the hero | This person has nothing to do | Move them, or restock their tile |

* **An unstaffed Token is not an error** (D-149). With ~8 heroes on 48 tiles most
  of the board is unstaffed at any moment; flagging it would make the mark
  meaningless. **An alert appears only when a Token has a hero on it and still
  cannot work.**
* The yellow mark lives on the *hero*, not the tile, so it costs nothing against
  the tile's information budget — and it should stand out hard, because spotting
  idle people is the main thing a returning player needs to do.
* Hovering a red mark states **exactly what is missing and by how much** (D-114).
  There is no aggregate supply dashboard; diagnosis is tile by tile.

#### H. Placeholder Content

* Hand-author **4–6 throwaway Tokens** to exercise this phase — a Forest, a
  Charcoal Kiln that consumes Wood, a Passive Generator, one with a skill
  requirement high enough to be refused. Real content is Phase 9; do not start
  authoring the Woodland kit here.

#### ✅ Acceptance

* `npm test` — new: `TokenCycle.test.js` (timer, output, XP, depletion to zero),
  `InputAllocator.test.js` (first-come, per-item shortfall, no partial cycles),
  `TokenAccess.test.js` (skill gate refuses and permits).
* **Run the game and exercise it properly.** Report what you saw: place a Forest,
  put a hero on it, watch the progress ring and Wood arriving as sprites; take the
  hero off mid-cycle and confirm the cycle is forfeited; place a Charcoal Kiln
  and confirm it pulls Wood from the Bank with no assignment step; empty the Wood
  and confirm the Kiln shows a **red** mark naming what it lacks; take the hero
  off and confirm the red mark **goes away** (unstaffed is not an error) and a
  **yellow** mark appears on the idle hero; run a Token to zero uses and confirm
  it disappears and its hero idles; place a Token whose skill requirement the
  hero fails and confirm the refusal.
* **Standing check 2** — the ring and both alert marks are new. Look at 48 tiles.
* Commit.

---

### Phase 5: Adjacency & Effects

Where placement starts to matter. **Adjacency governs *what*, not *how much*** —
context Tokens define what a station makes, which is binary and decisive;
numerical effects are deliberately small.

> [!WARNING]
> **This phase has two halves that grid concept §10.3 budgeted as one.**
> Retargeting `EFFECT_REACH` to the 8 neighbours delivers auras to the right
> tiles — but **YIELD, WORK_TIME and INPUT_COST are card-local axes**, so a
> neighbour still cannot move them. Only SPEED currently crosses scopes. See gap
> analysis §1.3 and `buff_diversification_orientation.md` §3. Both halves ship
> here (`G-5`).

#### A. Retarget Reach

* **[MODIFY]** [`effectRegistry.js`](src/config/cards/effectRegistry.js): replace
  `EFFECT_REACH.LOOP` / `NEXT_CARD` with `ADJACENT` (the 8 neighbours) and
  `SELF`. `GLOBAL` already exists via `GuildModifiers`.
* **[NEW]** `src/systems/board/TileModifiers.js` — a per-tile aggregator
  registry, replacing `AreaModifiers.js`. Runtime-only, rebuilt from board state,
  never serialized — the same discipline the deleted area/global aggregators
  used, and the reason a stale buff can never compound into a save.

#### B. Widen the Three Axes (`G-5`)

Each resolution point must consult **neighbouring tiles' aggregators**, not just
the Token's own:

| Axis | Resolver to widen |
| :--- | :--- |
| `YIELD` | [`LootSystem.handleTaskReward`](src/systems/combat/LootSystem.js) |
| `WORK_TIME` | [`StatProcessor.calculateWorkcycleStats`](src/systems/cards/logic/StatProcessor.js) |
| `INPUT_COST` | [`WorkProcessor.consumeInputs`](src/systems/cards/logic/WorkProcessor.js) |
| `SPEED` | Already crosses scopes — repoint from area/global to tile/guild |

* **Push every scope into the SAME buckets** rather than resolving each scope
  separately and multiplying. This is what makes a neighbour's buff and a Guild
  Hall aura stack **additively** (+25% and +25% → +50%) instead of compounding
  into ×1.5625. `ModifierScopes.test.js` from Phase 0 pins it.
* `EffectAxes.js` keeps the hard floors — work time never below 1s, input cost
  never below 1 unit.
* While here: `EFFECT_TYPES.XP_GAIN` in
  [`SkillSystem.js`](src/systems/hero/SkillSystem.js) does not exist (the
  constant is `XP_BONUS`), so `getXpMultiplier()` silently always returns 1.0.
  Fix the constant or delete the function — **do not leave a third silent
  no-op**, and record which you chose.

#### C. Context Crafting (D-18, D-19, D-20, D-113, D-148)

**This is adjacency's real job — definition, not amplification.** A Forge with a
Helmet Schematic beside it makes helmets; the same Forge with nothing beside it
makes nothing at all. That is binary, decisive, and what makes placement matter.

* **[NEW]** `src/systems/board/RecipeResolver.js`:
  * A context Token with nothing relevant adjacent is **inert** (D-19).
  * **Conflicting** context Tokens put the station into an error state — it
    produces nothing and shows a red alert until resolved (D-20).
  * **A context Token serves every adjacent station** (D-113). A schematic
    between two Forges drives both.
  * A station's output may be a **Token** rather than an item (D-148) — it bursts
    onto the board as a sprite exactly as a Map's contents do. The sprite layer
    already carries Tokens, so this is authoring plus a resolver, not a system.

#### D. Buffs (D-119, D-120, D-23, D-82, D-112, D-152)

* **Effects are small and Buff Tokens are scarce.** A typical buff nudges output
  a few percent or adds a low-probability bonus — "1% chance of double yield" is
  representative, **not** "double all output".
* **Stacking is uncapped** (D-23): eight Sawmills genuinely give eight times a
  very small number, which is still small. Individual Buff Tokens may carry a
  *"does not stack with duplicates"* flag where repetition would be degenerate
  (D-82). *(Note the reasoning has changed: uncapped stacking used to be safe
  because buff Tokens cost scarce tiles. Tiles are abundant now — it is safe
  because **effects are small**.)*
* A Buff Token targets **either the adjacent Token or the adjacent hero** (D-112).
* **The two target types behave differently when idle** (D-152):
  * **Token buffs are inert while their target is idle** — a Sawmill next to an
    unstaffed Forest does nothing, and costs nothing.
  * **Hero buffs always apply while the hero is there**, including while idle.
    Deliberate: a Campfire helping a resting hero is exactly when healing matters
    most, and it is what makes retreat-and-recover a real tactic.

#### E. Wear per Cycle Served (D-126, D-157)

* **Context and Buff Tokens lose one use each time an adjacent station completes
  a cycle.** One serving two Forges wears out twice as fast as one serving a
  single Forge.
* This is what makes shared context a **rate trade rather than free value**: one
  Token serving three stations delivers the same *total* benefit as one serving
  a single station — three times faster, and wearing out three times sooner.
  Clustering buys throughput now at the cost of restocking sooner. It is not
  strictly better, and the design does not pretend otherwise.

#### F. Connection Lines (D-84, D-22)

* **Shown on hover or selection only.** The board is clean by default; hovering a
  Token lights up *its* relationships — what feeds it, what modifies it, what it
  modifies — with the active recipe drawn on the line.
* With adjacency doing three jobs across 48 Tokens, permanent lines would produce
  exactly the unreadable mess that killed the previous playmat.
* Tooltips carry more weight here than usual: whether a Token consumes inputs is
  a **per-Token property with no derivable rule** (D-97, risk 10), so the player
  cannot reason from category and must be told.

#### ✅ Acceptance

* `npm test` — new: `Adjacency Effects` suites covering yield/cost/time actually
  moving from a *neighbouring* tile (the thing that does not work today), the
  additive-stacking rule across tile + guild scope, context inertness, conflict
  state, and wear-per-cycle-served across two stations.
* Run the game: place a Forge with no context beside it and confirm it produces
  **nothing**; add a schematic and confirm it starts making helmets; add a
  conflicting schematic and confirm the error state with a readable hover; put
  one schematic between two Forges and confirm both run **and it wears twice as
  fast**; place a Sawmill next to a Forest and confirm the **yield** changes by a
  few percent; hover a Token and confirm connection lines appear only then.
* **Standing check 2** — connection lines are new. Hover across a full board.
* Commit.

---

### Phase 6: Combat on the Board

**A porting job, not a design-and-build job** (D-136). The 7-stat engine, status
effects, damage resolution, the Wounded state and passive regen all carry over
unchanged. **Only the trigger changes** — today a hero encounters an enemy card;
now a hero is dropped onto an enemy Token.

The gap analysis confirms this claim holds: `processCombat(card, trait, delta)`
takes a card-like object, a hero and an enemy, and reaches into `HeroManager`,
`CombatFormulas`, `StatusEffectSystem` and `CombatAttackProcessor` — **not** into
area or deck state.

#### A. Wire It Up

* **[NEW]** a `board_combat` tick handler in
  [`EngineBootstrap.js`](src/systems/core/EngineBootstrap.js), or a combat leg
  inside `BoardRunner`. Today the **only** thing that ticks combat is the deleted
  `LoopRunner._tickCombat`.
* Enemy Tokens carry `enemyId`; dropping a hero on one starts the fight.
* **Enemies are inert until targeted** (D-14) — they never initiate, never aggro.
* Combat is strictly **1-on-1**, which is automatic since a hero stands on one
  Token (D-15).
* **Enemies fight back and the hero can lose** (D-13).

#### B. A Kill Is a Cycle (D-129)

The single unit that connects combat to the rest of the board:

* Context and Buff Tokens adjacent to an enemy **wear per kill** — a Weapon Rack
  burns down as it is used.
* Adjacency effects apply per kill, so a Weapon Rack raising damage or a Shrine
  granting XP works exactly as it would beside a Forge.
* The tile's progress ring tracks the **current fight**.
* **Enemy Tokens deplete** like any other Token and are refreshed by Managers
  (D-104).

#### C. The Post-Kill Rest — already built (D-103)

* `handleVictory` already sets `combat.state.intermissionTimer = 2000`, and
  `processCombat`'s intermission branch already restores the enemy to full HP and
  resumes. **That is exactly the model the board wants.** The deck loop simply
  pre-empted it by advancing the slot. Stop pre-empting it and the behaviour is
  correct.
* **Hero power shortens the fight but not the rest.** Against a long fight, more
  damage means meaningfully faster kills. Once fights are shorter than the rest
  interval, more power buys nothing. **Farming trivial content is capped;
  fighting hard content is not.**

#### D. Retreat and Defeat

* **Retreat is not a mechanic** (`G-3`) — it is unassigning the hero. It falls
  out of Phase 2's placement rules plus D-131. `isFleeing` was deleted in Phase 1.
* **The enemy resets to full HP when its hero leaves** (`G-4`) — current
  behaviour, and consistent with D-131's forfeited cycle. This is what gives
  §8.1's "watch your first few fights" its cost.
* **Defeat costs equipment** (D-74). Port `_applyDeathPenalties` out of the
  deleted `LoopRunner` into the board runner; the *rules* survive, only the
  harness moves. `DefeatPenalties.test.js` re-points here.
* Defeat → hero is **Wounded**, leaves the board, recovers on `WoundedSystem`'s
  own timer. Their tile idles until re-staffed.
* **No difficulty warning, no skill gate, no preview** on enemy Tokens (D-130).
  Risk is managed by attention, not information.

#### E. Regen — no code change (`G-2`)

* Regen is **constant** (idle, working *and* fighting), and that is intended.
  Retreat works by **removing the damage source**, so a withdrawn hero nets
  positive HP. The design documents said "idle only"; Phase 0 corrected them.
* Rate is currently 1 HP / 5s. Whether that makes retreat-and-recover feel like a
  tactic or like waiting is a **Phase 10 balance question**, not a mechanic to
  change here.

#### ✅ Acceptance

* `npm test` — `DefeatPenalties.test.js` re-homed and green; new
  `BoardCombat.test.js` (kill = one cycle for wear purposes; enemy resets on hero
  removal; enemy Token depletes).
* Run the game: drop a hero on an enemy Token and watch a fight resolve with the
  progress ring tracking it; confirm loot arrives **as sprites**; confirm the
  short rest then a second fight against the same Token; place a Weapon Rack
  beside it and confirm it wears **per kill**; pull the hero off mid-fight and
  confirm the fight ends immediately and the enemy is back to full HP; let a hero
  lose and confirm Wounded status, equipment loss and the tile idling; run an
  enemy Token to zero uses and confirm it disappears.
* Commit.

---

### Phase 7: Banks, Managers & Guild Upgrades

The economy plumbing, and the phase where **the AFK story becomes real**. Until
Managers exist, an unattended board simply winds down as charged Tokens run out.

#### A. The Token Bank (D-137, D-77)

* **Stacks are never capped; slots are.** The player can hold a million Wood but
  only so many *distinct types*. Capping quantity would punish a productive
  board, which is the opposite of what the economy is for; capping variety
  creates pressure to specialise without ever making success feel like a problem.
* **Consolidation (D-77).** A partially-used Token returning to the Bank merges
  with other partials of the same type and re-packs into as many full Tokens as
  possible plus at most one remainder:

```
Bank has:  Forest (3,000 uses left)        capacity 5,000
Returning: Forest (4,000 uses left)
Result:    1× Forest (5,000, full) + 1× Forest (2,000)
```

* **Totals are conserved exactly**, so picking a Token up and putting it back
  gains nothing. **Placement always draws a full Token first**; partials are used
  last. Test the arithmetic hard — this is exactly the kind of rule that quietly
  creates or destroys value.

#### B. Selling (D-146, D-128)

* **Tokens sell for gold at a deliberately poor rate.** This is the escape valve
  slot caps require: a Map burst will hand the player Tokens they have no use
  for, and without an exit those would eventually fill the Bank.
* Selling is an **escape valve, not a strategy** — the rate must stay bad enough
  that liquidating is never a plan.
* ⚠️ **Mythic Tokens need protection.** They are one-copy-ever, so selling one is
  permanent and irreversible. **Block it outright, or require an explicit
  confirmation** — do not let a misclick destroy the game's best moment.
* **Mythics are unique on the board, not unique to own** (D-177). A player may
  accumulate several copies; only one can be *placed* at a time. Duplicates are
  spares, not waste. Enforce the one-placed rule here.

#### C. Managers (D-35, D-104, D-140, D-151, D-133)

* **[NEW]** `src/systems/board/Managers.js`.
* A Manager is **type-specific** — a Lumber Camp auto-replaces exhausted Forests
  from the Bank; a Goblin Camp refreshes Goblin-type enemy Tokens.
* **Managers cover their 8 adjacent tiles and never deplete** (D-140). A Manager
  that wore out would be a restocker needing restocking, which is exactly the
  chore it exists to remove. Where two Managers cover the same tile, whichever
  acts first does the job.
* **A Manager restocks whether or not a hero is standing there, and the hero
  resumes automatically** (D-151). ⚠️ **This is the whole point and it has no
  analogue in any existing system** — a hero whose Forest ran dry does not need
  re-placing, because a fresh Forest arrives under their feet and they carry on.
  Without it Managers would restock tiles nobody was working while leaving idle
  heroes idle, which is the opposite of the mitigation they exist to provide.
* **A Manager with an empty Bank fails silently** (D-133). It cannot conjure a
  Token, only move one from storage. The tile stays depleted, the hero idles, and
  the tile shows its alert mark.
  * ⚠️ **Risk 15:** check a returning player can tell *"I ran out of stock"* from
    *"something else went wrong"*. The alert mark is the only cue.
* This completes the automation chain: **gold → Maps → Token Bank → Manager →
  board.** The AFK story is not "automation runs forever" — it is *"the board
  runs as long as you left it supplies for"*, which turns logging off into a
  decision rather than an event.

#### D. Guild Upgrades, Re-Homed (D-121, `G-10`)

* The centre tile is where Guild Upgrades are installed. **In v1 the Guild Hall
  does upgrades and nothing else** — it is also the reserved landing site for
  board-wide events if hazards are ever restored, but that is **a hook, not a
  feature**. Build no event system (D-135).
* **Two tracks only this pass:**
  * **Storage** — item-Bank and Token-Bank slot counts, as two independent lines.
  * **Roster** — raises the hero cap. The most powerful thing gold can buy, since
    roster size is the production ceiling (D-181).
* **Aura and Economy are deferred** (Appendix A). Aura needs Phase 5's adjacency
  delivery, which now exists — so it is a small later addition, not a blocked one.

#### ✅ Acceptance

* `npm test` — new: `Consolidation.test.js` (totals conserved exactly across
  merge/split; full Token drawn before partials), `Managers.test.js` (restocks
  within 8 tiles, never depletes, fails silently on an empty Bank, **restocks
  under a working hero who then resumes**), `TokenBank.test.js` (slot cap by
  distinct type; Mythic one-placed rule).
* Run the game: fill the Token Bank to its slot cap and confirm overflow becomes
  litter rather than loss; return a part-used Forest and watch consolidation
  repack it; sell a spare and confirm the rate is genuinely poor; try to sell a
  Mythic and confirm the block or confirmation; place a Lumber Camp, let an
  adjacent Forest run to zero **with a hero on it**, and confirm a fresh Forest
  arrives and **the hero carries on without being re-placed**; empty the Bank and
  confirm the Manager fails silently with the tile's alert mark as the only cue;
  buy a Roster upgrade and confirm the cap rises.
* Commit.

---

### Phase 8: The Cartographer & Maps

Progression, and **the game's headline reward beat**. This is the replacement for
the pack/booster economy.

#### A. The Cartographer (D-98, D-99, D-101, D-166)

* An **off-board NPC with a menu** — not a Token, not a board object. The second
  deliberate off-board exception; the **Map itself is a Token**, so only the
  transaction leaves the board.
* **Every Map is listed from the very start, in price order.** Nothing is ever
  locked; cost is the only gate. Price order is the guidance — the top entry is
  the obvious first purchase, the list below is the visible future. No tutorial,
  no recommendations, no greyed-out nodes.
* **The curve is steps between themes, flat within one** (D-166). A theme's price
  **never rises**, no matter how many times you buy it. This is what lets one
  curve do two jobs without them fighting: restocking stays cheap and predictable
  forever, while advancing to the next theme is a genuine saving-up.
* **Each Map shows its full pool, with undiscovered entries as silhouettes**
  (D-159). Two jobs at once: it makes restocking deliberate (a player needing
  Forests can see which Maps yield them), and it restores a **collection hook** —
  an unopened silhouette is something to want.
* Maps cost **mainly gold plus a small material component** (D-100).
  **Materials are pulled automatically from the Bank** (D-150), exactly as Tokens
  pull inputs. A purchase is refused if the Bank is short, and the tooltip names
  what is missing.

> [!TIP]
> [`CollectionManager.js`](src/systems/progression/CollectionManager.js) and
> `PackOpeningOverlay.jsx` are worth mining here — the purchase plumbing, cost
> checks and reveal presentation are reusable. **The mechanic is not:** packs are
> per-area escalating price with a pick-1-of-N; Maps are flat within-theme price
> with a burst where **all of it is yours**. Take the plumbing, not the model.
> Retire `CollectionManager` once the Cartographer stands on its own.

#### B. Maps as Objects (D-155, D-156, D-160, D-132)

* **A purchased Map goes straight to the Tray.** Maps cannot be stored, never
  occupy Token Bank slots, and there is no Map inventory.
* **Buying a Map with a full Tray is refused**, with the reason stated — the same
  shape as a refusal for missing materials.
* **A Map is a single burst and is consumed.** It can be opened **from the Tray
  or from a tile**. Opening it on the board scatters the contents around where it
  sat; opening it in the Tray throws them onto the grid. Either way it is spent.
* **Maps sit outside the rarity system entirely** (D-132). They are never Common
  or Mythic — always consumable, always bought, never placed to produce.

#### C. The Burst (D-142, D-167, D-154)

* **The player double-clicks and it bursts open**, scattering Tokens *and* items
  across the board as sprites. It should feel like tearing open a pack: a
  physical burst, things flying out, a scramble to see what you got.
* **Maps cost no hero-time.** Progression does not compete with production —
  opening a Map is an act, not a task.
* **A burst yields 3–6 things** (D-167) — a modest handful, not a windfall.
  Combined with flat within-theme pricing this makes shopping frequent and cheap.
* ⚠️ **The spectacle therefore rests on presentation, not volume.** Four items
  cannot carry the game's headline reward beat on quantity. It has to come from
  **how it looks and how often it happens** — the physicality, the scatter, the
  bounce, and a rare drop landing distinctly. **If a four-item burst reads as
  flat in testing, the lever is presentation first and volume second.**
* **Burst contents are random with no reliability guarantee** (D-154). A Woodland
  Map might hand you six Forests or three Bears and a Tool Rack. This is a
  genuine accepted cost; the mitigations (selling unwanted Tokens, crafting
  support Tokens) both arrive later, so **the exposure is the first hour** —
  risk 16.

#### D. A Map's Pool Is a Complete Kit (D-139)

Producers, their Context Tokens, their Buff Tokens, their Manager, and the
enemies that belong there:

```
WOODLAND MAP pool
  Forest, Berry Bush ........ producers
  Sawmill, Tool Rack ........ context
  Campfire .................. buff
  Lumber Camp ............... manager
  Bear ...................... enemy
```

**Buying a Map is therefore buying access to a self-contained set** — a strategic
commitment rather than a lottery ticket, and one purchase eventually yields
everything needed to run that theme properly, including the automation that makes
it survive unattended.

**A Map's loot pool is the only meaning "biome" has.** There are no biome
systems, bonuses or mechanics. Names are flavour.

#### ✅ Acceptance

* `npm test` — new: `Cartographer.test.js` (flat within-theme price across
  repeated purchases; refusal on short materials; refusal on a full Tray; Map
  goes to Tray never to Bank), `MapBurst.test.js` (3–6 items, drawn from the
  pool, Map consumed).
* Run the game: open the Cartographer and confirm every Map is listed in price
  order with silhouettes for undiscovered entries; buy a Woodland Map with gold
  and materials auto-pulled; buy a second and confirm **the price has not
  risen**; fill the Tray and confirm the purchase is refused with a readable
  reason; burst a Map from the Tray and watch things scatter and bounce; grab a
  Token straight from the burst onto a tile; burst one from a tile and confirm
  the contents scatter around where it sat. **Say whether the burst felt like a
  reward or like a chore** — that judgement is the point of this phase.
* Commit.

---

### Phase 9: Content — Map 1 and Map 2

The systems all exist. Now they get something real to run.

> [!NOTE]
> **D-173's card-by-card conversion pass is superseded** (`G-18`). The existing
> ~36 card entries were authored for draw order and area pools, not adjacency — a
> Forge with no schematic beside it is a different object. The archived JSON in
> `data/archive/cards/` is **reference**: mine it for item ids, enemy ids and
> flavour so the item and enemy registries do not need rebuilding, but author the
> kit clean.

#### A. Map 1 — the Woodland kit (~15 Tokens)

Claude drafts the full kit; the owner reviews and retunes (`G-14`). Follow §7.3d's
shape: producers, context, buff, manager, enemies.

* **Every Token's numbers are set individually** (D-161). There is no tier
  formula. This is the expensive option, entered knowingly — it gives every Token
  its own character at the cost of hand-tuning.
* **Cycle times in D-164's 10–30s band.** With eight heroes working this produces
  roughly one completion every two or three seconds across the board — an
  unhurried rhythm where every drop registers individually.
* **Use counts are a statement about unattended runtime**, which is the number
  that matters for the AFK story: `500 uses × 20s/cycle ≈ 2.8 hours`.
* **Tiers are not versions of each other** (D-178). There is no Forest →
  Uncommon Forest → Rare Forest ladder; there is a Forest, and separately an
  Ancient Grove, and separately a Heartwood — related things with their own art,
  behaviour and reasons to exist. This also removes the authoring explosion a
  per-Token ladder would cause.

#### B. Three authoring rules that are load-bearing

> [!WARNING]
> These are not style guidance. Each one prevents a specific failure the design
> has already identified.

1. ⚠️ **Every material must have at least one tool-free base Token** (D-213).
   D-51 used to promise that supply deadlock was *structurally* impossible
   because base Tokens consume nothing. D-213 downgraded that guarantee from
   structural to **authored** by making tool requirements per-Token — so a player
   who burns their last pickaxe with no ore banked **can now hard-lock**. A
   barehanded route back must always exist. This rule is the only thing
   preventing it.
2. ⚠️ **Every Passive Generator must be strictly worse than its staffed
   equivalent** (D-116, risk 11) — worse output *and* higher input cost. Check
   each one against the staffed job explicitly. If an unstaffed Token ever beats
   a staffed one per tile, the optimal board becomes mostly unstaffed and heroes
   stop being the ceiling.
3. **Author input costs consistently** even though no rule enforces them
   (D-97, risk 10): **creates-from-nothing should be free, transforms should
   cost.** Players have no principle to reason from and must learn each Token
   individually — consistency is the only kindness available.

#### C. Map 2 — deliberately thin (`G-12`, risk 6)

* **~5 Tokens.** It exists for one reason: to make the **price step** and the
  **strength/demand jump** real. Without a second price point, §7.5's entire
  progression model is untested and the 200g → 2,500g curve is a guess.
* Later Maps yield Tokens that are **stronger and more demanding** (D-95) —
  higher output, but deeper chains, more inputs and higher skill requirements.
  Power grows and so does its footprint, which is what keeps a fixed 48-tile
  board meaningful at every stage. Map 2 must demonstrate that, not just cost
  more.

#### D. Starting State (D-122, D-123)

A new game opens with:

* **1 hero** — the roster grows to about eight across the whole game.
* **A few basic Common Tokens** — enough to place and work immediately.
* **A small amount of gold.**
* **The Cartographer menu already open**, listing every Map cheapest first.

**The board starts nearly empty, and that is intended.** Filling it is the
visible measure of progress — a new player has four Tokens on 48 tiles; a veteran
has a packed board with heroes everywhere. **Emptiness is progress feedback, not
a content gap.**

The opening sequence should be: place Tokens → station the hero → produce → sell
→ buy the first Map → burst it → receive new Tokens. **The core loop reachable
within the first minute; the progression loop within the first session.**

#### E. Report the Authoring Cost

* ⚠️ **Risk 17.** D-161's hand-authored numbers do not scale — ~60 Tokens
  eventually, each new tier risking the balance of everything below it, all in
  hand-edited JSON until the CMS is rebuilt.
* **Explicitly say how painful 15 Tokens was.** If it is already painful at 15,
  say so plainly — that is the signal to revisit before the second Map, and it is
  much cheaper to hear now than at 60.
* ⚠️ **Never run the CMS's "Sync to Game" against hand-authored Token data**
  (D-109). It destroys unmodelled content. The CMS rebuild is a separate, later
  project.

#### ✅ Acceptance

* `npm test` — a content validation suite: every material reachable from a
  tool-free base Token (rule 1, asserted mechanically rather than by eye); every
  Passive Generator strictly worse than its staffed equivalent (rule 2); every
  Token's cycle time inside 10–30s; every Map pool complete per D-139.
* **Play a new game from scratch**, and report the arc: was the core loop
  reachable in the first minute? The progression loop in the first session? Did
  the first Map purchase feel like a milestone? Did the board fill up in a way
  that read as progress?
* Commit.

---

### Phase 10: Polish, Clutter & the First Balance Pass

The slice exists to answer one question: **is the board enjoyable?** This phase
is where it gets asked properly.

#### A. The Worst-Case Full-Board Mock (risk 7)

* **48 Tokens, heroes on eight of them, progress rings turning, alert marks in
  both colours, loot sprites scattered, connection lines on hover.** All at once.
* **Risk 7 killed the previous spatial playmat**, and this board carries more
  per-tile information than that one did. The standing check has been sampling
  this every phase; this is the formal, honest look.
* If it reads as cluttered, the levers in order: reduce what a tile shows
  (D-85's "exactly three things" is already the budget — enforce it), make the
  alert marks rarer, or move information to hover.

#### B. Measure Risk 13 — first-come allocation

* ⚠️ **A Token needing 1 Coal can act sooner than one needing 5**, so under
  sustained shortage the *deep, expensive* chains the game wants players to build
  are the ones that starve first. **This is the opposite of the pressure §6.2
  intends.**
* Set up a deliberate shortage across a shallow and a deep consumer and
  **measure it directly.** Phase 4 instrumented the allocator for this.
* If deep chains starve: allocation needs a rule that favours them, or expensive
  steps need buffered inputs. **Do not guess — measure first.**

#### C. Cycle Pacing and the Rhythm

* With eight heroes working, is it roughly one completion every two or three
  seconds? Does every drop register individually, or does it blur?
* **Is the inhale-and-exhale rhythm working?** An early board is mostly charged
  Tokens, so acquire-and-deplete should be strongest at the start and settle as
  unlimited-use Tokens accumulate.

#### D. Open Balance Questions to Answer Here

| Question | Why now |
| :--- | :--- |
| Is **1 HP / 5s regen** enough to make retreat-and-recover a tactic rather than waiting? (`G-2`) | The rate was never tuned for a board where combat is permanent |
| Does a **3–6 item burst** carry the headline reward beat? (D-167, risk 16) | If flat, the lever is **presentation first, volume second** |
| Are **adjacency effects too small to notice**? (risk 2) | D-120 made them small; if placement stops feeling meaningful the lever is *more recipe-defining context Tokens*, not bigger buff numbers |
| Does the **board get solved** into one optimal geometry? (risk 1) | Substantially reduced by D-120, but watch for it |
| Is a **purely constructive board** unchallenging? (risk 5) | This is the experiment. If it reads as flat, the suspended hazard system is the answer |
| Can a returning player tell **"I ran out of stock"** from other failures? (risk 15) | The alert mark is the only cue |

#### E. Polish

* Tooltips and the inspection panel wired for Tokens in **Bank, Tray and board
  alike** (D-145) — a player must never have to spend a tile and a hero to
  discover what something does. **Planning happens before placement.**
* Audio for placement, displacement, burst, depletion.
* Performance at 48 active tiles.

#### ✅ Acceptance

* `npm test` green.
* **A written balance report**, not a code summary: what was measured, what the
  numbers were, and what it felt like to play. This is the deliverable the whole
  slice exists to produce.
* Tag a baseline (`v0.5.0`) as a permanent rollback point, then merge to `main`.
* Commit.

---

## Appendix A: Explicitly Deferred

Described in the design or found in the code, and **intentionally out of scope**.
Recorded here so none of it is silently lost.

### A-1. Deferred by design decision

| Item | Source | Why deferred | Decision |
| :--- | :--- | :--- | :--- |
| **The entire skills rework** — six-slot sheet (D-180), three combat skills (D-196), three-layer list (D-205), D-192…D-214 | [`playmat_skills_concept.md`](playmat_skills_concept.md) | Design-ahead, paused mid-session. The existing 15-skill system ports unchanged. **D-66 is postponed, not violated.** | Brief §4 |
| **The hero rework** — job tree, promotion, recruitment, six-slot sheet | [`playmat_hero_concept.md`](playmat_hero_concept.md) | Out of scope; only §4's board interactions ship | Brief §4 |
| **Hero Speed and Efficiency** (D-67) | Grid §4.2 | Two of the three hero→board effects do not exist in code. Deferred to the hero rework. **Hero level does not change cycle time or input cost this pass.** | `G-1` |
| **Minions** (D-206–D-212) | Grid §3.5 | Designed, not built | Brief §3 |
| **The CMS rebuild** (D-109) | Grid §10.3 | Separate later project. ⚠️ Its "Sync to Game" destroys unmodelled content — **never run it against hand-authored Token data** | Brief §3 |
| **Hazards, Events, Invasions** | Grid §12 | Suspended to test whether the board needs an antagonist at all. The 30 authored Threat debuffs are orphaned but not deleted; the Guild Hall is already the landing site if they return. **Build no event system** (D-135) | Grid §12 |
| **Offline progress / prestige** | Grid §12 | ⚠️ Combat pacing is known not to scale under time acceleration (D-90), and combat is now *permanent* on the board. Any offline or fast-forward model must address that deliberately | Grid §12 |
| **Guild Upgrade Aura and Economy tracks** (D-121, D-163) | Grid §11 | Neither exists in code. Aura is now unblocked by Phase 5's adjacency work — a small later addition | `G-10` |
| **Small-mode viewport and touch support** (risk 8) | UI §2, §7 | The slice asks its question at full 4× fidelity. Tile size is a single constant so this stays a config change | `G-20` |
| **The second Map's full kit** | D-108 | Map 2 is deliberately thin — enough to test the price step, not a full theme | `G-12` |

### A-2. Deferred cleanup — code left in place deliberately

| Item | Size | Why left | Decision |
| :--- | :--- | :--- | :--- |
| **The Energy system** | ~183 refs / 45 files, incl. `hero.energy`, the Drink category, `ConsumptionSystem.tryDrink`, 6 test files | Nothing charges Energy once card draws and Outposts are gone, so the *design* cut lands for free. The *removal sweep* has no player-visible payoff and is exactly the broad change a no-flag branch cannot verify | `G-8` |
| **The Quest system** | `QuestBoardSystem`, `QuestTracker`, `questRegistry`, `QuestProcessor`, quest card traits, `quest_slots` | §12 says quests "may be cut" — it has not actually decided. Muted, not deleted | `G-9` |
| **The trait bag** (`card.traits[]` dispatch, alongside the newer effect list) | `WorkProcessor`, `StatProcessor`, `CardAssembler`, `ModularSyncer` | Two dispatch mechanisms coexist. The trait bag is what the live engine reads; collapsing them turns the port into a rewrite | `G-6` |
| **Hero traits and classes** | `traitRegistry.js`, `classRegistry.js` | Already cosmetic — `HeroGenerator.js:119`: *"Classes/traits are cosmetic — no modifiers applied."* Deleting or keeping costs nothing | `G-7` |
| **Silent no-op equipment effects** | `TICKSPEEDBONUS`, `SKILL_LEVEL`, `SLOW_ENEMY`, `SUNDER`, `EVASION`, `LIGHT`, `HASTE`, `HPBONUS` — 0 consumers each | Only `DAMAGE` and `DEFENSE` reliably reach a fight. **Ported as-is** — but know that "equipment survives" means porting a system where most gear effects do nothing. A real problem for a later hero/gear pass | Gap analysis §2.4 |
| **Dead axes** | `LOOT_MULT`, `FAIL_CHANCE`, `HP_REGEN`, `THORNS_REFLECT`, `STAT_BONUS`, `LOGIC_OVERRIDE` — no consumers | Each needs a consumer or deletion. Out of scope; **authoring against one silently does nothing**, which is the failure mode most likely to waste design time | `buff_diversification_orientation.md` §4 |

---

## Appendix B: Decisions Log

Calls made during the gap analysis and this planning session. Recorded here so a
future session can check *why the roadmap says X* without re-deriving it.
`G-1`…`G-15` are owner decisions; `G-16`…`G-20` are planning calls made while
writing this document.

| # | Decision | Why, and what it was chosen against | Where |
| :--- | :--- | :--- | :--- |
| **G-1** | **Hero Speed and Efficiency deferred.** Skills gate Access only. | Both are absent from the code (gap analysis §1.1) — `hero.aggregator` SPEED is written but never read, and its category casing would not match if it were. Chosen against building them now; accepted cost is that hero level is inert on the board this pass. Heroes still matter as D-62's *gate*. | Phase 4 §C; Appendix A-1 |
| **G-2** | **Regen unchanged; the documents are corrected.** Risk 14 stays closed. | `RegenSystem` heals idle, working *and* combat — always except when wounded. Owner confirmed that is the intent. §8.1/D-136/hero §134 stated it as idle-only and drew a conclusion that happens to still hold for a different reason: regen is constant, so retreat works by removing the damage source. Chosen against suppressing combat regen. | Phase 0 §E; Phase 6 §E |
| **G-3** | **Retreat is not a mechanic** — it is unassigning the hero. | `isFleeing` was read in two places and written nowhere. Falls out of placement plus D-131 rather than needing a feature. Chosen against building a dedicated retreat path. | Phase 1 §E; Phase 6 §D |
| **G-4** | **The enemy resets to full HP when its hero leaves.** | Current behaviour, and consistent with D-131's forfeited cycle. Chosen against persisting enemy damage, which would let a player chip down any enemy across many free attempts and remove combat's risk entirely. | Phase 6 §D |
| **G-5** | **Widen YIELD / WORK_TIME / INPUT_COST to read neighbouring tiles.** | §10.3 framed the rebuild as "keep the maths, swap the targeting", but only SPEED crosses scopes — the other three are card-local, so a Context Token could not change a neighbour's yield. Chosen against a SPEED-only first Map, which would silently turn D-119/D-120's yield nudges into speed nudges. | Phase 5 §B |
| **G-6** | **Keep both dispatch mechanisms** (trait bag + effect list); collapse later. | The trait bag is what the live engine reads. Chosen against collapsing during the conversion pass, which would turn the port phase into an engine rewrite. | Phase 4 §A; Appendix A-2 |
| **G-7** | **Hero traits kept.** §10.1's deletion is corrected. | §10.1 deleted them; the brief and hero spec keep them. They are already cosmetic, so the argument was over a display label. Zero work either way. | Phase 0 §E |
| **G-8** | **Energy: stop consuming it, hide the UI, leave the data.** | The design cut (D-183/D-184) lands for free once draws and Outposts are gone. Chosen against a full 45-file removal, which has no player-visible payoff and is unverifiable on a no-flag branch. | Phase 1 §F; Appendix A-2 |
| **G-9** | **Quests dormant, not deleted.** | §12 says "may be cut" — undecided. Chosen against cutting now and against re-pointing them at Token rewards, which would add new design to a pass meant to isolate one question. | Phase 1 §F; Appendix A-2 |
| **G-10** | **Guild Upgrades: Storage + Roster only.** | 9 of 14 nodes are outpost/universal grants that die with the loop. Aura needs adjacency (Phase 5) and Economy is thin once the Tray is generous from the start (D-168). Chosen against building all four tracks. | Phase 1 §G; Phase 7 §D |
| **G-11** | **Build the loot-sprite layer EARLY**, before Token behaviour. | D-138, Map bursts (D-142) and crafted Tokens (D-148) all land through it. Chosen against a preflight-refuses interim, which is the *opposite* of D-138 and would need unwinding. | Phase 3 |
| **G-12** | **One full Map plus a deliberately thin second.** | Resolves D-108 ("one Map's content") against risk 6 ("one Map cannot test progression") in risk 6's favour, for ~5 Tokens of authoring. Chosen against two full Maps, which doubles D-161's hand-authoring cost before it is known to be sustainable. | Phase 9 §C |
| **G-13** | **Branch `playmat-7x7-build` off `rework/playmat-7x7-grid`.** | That branch carries all 12 design commits plus everything `main` has, so work starts with the specs present. Chosen against merging to `main` first, and against implementing on the design branch — which would mix months of build commits into the record of what was agreed. | Phase 0 §A |
| **G-14** | **Claude drafts the Map 1 kit; owner reviews and retunes.** | Fastest route to a playable board, and it surfaces risk 17's authoring cost immediately. Chosen against owner-authors-all (slower) and against converting the old cards first. | Phase 9 §A |
| **G-15** | **Clutter mock in Phase 10, plus a standing per-phase check.** | Owner chose the mock in UI/polish. Risk 7 killed the previous spatial playmat, so waiting until Phase 10 to *first look* is how that repeats. Real playmat art already exists, making a per-phase sample nearly free. | Standing checks; Phase 10 §A |
| **G-16** | **The game must boot at the end of every phase.** | With no feature flag there is no flag-off comparison to catch collateral damage. "It still boots" is the cheapest available signal, so Phase 1 ships a `BoardStub` rather than leaving a dead centre screen. | Standing checks; Phase 1 §I |
| **G-17** | **Version 0.5.0 across five files; save gate 0.6.0.** | A minor bump matches how 0.3.0 and 0.4.0 marked the last two reworks. The save gate is deliberately separate — it names the app version at which the save *structure* last broke. | Phase 0 §B/§C |
| **G-18** | **D-173's conversion pass is superseded; archive `data/cards/`.** | The existing cards were authored for draw order and area pools, not adjacency. Chosen against converting first, which risked a kit that reads as leftovers rather than a designed Woodland set. Item and enemy registries are still mined so they need no rebuilding. | Phase 1 §H; Phase 9 |
| **G-19** | **`TokenAxes.js` → `EffectAxes.js` (kept); `GlobalModifiers.js` → `GuildModifiers.js` (kept).** | §10.3 grouped `TokenAxes` with the retiring mutator system. It is generic and is the only consumer path for YIELD/WORK_TIME/INPUT_COST — deleting it deletes the board's economy resolvers. `GlobalModifiers` was omitted from §10.3 entirely and is the only cross-scope aura proof in the codebase. | Phase 1 §B/§C |
| **G-20** | **Desktop only at 4×; tile size is a single constant.** | The slice asks its question at full fidelity. Pixel art means a small mode needs its own integer scale, not a CSS shrink — so it is a real build, deferred. Keeping the size as one constant makes it a config change later. | Phase 2 §E |

---

## Appendix C: The Test-Suite Plan

**Baseline: 39 files / 563 tests / all green** (verified 2026-08-06).

> [!WARNING]
> **"Tests green" becomes a hollow signal as suites vanish.** Roughly **230 of
> 563 tests die** with the deck loop. The ~174 that survive untouched cover
> heroes, skills, equipment, combat maths, status effects, saves and the Hero
> Dock — and cover **nothing spatial and nothing economic**. After Phase 1, a
> green suite proves the hero/combat half still works and says essentially
> nothing about the board.

### C-1. The three mitigations

1. **Re-pin the orphaned rules before deleting their homes** (Phase 0 §D). Two
   rule sets exist only inside doomed test files: `GlobalAuras.test.js`'s
   additive-stacking and rehydration rules, and `CardFailure.test.js`'s
   Bank-full semantics. Both matter to the board.
2. **Write the board's tests as the board is built, phase by phase.** Adjacency
   sets, displacement paths, consolidation arithmetic, first-come allocation,
   overflow routing — all pure logic, cheap to test, and **the only thing that
   will catch collateral damage on a branch with no flag-off comparison.**
3. **Account for every deleted test in its commit message.** A dropping count is
   expected. An unexplained failure is not. The two must stay distinguishable.

### C-2. What dies (13 files, 166 tests) — Phase 1

`BinderManager` (23) · `DeckSlotRules` (18) · `CollectionManager` (18, at Phase 8)
· `LoopBuffs` (18) · `GuildTreeOutposts` (16) · `OutpostBanners` (13) ·
`GlobalAuras` (12, **rules rescued first**) · `BinderMastery` (11) ·
`LoopRunnerFlow` (11) · `PrepPhase` (9) · `CardPips` (9) · `CraftingUpkeep` (7)
· `LibraryFoundation` (6) · `StationCard` (4)

### C-3. What survives untouched (~174 tests)

`HeroDock` (33) · `HeroSystem` (21) · `BigNumbers` (11) · `StatusEffects` (10) ·
`TimeBank` (10) · `CombatFormulas` (9) · `EquipmentCategories` (9) ·
`useGameState` (9) · `SaveRoundtrip` (7) · `EquipmentRequirements` (6) ·
`SaveDurability` (6) · `CombatEating` (5) · `EventBus` (5) · `XPCurve` (5) ·
`theaterUtils` (5) · `InventorySlotCap` (5) · `AssetManager` (4) ·
`DynamicRegistries` (4) · `CombatCard` (1)

### C-4. What splits (~223 tests across 6 files)

| File | Tests | Split | Phase |
| :--- | ---: | :--- | :--- |
| `Mutators.test.js` | 130 | **Keep:** Phase 1 three-bucket maths (26), Phase 2 card tags (26), Phase 5 token axes (13, rehome onto Token instances), Phase 7 combat-tag derivation (7). **Delete:** Phase 0 scaffolding (13), Phase 3 slot lifecycle (19), Phase 4 stamping (10), Phase 8 Area Anchor (5), Phase 9 badge data (11) — **~58 of 130 go** | 1 |
| `CardEffects.test.js` | 31 | Registry keeps; the `LOOP`/`NEXT_CARD` reach cases rewrite to adjacency | 5 |
| `CardFailure.test.js` | 24 | Failure gating keeps; **the Bank-full cases encode the behaviour D-138 inverts** — superseded by `BankOverflow.test.js` | 0, 3 |
| `ConsumptionSystem.test.js` | 15 | Food/`tryEat` keeps; drink/energy dormant | 1 |
| `EffectResolvers.test.js` | 14 | Resolvers keep; reach-dependent cases rewrite | 5 |
| `DefeatPenalties.test.js` | 9 | The D-74 rules keep; the `LoopRunner` harness re-homes onto the board runner | 6 |

### C-5. New suites this rework should add

| Suite | Phase | Pins |
| :--- | :--- | :--- |
| `ModifierScopes` | 0 | Additive stacking (D-23), distinct source ids, post-load rehydration |
| `BankOverflow` | 0 → 3 | D-138: a full Bank never destroys, never refuses |
| `Adjacency` | 2 | Exhaustive neighbour sets — corners, edges, centre |
| `Placement` | 2 | Every displacement path in D-134 / D-143 / D-147 |
| `BoardState` | 2 | Guild Hall immovable; sparse tiles; save roundtrip |
| `SpriteLayer` | 3 | Routing by kind (D-158); sprite-as-input-source (D-42) |
| `TokenCycle` | 4 | Timer, output, XP, depletion to zero |
| `InputAllocator` | 4 | First-come (D-127); per-item shortfall; no partial cycles |
| `TokenAccess` | 4 | Skill gate refuses and permits |
| `AdjacencyEffects` | 5 | Yield/cost/time moving from a **neighbouring** tile; context inertness; conflict; wear per cycle served |
| `BoardCombat` | 6 | Kill = one cycle; enemy resets on hero removal; enemy depletion |
| `Consolidation` | 7 | Totals conserved exactly (D-77); full drawn before partials |
| `Managers` | 7 | 8-tile reach; never deplete; silent fail on empty Bank; **restock under a working hero** |
| `TokenBank` | 7 | Slot cap by distinct type; Mythic one-placed rule |
| `Cartographer` | 8 | Flat within-theme price; refusals; Map never enters the Bank |
| `MapBurst` | 8 | 3–6 items from the pool; Map consumed |
| `ContentValidation` | 9 | Tool-free base Token per material (D-213); Passive Generators strictly worse (D-116); cycle times in band |

---

## Appendix D: Quick Reference — Keep / Delete / Rename

For the Phase 1 sweep. **Grid concept §10 is wrong on three of these** — the
gap-analysis column says which.

| Module | Fate | Note |
| :--- | :--- | :--- |
| `src/systems/loop/` (all but `GlobalModifiers`) | ❌ Delete | |
| `src/systems/area/`, `core/areaEvents.js` | ❌ Delete | |
| `config/registries/TokenRegistry.js`, `effects/SlotTokens.js`, `effects/MutatorStamping.js` | ❌ Delete | Frees the name "Token" |
| **`effects/TokenAxes.js`** | ✅ **KEEP** → `EffectAxes.js` | ⚠️ **§10.3 says delete — it is wrong.** Only consumer path for YIELD/WORK_TIME/INPUT_COST |
| **`loop/GlobalModifiers.js`** | ✅ **KEEP** → `effects/GuildModifiers.js` | ⚠️ **§10.3 omits it.** Only cross-scope aura proof in the codebase |
| `effects/ModifierAggregator.js` | ✅ Keep verbatim | Imports only `constants.js` + `skillRegistry.js`. Nothing deck-shaped |
| `effects/StatusEffectSystem.js` | ✅ Keep | Own tick, independently registered |
| `cards/logic/CombatProcessor` + `CombatAttackProcessor` + `CombatResolutionProcessor` | ✅ Keep | Needs a new tick owner — `LoopRunner` was the only caller |
| `utils/CombatFormulas.js` | ✅ Keep | The 7-stat engine |
| `systems/inventory/`, `systems/economy/` | ✅ Keep | ⚠️ D-138 inverts `addItem`'s full-Bank branch (Phase 3) |
| `systems/hero/`, `systems/equipment/` | ✅ Keep | ⚠️ Most gear effects are silent no-ops (Appendix A-2) |
| `equipment/DurabilitySystem.js` | ❌ Delete | Replaced by Token depletion (D-118) |
| `progression/GuildUpgradeManager.js` | ⚠️ Trim | Keep the rank→derived-stat mechanism; strip outposts/universals/area gate |
| `progression/BinderManager.js`, `BinderMastery.js` | ❌ Delete | |
| `progression/CollectionManager.js` | ⏳ Keep till Phase 8 | Mine the purchase/reveal plumbing for the Cartographer, then retire |
| `src/ui/components/banner/` | ❌ Delete | ~2,900 lines |
| `src/ui/dnd/` | 🎁 **Keep — major survivor** | Unlisted in §10. Pointer-tracked, animated ghost, `board` surface already exists. Add `DRAG_KIND.TOKEN` |
| `src/ui/ReactRoot.jsx`, `nav/`, `drawer/`, `dock/`, `base/` | ✅ Keep | Shell is already the right shape; only the centre changes |
| `public/assets/playmat/` (26 files, 20 `pm_board_*` sprites) | 🎁 **Keep — major survivor** | Unlisted in §10. Real board art from the previous spatial playmat |
| `data/cards/` | 📦 Archive | → `data/archive/cards/`. Reference for Phase 9 (`G-18`) |
| `data/items.json`, `enemies.json`, `recipes.json`, drop tables | ✅ Keep | Phase 9 mines them |
