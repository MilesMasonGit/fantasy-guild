# Code Review **Round 2** — Findings Tracker

Persistent tracker for the second full-codebase review. See
[`code_review_v2_guide.md`](code_review_v2_guide.md) for scope, objectives,
scoring, and the session plan. **Every review session writes into this file**;
fix waves later update ticket statuses here.

Round 1's tracker (`archive/docs/code_review_findings.md`, 53 tickets) is
history. Only the leftovers carried forward by Prerequisite 4 appear here.

---

## Session Status *(update at the end of every session)*

| # | Session | Status | Notes |
|---|---|---|---|
| — | Prereq 1: preliminary cleanup phase committed + merged, tree clean | ✅ Done (2026-08-18) | Merged to `main` as `edb2e2d`. Brief: [`cleanup_phase_brief.md`](cleanup_phase_brief.md). Filed CR2-001…009. |
| — | Prereq 2: baseline test run recorded | ✅ Done (2026-08-18) | **59 files / 875 passed / 21 skipped / 0 failed.** Was 86 failed / 912 passed over 17 of 62 files at `f8dcae0`. ⚠ Read the Retired Tests Ledger before Session 1 — 41 tests were deleted, not rewritten, so coverage of the cartographer, hero equipment, map burst and board loot is **gone**. Restore hints are recorded (many failed on renamed ids, not absent content). |
| — | Prereq 3: fresh reachability list generated | ✅ Done (2026-08-18) | Re-run post-deletion; see *Shared Inputs* below. |
| — | Prereq 4: round-1 leftovers re-triaged | ✅ Done (2026-08-18) | All 17 checked against current code: **6 superseded** (CR-019/023/024/025/043/046), **1 fixed incidentally** (CR-032), **10 re-filed** as CR2-022…031. Results table in *Shared Inputs*. |
| — | Prereq 5: round-1 docs archived | ✅ Done (2026-08-18) | `code_review_guide.md` + `code_review_findings.md` moved to `archive/docs/` and listed in its README, after Prereq 4 finished reading them. |
| 1 | State core & serialization | ⬜ Not started | |
| 2 | Board engine (the 7×7 playmat) | ⬜ Not started | |
| 3 | Combat, heroes, skills & promotion | ⬜ Not started | |
| 4 | Cards, economy, inventory, quests & progression | ⬜ Not started | |
| 5 | Content pipeline & the CMS boundary | ⬜ Not started | |
| 6 | UI ↔ engine boundary | ⬜ Not started | |
| 7 | UI components | ⬜ Not started | |
| 8 | Runtime verification (hands-on) | ⬜ Not started | |
| 9 | Build, Tauri readiness & synthesis | ⬜ Not started | |

**Next ticket ID:** CR2-039

Status values: `⬜ Not started` → `🔄 In progress` → `✅ Done (date)`.

---

## Shared Inputs *(filled by the prerequisites, used by every session)*

### Baseline

- Branch / commit: `main` @ `edb2e2d` (cleanup merge), tree clean
- Test baseline: **875 passed / 21 skipped / 0 failed**, 59 files
- Build baseline: **912.23 KB JS** (279.76 KB gzip), **282.59 KB CSS** (44.25 KB
  gzip), single chunk, no warnings. Round 1 ended at 1,036 KB JS.
  ⚠ `public/assets` is **11 MB** — more than 10× the JS bundle and the real size
  lever for a Steam build (CR2-008).
- Source size: **260 files** in `src/`, down from 305.

### Reachability — files nothing imports *(Prereq 3)*

*Paste `node tools/reachability.mjs` output here. Caveat from the tool's own
header: the import regex also matches commented-out imports, so this list is a
floor, not a ceiling. Ignore `src/tests/` lines — vitest finds those itself.*

Re-run after the cleanup's deletions. Three non-test entries remain, all
accounted for — **treat this list as fully triaged, not as work**:

```
   165 src/config/registries/modifierPalette.js   <- LIVE, but only via cms/src (see below)
    86 src/config/registries/tokenConstants.js    <- LIVE via cms/src; also ContentRules.test.js
    83 src/systems/core/EventBatch.js             <- KEPT DELIBERATELY, see CR2-007
```

*(`StatProcessor.js` was on this list and was genuinely dead — deleted
2026-08-18 after checking both `src/` and `cms/`.)*

### ⚠ Three ways this tool lies — read before deleting anything it lists

1. **It walks from `src/main.jsx` only**, so files used solely by **tests**
   report as unreachable. Deleting on its word broke the suite once during the
   cleanup (`RecruitSystem`).
2. **It does not know the CMS exists.** `cms/src` imports seven modules directly
   out of the game's `src/` — see CR2-010. Two entries above are live *only*
   because of that. Nothing in the game reaches them, and no game test covers
   them, so deleting them looks safe right up until the CMS breaks. The CMS has
   no tests of its own (CR2-006), so nothing would catch it.
3. **Searching for a filename is not the same as finding an import.** An earlier
   pass here matched any quoted string containing the stem, including doc
   comments, and wrongly cleared all three files above as "live via
   triggerRegistry" — `triggerRegistry` imports none of them. Match on an actual
   `from '…'` specifier, then confirm the exported symbols are referenced.

The reliable check is: grep `src/`, grep `cms/src/`, grep `src/tests/`, and
check the exported symbols — not the filename — before removing anything.

### Round-1 leftovers — triage results *(Prereq 4)*

