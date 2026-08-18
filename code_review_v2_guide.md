# Fantasy Guild Idle — Code Review **Round 2** Master Plan

This is the authoritative brief for the second full-codebase review. It was
planned on 2026-08-18 with the project owner; the scope, session structure,
scoring scheme, and ground rules below are **owner-approved decisions** —
follow them rather than re-proposing your own methodology.

**Companion file:** [`code_review_v2_findings.md`](code_review_v2_findings.md)
— the persistent findings tracker every session writes into. It holds the
Session Status table (check it first to see which session is next) and all
findings. Tickets in this round are numbered **`CR2-NNN`**.

**Round 1** (2026-07-16 → 2026-07-18) lives in `code_review_guide.md` and
`code_review_findings.md`: 53 tickets, 0×P0, six fix waves, 17 P2/P3 tickets
still open. It is **history, not current truth** — it reviewed a codebase that
has since largely been replaced. Its methodology is inherited here; its
findings are not, except for the leftovers carried forward by Prerequisite 4.

---

## Why round 2 exists

Since round 1's final fix wave (`1807564`, 2026-07-18) the codebase has
churned by **366 files, +38,357 / −25,678 lines** — 139 brand-new source
files, 110 modified. Four reworks landed on top of each other:

| Rework | What it replaced | New code |
|---|---|---|
| **Skill & Class** (27 skills, job tree, promotion/re-training) | the old class system | `systems/hero/` (+`logic/`), `SkillSystem`, `PromotionSystem`, `jobRegistry`, `skillRegistry` |
| **Playmat 7×7** | the linear 12-area Deck Loop | `systems/board/` (19 files) — replaces `systems/loop/` + `systems/area/`, both deleted |
| **CMS Rework v2** (phases 0–10) | hand-authored registries | the `cms/` app (~42 files, 13-module solver engine), `data/*.json`, `DatabaseManager`, dynamic registries |
| **Hero Dock** (6 equip slots, bench retired, now rightmost sliding tabs) | the hero bench | `ui/components/dock/` (5 files), `ui/components/drawer/` (11 files) |

Round 1's territories are, in several cases, *gone*: `systems/loop/`,
`systems/area/`, and the entire `ui/components/banner/` family (including the
`AreaBannerRow` that round 1 spent a fix wave splitting into five modules) no
longer exist. **This is a genuine second full review, not a delta pass.**
Do not assume any round-1 finding, system-map note, or verdict still applies.

---

## Scope *(owner decision, 2026-08-18)*

**In scope: the game, plus the CMS↔game boundary.**

- **All of `src/`** — 305 source files. The code that ships to players.
- **The content pipeline where CMS output enters the game** — `data/*.json`,
  `data/schemas/`, `data/templates/`, `src/config/DatabaseManager.js`, the
  dynamic registries that read it, `scripts/regenerate_game_package.js`, and
  the sync route. This is Session 5.

**Out of scope: the CMS's own internals.** `cms/src/` — the editors, stores,
and especially the 13-module solver engine (`evCalculator`, `taskSolver`,
`tokenSolver`, `xpSolver`, `chargeSolver`, `combatLootSolver`,
`valuePropagator`, `balanceRunner`, …) — is **not reviewed this round**. It is
a dev tool that never ships; a wrong number there is caught by playing the
game, not by a crash.

**Standing note for the owner, recorded so it isn't lost:** `cms/src` has **no
tests of its own**. The only CMS coverage anywhere is three suites in the
game's test dir (`CMSBalanceEngine`, `CMSDescriptionDictionary`,
`CMSSyncRoute`). The solver computes your balance numbers, so an arithmetic
error there surfaces as content that looks fine and plays badly — the slowest
possible bug to find. Deliberately accepted as out of scope for now; worth its
own dedicated pass later. Session 9 should re-raise it as a single ticket
rather than letting it vanish.

---

## Intended architecture — the review verifies this is actually true

- **UI layer** (`src/ui/`, React): subscribes to engine events via `EventBus`,
  reads state via `useGameState()`. Must be read-only — never mutates game
  state directly.
- **Engine layer** (`src/systems/`, vanilla JS): all game logic; React-agnostic;
  mutates the singleton `GameState`.
