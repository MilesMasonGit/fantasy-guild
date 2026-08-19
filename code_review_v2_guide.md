# Fantasy Guild Idle — Code Review **Round 2** Master Plan

This is the authoritative brief for the second full-codebase review. It was
planned on 2026-08-18 with the project owner, and **re-scoped later the same day**
after a large deletion pass changed the shape of the codebase underneath it.
The scoring scheme, ground rules and one-session-per-sitting discipline below are
**owner-approved decisions** — follow them rather than re-proposing your own
methodology. The *territories* and *objectives* were re-drawn in the re-scope and
are marked where a judgement call was made, so they can be argued with.

> **⚠ Approved 2026-08-18.** Sections marked
> **[JUDGEMENT CALL]** are decisions the re-scope made on its own, and sections
> All five of its open questions have since been ANSWERED by the owner — see the
> "Owner rulings on the re-scope" section below.
> Read those before starting Session 1.

**Companion file:** [`code_review_v2_findings.md`](code_review_v2_findings.md)
— the persistent findings tracker every session writes into. It holds the
Session Status table (check it first to see which session is next) and all
findings. Tickets in this round are numbered **`CR2-NNN`**. **38 tickets are
already filed** (CR2-001…038) before Session 1 has run.

**Round 1** (2026-07-16 → 2026-07-18) lives in `archive/docs/code_review_guide.md`
and `archive/docs/code_review_findings.md`. It is **history, not current truth**.
Its methodology is inherited here; its findings are not, except for the ten
leftovers Prerequisite 4 re-filed as CR2-022…031.

---

## Why round 2 exists, and why it was re-scoped

Since round 1's final fix wave the codebase churned by hundreds of files across
four back-to-back reworks — Skill & Class, Playmat 7×7, CMS Rework v2, and Hero
Dock. Each one orphaned the last one's code. That is why round 2 was planned as a
genuine second full review rather than a delta pass.

**Then, on 2026-08-18, the preparation work turned into a large demolition.** The
preliminary cleanup, the card retirement, the quest cleanup and the tooling
baseline ran back to back and removed roughly **8,000 lines**. `src/` went from
**305 files to 232**. The original session plan was written before that happened,
and several of its territories no longer exist. Hence this re-scope.

**What went (all verified against the tree at `4d2980b`):**

| Retired | What is there now |
|---|---|
| **The entire Card system** — `src/systems/cards/`, `src/config/cards/`, `cardRegistry`, `cardConstants` | The live combat engine was rehomed to `src/systems/combat/`. The object it fights over is an ephemeral **fight object** with id `fight_${tile}` (`BoardCombat.js:90`), not a Token and not a Card. |
| **The card-era work cycle** (`WorkProcessor`, `GradualInputSystem`, `systems/exploration/`) | `BoardRunner` + `InputAllocator` had already reimplemented it. |
| **A second, dormant quest system** — `QuestBoardSystem`, `QuestTracker` | `QuestManager` is the only quest system: hardcoded `TUTORIAL_QUESTS` plus quests generated from the player's purchased maps (`QuestManager.js:299-351`). |
| **The authored quest pipeline** — `data/quests.json`, `questRegistry`, and the CMS's quest editor | Quests are hardcoded in `src/systems/quests/tutorialQuests.js`. Owner decision, CR2-017. |
| **Retired concepts** — themes, biomes, tiles, tags, exploration (`biomeRegistry`, `tileRegistry`, `tagRegistry`, `invasionRegistry`, `eventRegistry`, `dungeonRegistry` all deleted) | See `concept_audit.md` §A/§B. |

**And what arrived:** three detection tools (`npm run lint`, `npm run cycles`,
`npm run duplication`) and a **fixed test harness** — `vitest.config.js` now
compiles JSX the same way the real build does, so React components can actually
be rendered in tests. Before that fix, roughly 41 of the UI files could not be
tested at all. That changes what Session 9 can reasonably ask for.

---

## Scope *(owner decision, 2026-08-18 — unchanged by the re-scope)*

**In scope: the game, plus the CMS↔game boundary.**

- **All of `src/`** — now **232 source files** (was 305). The code that ships.
- **The content pipeline where CMS output enters the game** — `data/*.json`,
  `data/schemas/`, `data/templates/`, `src/config/DatabaseManager.js`, the
  dynamic registries that read it, `scripts/regenerate_game_package.js`, and
  the sync route. This is Session 5.

**Out of scope: the CMS's own internals** (`cms/src/`) — the editors, stores, and
the 13-module solver engine. It is a dev tool that never ships. **Standing note:**
`cms/src` has no tests of its own; the only CMS coverage anywhere is three suites
in the game's test dir (`CMSBalanceEngine`, `CMSDescriptionDictionary`,
`CMSSyncRoute`). Recorded as CR2-006 so the scope decision doesn't quietly become
permanent; Session 9 re-raises it.

---