| Round-1 ticket | Verdict | Carried as |
|---|---|---|
| CR-010 (P2) | Mostly fixed incidentally; residue still live | CR2-022 |
| CR-012 (P3) | Still live | CR2-023 |
| CR-014 (P3) | Still live | CR2-024 |
| CR-015 (P3) | Still live | CR2-025 |
| CR-016 (P3) | Still live | CR2-026 |
| CR-019 (P2) | Superseded (code deleted by rework) | — *(every file it named is gone; the one survivor, GICard's hover audio, is already CR2-020)* |
| CR-023 (P3) | Superseded (code deleted by rework) | — *(LoopRunner + StationManager deleted)* |
| CR-024 (P3) | Superseded (code deleted by rework) | — *(areaStates and their `_`-prefixed fields are gone)* |
| CR-025 (P3) | Superseded (code deleted by rework) | — *(all five files it cited are deleted)* |
| CR-031 (P3) | Still live | CR2-027 |
| CR-032 (P3) | Fixed incidentally | — *(now `logger.debug` at `SkillSystem.js:182`, with a comment recording why)* |
| CR-034 (P3) | Half still live, half superseded | CR2-028 |
| CR-042 (P2) | Still live | CR2-029 |
| CR-043 (P3) | Superseded (code deleted by rework) | — *(every registry it named, and both DropTableModals, are deleted)* |
| CR-046 (P3) | Superseded (code deleted by rework) | — *(AreaBannerRow deleted)* |
| CR-047 (P3) | One part still live, three superseded | CR2-030 |
| CR-050 (P2) | Still live, re-characterised and downgraded to P3 | CR2-031 |

Verdicts: `Superseded (code deleted by rework)` / `Still live → CR2-NNN` /
`Fixed incidentally (verify + note where)`.

---

## Ticket Format

```
### CR2-NNN · P0–P3 · S/M/L · Session N · Status: Open
- **Where**: src/path/File.js:123
- **What**: One-sentence statement of the defect or debt.
- **Why it matters**: Plain-language impact on the game or player.
- **Suggested fix**: Concrete direction (not a full diff — those are written
  by the fix session against current code).
- **Related**: CR2-XXX, a round-1 ticket, roadmap §, or concept doc reference.
- **Confidence**: Only if suspected-but-unproven; say what would confirm it.
```

Statuses: `Open` → `Fixed (date, commit)` / `Won't fix (reason)` /
`Superseded by CR2-XXX`. Fix sessions update this line; never delete tickets.

Out-of-territory observations: file a stub ticket (Where + What only) tagged
with the session that owns that territory, so it's waiting for them.

**Owner-decision tickets:** if a finding needs the owner to choose, say so in
the ticket and present the options as labelled multiple choice with a
recommendation — don't leave it as an open question.

---

## System Map *(each session fills in its territory)*

Goal: a holistic picture of how systems connect, built up across sessions.
For each system note: **state it owns** (paths in GameState), **events
published**, **events subscribed**, **who calls it / what it calls**. Flag
contract mismatches (publisher payload ≠ subscriber expectation) as tickets.

Round 1 built a map of a codebase that no longer exists — start fresh.

### Session 1 — State core
*(pending)*

### Session 2 — Board engine
*(pending)*

### Session 3 — Combat, heroes, skills & promotion
*(pending)*

### Session 4 — Cards, economy, inventory, quests & progression
*(pending)*

### Session 5 — Content pipeline & CMS boundary
*(pending)*

### Session 6 — UI ↔ engine boundary
*(pending)*

### Session 7 — UI components
*(pending)*

---

## Findings

*(Tickets are appended below, grouped by session, as sessions run.)*

### Filed by the preliminary cleanup phase (2026-08-18)

These came out of the test triage, before Session 1. They are numbered in the
review's sequence so the fix waves can pick them up normally.

---

### CR2-001 · P2 · S · Cleanup phase · Status: Open
- **Where**: `data/tokens.json` → `token_copper_pickaxe` (and `token_forge_altar`)
- **What**: Authored Tokens carry an empty `theme` (`""`), which is not a value
  the game's vocabulary declares. `ContentRules` catches it as
  `token_copper_pickaxe has unknown theme ""`.
- **Why it matters**: Theme is the only thing that makes a Map's loot pool mean
  anything — the rule these Tokens break is the one stopping a Woodland Map from
  dropping desert content. A blank theme won't match any Map's pool filter, so
  the Token silently can't appear where it should.
- **Suggested fix**: Set a real theme in the CMS, not by hand in `data/` — a
  hand-edit is overwritten by the next Sync to Game. Worth checking whether the
  CMS lets a Token be saved with no theme at all; if so, that's the actual bug
  and this is its symptom.
- **Related**: CR2-005. Found by `ContentRules.test.js` "classifies every Token
  with vocabulary the game declares".

---

### CR2-002 · P2 · S · Cleanup phase · Status: Open
- **Where**: `data/tokens.json` → `token_copper_pickaxe.sprite`
- **What**: Points at `Token_pickaxe_copper.png`, which does not exist on disk.
- **Why it matters**: A Token with no art renders as a fallback wherever it
  appears — tray, board, vault. Visible to the player, and the kind of thing
  that's invisible in review until someone happens to obtain that Token.
- **Suggested fix**: Either the art needs generating, or the reference is a
  naming mismatch — note the id/sprite naming inversion this project has
  elsewhere (`oak_wood` → sprite `wood_oak`), so check the manifest for the
  same file under a transposed name before commissioning art.
- **Related**: CR2-001. Found by `ContentRules.test.js` "⚠️ points every Token
  at art that actually exists".

---

### CR2-003 · P1 · M · Cleanup phase · Status: Open
- **Where**: `src/tests/CMSBalanceEngine.test.js` (3 cases, now `it.skip`) →
  `cms/src/engine/anchorCalculator.js`, `valuePropagator.js`, `balanceRunner.js`
- **What**: Three balance-solver assertions each come out at half their expected
  value — `expected 1 to be close to 2`. The anchor calculator should resolve
  Oakwood Grove as primary anchor and derive Oak Wood at 2.0g; it derives 1.0g.
  The value propagator and the end-to-end runner fail consistently with that.
- **Why it matters**: This is the machinery that computes every price and yield
  in the game. If it's genuinely off by a factor of two, all authored content is
  balanced against wrong numbers, and the symptom is a game that plays badly
  rather than anything that crashes — the slowest possible bug to find.
- **Suggested fix**: **Confirm the cause before assuming a maths bug.** The
  favoured hypothesis is content, not code: the anchor token these tests name
  ("Oakwood Grove") may be the re-authored `token_oak_forest`, in which case the
  solver is anchoring on something absent and this is a stale test. Settle that
  first; only then look at the arithmetic.
- **Confidence**: Cause unproven. Confirmed by checking whether the anchor id
  the test expects still exists in `data/tokens.json`.
- **Related**: Scope note — `cms/src` internals are out of the review's scope,
  so this ticket covers the *boundary* symptom. The solver's own correctness is
  the standing gap in CR2-006.

---

### CR2-004 · P2 · M · Cleanup phase · Status: Open
- **Where**: `src/tests/fixtures/testTokens.js`, `src/config/registries/itemRegistry.js`
- **What**: Fixture insulation is now partial, not complete.
  `registerItems` (added in `8935468`) covers the 10 item ids current content
  doesn't define, but `item_oak_wood`, `item_charcoal` and `item_copper_ore` are
  deliberately left pointing at real content so `Market` and `RosterAndMarkets`
  keep measuring real values.
- **Why it matters**: Those three ids are still a tripwire. Re-authoring or
  renaming any of them breaks engine suites that aren't about them — exactly the
  coupling Phase 10's fixture split exists to prevent, and exactly what just
  cost ~25 test failures.
- **Suggested fix**: Give every fixture its own `fixture_*` item and update the
  assertions that name real ids across the six affected suites. Mechanical but
  wide; wasn't smuggled into the cleanup.
- **Related**: `8935468`.

---

### CR2-005 · P3 · S · Cleanup phase · Status: Open
- **Where**: `src/tests/ContentRules.test.js` (18 cases, now `it.skip`)
- **What**: The content-validation rules are skipped while content is
  mid-re-authoring (live set: 5 items, 10 Tokens). They describe a *complete*
  content set and can't pass against a partial one.
- **Why it matters**: These are the acceptance criteria for "content is finished
  enough to ship". Left skipped indefinitely, the project loses its only
  mechanical check that authored content is well-formed — and skipped tests tend
  to stay skipped.
- **Suggested fix**: Un-skip in step with content authoring rather than in one
  go. Session 9 should check this ticket before signing off on test coverage.
- **Related**: CR2-001, CR2-002 (real defects this suite caught).

---

### CR2-007 · P1 · M · Cleanup phase · Status: Open
- **Where**: `src/systems/core/EventBatch.js`; hook surface in
  `src/systems/core/EventBus.js:19,27`
- **What**: **Event coalescing is no longer wired to anything.** `EventBatch`
  collects events raised during a tick and de-duplicates them before they reach
  the UI. Round 1 verified its two callers — `LoopRunner.tick` and
  `StationManager.tick` — paired begin/flush correctly. Both were deleted by the
  playmat rework, and `BoardRunner` never took up the mechanism. Nothing in
  `src/` now calls `EventBatch.queue`, `begin` or `flush`; `EventBus` still
  carries the batch-capture hook for a batch that is never opened.
- **Why it matters**: This is objective 3's "events are coalesced so the UI
  can't render-storm". Without it, every state change during a tick publishes
  straight through to React. With a 7×7 board of running tiles this is exactly
  the shape that produces render storms — many small publishes per tick, each
  potentially re-rendering subscribers. It may currently be masked by the board
  being sparsely populated during testing.
- **Suggested fix**: **Deliberately not deleted**, though it is technically dead
  code — it is a working, previously-verified solution, and deleting it would
  make whoever fixes the render storm rebuild it. Decide whether `BoardRunner`
  should open a batch per tick the way `LoopRunner` did. Session 2 (board
  engine) and Session 8 (runtime verification) both need this on their list;
  Session 8 should measure render counts per tick before and after wiring it.
- **Confidence**: The wiring gap is confirmed by grep. Whether it currently
  causes a *measurable* problem is not — that needs Session 8's render census.
- **Related**: Round 1 objective 3; CR2-003 is unrelated.

---

### CR2-008 · P2 · M · Cleanup phase · Status: Open
- **Where**: `public/assets/` (11 MB), chiefly `audio/` 5.0 MB,
  `backgrounds/` 2.9 MB, `items/` 1.2 MB, `playmat/` 696 KB
- **What**: The shipped asset payload is **11 MB against a 912 KB JS bundle** —
  assets are more than ten times the code. Nobody has cross-checked them against
  what `sprite-manifest.js` and `AssetPreloader` actually reference since the
  playmat and CMS reworks changed what content exists.
- **Why it matters**: This is the real size lever for a Steam build; the code
  bundle is already small. Round 1 flagged one 3.8 MB BGM file and a set of
  retired-era backgrounds. The backgrounds in particular were authored for the
  old area-banner UI, which no longer exists — but the 7×7 playmat art *is*
  live now, so the round-1 verdict on `playmat/` is inverted and cannot be
  reused. Needs checking, not assuming.
- **Suggested fix**: Build the referenced-asset set from `sprite-manifest.js`,
  `AssetPreloader` and any literal `/assets/...` strings, diff it against the
  files on disk, and report the orphans by directory before deleting anything.
  Art is expensive to regenerate and cheap to keep, so this wants evidence
  rather than a sweep.
- **Deliberately not done in the cleanup**: it needs the manifest cross-check
  above, which is a session's work rather than a mechanical pass.
- **Related**: Session 9 (build & Tauri readiness) owns the bundle audit.

---

### CR2-009 · P3 · S · Cleanup phase · Status: Open
- **Where**: the repo root — 43 `.md` files after the cleanup archived 7
- **What**: The root still mixes live references with documents for finished
  work. The cleanup moved only those with an **explicit successor** (a v1 where
  a v2 exists, a brief where its roadmap exists). Everything else needs an
  owner ruling, because "is this still live?" is not answerable from the files.
- **Why it matters**: The review guide already warns that stale concept docs
  describing retired systems (the linear 12 areas, the hero bench, food/drink
  slots, packs as a shop) must not be treated as truth. The more of them sit
  beside the live roadmaps, the likelier a session reads the wrong one — and
  round 1 filed tickets against exactly that mistake.
- **Suggested fix**: Owner passes over the root list and marks each as live or
  finished. Likely-finished candidates, all pending confirmation: the playmat
  concept set (`playmat_grid_concept`, `playmat_hero_concept`,
  `playmat_skills_concept`, `playmat_ui_concept`, `playmat_gap_analysis`,
  `playmat_refinement_briefs`), the intent notes for shipped features
  (`bank_drawer_intent`, `token_object_intent`, `token_object_brief`,
  `tray_loose_objects_intent`), `status_effects_plan`, `ui_overhaul_spec`,
  and `Fantasy_Guild_Granular_Implementation_Plan`.
  **Do not archive on inference**: `playmat_balance_report_v1.md` holds the
  balance numbers and the solver plans may still be live work
  (`cms_solver_plan_v2`, `solver_levers_brief` — recent commits touch them).
- **Related**: `archive/docs/README.md`; Session 9 owns documentation health.

---

### CR2-010 · P2 · M · Cleanup phase · Status: Open
- **Where**: `cms/src/utils/constants.js`, `cms/src/**` → seven modules under
  the game's `src/`: `registries/modifierPalette.js`, `registries/itemRegistry.js`,
  `registries/skillRegistry.js`, `registries/tokenConstants.js`,
  `registries/triggerRegistry.js`, `registries/equipmentCategories.js`,
  `utils/AssetManager.js`
- **What**: The CMS reaches across the project boundary and imports game source
  directly, by relative path (`../../../src/config/registries/...`). The two
  codebases have separate `package.json` files and separate build pipelines, but
  are silently coupled at the module level.
- **Why it matters**: **Two of those modules have no game-side consumer at all** —
  `modifierPalette` (164 lines) and `tokenConstants` (85 lines) exist *solely*
  to serve the CMS. Nothing in the running game imports them and no game test
  covers them, so every dead-code tool reports them as removable. Delete one and
  the game keeps building, the game's tests stay green, and the CMS breaks — and
  since the CMS has no tests (CR2-006), nothing catches it. This nearly happened
  during the cleanup; the deletion was caught only because three CMS-adjacent
  suites happen to live in the game's test directory.
- **Suggested fix**: Owner decision on the shape. The options are to make the
  shared vocabulary an explicit shared module both sides import deliberately, to
  let the CMS own its own copy, or to leave the coupling and simply **document
  it loudly** at the top of each of the seven files so nobody deletes one. The
  last is cheapest and would have prevented this.
- **Related**: CR2-006 (no CMS tests). Note the round-2 scope decision puts
  `cms/src` internals out of review, but this is a boundary issue and in scope.

---

### CR2-011 · P1 · S · Card retirement · Status: Open
- **Where**: `data/enemies.json` → `enemy_thorn_elemental.drops[0].itemId` =
  `item_blackberry`, which is not in `data/items.json`; drop resolution in
  `systems/combat/LootSystem.js`
- **What**: **A kill can silently yield nothing.** The enemy's only drop entry
  names an item the content set does not contain, so the loot roll succeeds, the
  item lookup returns nothing, and no reward reaches the board. Found while
  verifying the card retirement in the running game: the first fight produced 12
  kills and zero loot.
- **Why it matters**: Player-facing, and silent. Combat *looks* like it worked —
  damage, XP and charges all behave — but the reward never arrives, and nothing
  logs a warning. The automated tests cannot catch it because the engine
  fixtures register the missing ids deliberately (CR2-004), so the suite is green
  precisely where reality is broken.
- **Suggested fix**: Two parts, and the second matters more. Author the missing
  item (or repoint the drop) **and** make an unresolvable drop id loud — a
  warning at minimum, since "content references something that doesn't exist"
  should never fail silently in a game whose content is authored elsewhere.
- **Related**: CR2-004 (fixture insulation is the reason tests miss this),
  CR2-002 (same class of dangling content reference).

---

### CR2-012 · P3 · S · Card retirement · Status: Open
- **Where**: `src/utils/RegistryUtils.js`
- **What**: Newly dead — the card retirement removed its last caller. It is a
  generic rehydration helper, not card-specific code.
- **Why it matters**: Small, but it is exactly the "orphaned by the last rework"
  residue the review exists to find, and it will now show up on every
  reachability run until someone rules on it.
- **Suggested fix**: Delete, unless it is worth keeping as a utility for future
  rehydration work — the same judgement made for `EventBatch` in CR2-007.

---

### CR2-013 · P3 · S · Card retirement · Status: Open
- **Where**: `src/state/GameState.js` → `rebuildCardCache`, `getCardById`,
  `_cardById`
- **What**: A card lookup cache that nothing populates or reads any more. Dead
  but self-contained — it blocks nothing.
- **Why it matters**: Pure maintainability. It is state-shaped dead code sitting
  in the most load-bearing file in the project, which makes that file harder to
  reason about than it needs to be. Session 1 owns this territory.
- **Suggested fix**: Remove with the rest of the card-era state handling; verify
  no save path touches `_cardById` first.

---

### CR2-014 · P3 · S · Card retirement · Status: Open
- **Where**: `data/enemies.json` → every enemy carries `biomeId`
- **What**: An inert label. `biomeRegistry` was retired by owner decision
  (2026-08-18), so the field now points at a concept with no registry behind it.
- **Why it matters**: Dangling vocabulary in authored content invites someone to
  reimplement the concept later because the data implies it exists — which is
  how `theme` got as far as it did.
- **Suggested fix**: Strip the field from the CMS schema and the data, or keep
  it as documented flavour with a comment saying it drives nothing.
- **Related**: `concept_audit.md`; the decision-log note added in `0795bf7`.

---

### CR2-015 · P2 · M · Card retirement · Status: Open
- **Where**: `src/systems/progression/QuestBoardSystem.js` (procedural pool path)
- **What**: The **procedural** quest pool produces nothing, and did so before the
  card retirement — it drew from the card registry, which had already been
  emptied. Story quests, quest slots, progress tracking and turn-in are all
  unaffected and work.
- **Why it matters**: A whole quest source is silently inert. A player sees
  fewer quests than the system was built to offer, with no indication anything
  is missing.
- **Suggested fix**: **Design decision, not a repair.** Procedural quests need a
  new source now that cards are gone — presumably generated from Tokens, but
  what a Token-derived quest should ask for is the owner's call. The retirement
  left an explanatory note in the code rather than guessing.
- **Related**: Session 4 territory.

---

### CR2-016 · P1 · M · Card retirement · Status: Fixed (2026-08-18, c48e2f8 — focus gate removed so combat SFX always play; dead `task_completed` subscription removed. ⚠ Verified by code path, NOT by ear — and `masterVolume` defaults to 0 as a dev mute, so the game stays silent until that slider is raised)
- **Where**: `src/systems/core/AudioSystem.js:41,52-54,126`; publishers in
  `systems/combat/CombatAttackProcessor.js`, `CombatResolutionProcessor.js`;
  `src/ui/components/base/GICard.jsx:59,93`
- **What**: **Combat sound effects almost certainly never play.**
  `playContextualSfx` early-returns unless `this.currentFocusId === cardId`. Those
  two values come from different id spaces that cannot meet:
  `currentFocusId` is only ever set from `audio:focus_changed`, published solely
  by `GICard` with its own DOM id — and **the board does not render `GICard` at
  all**. Meanwhile combat publishes `cardId: card.id` where `card` is the
  ephemeral fight object, so the value is `fight_10`.
  Separately, the `task_completed` subscription on line 54 listens for an event
  **nothing publishes**.
- **Why it matters**: Silent combat is player-facing and the kind of fault that
  reads as "the audio is broken" rather than as a bug with a cause. It is also
  invisible to tests, which do not assert sound.
- **Suggested fix**: Decide what "contextual" audio should key off now the board
  replaced cards — probably the tile, since that is what the player is looking
  at. The focus-gating idea may simply not survive the rework. Remove the
  `task_completed` subscription or reinstate its publisher.
- **Confidence**: Strongly evidenced by the id-space mismatch, **not confirmed at
  runtime** — fight with sound enabled and listen. That is the five-minute check
  that settles it.
- **Related**: CR2-017. Blocks the `cardId` → `anchorId` rename (see below).

---

### CR2-017 · P2 · S · Card retirement · Status: Fixed (2026-08-18, 52381a0 — owner chose to remove the pipeline; quests stay hardcoded in tutorialQuests.js. See CR2-019 for the CMS remnant)
- **Where**: `src/config/registries/questRegistry.js`, `data/quests.json`,
  `src/systems/quests/QuestManager.js:7`, `src/systems/quests/tutorialQuests.js`
- **What**: **The 15 CMS-authored quests in `data/quests.json` never reach the
  game.** `questRegistry` is their only reader, and after the card retirement it
  has no live importer — only a test. The running quest system takes its
  definitions from `TUTORIAL_QUESTS`, hardcoded in `tutorialQuests.js`.
- **Why it matters**: Content authored in the CMS is silently ignored. Same class
  of failure as CR2-011: the pipeline accepts the content and the game never
  shows it, with nothing reporting a problem. Authoring more quests would change
  nothing until this is wired.
- **Suggested fix**: Either wire `QuestManager` to the registry so authored
  quests load, or accept that quests are hardcoded and remove `data/quests.json`
  and `questRegistry` so the CMS stops offering an editor for content that goes
  nowhere. **Deliberately not deleted during the retirement** — removing it
  would cement the disconnect and delete the only bridge to that content.
- **Related**: CR2-011, CR2-015 (the procedural pool, also inert).

---

### CR2-018 · P3 · S · Card retirement · Status: Fixed (2026-08-18, c12eb69 — owner confirmed exploration retired; GradualInputSystem and systems/exploration/ deleted)
- **Where**: `src/systems/exploration/GradualInputSystem.js` (266 lines) — the
  only file in `systems/exploration/`
- **What**: Orphaned by the work-cycle deletion; no importer in `src/`,
  `cms/src/` or the tests.
- **Why it matters**: It is a whole system directory for a concept —
  "exploration" — that the concept audit never covered. Deleting it silently
  would remove a feature the owner may still want; keeping it leaves a dead
  system in the tree.
- **Suggested fix**: **Owner ruling needed**, as with the `concept_audit.md`
  entries: is exploration a real feature, an abandoned one, or another `theme`?
  Not deleted for that reason.
- **Related**: `concept_audit.md`; CR2-012 (`RegistryUtils`, same situation).

---

### CR2-019 · P2 · S · Card retirement · Status: Open
- **Where**: `cms/src/engine/contentGenerator.js` (~90 lines of quest handling)
- **What**: The CMS has **no quest editor any more** — no screen, no column, no
  quest data in its store. What survives is quest handling inside the AI content
  generator: the prompt still asks the model to invent quests, and the code that
  would save them calls `addQuest` / `updateQuest`, **functions that no longer
  exist in the CMS store**. If the model ever returns a quest, that path throws.
- **Why it matters**: A latent crash in the content tool, and it predates the
  quest-pipeline removal rather than being caused by it. Now that
  `data/quests.json` is gone (CR2-017), any quest the generator produced would
  have nowhere to go regardless.
- **Suggested fix**: Strip the quest branch from the generator and the quest
  instructions from its prompt. **Not a clean removal** — it is entangled with
  encounter handling on at least one line, and `cms/src` has no tests to catch a
  mistake, so this wants a dedicated CMS session rather than a drive-by edit.
- **Related**: CR2-017, CR2-006 (no CMS tests).

---

### CR2-020 · P3 · S · Card retirement · Status: Open
- **Where**: `src/systems/combat/LootSystem.js` → `handleTaskReward`;
  `src/ui/components/base/GICard.jsx:59,93`
- **What**: Two pieces of residue left by the card retirement and the audio fix.
  `handleTaskReward` has no callers at all. `GICard` still publishes
  `audio:focus_changed` on hover, and nothing subscribes to it any more now the
  focus gate is gone — it announces to an empty room.
- **Why it matters**: Harmless today, but both are the kind of thing that reads
  as intentional to the next person and gets preserved. Cheap to clear.
- **Suggested fix**: Delete both, checking `cms/src` and the tests first as ever.
- **Related**: CR2-012, CR2-016.

---

### CR2-021 · P3 · S · Card retirement · Status: Open
- **Where**: `src/systems/core/AudioSystem.js` — the SFX clip pool
- **What**: Rapid repeated sounds log `play() interrupted by pause()` errors. The
  pool holds only three copies of each clip, so a fourth overlapping play
  interrupts one already running. **Pre-existing** — the victory sound does it
  too — and it was exaggerated during verification by cramming sixty ticks into
  an instant.
- **Why it matters**: Console noise rather than a player-facing fault at normal
  speed, but combat can plausibly fire several hits close together, and time-bank
  fast-forward compresses everything. Worth confirming at 10× before dismissing.
- **Suggested fix**: Grow the pool, or drop the play silently when every copy is
  busy instead of interrupting one mid-sound.
- **Confidence**: Observed in the console; real-world impact at normal speed
  unmeasured.

---

### CR2-032 · P2 · S · Quest cleanup · Status: Open
- **Where**: `cms/src/components/shared/GenerateModal.jsx`;
  `cms/src/stores/useGlobalStore.js`; `cms/src/components/shared/FileManagerModal.jsx`
- **What**: Three leftovers in the CMS, all **pre-existing** and confirmed present
  before the quest cleanup touched anything:
  1. **Opening the Generate dialog on an empty workspace crashes it.** Reproduced
     against unmodified code.
  2. The global AI prompt still contains a "QUESTS & ZONE UNLOCKS" section, so the
     model may still be asked for quests. Now harmless — they are ignored rather
     than crashing the import — but it wastes prompt budget asking for content
     nothing consumes.
  3. `FileManagerModal` saves `quests: state.quests` into workspace files; that
     field does not exist in the CMS store, so it always writes empty.
- **Why it matters**: (1) is a real crash in the tool you author content with.
  (2) and (3) are cosmetic but are the same "vocabulary outlived its feature"
  pattern that produced `theme`.
- **Suggested fix**: Fix the crash; drop the quest section from the global prompt
  and the dead `quests` field. **`cms/src` has no tests (CR2-006)**, so verify by
  loading the CMS and opening the dialog rather than by any automated check.
- **Related**: CR2-019 (the generator's quest code, removed), CR2-006.

---

### CR2-033 · P1 · S · Tooling baseline · Status: Fixed (2026-08-18, 00e3178 — `vault_deposited` now published by `TokenBank.deposit()` after both refusal checks; manual publish in TokenVaultTab removed. Verified in the running game: an engine deposit moved a live quest counter 0→1. +3 tests)
- **Where**: `src/systems/board/TokenBank.js` → `deposit()`;
  `src/ui/components/drawer/TokenVaultTab.jsx:81`;
  `src/systems/quests/QuestManager.js:211`
- **What**: **Depositing a Token into the Vault only counts for quests if done
  from one particular tab.** The engine's `TokenBank.deposit()` publishes
  `token_bank_updated` but never `vault_deposited`. Only `TokenVaultTab`
  publishes that, by hand, after calling deposit itself — and `QuestManager`
  subscribes to `vault_deposited` to advance quest progress. Every other deposit
  route (the Tray's four call sites, the Board) therefore advances nothing.
- **Why it matters**: Player-facing and maddening in the way only silent rule
  divergence is: a quest that says "deposit a Token" refuses to tick unless the
  player happens to use the right screen, with no feedback explaining why. There
  is nothing wrong with the deposit itself — the Token arrives — so the player
  has no way to work out the rule.
- **Suggested fix**: Publish `vault_deposited` from `TokenBank.deposit()`, where
  every route already funnels through, and delete the manual publish in
  `TokenVaultTab`. That is the general shape here: **a game rule is being
  enforced in React components rather than in the engine.**
- **Related**: Found by the duplication tooling (`npm run duplication`) as a
  three-way clone of the deposit sequence across `Tray.jsx`, `TokenVaultTab.jsx`
  and `BubbleMenu.jsx`; the divergence is what makes it a bug rather than
  untidiness. See `tooling_baseline.md`.

---

### CR2-034 · P1 · S · Tooling baseline · Status: Fixed (2026-08-18, 1ed49ad — hooks lifted above the conditional. Regression proved: reverting the fix makes the new GICard.test.js fail with the real "Rendered more hooks" error)
- **Where**: `src/ui/components/base/GICard.jsx` — two `useTransform` calls
  inside a conditional block
- **What**: React hooks called conditionally. React requires every hook to run in
  the same order on every render; a card whose image appears or disappears
  changes that order.
- **Why it matters**: This is the class of bug that crashes the UI outright
  ("rendered more hooks than during the previous render") rather than degrading.
  It needs the right sequence of states to trigger, which is why it has survived
  — not because it is harmless.
- **Suggested fix**: Lift both `useTransform` calls above the conditional and
  branch on their *result*. Small change, but it is a behaviour fix rather than a
  cleanup, so it wants deliberate verification in the browser.
- **Related**: Found by ESLint (`npm run lint`). One of the 37 remaining problems.

---

### CR2-035 · P3 · S · Tooling baseline · Status: Open
- **Where**: `src/ui/components/base/GISurface.jsx`;
  `src/ui/components/base/ToastContainer.jsx`;
  `src/tests/Risk13Allocation.test.js`
- **What**: Three small loose ends, deliberately left for the review to handle in
  territory order (owner decision, 2026-08-18):
  1. **`GISurface.jsx` is orphaned.** Removing its one unused import left it with
     no importer anywhere — verified across `src/`, `cms/src/` and the tests.
  2. **`ToastContainer` has a fully built notification-collapse feature with no
     way to trigger it** — no button, no shortcut. Either it lost its control in
     a rework or it was never finished. Worth establishing which before deleting,
     since a finished feature missing only its button is cheap to restore.
  3. A lint-suppression comment in `Risk13Allocation.test.js` that no longer
     suppresses anything.
- **Why it matters**: Individually trivial. Together they are the same pattern
  the review keeps meeting — code that survives its purpose and then reads as
  intentional to the next person. (2) is the one with any real content.
- **Suggested fix**: Session 7 (UI components) owns all three.
- **Related**: `tooling_baseline.md`.

---

### CR2-036 · P2 · M · Lint triage · Status: Open
- **Where**: 34 sites across `src/ui/` and `src/systems/`, from `npm run lint`
- **What**: The lint residue, and it is more interesting than "unused code". Three
  patterns, each pointing at a control wired up at one end only:
  - **Accepted then ignored (10)** — `BottomFolderDrawer` takes a card-size
    setting and never passes it on; `GuildUpgradeInspection` takes an `onClose`
    and offers no way to close; `ParticleOverlay` is told how many items were
    collected and ignores it, so collecting 40 looks like collecting 1; `Toast`
    is told `isLoss` **and works it out for itself**, so caller and component can
    disagree.
  - **Computed then dropped (7)** — `ItemIcon` resolves an item's emoji and never
    draws it, so authored icons fall back to a placeholder; **`BoardTile` holds
    `ALERT_HINT`, a full table of player-facing explanations for each red warning
    mark, that nothing reads** — D-114 says hovering a warning should explain it,
    and it doesn't; `BankTab` reads the player's gold and never shows it.
  - **React effect dependencies (7)** — mostly harmless, but `useGameState:126`
    has a dependency list that is not a plain list, so neither React's tooling
    nor a reader can tell what it actually depends on.
  - **One clock question** — `QuestManager.tick()` is handed the elapsed time and
    ignores it in favour of the wall clock, so quest timing runs on a different
    clock from the rest of the engine. That matters under time-bank fast-forward.
  - **Two in tests** — `BoardCombat.test.js` names an enemy it never asserts on;
    `Cartographer.test.js` has a `stockFor` helper that is never called, so a
    test may not be set up as its author intended.
- **Why it matters**: Individually small; collectively this is the review's
  central question in miniature — features half-wired, where the missing half is
  invisible because nothing errors. `ALERT_HINT` and `ItemIcon` are player-facing.
- **Suggested fix**: Distribute by territory across the review sessions rather
  than as one job. Re-run `npm run lint` to regenerate the list.
- **Related**: `tooling_baseline.md`; CR2-035.

---

### CR2-037 · P3 · S · Lint triage · Status: Open
- **Where**: `src/ui/context/EngineContext.jsx` (2 importers) and
  `src/ui/hooks/useEngine.js` (13 importers)
- **What**: **Two functionally identical `useEngine` implementations**, both live.
- **Why it matters**: Exactly the "two plausible answers to the same question"
  pattern that made the quest and card systems hard to read. Nothing is broken;
  a newcomer simply cannot tell which is canonical, and edits may land in the one
  fewer files use.
- **Suggested fix**: Consolidate on the 13-importer version. Session 6 territory.
- **Related**: CR2-035, CR2-038.

---

### CR2-038 · P3 · S · Lint triage · Status: Open
- **Where**: `src/ui/components/base/GICard.jsx`
- **What**: **`GICard` renders nowhere in the game.** Nothing imports it but its
  own tests; the `data-card-id` elements in the live DOM are quest cards from
  `QuestColumn.jsx`. It is a second orphan alongside `GISurface` (CR2-035).
- **Why it matters**: It carried a real crash (CR2-034) that could never fire,
  and the effort of fixing and testing it went into code no player reaches. Worth
  settling before more is spent on it.
- **Suggested fix**: Delete it with its test, or wire it up if it is meant to be
  the card component. **Owner decision** — same call as `GISurface`.
- **Related**: CR2-034, CR2-035.

---

### CR2-006 · P2 · L · Cleanup phase · Status: Open
- **Where**: `cms/src/` (whole app)
- **What**: The CMS has **no tests of its own**. Its only coverage anywhere is
  three suites on the game side, of which the balance-engine one is currently
  skipped (CR2-003).
- **Why it matters**: The 13-module solver engine computes the game's balance
  numbers. An arithmetic error there produces content that looks fine and plays
  badly. Recorded here so the deliberate scope decision (2026-08-18: `cms/src`
  internals out of scope for round 2) doesn't quietly become permanent.
- **Suggested fix**: Owner decision — a dedicated CMS pass after round 2, or
  accept the risk explicitly.
- **Related**: Scope section of `code_review_v2_guide.md`; CR2-003.

---

### Re-filed from round 1 by Prerequisite 4 (2026-08-18)

Each of these was checked against current code before being carried forward.
The round-1 ticket it came from is named in **Related**; that ticket's own
history stays in the archived `archive/docs/code_review_findings.md`.

---

### CR2-022 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/AudioSystem.js:43-44`
- **What**: Two sound subscriptions listen for events nothing publishes any
  more: `skill_leveled` and `invasion_started`. (`hero_leveled` next to them is
  still published by `SkillSystem` and is fine.)
- **Why it matters**: Reads as working audio wiring that is actually inert, so
  the next person debugging "why is there no sound" starts in the wrong place.
- **Suggested fix**: Delete both subscriptions, or publish the events if the
  sounds are wanted.
- **Related**: Round-1 CR-010. Most of that ticket is already gone — its
  missing-clip publishers were deleted with the card era, the `task_completed`
  subscription went with CR2-016, the hover-audio half is CR2-020, and per-area
  BGM is a deferred owner decision, not a defect. This is the remainder.

---

### CR2-023 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/state/GameState.js:144` (`serialize`),
  `src/systems/hero/logic/HeroRehydration.js:19`
- **What**: Heroes are saved whole. Each one carries a live `aggregator` object
  plus derived fields that are recomputed on load anyway, and `serialize()` no
  longer strips anything — the strip pass that used to run there was removed
  with the card retirement.
- **Why it matters**: Harmless today (rehydration overwrites them) but it makes
  save files bigger and records runtime scratch as if it were saved truth.
- **Suggested fix**: A `HERO_PROPS_TO_STRIP` list applied in `serialize()`.
- **Related**: Round-1 CR-012.

---

### CR2-024 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/TimeManager.js:21/77/148-153`,
  `src/systems/core/GameLoop.js:37`
- **What**: TimeManager keeps its own clock that restarts at zero every boot
  (`GameLoop.start()` calls `TimeManager.init()` with no saved value), and its
  `getGameTime()` and `serialize()` have no callers anywhere. The real clock is
  `state.time.gameTimeMs`, ticked by EngineBootstrap. Separately,
  `state.time.isPaused` is written into every save but never read back.
- **Why it matters**: A second clock that disagrees with the real one is a trap
  for whoever reaches for it next.
- **Suggested fix**: Delete the parallel counter and `serialize()`; decide
  whether pause should survive a reload (probably not — then drop the field).
- **Related**: Round-1 CR-014.

---

### CR2-025 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/EngineBootstrap.js:261-263`
- **What**: Boot writes `GameState.exploration = { count: 0 }` onto the manager
  object rather than into game state, and nothing reads it. Exploration itself
  was retired earlier today.
- **Suggested fix**: Delete the block.
- **Related**: Round-1 CR-015.

---

### CR2-026 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/core/EngineBootstrap.js:140-191`,
  `src/systems/core/GameLoop.js:90-95`
- **What**: All eight per-frame handlers register at the default priority, so
  the order they run in is decided by the order the registration calls happen to
  appear in, even though `onTick` takes a priority argument and the comments
  claim a specific order matters.
- **Why it matters**: Reordering two lines of boot code silently reorders the
  game loop.
- **Suggested fix**: Pass explicit priorities (10, 20, 30…) so the intent is
  written down in code.
- **Related**: Round-1 CR-016.

---

### CR2-027 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/combat/CombatProcessor.js:74/92-99`
- **What**: `heroStatsForUi` is built up on every combat tick, for every hero in
  the fight, and never read by anything.
- **Why it matters**: Pure waste on the hottest path in the game.
- **Suggested fix**: Delete it — the UI already gets combat state from the
  combat events.
- **Related**: Round-1 CR-031. The file moved from `systems/cards/logic/` to
  `systems/combat/` in the rework; the dead code came with it.

---

### CR2-028 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/effects/StatusEffectSystem.js:110`
- **What**: The five-second status tick publishes `heroes_updated` for every
  hero carrying a status, whether or not anything actually changed.
- **Why it matters**: Every one of those makes the UI re-render for nothing.
- **Suggested fix**: Publish only when the tick changed something.
- **Related**: Round-1 CR-034. That ticket's second half (statuses frozen on
  benched heroes) is gone: the bench was retired, and `getAllHeroes` now returns
  every hero.

---

### CR2-029 · P2 · S · Prereq 4 · Status: Open
- **Where**: `src/systems/equipment/EquipmentManager.js:188` (stat names upper-
  cased into modifier types), `:253/262/280/289/298`
- **What**: Seven modifier types are attached to heroes from their gear —
  `SLOW_ENEMY`, `SUNDER`, `EVASION`, `LIGHT`, `HASTE`, `HPBONUS`,
  `TICKSPEEDBONUS` — and nothing anywhere reads them. Re-checked today across
  the whole of `src/`: zero consumers.
- **Why it matters**: Items carrying those effects do nothing. The gear is
  weaker than its own description claims, and there is no guardrail stopping
  more content being authored against effect names that aren't wired up.
- **Suggested fix**: When the gear pass happens, wire or delete each type; in
  the meantime gather every live modifier-type string into one constants file so
  the dead ones are visible.
- **Related**: Round-1 CR-042.

---

### CR2-030 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/ui/hooks/useDiscovery.js:52-56`
- **What**: The `'card'` branch of `isDiscovered` reads
  `state.library.tasks`, which no longer exists, so it always answers "not
  discovered". Cards themselves were retired today, so the branch may simply be
  deletable.
- **Suggested fix**: Delete the branch, or point it at the collection if
  something still asks the question.
- **Related**: Round-1 CR-047. The other three parts of that ticket are gone —
  the drag-ghost no longer calls the card factory, TestDashboard no longer
  writes retired fields, and `AreaUnlockOverlay` was deleted.

---

### CR2-031 · P3 · S · Prereq 4 · Status: Open
- **Where**: `src/ui/components/base/ToastContainer.jsx:125-142`
- **What**: Some toasts leave their DOM element behind after they disappear,
  stranded at `opacity: 0`. **Re-tested today in a running game**: two bursts of
  ninety notifications left three stranded elements, and the count did not grow
  with the second burst — so it is bounded and much smaller than round 1's
  22–27.
- **Why it matters**: Barely. The elements are invisible and few. Recorded so
  the warning comment in the file has a live ticket behind it.
- **Suggested fix**: Either drop the toast exit animation (removal then becomes
  plain React and is guaranteed correct) or upgrade framer-motion. Owner's call
  — it is an aesthetic trade.
- **Related**: Round-1 CR-050, filed at P2. **Its stated root cause no longer
  applies**: that was orphaned portal content, and the rebuilt UI renders the
  toast column inline with no portal at all (`floating` defaults to false). What
  survives is the AnimatePresence exit behaviour, at much lower severity, so it
  is re-filed at P3.