- **Data layer** (`src/config/`, `src/state/`, `data/*.json`): CMS-authored
  content JSON, dynamic registries, formula curves (`FormulaRegistry.js`),
  schemas.

**End goal:** a production build wrapped in a Tauri desktop shell for Steam.

---

## Review Objectives *(inherited from round 1, owner-approved)*

1. **Legacy residue check** — four reworks landed back-to-back, each orphaning
   the last one's code. Expect this to be the single biggest category again:
   dead systems still wired up, half-retired features, contracts pointing at
   deleted counterparts, orphaned flags and schema fields. `tools/reachability.mjs`
   (committed after round 1) gives every session a starting candidate list.
2. **Strict separation of concerns** — no React in `src/systems/`; no state
   mutation from `src/ui/`; EventBus contracts coherent (publisher and
   subscriber payloads agree). `boardEvents.js` is this round's contract
   registry to check publishers/subscribers against.
3. **Performance: smooth 60 FPS + stable memory** *(owner decision, 2026-08-18:
   hold round 1's bar and re-verify it on the new code — do not fund a deeper
   perf program to fix a problem we may not have)*. Concretely:
   - Engine tick stays well inside its 5ms budget with the full 7×7 board
     running. (Round 1 measured 0.09ms avg on the old loop engine — the board
     rework has not been measured.)
   - No high-frequency allocations, deep clones, or GC spikes on the tick path.
   - Hot-path visuals (progress bars, vitals) use direct-DOM updates, not React
     re-renders; events are coalesced so the UI can't render-storm.
   - Flat memory over a long idle session — no leaked EventBus subscriptions,
     un-cleared timers, or detached DOM.
   - Assets preload with no visible pop-in (`AssetPreloader` — verify it covers
     the new token/sprite content).
4. **Serialization integrity** — the flyweight save model in `GameState.js`
   saves only minimal mutable state and rehydrates correctly from static
   templates; a save/load roundtrip loses nothing. The save surface is largely
   new this round (board tiles, token bank, token groups, hero dock equipment,
   job/skill progression) — treat round 1's clean verdict as void.
5. **Maintainability, by judgment not quota** — flag files that are large **and**
   mix unrelated responsibilities, with a per-file split proposal and reason.
   Never propose splitting cohesive code just to hit a number. Pure
   data/registry files are exempt regardless of size.

---

## Ground Rules *(inherited — these worked, don't renegotiate them)*

- **Findings only — review sessions never edit game code.** Every issue becomes
  a ticket in `code_review_v2_findings.md`. Fix waves happen after the review,
  picking tickets by priority. The only files a review session may write are
  the findings tracker and this guide.
- **Ask, don't assume — as multiple choice.** If you can't tell whether
  behavior is a bug or a design decision, ask the owner with labelled options,
  trade-offs, and a recommendation. Many "odd" choices are locked decisions —
  check the relevant roadmap first (see *Current truth* below).
- **The owner does not code.** Session reports must explain findings in plain
  language: what's wrong, why it matters to the game/player, roughly how big
  the fix is. Save the technical detail for the ticket body.
- **One session per sitting.** End by updating the Session Status table and
  committing the findings doc. Don't roll into the next session's territory.
- **Evidence over vibes.** Cite `file:line` for every finding. For performance
  claims, measure — Session 8 exists for this.
- **Holistic lens.** Each session fills in the "System Map" section of the
  findings doc for its territory: what it owns in state, which events it
  publishes/subscribes, which systems call into it. Cross-system findings
  (mismatched contracts, duplicated responsibilities) are the most valuable
  output of this review.
- **Concurrent sessions share one checkout.** Other chats may be editing this
  same working tree. Check the branch and `git status` before committing, and
  don't assume a red test is your fault.

---

## Prerequisites — do NOT start Session 1 until these are done

**The preliminary cleanup phase covers Prerequisites 1, 2, 3 and 5** — see
[`cleanup_phase_brief.md`](cleanup_phase_brief.md) for its own objectives and
boundaries. Prerequisite 4 belongs to the review and can run alongside it.

1. **The preliminary cleanup phase is committed and merged.** Verify `git status`
   is clean and record the branch + commit. The cleanup runs on a short-lived
   `cleanup` branch off `main`; the review starts from the merge.