## Intended architecture — the review verifies this is actually true

- **UI layer** (`src/ui/`, React): subscribes to engine events via `EventBus`,
  reads state via `useGameState()`. Must be read-only — never mutates game state
  directly, and **never enforces a game rule of its own** (see CR2-033).
- **Engine layer** (`src/systems/`, vanilla JS): all game logic; React-agnostic;
  mutates the singleton `GameState`.
- **Data layer** (`src/config/`, `src/state/`, `data/*.json`): CMS-authored
  content JSON, dynamic registries, formula curves (`FormulaRegistry.js`),
  schemas.

**End goal:** a production build wrapped in a Tauri desktop shell for Steam.

---

## Review Objectives *(re-aimed 2026-08-18 — read the note below first)*

> **⚠ Objective ordering note (owner ruling).** Performance is a **standing
> objective** — every session watches for it in its own territory, and Session 8
> owns measurement. The re-scope proposed demoting it; the owner restored it.

**The owner's stated goal for this review is: "identify and fix spaghetti code
that has been introduced throughout development", and get the codebase "as clean
and functional as possible."**

**[JUDGEMENT CALL] Honesty about what "spaghetti" turned out to mean here.**
The obvious reading of that goal is a knot-hunt: tangled dependencies, code
copy-pasted everywhere, files that can't be understood on their own. **The
tooling looked for exactly that and did not find it.** There are **zero dangerous
import cycles** in 232 files and 1,057 imports, and duplication sits at **0.44%
of lines** — both genuinely good results (`tooling_baseline.md`). A session sent
hunting for architectural knots will come back empty and will have burned a
sitting doing it.

What the day *did* find, repeatedly, was a different and less obvious mess:

- **Retired systems still wired in** — a whole dead quest system, a card layer the
  live engine was living inside, an exploration system nothing reached.
- **Features wired up at one end only** — a table of player-facing warning
  explanations that nothing reads (`BoardTile`'s `ALERT_HINT`, CR2-036); a Vault
  deposit rule that only counted quest progress from one screen out of four
  (CR2-033); combat audio gated on an id that could never match (CR2-016); two
  live `useEngine` implementations (CR2-037); a notification-collapse feature with
  no button (CR2-035).

That second pattern is the real target, and it is *worse* than tangled code
because nothing errors, nothing fails a test, and the code reads as intentional.
**The objectives below aim the sessions at that.** If a session does find a
genuine knot, file it — but do not go looking for one as the main event.

### 1. Features wired up at one end only ← **the primary objective this round**

For every feature in your territory, follow the wire from both ends. Ask:

- Is this event **published** by anything? Is it **subscribed to** by anything?
- Is this value **computed** and then actually **read**? Displayed?
- Is this prop **accepted** and then actually **used**?
- Is this rule enforced on **every** route into the behaviour, or only one?
- Is there **more than one** live implementation of the same thing?
- Does this piece of content have somewhere to go once it's authored?

Every confirmed instance is a ticket. State plainly which half is missing and
whether the missing half is player-facing. `npm run lint` (see *Tooling* below)
gives you a starting candidate list for the "computed then dropped" and "accepted
then ignored" shapes; CR2-036 already catalogues 34 of them awaiting distribution
by territory.

### 2. Retired systems still wired in

Four reworks and one demolition day. Expect residue: dead modules with a live
importer, contracts pointing at deleted counterparts, orphaned flags and schema
fields, vocabulary that outlived its feature (`biomeId` still on every enemy,
CR2-014). `node tools/reachability.mjs` is the starting candidate list —
**read the "three ways this tool lies" note below before deleting anything on
its word.**

### 3. Rules in the right layer

No React in `src/systems/`; no state mutation from `src/ui/`; and — the sharper
version, learned from CR2-033 — **no game rule enforced inside a React
component.** If a component decides whether an action is legal, or publishes the
event that makes an action count, that rule is in the wrong place and will
diverge from the other routes into the same action. `boardEvents.js` is this
round's contract registry; check publishers and subscribers against it.

### 4. Serialization integrity

The flyweight save model in `GameState.js` saves only minimal mutable state and
rehydrates correctly from static templates; a save/load roundtrip loses nothing.
The save surface is largely new this round (board tiles, token bank, token
groups, hero dock equipment, job/skill progression) — round 1's clean verdict is
void. Note also that `GameState._rehydrateAll` reaches *up* into the engine layer
via two deliberate lazy imports (`GameState.js:44-45`); whether rehydration
belongs in `GameState` at all is a fair Session 1 question.

### 5. Runtime truth — verify in the game, not in the test suite

**The suite has repeatedly been green while the game was broken.** Documented
cases from this project, all found by playing rather than by testing:

- Combat produced 12 kills and **zero loot** — the enemy's only drop named an
  item that doesn't exist (CR2-011). Tests were green because the fixtures
  register the missing ids deliberately (CR2-004).
- A quest counter **never moved** — deposits only published the event quests
  listen for if made from one particular tab (CR2-033).
- **Combat audio never played** — gated on an id from a component the board never
  renders (CR2-016). No test asserts sound.

So: a passing test is not evidence a feature works. Where a finding is
player-facing, **exercise it in the running game** and say in the ticket whether
you confirmed it by running it or only by reading the code. CR2-016's fix is
labelled "verified by code path, NOT by ear" precisely so that gap stays visible.

This objective also carries round 1's **performance bar**, re-verified rather than
re-designed *(owner decision, 2026-08-18: hold the bar, don't fund a deeper perf
programme for a problem we may not have)*: engine tick well inside 5ms with the
full 7×7 board; no high-frequency allocations or deep clones on the tick path;
hot-path visuals on direct-DOM updates rather than React re-renders; flat memory
over a long idle; assets preloaded with no pop-in. **Session 8 owns measuring
all of it.** Note CR2-007: event coalescing (`EventBatch`) is no longer wired to
anything, which is the single most likely cause of a render storm.

### 6. Maintainability, by judgement not quota

Flag files that are large **and** mix unrelated responsibilities, with a per-file
split proposal and reason. Never propose splitting cohesive code to hit a number.
Pure data/registry files are exempt regardless of size. **And given the cycles
result above: if you propose a structural change, you owe evidence that the
current structure actually causes a problem** — "it's big" is not evidence.

---

## Ground Rules *(inherited — these worked, don't renegotiate them)*

- **Findings only — review sessions never edit game code.** Every issue becomes
  a ticket in `code_review_v2_findings.md`. Fix waves happen after the review,
  picking tickets by priority. The only files a review session may write are
  the findings tracker and this guide.
- **Ask, don't assume — as multiple choice.** If you can't tell whether behavior
  is a bug or a design decision, ask the owner with labelled options, trade-offs,
  and a recommendation. Many "odd" choices are locked decisions — check the
  relevant roadmap first (see *Current truth* below). **And if you hit a concept
  that `concept_audit.md` hasn't ruled on, ask — don't assume it's real** (see
  *What the prep settled*).
- **The owner does not code.** Session reports must explain findings in plain
  language: what's wrong, why it matters to the game/player, roughly how big the
  fix is. Save the technical detail for the ticket body.
- **One session per sitting.** End by updating the Session Status table and
  committing the findings doc. Don't roll into the next session's territory.
- **Evidence over vibes.** Cite `file:line` for every finding. For performance
  claims, measure — Session 8 exists for this. For player-facing claims, run the
  game — see objective 5.
- **Holistic lens.** Each session fills in the "System Map" section of the
  findings doc for its territory: what it owns in state, which events it
  publishes/subscribes, which systems call into it. Cross-system findings
  (mismatched contracts, duplicated responsibilities) are the most valuable
  output of this review.
- **Concurrent sessions share one checkout.** Other chats may be editing this
  same working tree. Check the branch and `git status` before committing, and
  don't assume a red test is your fault.

---

## What the prep already settled — do NOT redo this work

All five prerequisites are **complete** (see the Session Status table in the
findings doc for dates and commits). In short:

1. **The preliminary cleanup phase is merged** (`edb2e2d`), and three further
   passes ran after it: the card retirement, the quest cleanup, and the tooling
   baseline.
2. **Baseline recorded and re-verified at `4d2980b`:**
   **840 passed / 21 skipped / 0 failed across 58 files**, `npm run build` clean
   at **864.77 KB JS** (265.53 KB gzip) + 282.59 KB CSS, single chunk.
   ⚠ `public/assets` is **11 MB** — the real size lever for a Steam build (CR2-008).
3. **Reachability list generated** and fully triaged — see the findings doc's
   *Shared Inputs*, and the caution below.
4. **Round-1 leftovers re-triaged.** All 17 walked against current code: 6
   superseded, 1 fixed incidentally, 10 re-filed as CR2-022…031. **The CR2
   backlog is now the single truth about what is outstanding** — do not go
   reading round 1's tracker.
5. **Round-1 docs archived** to `archive/docs/`.

**38 tickets are already filed (CR2-001…038).** Read them before your session
starts. Several already name the session that owns them. A session that re-files
something already in the tracker has wasted its sitting — cross-reference the
existing ticket number instead.

### The concept audit — what's settled and what isn't

[`concept_audit.md`](concept_audit.md) exists because the `theme` field turned out
to be something an agent invented, not a feature the owner asked for — and it had
reached the code, the content, the tests, the CMS *and* the decision log as two
numbered decisions. It is the owner's ruling on which concepts are real.

- **§A (themes) is answered: NOT REAL.** Removal is done for the registries; check
  for residue in your territory.