2. **Baseline test run recorded.** Run `npm test` and note the passing count in
   the Session Status table. **The suite was red when this review was planned —
   86 failures across 17 of 62 files on `f8dcae0` (2026-08-18)** — and clearing
   that is the cleanup phase's first objective. If it is still red at kickoff,
   that is a blocker, not a finding: report it and stop. For reference, round 1
   ended at 121/121 across ~14 files.
   **Read the cleanup's Retired Tests Ledger** before Session 1: stale tests
   were deleted rather than rewritten (owner decision), so coverage on the
   newest code — board, tokens, dock — is thinner than the green count suggests.
   Session 9 owns re-adding it.
3. **Fresh reachability list generated.** `node tools/reachability.mjs` →
   paste the unreachable-file list into the findings doc as a shared input for
   every session. (Caveat, from the tool's own header: its import regex also
   matches commented-out imports, so the list is a floor, not a ceiling;
   ignore `src/tests/` lines.)
4. **Round-1 leftovers re-triaged** *(owner decision, 2026-08-18)*. Walk the 17
   still-open round-1 tickets against current code: **CR-010, 012, 014, 015,
   016, 019, 023, 024, 025, 031, 032, 034, 042, 043, 046, 047, 050**. For each,
   either mark it `Superseded by round 2 (rework deleted this code)` in
   `code_review_findings.md`, or re-file it as a `CR2-NNN` ticket in the new
   tracker with a one-line note of its origin. Goal: after this step, the new
   backlog is the single truth about what's outstanding. Expect an hour.
   Note CR-050 specifically — orphaned portal DOM, root cause still open, and
   the portal-heavy UI has been rebuilt since.
5. **Archive the round-1 docs.** Move `code_review_guide.md` and
   `code_review_findings.md` into `archive/` once Prerequisite 4 has finished
   reading them — not before. *(Deliberately not done at planning time: another
   agent was working the same tree, and moving files under it invites a
   conflict. Do it at kickoff.)*

---

## Current truth, for resolving "is this a bug or a decision?"

In this order:

1. [`CLAUDE.md`](CLAUDE.md) — project ground rules
2. The roadmap for the area you're in, plus its locked-decisions appendix:
   - Playmat 7×7 → `playmat_roadmap_v1.md`, `playmat_decisions.md`
   - Skill & Class → `skill_class_rework_roadmap_v1.md`
   - CMS v2 → `cms_rework_v2_roadmap.md`, `cms_rework_v2_decisions.md`
   - Hero Dock → `project_hero_dock` decisions (12 locked, override the concept doc)
   - Combat/SCB → `SCB_concept.md` (v2 is source of truth), `combat_formula_spec.md`
3. The concept docs those reference.

**Living trackers — check before filing, cross-reference instead of duplicating:**

- [`game_refinement_and_alignment_plan.md`](game_refinement_and_alignment_plan.md)
  — the in-progress refinement pass (v3.2). Sections 1–4 have real progress;
  5–22 are untouched inventory. ⚠ **Its item descriptions have repeatedly been
  stale** — several items describe UI that doesn't exist or point at the wrong
  file (see its own 2026-08-01 findings). Verify against code before treating
  any of it as truth, and never file a ticket merely because code disagrees
  with this doc.
- [`ui_bugfix_tracker.md`](ui_bugfix_tracker.md) — bug/UI-fidelity sweep log.

**Stale documentation warning:** many root concept docs describe retired
systems — the pre-playmat deck loop, the linear 12 areas, the hero bench,
food/drink slots, packs as a shop. Do not treat them as truth and do not file
tickets because code disagrees with them. Session 9 should include a ticket
proposing which docs to archive or delete; the root directory now holds ~50
markdown files of mixed vintage.

**Known content hazard to verify, not assume:** an earlier CMS note warned that
"Sync to Game" destroyed unmodelled content. Phases 8–10 included Sync &
Cutover, so this *may* be resolved — Session 5 must confirm it either way
rather than inheriting the warning.

**Known data hazard:** legacy item ids and live `item_*` ids coexist; the
legacy ones can mask real data bugs. Always reproduce with `item_*` ids.

---

## Scoring *(inherited from round 1)*

Each finding gets a **severity** and an **effort**, kept separate:

| Severity | Meaning |
|---|---|
| **P0** | Broken or dangerous now: data corruption, save loss, crash, leak that degrades long sessions |
| **P1** | Real bug or performance problem a player could hit |
| **P2** | Architecture/maintainability debt: layer violations, dead code, contract drift, oversized mixed-responsibility files |
| **P3** | Polish: naming, style, minor cleanup |

**Effort:** S (< 1 hour), M (a session), L (multi-session project).
Add a confidence note when a finding is suspected but unproven.

Fix ordering after the review: P0 first, then P1, then highest-value P2s —
within a tier, S-effort items first ("quick wins").

---

## Session Plan

Nine sessions: four engine, one pipeline, two UI, one hands-on runtime, one
synthesis. Each is scoped to fit one context window: read the listed territory
in full, apply all five objectives to it, write tickets + system-map notes.
Territory lists are starting points — follow the dependencies you find, and
note anything out-of-territory as a stub ticket for the owning session.

| # | Session | Territory (primary) |
|---|---|---|
| 1 | **State core & serialization** | `src/state/` (GameState, StateSchema), `src/systems/core/` (EventBus, EventBatch, GameLoop, EngineBootstrap, TimeManager, TimeBankManager, SaveManager, SaveMigration, SaveSlotHelper, SettingsManager, NotificationSystem, NotificationSubscriptions, AssetPreloader, DiscoveryManager, AudioSystem). **Objective 4 lives here** — the save surface is largely new (board, token bank, token groups, dock equipment, job/skill progression), so verify rehydration of each from scratch. Note the current save-schema version; it is deliberately decoupled from `package.json` (now 0.6.0). |
| 2 | **Board engine (the 7×7 playmat)** | `src/systems/board/` — all 19 files: BoardRunner, BoardState, Placement, adjacency, TileModifiers, TokenBank, TokenGroups, TriggerSystem, Cartographer, RecipeResolver, BlockUpkeep, BoardCombat, SpriteLayer, InputAllocator, Managers, boardEvents. Plus `src/config/loopConstants.js`, `tileRegistry.js`, `tokenConstants.js`, `mapRegistry.js`, `guildHallMaps.js`. **The largest new engine territory** and where the tick-path allocation audit (objective 3) starts. Verify `boardEvents.js` documents what is actually published. |
| 3 | **Combat, heroes, skills & promotion** | `src/systems/cards/logic/` (CombatProcessor, CombatAttackProcessor, CombatResolutionProcessor, WorkProcessor, StatProcessor, CardPreflight), `src/systems/combat/` (WoundedSystem, LootSystem, DefeatPenalties), `src/systems/effects/` (StatusEffectSystem, ModifierAggregator, EffectAxes, GuildModifiers), `src/systems/hero/` + `logic/` (HeroManager, SkillSystem, PromotionSystem, HeroGenerator, RegenSystem, ConsumptionSystem, HeroRehydration, HeroLifecycle, HeroRoster, HeroState, HeroLookup), `src/systems/equipment/`, `src/config/FormulaRegistry.js`, `src/utils/CombatFormulas.js`, `RetirementFormula.js`, `XPCurve.js`. Two reworks converge here (27 skills + the 7-stat engine) — expect the densest cross-system findings. Per locked decisions: crit/armor/speed were deferred and classes are cosmetic; don't file those as gaps. |
| 4 | **Cards, economy, inventory, quests & progression** | `src/systems/cards/` (CardManager, CardAssembler, `assembler/`, `effects/`, CardFactory, RecruitSystem, RequirementProcessor, QuestProcessor), `src/systems/economy/` (CurrencyManager, CommerceSystem, TransactionProcessor, InventoryGroupManager), `src/systems/inventory/`, `src/systems/quests/` (QuestManager, tutorialQuests), `src/systems/progression/` (ProgressionSystem, QuestTracker, QuestBoardSystem, GuildUpgradeManager, RegistryManager), `src/config/guildUpgrades.js`. |
| 5 | **Content pipeline & the CMS boundary** | `data/*.json` (items, tokens, tokenRecipes, recipes, enemies, encounters, effects, quests, maps, stations, subskills) + `data/schemas/` + `data/templates/`, `src/config/DatabaseManager.js`, every dynamic registry that reads it (`itemRegistry`, `tokenRegistry`, `recipeRegistry`, `recipePoolRegistry`, `enemyRegistry`, `questRegistry`, `mapRegistry`, `tagRegistry`, `areaSetRegistry`, `cardRegistry`, `triggerRegistry`, `modifierPalette`), `scripts/regenerate_game_package.js`, the sync route, and its three test suites. **Central question: can content be silently lost or corrupted crossing the boundary?** Confirm the "Sync to Game destroys unmodelled content" hazard is closed. Also: schema/registry drift, id-space integrity (legacy vs `item_*`), and what happens to a save when content ids change under it. |
| 6 | **UI ↔ engine boundary** | `src/ui/hooks/` (useGameState, useEngine, useUIModals, useDiscovery), `src/ui/context/` (EngineContext, ViewportContext), `src/ui/ReactRoot.jsx`. Then the two sweeps across all of `src/ui/`: **the subscription leak audit** (every subscribe paired with an unsubscribe — round 1 found all 35 sites clean; the UI has been rebuilt since, so re-run it properly) and **the mutation-from-UI sweep**. Plus direct-DOM hot paths (RefProgressBar/TileProgressBar pattern). Objectives 2 and 3's UI half. |
| 7 | **UI components** | `src/ui/components/`: `board/` (Board, BoardTile, Tray, TrayMiniBoard, GuildHallBoard, ConnectionLines, SpriteLayerView, TileProgressBar, TileProgressRing, TokenInspectPopup, BoardStub), `dock/` (5), `drawer/` (11), `quests/`, `fullscreen/`, `nav/`, `hud/`, `base/`, `card-modules/`, `combat/`, `hero/`, plus `src/ui/modals/` and `src/ui/dnd/`. Render-storm risk, oversized mixed-responsibility files, dead components. Explicitly check whether `sandbox/LayoutSandbox`, `dev/DevSpawnItemModal`, `TestDashboard`, `BoardStub`, and `FPSCounter` are intentional dev tools or shipping dead weight. |
| 8 | **Runtime verification (hands-on)** | Not a reading session: run the dev server. Profile the tick path with the full 7×7 board active, take heap snapshots across a long idle to prove flat memory, count React renders during heavy play, verify asset preload coverage for the new token/sprite content, exercise save/load roundtrips including a load into changed content. Confirms or refutes the perf/leak tickets from Sessions 1–7. **Verification notes:** screenshots time out in this project — use `window.Game` / `window.GameState` probes instead; dynamic `import()` does not work in that console context. Drag-and-drop is unreliable to simulate, so DnD findings need the owner's own eyes. |
| 9 | **Build, Tauri readiness & synthesis** | `vite.config.js`, `vitest.config.js`, bundle size and asset pipeline audit (round 1 baseline: 1,036KB JS after its deletion wave — compare), dependency audit across both `package.json` files, `src-tauri/` config and the five-file version consistency check, persistence robustness for a desktop shell, test coverage gaps against the 62 existing suites. File the standing CMS-solver-coverage ticket from the Scope section. Then consolidate everything into the final prioritized action backlog. |