- **§B is answered in practice** by the day's demolition, even though its blanks
  were never filled in: cards, invasions, events, dungeons, biomes and tiles are
  all deleted. **One §B item is *not* settled** — `nameRegistry.js` (B4) still
  exists and, like `areaSetRegistry.js`, is reachable only through the barrel
  `registries/index.js`, which makes it *look* used when nothing consumes it.
  Session 5 owns raising both.
- **§C (vocabularies nothing enforces — `tokenConstants`, the nine Token types,
  Rarity), §D (the "probably real" registry list), and §E (should the decision
  logs themselves be audited?) are UNANSWERED.**

**Therefore: if a session meets a concept covered by §C, §D or §E, it must ask
the owner rather than assume the concept is real.** This is the specific failure
`theme` demonstrated — a D-number in a decision log is not proof the owner wanted
it. Treat D-numbers attached to unaudited concepts as *suggestive*, not binding,
and say so in the ticket.

---

## Tooling — run it over your territory, don't read blind

Three commands, added 2026-08-18. Baselines in
[`tooling_baseline.md`](tooling_baseline.md). **Re-run them yourself** rather than
trusting the recorded numbers; earlier passes have gone stale within a day.

| Command | What it is | Which sessions, and what to do with it |
|---|---|---|
| `npm run lint` | ESLint, configured for *problems* not style (34 problems at `4d2980b`) | **Every session.** Filter the output to your territory's paths. This is objective 1's best mechanical detector: "assigned but never used" is what a half-wired feature looks like from the outside. CR2-036 already catalogues 34 sites — claim the ones in your territory off that ticket rather than re-filing them. |
| `npm run duplication` | jscpd copy-paste detector (12 clones, 0.44%) | **Sessions 2, 3, 4, 6, 7.** The number is low, so don't hunt clones for their own sake. What matters is a clone whose copies have **drifted** — that's how CR2-033 was found. For each clone in your territory, diff the copies and only file it if they differ or if the duplicated thing is a *rule* rather than markup. |
| `npm run cycles` | home-grown import-cycle map (0 dangerous cycles) | **Sessions 1, 3, 9.** The one result worth attention is the 16-module hero/inventory/equipment group held together by `GameState`'s two lazy imports — Session 1 (does rehydration belong in `GameState`?) and Session 3 (the cluster itself). Everyone else: this tool has already returned a clean answer; don't re-litigate it. |
| `node tools/reachability.mjs` | files nothing imports (66 of 232, mostly tests) | **Every session**, as a *candidate* list only. Non-test entries at `4d2980b`: `config/questConfig.js` (**new orphan, not yet ticketed — Session 4**), `registries/modifierPalette.js` and `registries/tokenConstants.js` (live via `cms/src` only, CR2-010), `systems/core/EventBatch.js` (kept deliberately, CR2-007), `ui/components/base/GICard.jsx` (CR2-038), `ui/components/base/GISurface.jsx` (CR2-035), `utils/RegistryUtils.js` (CR2-012). |

### ⚠ Three ways the reachability tool lies — read before deleting anything

*(Carried forward verbatim in substance from the findings doc. Every one of these
has already cost this project real time.)*

1. **It walks from `src/main.jsx` only**, so files used solely by **tests** report
   as unreachable. Deleting on its word broke the suite once during the cleanup
   (`RecruitSystem`).
2. **It does not know the CMS exists.** `cms/src` imports seven modules directly
   out of the game's `src/` (CR2-010). Two entries above are live *only* because
   of that. Nothing in the game reaches them and no game test covers them, so
   deleting them looks safe right up until the CMS breaks — and the CMS has no
   tests (CR2-006), so nothing would catch it.
3. **Searching for a filename is not the same as finding an import.** An earlier
   pass matched any quoted string containing the stem, including doc comments,
   and confidently cleared three live files as reachable. Match on an actual
   `from '…'` specifier, then confirm the exported *symbols* are referenced.

The reliable check is: grep `src/`, grep `cms/src/`, grep `src/tests/`, and check
the exported symbols — not the filename — before removing anything.

### ⚠ And one more the day proved: a barrel file hides orphans

`src/config/registries/index.js` re-exports everything, so a registry with zero
real consumers still shows as "imported". `nameRegistry.js` and
`areaSetRegistry.js` are in exactly this state right now. When a registry's only
importer is the barrel, treat it as unreached until proven otherwise.

---

## Test coverage — the standing warning *(updated by the re-scope)*

**41 tests were deleted during the cleanup rather than rewritten** (owner
decision), and 21 more are skipped. Every one is recorded in the **Retired Tests
Ledger** in [`cleanup_phase_brief.md`](cleanup_phase_brief.md), with what it
covered and a restore hint — many failed on *renamed* ids (`token_forest` →
`token_oak_forest`, `item_coal` → `item_charcoal`) and are restorable by
repointing an id rather than rewriting.

**So the green 840 is thinner than it looks**, and it is thinnest exactly where
the code is newest: cartographer, hero equipment, map burst, board loot, token
groups, market guard rails, charge badge.

**Owner's decision on timing: restore coverage *after* the review, before the fix
waves.** Rationale — the fix waves are what will actually change behaviour, and
they are the thing that needs a safety net under them. Sessions therefore should
**not** stop to write tests. What they should do is note, in any ticket whose fix
would be risky without coverage, that the Retired Tests Ledger has a relevant row.
Session 9 turns the ledger plus the sessions' notes into the coverage-restoration
plan.

Session 9 should also note what the harness fix makes newly possible: `vitest`
now compiles JSX like the real build, so React components can be rendered in
tests for the first time. UI coverage was not previously a choice.

---

## Current truth, for resolving "is this a bug or a decision?"

In this order:

1. [`CLAUDE.md`](CLAUDE.md) — project ground rules
2. The roadmap for the area you're in, plus its locked-decisions appendix:
   - Playmat 7×7 → `playmat_roadmap_v1.md`, `playmat_decisions.md`
   - Skill & Class → `skill_class_rework_roadmap_v1.md`
   - CMS v2 → `cms_rework_v2_roadmap.md`, `cms_rework_v2_decisions.md`
   - Hero Dock → the 12 locked hero-dock decisions (they override the concept doc)
   - Combat/SCB → `SCB_concept.md` (v2 is source of truth), `combat_formula_spec.md`
3. [`concept_audit.md`](concept_audit.md) — **and remember §C/§D/§E are blank.**
4. The concept docs those reference.

**Living trackers — check before filing, cross-reference instead of duplicating:**

- [`game_refinement_and_alignment_plan.md`](game_refinement_and_alignment_plan.md)
  — the in-progress refinement pass. ⚠ **Its item descriptions have repeatedly
  been stale.** Verify against code before treating any of it as truth, and never
  file a ticket merely because code disagrees with this doc.
- [`ui_bugfix_tracker.md`](ui_bugfix_tracker.md) — bug/UI-fidelity sweep log.

**Stale documentation warning:** the root still holds ~43 markdown files of mixed
vintage, many describing retired systems — the pre-playmat deck loop, the linear
12 areas, the hero bench, food/drink slots, packs as a shop, and now cards and the
authored quest pipeline. Do not treat them as truth and do not file tickets
because code disagrees with them. CR2-009 already covers this; Session 9 owns it.

**Known content hazard to verify, not assume:** an earlier CMS note warned that
"Sync to Game" destroyed unmodelled content. Phases 8–10 included Sync & Cutover,
so this *may* be resolved — Session 5 must confirm it either way rather than
inheriting the warning.

**Known data hazard:** legacy item ids and live `item_*` ids coexist; the legacy
ones can mask real data bugs. Always reproduce with `item_*` ids.

---

## Scoring *(inherited from round 1 — unchanged)*

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

## Session Plan *(re-drawn 2026-08-18 against the tree at `4d2980b`)*

Still nine sessions: four engine, one pipeline, two UI, one hands-on runtime, one
synthesis. **Every file path below was checked to exist**; the old plan cited a
dozen files that had been deleted, which is what made this re-scope necessary.

**Ownership rule, to stop two sessions owning the same file:**
everything under `src/config/registries/` belongs to **Session 5**. Other
sessions read registries freely, but file registry findings as stub tickets
tagged for Session 5 rather than working them.

**[JUDGEMENT CALL] Session 4 survives, shrunk and repurposed.** It was "Cards,
economy, inventory, quests & progression". Cards are gone entirely and half the
quest machinery with them, leaving about 2,100 lines — half a sitting. Rather
than delete the session or fold it into the already-dense Session 3, it keeps its
gameplay-services core and **takes over `src/utils/` and the loose `src/config/`
constants, which no session previously owned at all**. That closes a real gap
(the old plan left seven utility files unreviewed) and brings Session 4 back to a
normal size. The alternative — merging it into Session 3 — was rejected because
Session 3 is where two reworks converge and is the densest territory in the plan.

**[JUDGEMENT CALL] Sessions 6 and 7 were rebalanced.** The UI shrank from ~90
files to 60, but unevenly: under the old split Session 7 would have carried 53
files / ~10,000 lines while Session 6 carried 7 files. Session 6 now takes the
app shell and shared UI (which is also where the boundary sweeps naturally start);
Session 7 takes the three game surfaces — board, dock, drawer. Roughly 25 files
each. See the open question below if you'd rather split differently.