Sessions 1–7 can run in any order if needed, but the listed order builds the
system map bottom-up (state → engine → pipeline → UI). Session 8 requires
1–7's tickets; Session 9 goes last.

---

## Session Kickoff Prompt

The owner starts each review session with this (or a paraphrase). If something
like it brought you here, follow it as written:

> I'm continuing the round-2 code review of this project.
>
> 1. Read `CLAUDE.md` at the repo root for project ground rules.
> 2. Read `code_review_v2_guide.md` — the review's scope, objectives, scoring,
>    and session plan. These are settled; don't re-propose methodology, and
>    don't widen the scope into `cms/src`.
> 3. Open `code_review_v2_findings.md`, check the Session Status table, and tell
>    me which session is next and what territory it covers. If any Prerequisite
>    row isn't marked done, stop and tell me — don't start Session 1 over an
>    unfinished baseline.
> 4. Confirm the working tree is clean and note the current branch and commit.
>    Other chats may share this checkout.
> 5. Skim the findings and system-map notes from prior sessions so you have the
>    holistic picture before diving into your territory.
>
> Then **stop and confirm the session scope with me** before starting. I don't
> code, so report findings in plain language. Remember: this is a review
> session — file tickets, don't change game code. When the session's territory
> is covered, update the Session Status table, give me a plain-language summary
> of what you found, and commit the findings doc.