| # | Session | Territory *(all paths verified present at `4d2980b`)* |
|---|---|---|
| 1 | **State core & serialization** | `src/state/` (2 files: `GameState.js`, `StateSchema.js`) and `src/systems/core/` (15 files: `EventBus`, `EventBatch`, `GameLoop`, `EngineBootstrap`, `TimeManager`, `TimeBankManager`, `SaveManager`, `SaveMigration`, `SaveSlotHelper`, `SettingsManager`, `NotificationSystem`, `NotificationSubscriptions`, `AssetPreloader`, `DiscoveryManager`, `AudioSystem`). ~2,900 lines. **Objective 4 lives here.** Verify rehydration of each new save area from scratch. Note the save-schema version; it is deliberately decoupled from `package.json`. **Unchanged in size** — this territory survived the demolition intact. Already-filed: CR2-007 (EventBatch unwired), CR2-013 (dead card cache in `GameState`), CR2-016/020/021/022 (AudioSystem), CR2-023/024/025/026. |
| 2 | **Board engine (the 7×7 playmat)** | `src/systems/board/` — all 16 files: `BoardRunner`, `BoardState`, `Placement`, `adjacency`, `TileModifiers`, `TokenBank`, `TokenGroups`, `TriggerSystem`, `Cartographer`, `RecipeResolver`, `BlockUpkeep`, `BoardCombat`, `SpriteLayer`, `InputAllocator`, `Managers`, `boardEvents`. Plus `src/config/loopConstants.js`. ~4,600 lines — **the largest engine territory**. `tileRegistry.js` and `tokenConstants.js` are no longer on this list: the first is deleted, the second belongs to Session 5. **Grown in importance:** `BoardRunner`/`InputAllocator` now carry the work cycle the card era used to own, and were never reviewed in that role. Verify `boardEvents.js` documents what is actually published (objective 3), and start the tick-path allocation audit here. CR2-007 needs a ruling from this session: should `BoardRunner` open an event batch per tick the way `LoopRunner` did? |
| 3 | **Combat, heroes, skills & promotion** | `src/systems/combat/` (6: `CombatProcessor`, `CombatAttackProcessor`, `CombatResolutionProcessor`, `WoundedSystem`, `LootSystem`, `DefeatPenalties`), `src/systems/effects/` (5: `StatusEffectSystem`, `ModifierAggregator`, `EffectAxes`, `GuildModifiers`, `constants.js`), `src/systems/hero/` + `logic/` (11: `HeroManager`, `SkillSystem`, `PromotionSystem`, `HeroGenerator`, `RegenSystem`, `ConsumptionSystem`, `HeroLifecycle`, `HeroLookup`, `HeroRehydration`, `HeroRoster`, `HeroState`), `src/systems/equipment/` (2), `src/config/FormulaRegistry.js`, `src/utils/CombatFormulas.js`, `RetirementFormula.js`, `XPCurve.js`. ~4,300 lines. **Note the move:** the combat processors are no longer under `systems/cards/logic/` — they were rehomed to `systems/combat/`, and `WorkProcessor`, `StatProcessor` and `CardPreflight` were deleted. The fight object is `fight_${tile}`. Per locked decisions, crit/armor/speed were deferred and classes are cosmetic — don't file those as gaps. This session also owns the 16-module lazy-import cluster from `npm run cycles`. Already-filed: CR2-011 (silent loot failure), CR2-027, CR2-028, CR2-029. |
| 4 | **Gameplay services & shared utilities** *(was "Cards, economy, inventory, quests & progression")* | `src/systems/economy/` (4: `CurrencyManager`, `CommerceSystem`, `TransactionProcessor`, `InventoryGroupManager`), `src/systems/inventory/` (4: `InventoryManager`, `InventoryStore`, `InventoryFormatter`, `ItemRateTracker`), `src/systems/quests/` (2: `QuestManager`, `tutorialQuests`), `src/systems/progression/` (3: `ProgressionSystem`, `GuildUpgradeManager`, `RegistryManager`), `src/config/guildUpgrades.js`, `src/config/constants.js`, `src/config/questConfig.js`, and **`src/utils/`** (`AssetManager`, `CardManagerUtils`, `Formatters`, `Logger`, `RNG`, `RecruitCostCalculator`, `RegistryUtils`). ~3,000 lines. **Shrunk then refilled** — see the judgement call above. Specific starting points: `questConfig.js` has **zero importers anywhere** (new orphan, not yet ticketed); `CardManagerUtils.js` is named for a system that no longer exists — check whether its contents outlived it; `QuestManager.tick(deltaMs)` ignores `deltaMs` and reads the wall clock instead, which matters under time-bank fast-forward (CR2-036); CR2-012 (`RegistryUtils` orphaned). The quest system is now only `QuestManager` — `QuestBoardSystem` and `QuestTracker` are deleted, so CR2-015 (the inert procedural pool) is moot as written; confirm and close it. |
| 5 | **Content pipeline & the CMS boundary** | `data/` — `items.json`, `tokens.json`, `tokenRecipes.json`, `recipes.json`, `enemies.json`, `encounters.json`, `effects.json`, `maps.json`, `stations.json`, `subskills.json` — plus `data/schemas/` (3) and `data/templates/` (3). `src/config/DatabaseManager.js`. **All 23 files in `src/config/registries/`**, including the `index.js` barrel. `scripts/regenerate_game_package.js`, the sync route, and its three test suites. **Shrunk:** `data/quests.json`, `questRegistry`, `biomeRegistry`, `tileRegistry`, `tagRegistry`, `cardRegistry`, `invasionRegistry`, `eventRegistry` and `dungeonRegistry` are all deleted — do not look for them. **Central question: can content be silently lost or corrupted crossing the boundary?** Confirm the "Sync to Game destroys unmodelled content" hazard is closed. Also: schema/registry drift; id-space integrity (legacy vs `item_*`); what happens to a save when content ids change under it; whether `data/archive/cards/` should now be deleted. Barrel-only orphans `nameRegistry.js` and `areaSetRegistry.js` need an owner ruling (see `concept_audit.md` §B4) — `areaSetRegistry` currently loads **0 area sets** at runtime. Already-filed: CR2-001, CR2-002, CR2-004, CR2-005, CR2-010, CR2-014. |
| 6 | **UI ↔ engine boundary, shell & shared UI** | The boundary itself: `src/ui/hooks/` (4: `useGameState`, `useEngine`, `useUIModals`, `useDiscovery`), `src/ui/context/` (2: `EngineContext`, `ViewportContext`), `src/ui/ReactRoot.jsx`, `src/ui/dnd/` (3: `DndKit`, `DragGhost`, `dragConstants`). Then the shared UI: `src/ui/components/base/` (9: `GICard`, `GIModal`, `GISurface`, `ItemIcon`, `ParticleOverlay`, `Toast`, `ToastContainer`, `TokenSprite`, `VitalBar`), `src/ui/modals/` (6), `src/ui/components/nav/BubbleMenu.jsx`, `hud/TimeBankWidget.jsx`, `quests/QuestColumn.jsx`, `card-modules/LootModule.jsx`, `src/ui/utils/cn.js`, `src/ui/dev/cardSizeStore.js`, and the four dev surfaces: `components/TestDashboard.jsx`, `base/FPSCounter.jsx`, `dev/DevSpawnItemModal.jsx`, `sandbox/LayoutSandbox.jsx` — establish whether each is a tool the owner uses or shipping dead weight (`BoardStub` no longer exists). **Then the two sweeps across all of `src/ui/`:** the subscription-leak audit (every subscribe paired with an unsubscribe — round 1 found all 35 sites clean, but the UI has been rebuilt since) and the **mutation-from-UI sweep**, which after CR2-033 should be read as "does any component enforce a game rule?", not just "does any component write state?". Already-filed: CR2-030, CR2-031, CR2-034, CR2-035, CR2-037 (two live `useEngine` implementations — consolidate on the 13-importer one), CR2-038 (`GICard` renders nowhere). |
| 7 | **Game-surface components** | `src/ui/components/board/` (10: `Board`, `BoardTile`, `Tray`, `TrayMiniBoard`, `GuildHallBoard`, `ConnectionLines`, `SpriteLayerView`, `TileProgressBar`, `TokenInspectPopup`, `boardConstants`), `dock/` (7: `RightmostHeroDock`, `VerticalHeroDock`, `HeroDockCard`, `HeroDockTab`, `DockEquipmentGrid`, `DockSkillsGrid`, `dockConstants`), `drawer/` (10: `BottomFolderDrawer`, `BankTab`, `TokenVaultTab`, `CartographerTab`, `InspectionPanel`, `HeroInspectionSheet`, `TokenInspection`, `MapInspection`, `GuildUpgradeInspection`, `SellControls`), and `hero/HeroSkillSheet.jsx`. ~6,000 lines. **`TileProgressRing` and `BoardStub` no longer exist.** This is where objective 1 has the richest seam: `BoardTile`'s `ALERT_HINT` table of warning explanations that nothing reads, `BankTab` reading gold it never shows, `BottomFolderDrawer` accepting a card-size setting it never passes on, `GuildUpgradeInspection` taking an `onClose` it offers no way to trigger, `ParticleOverlay` ignoring the collected-count so 40 items look like 1 — all in CR2-036, all in this territory. Also render-storm risk and oversized mixed-responsibility files. Run `npm run duplication` here and check whether the three-way deposit clone (CR2-033, fixed) left any siblings. |
| 8 | **Runtime verification (hands-on)** | Not a reading session: run the dev server. Profile the tick path with the full 7×7 board active; take heap snapshots across a long idle to prove flat memory; **count React renders per tick, before and after wiring `EventBatch`** (CR2-007); verify asset preload coverage for the token/sprite content; exercise save/load roundtrips including a load into changed content. Then the objective-5 pass: **take the player-facing tickets from Sessions 1–7 and actually try them in the game.** Green tests have repeatedly coexisted with a broken game, and this session is where that gets caught. Specific outstanding checks: does combat audio play *by ear* now (CR2-016 was verified only by code path, and `masterVolume` defaults to 0 as a dev mute — raise the slider first); does the SFX pool still log `play() interrupted` at 10× time-bank speed (CR2-021). **Verification notes:** screenshots time out in this project — use `window.Game` / `window.GameState` probes instead; dynamic `import()` does not work in that console context; drag-and-drop is unreliable to simulate, so DnD findings need the owner's own eyes. |
| 9 | **Build, Tauri readiness & synthesis** | `vite.config.js`, `vitest.config.js`, `eslint.config.js`, `.jscpd.json`, bundle and asset audit (current: **864.77 KB JS** vs round 1's 1,036 KB; **`public/assets` is 11 MB** — CR2-008 is the real lever), dependency audit across both `package.json` files, `src-tauri/` config and the five-file version consistency check, persistence robustness for a desktop shell. Then the three synthesis jobs: (a) build the **coverage-restoration plan** from the Retired Tests Ledger plus the sessions' notes, ready for the owner to run *before* the fix waves; (b) file the standing CMS-solver-coverage ticket (CR2-006) and the documentation-archive ticket (CR2-009); (c) consolidate everything into the final prioritized action backlog. |

Sessions 1–7 can run in any order if needed, but the listed order builds the
system map bottom-up (state → engine → pipeline → UI). Session 8 requires 1–7's
tickets; Session 9 goes last.

---

## Owner rulings on the re-scope *(2026-08-18 — all five settled)*

The re-scope left five questions open. All are now answered; they are recorded
here so no session reopens them.

**Q1 — Session 4's shape: APPROVED as written.** It keeps economy, inventory,
quests and progression, and gains `src/utils/` plus the loose `src/config/`
constants, which no session owned before. Not merged into Session 3.

**Q2 — the Sessions 6/7 re-cut: APPROVED.** Session 6 takes the UI↔engine
boundary plus the app shell and shared components; Session 7 takes the three game
surfaces (board, dock, drawer). Roughly 25 files each. The old cut would have put
53 files and ~10,000 lines into one sitting.

**Q3 — the concept audit's open sections: ANSWERED DIRECTLY, not deferred.**
- **Token types**: all nine stay, as *descriptive labels*. The owner's words:
  they "describe what a token does… the actual utility of the tokens is
  determined elsewhere". **Do not delete `tokenType`** — four engine paths branch
  on it (`BoardCombat.js:71`, `RecipeResolver.js:230`, `TileModifiers.js:99`,
  `QuestManager.js:164,175`), so the labels are partly load-bearing whatever the
  intent was.
- **Rarity**: real, but essentially cosmetic — a signal that a drop is more
  valuable, **not** connected to drop chance. It drives sell value
  (`TokenBank.js:172`) and the one-Mythic-placed rule (`Placement.js:43`). The
  false "drop frequency and nothing more" comment was corrected on 2026-08-18.
- **Traits and classes**: both retired — traits are gone, classes are replaced by
  jobs. Deleted. A perk/upgrade system may arrive later; that is a future
  feature, not a reason to keep the old code.
- **Area sets**: retired and deleted (it was loading nothing).
- **§E, auditing the decision logs**: no deeper audit. Entries tied to retired
  concepts get struck as those concepts are removed, which is already happening.

**Q4 — performance: RESTORED as a standing objective** *(owner overruled the
re-scope's recommendation)*. Every session watches for performance problems in
its own territory; Session 8 still owns measurement. The re-scope argued round 1
measured 0.09ms against a 5ms budget so there was no evidence of a problem — the
owner's call is that cheap insurance is worth it, particularly with the 7×7 board
being the one thing that has changed since that measurement.

**Q5 — the four dev surfaces: KEEP, they are intentional tooling.** Verified
2026-08-18: `TestDashboard` and `FPSCounter` render only behind
`(import.meta.env.DEV || debugMode)` in `ReactRoot`, `DevSpawnItemModal` renders
only from `TestDashboard`, and `LayoutSandbox` opens only via a
`dev:toggle-sandbox` event published from that dashboard. They are in the bundle
but never render in a normal production build. **No session should propose
deleting them.**

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
>    me which session is next and what territory it covers. **Read the existing
>    CR2 tickets for that territory before you start** — 38 are already filed and
>    re-discovering one wastes the sitting.
> 4. Confirm the working tree is clean and note the current branch and commit.
>    Other chats may share this checkout.
> 5. Run the tooling the guide assigns your session over your territory's paths,
>    rather than reading blind.
> 6. Skim the findings and system-map notes from prior sessions so you have the
>    holistic picture before diving into your territory.
>
> Then **stop and confirm the session scope with me** before starting. I don't
> code, so report findings in plain language. Remember: this is a review
> session — file tickets, don't change game code. If you hit a concept
> `concept_audit.md` hasn't ruled on, ask me rather than assuming it's real.
> When the session's territory is covered, update the Session Status table, give
> me a plain-language summary of what you found, and commit the findings doc.
