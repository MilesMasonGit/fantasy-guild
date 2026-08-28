# Economic Simulator — Implementation Roadmap v1

> **Status:** v1, authored 2026-08-28. The build plan for the design in
> [`economic_simulator_plan_v1.md`](economic_simulator_plan_v1.md) (v1.3, approved).
> **The plan is the design authority — this document only sequences it.** Where
> this roadmap and the plan disagree on *what* to build, the plan wins; where they
> disagree on *when* and *in what order*, this document wins. The plan's §19
> (decisions CMS-117–137) and §21 (22 owner rulings) are settled — do not
> re-litigate them, and do not "improve" on them while implementing.
>
> **Style and ground rules follow
> [`recipe_and_charges_roadmap_v1.md`](recipe_and_charges_roadmap_v1.md)**, this
> project's proven shape: numbered phases sized to one sitting each, every phase
> verifiable end to end on its own, committed on `main` when green, logged in
> `CHANGELOG.md` under `## [Unreleased]`. There are ten phases where the plan's
> §17 sketched seven sittings: the plan's sittings 1 and 3 each split in two
> (§4 explains why at each split), and the decision transcription is its own
> Phase 0 per the kickoff brief.
>
> **Read §2 before writing any code.** This roadmap was written against the real
> tree on 2026-08-28, and §2 records where the code differs from what the plan or
> the brief implies — including one live bug (every item currently sells for 1g)
> and one live D-176 violation (the old solver rewrites charges). This project's
> documented failure mode is docs drifting from code; §2 is the drift audit for
> this rework, and each phase below names which of its findings it consumes.

---

## 1. Rules of engagement

1. **No design decisions are made during this rework.** CMS-117–137 (plan §19)
   and the 22 interview rulings (plan §21) are the complete design. If a phase
   uncovers a genuine contradiction or impossibility, stop and ask the owner —
   as labelled multiple-choice options with a recommendation first, in plain
   language. Do not quietly design around it.
2. **`npm test` stays green at every phase boundary.** A phase that needs a
   test changed changes it *inside* the phase, with the reasoning recorded.
3. **Anything player-visible is verified in the running game**, not just in
   tests. Screenshots of the game time out in this environment; verify with
   `window.Game` / `window.GameState` probes instead (see the project memory on
   browser verification). The CMS is its own Vite app — run it from `cms/` with
   its own `npm run dev` and exercise it by hand in the browser.
4. **One phase per sitting, committed on `main` when verified.** Tag `v0.6.0`
   when Phase 9 lands; the five version files bump together at that point, not
   per phase.
5. **Do not calibrate anything to existing content** (brief §9, acceptance
   criterion 10). The current data — 39 Tokens, 18 items, 7 Maps, 3 recipes —
   is placeholder and sparse. It is the test *substrate*, never the test
   *oracle*: curves and dials come from the plan's §13/§14, and a number that
   "looks wrong" against today's content is not evidence of a bug.
6. **Comments in this codebase are not trustworthy** (Code Review Round 2: eight
   cases of fabricated rationale). Verify against code and tests, including
   against this document — and when a phase changes behaviour a comment
   describes, rewrite the comment in the same commit.

---

## 2. What the code actually says — the drift audit

Findings from reading the tree on 2026-08-28. Each is numbered so the phases
can cite them.

| # | Finding | Consumed by |
| :--- | :--- | :--- |
| **S1** | **The old solver is live and wired.** `recalculateEconomy` (`cms/src/stores/useEntityStore.js:666`) runs `runFullBalance` (`cms/src/engine/balanceRunner.js`) — the struck CMS-109–116 engine: `valuePropagator`, `tokenSolver`, `xpSolver`, `chargeSolver`, `combatLootSolver`, with `anchorCalculator`, `evCalculator`, `velocityCalculator` behind them. Both the TopBar Recalculate button and `syncToGame` (`cms/src/engine/fileUtils.js:67`) call it. It cannot be deleted until the new engine can stand in for it. | P5 |
| **S2** | **The old solver violates D-176 today.** `balanceRunner.js:124-141` computes and rewrites Token `charges` from Map ROI (the struck CMS-114). Retiring it is a correctness fix, not just a replacement. | P5 |
| **S3** | **The recipe-sync bypass is exactly as the handoff describes.** `cms/src/engine/recipeSync.js` flattens store `recipePools` past the economy pass, and `src/tests/RecipeSyncRoundTrip.test.js` pins the byte-identical round trip — *including* the nine EV fields. When the EV fields die (plan §16), that test is deliberately rewritten, not deleted: its new job is "authored intent survives sync byte-for-byte; derived fields are regenerated". | P5 |
| **S4** | **Every item sells for 1g — a live bug the plan's CMS-132 will fix in passing.** `CommerceSystem.getItemPrice` (`src/systems/economy/CommerceSystem.js:23`) reads `item.baseValue \|\| 1`, and no item in `data/items.json` carries `baseValue`. The items carry `value` (currently `null`), `trueCost` and `sellPrice` instead. Wiring the sell path to the derived `value` implements CMS-132 (Bank sells at full derived value) and fixes the bug in one move. | P5 |
| **S5** | **Token scrap prices are a flat rarity table, not derived.** `TokenBank.sellValue` (`src/systems/board/TokenBank.js:202`) reads `SELL_VALUE[def.rarity]` — no per-Token scrap value exists in the game. The sim's Price pass writes Token scrap values (plan §4); the game must gain a reader for them. | P7 |
| **S6** | **The live charge pool is `uses`, not `charges`.** Tokens in `data/tokens.json` carry *both fields with different values* (the Recipe & Charges roadmap's P0 hazard, still unresolved); the runtime reads `uses` via `tokenStartingUses`. Every lifetime calculation in the sim must resolve charges the way the game does, or the productive-value maths silently uses the dead field. 14 of 39 shipped Tokens are unlimited (`uses` null/absent). | P4, P7 |
| **S7** | **Burst code confirmed: 3–5 draws, no composition guarantee.** `BURST_MIN = 3` / `BURST_MAX = 5` (`Cartographer.js:56-57`), free weighted draws in `rollBurst` (`Cartographer.js:280`), comment claims "3–6 (D-167)". Both wrong under CMS-129. Existing tests: `src/tests/Cartographer.test.js`, `src/tests/MapBurst.test.js`. | P1 |
| **S8** | **`TOKEN_RARITIES` is four tiers** (`src/config/registries/tokenConstants.js:85`), imported live by the CMS across the project boundary (CMS-5), with `src/tests/CMSBoundary.test.js` guarding the exports. Adding `epic` flows into the CMS dropdown with no CMS change. | P2 |
| **S9** | **The 30-second wall is `ContentRules.test.js` Rule 4** (lines 222–234): hard 10,000–30,000ms on every running Token's `config.cycleTimeMs`. | P2 |
| **S10** | **Worker speed is real and live**: `SKILL_SPEED_FACTOR = 0.005` (`src/config/FormulaRegistry.js:18`), applied at `BoardRunner.js:553`. ⚠️ The doctrine comment at the head of that same file (`BoardRunner.js:62-66`) still claims hero level does not affect speed — stale, and exactly the fabricated-rationale hazard. Fix the comment when first touching board systems. | P1 |
| **S11** | **Items' legacy value fields are safe to migrate.** `trueCost` is read only by `src/tests/CMSBalanceEngine.test.js` (which dies with the old engine); `sellPrice` on items.json is read by nothing (`QuestManager` uses its own hardcoded list). `value` and the new `valueSource` can replace both. | P5 |
| **S12** | **Enemy pool entries are a paper shape today.** No shipped Map pool contains an enemy or raw-item entry, and `data/enemies.json` (4 enemies, `drops[]` with itemId/qty/chance) is **not loaded by the CMS store** — `recalculateEconomy` passes no enemies. The Map check (plan §7, CMS-128) needs a read path for enemies before it can value one; investigate at the start of P7, including how an enemy's charge count is expressed. | P7 |
| **S13** | **Sim-engine tests live in the game's suite by precedent.** The CMS has no test runner of its own; `src/tests/CMSBalanceEngine.test.js` already tests CMS engine code across the boundary. New engine tests follow that pattern as `src/tests/EconSim*.test.js`. | P3–P9 |
| **S14** | **The dial store is `cms/src/stores/useGlobalStore.js`**, persisted (`fantasy-guild-cms-globals`, version 1, with a `migrate`). New dials mean a version bump and migration, not a silent shape change. Note the wrinkle: CMS-127's cost line says the Map pins and craft margin "ship unset and required", while the later CMS-137 ships every owner dial pre-set at the interviewed values and explicitly rejects blankness. **CMS-137 wins on shipped values** — transcribe both as written in P0, implement 137. | P5 |
| **S15** | **No shipped recipe outputs a Token** (CR2-199 confirmed — the 3 shipped recipes output items only), so the Token-output refusal (CMS-128) and the downcycle path (CMS-130) will be fixture-proven only, like the Recipe rework's tool tiers. Named here so nobody mistakes fixture-proven for untested. | P4, P9 |

---

## 3. Foundations already in place

Verified in the tree — extension points, not new builds.

| Need | Already exists |
| :--- | :--- |
| Audit rows with severity, sorting, click-through | `cms/src/components/audit/AuditPanel.jsx` (CMS-74 shape) |
| On-demand recalc entry point + button | `recalculateEconomy` in `useEntityStore.js`, TopBar button (CMS-16) |
| One-way full-file sync, four files | `syncToGame` (`fileUtils.js`), `syncFiles` (`recipeSync.js`) (CMS-53) |
| Live vocabulary import game→CMS, with a boundary guard | CMS-5 machinery; `CMSBoundary.test.js` |
| Shared per-output I/O editor (min/max, chance, token outputs) | `cms/src/components/shared/IOEntryList.jsx` (Recipe rework P6b) |
| Chance snapping prior art (10 → 5 → 1%) | `cms/src/engine/taskSolver.js` — port the snapping in P6, then delete the file |
| Worker-speed formula in one place | `src/config/FormulaRegistry.js` (`SKILL_SPEED_FACTOR`) |
| Charge semantics (live pool, unlimited, starting uses) | `tokenStartingUses`, `usesRemaining`, `src/systems/board/Charges.js` |
| Burst tests to extend | `src/tests/Cartographer.test.js`, `src/tests/MapBurst.test.js` |
| XP threshold curve (for the XPH curve maths) | the game's `floor(l + 300·2^(l/7))/4` cumulative curve (plan §8) |

---

## 4. Phases

Dependency spine: **P0 and P1 are independent openers** (do P0 first — it is the
kickoff brief's named first task). **P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9** is
strict. P1 must land before P7 (the Map check reads the burst constants live).

| # | Phase | One line | Depends on |
| :--- | :--- | :--- | :--- |
| **P0** | Decisions transcribed | CMS-117–137 into the log, in house style | — |
| **P1** | Burst rules in the game | Exactly 3, first slot always a Token (CMS-129) | — |
| **P2** | Vocabulary + intent schema | Tags authorable; `epic`; tempo bands; 30s rule relaxed | — |
| **P3** | Time + anchors, report-only | Passes 1–2, elections reviewable before anything writes | P2 |
| **P4** | Pricing pass, engine-only | Pass 3 pure and tested, not yet wired | P3 |
| **P5** | The cutover | Recalculate runs the new engine; old engine deleted; EV fields die; items sell right | P4 |
| **P6** | Lever policy + refusals | Pass 4, audit cards, churn report | P5 |
| **P7** | Map economics | Pass 5, derived weights, scrap, two-sided check, Map table | P5, P1 |
| **P8** | XP + pacing | Pass 6 (well, §8): XP derivation, curves, "day in reach" | P5 |
| **P9** | Polish + guards | Sticky-anchor UX, progression guard, adversarial set | P6–P8 |

---

### P0 — Decisions transcribed (the kickoff's first implementation task)

**Docs only; no code.** One sitting.

- **`cms_rework_v2_decisions.md`**: append **CMS-117 through CMS-137** exactly as
  the plan's §19 states them, in house style (claim first, *Rejected:*, *Cost:*,
  supersessions named). Re-point **CMS-107**'s note from "once the plan is
  approved" to the landed CMS-117+. Strike **CMS-45** in place with a pointer to
  CMS-119, and **CMS-54** with a pointer to CMS-124, per house style
  (struck-through, never deleted).
- **`playmat_decisions.md`** (or wherever D-167 is recorded — it appears in
  several playmat docs): annotate **D-167** as superseded on burst size by
  CMS-129. Annotate, don't rewrite history.
- Note the S14 wrinkle in the transcription commit message: CMS-127 and CMS-137
  are both transcribed as written; CMS-137 governs shipped dial values.
- **Verify:** read-back against plan §19 (21 decisions, none paraphrased into
  something weaker); `npm test` untouched and green. **CHANGELOG** entry; commit.

### P1 — Burst rules in the game (CMS-129) — consumes S7, S10

The plan filed this as its own game-side task; it is independent of everything
CMS-side and player-visible on day one.

- **Game half** (`src/systems/board/Cartographer.js`):
  - A burst is **exactly 3**: replace the `BURST_MIN`/`BURST_MAX` random count.
    Keep exported constants the Map check can read live (plan §7) — e.g.
    `BURST_SIZE = 3` — rather than burying a literal.
  - **Slot one draws over the pool's Token entries only**, weights renormalised
    among them; slots two and three stay free weighted draws over the whole
    pool. A pool with no Token entries falls back to free draws (and P7's check
    will warn on such a pool; don't crash here).
  - Rewrite the "3–6 things (D-167)" comments to name CMS-129. Do not touch the
    Guild Hall scripted-sequence branch.
- **In passing** (S10): correct the stale `BoardRunner.js:62-66` doctrine
  comment — worker speed is live (`SKILL_SPEED_FACTOR`), Access is not the only
  hero effect anymore. Comment-only change, same commit, per rule §1.6.
- **Tests**: extend `MapBurst.test.js` / `Cartographer.test.js` — burst length
  is always 3 across seeded runs; first entry is always `kind: 'token'` on a
  mixed pool; renormalisation keeps relative Token weights; token-less pool
  doesn't hang or crash.
- **Verify in game**: `npm run dev`, buy and open a Map, probe the burst via
  `window.Game`/`window.GameState` — 3 things, at least one Token, several runs.
- **CHANGELOG**; commit.

### P2 — Vocabulary and intent schema (plan sitting 1) — consumes S8, S9

Content becomes taggable; the game's behaviour is unchanged.

- **Game half:**
  - `src/config/registries/tokenConstants.js`: `epic` joins `TOKEN_RARITIES`
    between `rare` and `mythic`. The CMS dropdown picks it up via CMS-5 (S8);
    check `CMSBoundary.test.js` stays satisfied.
  - **New** `src/config/registries/tempoBands.js`: the §13.3 band table (four
    tempos, scaled ×(1 + level/70)), plus `bandFor(tempo, level)` and
    `isInBand(cycleMs, tempo, level)`. Game-side so the CMS imports it live
    (CMS-5) and `ContentRules` can read it — add it to the boundary guard.
  - `src/tests/ContentRules.test.js` Rule 4 relaxed (S9): a Token whose
    `sim.tempo` is authored is checked for **tempo-band membership at its
    required level**; a Token not yet tagged keeps the legacy 10–30s check.
    That split keeps the suite green through the re-authoring window instead of
    forcing a big-bang tagging pass.
- **CMS half:**
  - `TokenEditor.jsx`: the Simulator Panel's "You set" half begins — Tempo
    (four buttons), Purpose (three, with the plan's one-line meanings), Rarity
    dropdown gains `epic` automatically. Writes `sim.tempo` / `sim.purpose` on
    the token.
  - `RecipeEditor.jsx`: the same Tempo/Purpose controls, plus the
    **`downcycle`** flag (plain-language caption: "a return leg — breaks things
    back into ingredients; priced by the recovery dial, never an anchor").
  - `IOEntryList.jsx` (shared, so both editors get it): per-output **intent**
    fields — `baseQty {min,max}` (a metronome authors min = max), `variable`,
    and the **`anchor`** flag ("this sets the item's value") with the plan's
    F9 caption. Existing minQty/maxQty/chance columns become visibly the
    *derived* side (read-only styling lands with P5's write-back; for now they
    still work as before — the old engine is still live).
- **Schema note:** intent fields are additive and optional; nothing reads them
  yet. The game is byte-for-byte unaffected.
- **Tests:** band table sanity in a new `src/tests/EconSimTempo.test.js`
  (bands ordered Fast<Medium<Slow<Heavy at every level, scaling monotonic,
  membership function agrees with the table); ContentRules both branches
  (fixture: one tagged, one untagged token).
- **Verify:** CMS by hand — tag a token and a recipe, reload, tags persist;
  `epic` appears in the rarity dropdown; `npm test` green.
- **CHANGELOG**; commit.

### P3 — Time + anchors, report-only (plan sitting 2) — consumes S13

The first two passes of the assembly line, with a read-only report — the
checkpoint where the developer reviews elections on real authoring **before
anything writes** (plan §17.2).

- **Engine half** — new directory `cms/src/engine/sim/`:
  - `tempoPass.js`: resolve every tagged Token/Recipe to a cycle time — middle
    of its band, snapped to whole seconds (plan §3.1); units/hour arithmetic
    including `speed(L) = 1 + 0.005 × L`, reading `SKILL_SPEED_FACTOR` from
    `FormulaRegistry.js` rather than duplicating the constant.
  - `anchorPass.js`: election per item — lowest-level source, ties to commoner
    rarity, Token before Recipe; explicit `anchor` flag overrides; passive and
    deferred kinds never anchor; downcycle recipes never anchor (CMS-119,
    CMS-130). Stickiness: an existing election (read from the item's
    `valueSource`) is kept, and a would-be-different winner becomes an Info row
    (plan §3.2). Orphan and deferred-only items become Critical rows (CMS-86).
  - `simRunner.js`: orchestrates the passes; for now returns
    `{ cycleTimes, elections, rows }` and **writes nothing**.
- **CMS half:** a "Sim preview" surface — simplest honest version: a TopBar
  action that runs the two passes and feeds the rows (Info/Critical) into the
  existing `AuditPanel`, plus a small report listing each item → elected anchor
  with the reason ("lowest level (1) · common · Token"). No store writes.
- **Tests** (`src/tests/EconSimAnchors.test.js` + additions to the tempo file,
  per S13): election rule and each tie-break; the override flag; passive
  exclusion; sticky election kept + Info row emitted; orphan → Critical;
  deferred-only → Critical; cycle time = band middle, whole seconds.
- **Verify:** run the CMS on the real workspace, read the elections for all 18
  items, sanity-check a handful by hand against the rule. `npm test` green.
- **CHANGELOG**; commit.

### P4 — Pricing pass, engine-only (first half of plan sitting 3) — consumes S6, S15

The plan's sitting 3 ("pricing, write-back") is two sittings here: the pricing
maths deserves its own tested landing before anything overwrites data. The
split point is natural — P4 is pure functions, P5 is wiring and deletion.

- **Engine half** (`cms/src/engine/sim/pricingPass.js`):
  - Topological walk over the recipe graph; genuine cycles → the Recipe-cycle
    Critical refusal naming both recipes; `downcycle` recipes stand outside the
    walk (CMS-130).
  - Root anchors: target = GPH curve × purpose factor; the two-neighbour
    integer trial; residual recorded for P6's levers (until P6 lands, an
    unclosed residual is a Warning row, not a silent pass).
  - Multi-output anchors: inherited-value outputs contribute; remainder split
    inversely proportional to abundance (plan §3.3).
  - Crafted anchors: inputs + purpose profit, floored at inputs × (1 + margin);
    floor-engaged → Info row (CMS-122).
  - Downcycle pricing: output value capped at recovery ratio × input value,
    quantities derived to fit (CMS-130).
  - Token-output recipes → the deferred-shape Critical refusal (CMS-128, S15 —
    fixture-proven only, and that's fine).
  - Token scrap values and lifetime arithmetic **resolve charges the way the
    game does** (S6): the live `uses` pool via the same helper
    (`tokenStartingUses` semantics), never the dead `charges` field.
  - GPH curve: pinned points from plan §13.1, interpolated; purpose factors and
    craft margin read from a dials object (the store schema itself lands in P5 —
    P4 takes dials as a plain argument with §13.6/§14 defaults).
- **Tests** (`src/tests/EconSimPricing.test.js`): a worked single-output anchor
  (the brief's 540-units/hour example lands on a neighbour integer); a
  multi-output split fixture (Trout-Stream shape); a four-step chain showing
  margin compounding matches §6's ×1.75-at-15% arithmetic; downcycle cap holds
  and never anchors; cycle refusal fires and names both recipes; token-output
  refusal fires; **idempotence** — running the pass twice on identical input is
  byte-identical (plan §11).
- **Verify:** `npm test` only — deliberately nothing player-visible yet.
- **CHANGELOG**; commit.

### P5 — The cutover (second half of plan sitting 3) — consumes S1, S2, S3, S4, S11, S14

The biggest phase, but one coherent act: the new engine takes over, the old one
leaves, and the data migrates. Everything here is the *removal* of machinery P4
already replaced — nothing new is designed.

- **CMS half:**
  - `recalculateEconomy` (`useEntityStore.js`) runs `simRunner` —
    time → anchors → pricing (tuning is a stub until P6: out-of-band non-anchors
    become Warning rows, untouched). It writes back: items' `value` (integer) +
    `valueSource`; tokens' `config.cycleTimeMs` + per-output
    `minQty`/`maxQty`/`chance` (from intent; the derived shape the game already
    reads — plan §16); recipes' `durationMs` and output fields likewise. XP is
    **not** written until P8 — authored `xp` passes through untouched.
  - **Old engine deleted** (S1, S2): `balanceRunner.js`, `valuePropagator.js`,
    `tokenSolver.js`, `xpSolver.js`, `chargeSolver.js`, `combatLootSolver.js`,
    `anchorCalculator.js`, `evCalculator.js`, `velocityCalculator.js`, and
    `mockBattle.js` if nothing else holds it. `taskSolver.js` **survives until
    P6** (its chance-snapping is ported there, then it dies).
  - **The recipe bypass retires** (S3): recipes flow through the economy pass
    like everything else; `recipeSync.js`'s pool-flattening moves into the sync
    payload builder or `simRunner`; the "recipes bypass the economy pass"
    doctrine comment goes with it.
  - **Dial store** (S14): `useGlobalStore` version 2 with the §14 dial set under
    one key, shipped at CMS-137's owner values (Map pins 10×/1.5×, scrap 40%,
    margin 15%, purpose factors 1.0/0.35/0.10, recovery ratio, band widths,
    non-anchor ×2, rarity weights, assumed lifetime 16h, hours/day 8, training
    loss cap 25%). Migration from v1 fills defaults. Dashboard UI for them
    arrives progressively (P6–P8); this phase just makes them real and read.
- **Data migration** (a script or a careful hand-edit, tested either way):
  - `data/tokenRecipes.json`: the nine EV fields deleted; `isPrimarySource:
    true` → the new `anchor` intent flag, deleted otherwise (plan §16).
  - `data/items.json`: `value` becomes the derived integer; `valueSource`
    added; `trueCost` and `sellPrice` removed (S11 — nothing reads them).
- **Game half** (S4): `CommerceSystem.getItemPrice` reads the item's derived
  `value` (fallback 1 for safety) — CMS-132's "Bank sells at full derived
  value", and the 1g-everything bug dies.
- **Tests:** `CMSBalanceEngine.test.js` retired with the engine it tests;
  `RecipeSyncRoundTrip.test.js` **rewritten, not deleted** (S3): authored
  intent fields round-trip byte-identical, derived fields match a fresh solve.
  New `ContentRules` assertions (plan §16): every item has a `valueSource`;
  derived fields match a fresh solve (the drift alarm). A CommerceSystem test:
  selling yields the derived value.
- **Verify end to end:** `npm test` green. CMS: Recalculate on the real
  workspace, read the churn by eye, Sync, `git diff data/` and check the four
  files are sane (values integer, intent preserved, EV fields gone). Game:
  `npm run dev`, produce and sell an item, gold received = derived value
  (probe via `window.GameState`).
- **CHANGELOG**; commit. *This is the "priced economy from tags" checkpoint —
  the tool's core value exists from here.*

### P6 — Lever policy + refusals + churn (plan sitting 4)

- **Engine half** (`cms/src/engine/sim/tuningPass.js`, replacing P5's stub):
  the CMS-120 policy verbatim — band first (non-anchors ×2, judged on the
  source's *total* profit/hour), then quantity-range midpoint (spread
  preserved, half-unit EV steps), then authored-variable chance (10/5/1
  snapping ported from `taskSolver.js`, 5% floor on primaries — then **delete
  `taskSolver.js`**), then cycle time within band; one lever at a time; >3×
  refuses — except IPH quantity moves, uncapped but filing a Warning past 3×.
  Anchor integer residuals close through the same levers (plan §3.3). Purpose
  mismatch across an item's sources → standing Info row (F3). Training-loss
  cap on XPH non-anchor recipes (CMS-122).
- **Refusals** (`cms/src/engine/sim/refusals.js`): the §12 catalogue as
  structured cards — what / why in game terms / ranked remedies — feeding the
  existing `AuditPanel` severities. Every refusal names tags and dials, never
  numbers (the §12 legibility test is an acceptance criterion for this phase's
  review, not decoration).
- **Churn report**: after every Recalculate — values changed count, largest
  movers, Tokens re-tuned, new/cleared refusals. Store the last report
  (CMS store/globals per plan §16); render it in the Dashboard zone.
- **CMS half:** Simulator Panel "the sim answered" grows: tuning shown as a
  diff ("range 1–3 → 2–4"), the earn gauge (dot in a bracket), inline refusal
  cards; stale-since-edit badge (plan §15.1).
- **Tests** (`src/tests/EconSimLevers.test.js`): each lever in isolation; the
  order; one-lever-at-a-time; the 3× refusal; the IPH exemption + its Warning;
  the doubled band forgiving an inheritor untouched; a 100%-chance output never
  made random (the firm brief §5 rule); training-loss cap refusal; churn report
  counts against a scripted edit.
- **Verify:** CMS on real content — author a deliberate second source for an
  already-anchored item, Recalculate, watch it land in band via one legible
  lever move or refuse with usable remedies; churn report matches what
  happened. `npm test` green.
- **CHANGELOG**; commit.

### P7 — Map economics (plan sitting 5) — consumes S5, S6, S12, and needs P1

- **Open with the S12 investigation** (timeboxed): how enemy pool entries and
  `data/enemies.json` reach the sim — the store loads no enemies today, and an
  enemy's "charges" needs locating. If the answer requires a design choice the
  plan doesn't cover, stop and ask (multiple choice) rather than inventing.
- **Engine half** (`cms/src/engine/sim/mapPass.js`):
  - Derived **pool weights** from the global rarity table (CMS-124; §13.4
    values); `data/maps.json` entry `weight` becomes sim-written on sync.
  - **Scrap allocation**: aggregate first (Map cost × scrap ratio), allocated
    by `weight^(−premium)` (CMS-48/103); raw item entries contribute at item
    value and stand outside the allocation, item-heavy pools → Warning (F10);
    enemy entries valued at CMS-51 lifetime loot and band-checked against
    their slice (CMS-128); unlimited Token in an ordinary pool → Warning
    (CMS-131).
  - **Two-sided check**: expected burst scrap vs the scrap bound, expected
    productive value vs the return bound — pins interpolated over the Map's
    derived level (pool-share-weighted mean of entry requirements); slot-one
    Token renormalisation read from P1's live constants, never hardcoded 3.
    Violations are refusals with the §12 remedies; nothing auto-adjusts a Map.
  - Lifetime hours via the live `uses` pool (S6); unlimited via the
    assumed-lifetime dial.
- **CMS half:** the Dashboard's **Map table** — one row per Map: derived level,
  cost, scrap side vs bound, productive side vs bound, pass/fail; computed pool
  shares on the Map screen; dial editors for the two pin-pairs, scrap ratio,
  premium, rarity weights. `MapEditor.jsx`'s weight column goes read-only-derived.
- **Game half** (S5): the sim's per-Token scrap value lands in token data;
  `TokenBank.sellValue` reads it, falling back to the `SELL_VALUE` table for
  tokens that lack one (safety through the re-authoring window). Partial-charge
  proration (`copySellValue`) is untouched.
- **Tests** (`src/tests/EconSimMaps.test.js`): allocation sums exactly to the
  scrap budget; premium dial travel (0 = flat, 1 = hard inverse; 0.8 matches
  §13.4's column); burst expectation uses slot-one renormalisation and the live
  constant; item-heavy Warning; unlimited-in-pool Warning; enemy band check on
  an S12 fixture; two-sided verdicts flip when a pin dial moves.
- **Verify:** CMS — Map table verdicts on the 7 shipped Maps read sensibly
  (they are placeholder content, so *refusals are expected* — what must be true
  is that each refusal's remedy line makes sense). Game — sell a rare token,
  price reflects derived scrap (probe).
- **CHANGELOG**; commit. *Criterion 5 demonstrable here.*

### P8 — XP + pacing (plan sitting 6)

- **Engine half** (`cms/src/engine/sim/xpPass.js`): XP per cycle = XPH curve ×
  purpose XP factor × cycle hours, rounded, min 1 (CMS-123); the XPH curve
  compounding at 7.5%/level from ~700, stored as pins like the GPH curve; the
  min-1 wobble documented in-code as accepted (F8). Written to `config.xp` /
  recipe `xp` — the fields the game already awards from.
- **CMS half:** the Pace dial group surfaces (earn curve pins, mastery time,
  hours/day) — pin editors over a drawn curve (a simple SVG polyline with
  draggable points, or numeric pin rows if dragging fights the sitting: the
  *dial*, not the flourish, is the deliverable); the **"estimated day in
  reach"** line per Map (Map price vs projected income at hours/day), and the
  ladder of those dates in the Map table — the game's pacing on one screen.
- **Tests** (`src/tests/EconSimXP.test.js`): curve interpolation matches
  §13.2's table points; a focused-skill integration sum lands ~50–60 hours to
  99 at defaults (assert a band, not a point); purpose seesaw (XPH trains ~3×
  GPH at equal level per the factors); min-1 floor; day-in-reach arithmetic.
- **Verify:** game — work a re-derived Token, XP awarded per cycle matches the
  data (probe); CMS — day-in-reach ladder reads plausibly against CMS-123's
  "top tier ~day 30" intent (again: placeholder Maps, so judge the arithmetic,
  not the content).
- **CHANGELOG**; commit.

### P9 — Polish + guards (plan sitting 7)

- **Sticky-anchor UX**: the anchor-candidate Info row gains its one-click
  re-elect (re-runs the chain and reports churn) and dismiss (plan §3.2).
- **Progression guard**: anchor-band ceiling at L below the floor at L+10
  everywhere, as a check-pass refusal aimed at the dials (F1 — anchor bands
  only, the non-anchor seam overlap is accepted and documented).
- **Chain inspector** grows from P5's minimal version to the sentence-trail of
  §15.2; Dashboard captions and the printed dial interactions (§14).
- **Hours-first charge display** (CMS-135): the lifetime line on the Simulator
  Panel ("lives ~3.1h · returns ~14× its find cost") with the soft outlier Info
  rows (Common over ~a day; anything under ~10 minutes).
- **Adversarial content set** (criterion 2's second half): a fixture workspace
  — a recipe cycle, an orphan item, a token-output recipe, a downcycle chain, a
  deferred-only item, an extreme-tag token, a token-less Map pool — run through
  the full pipeline in one test: terminates, refuses each correctly, stays
  idempotent (S15's fixture-proven paths all get their exercise here).
- **Tests:** `src/tests/EconSimAdversarial.test.js` as above; guard tests;
  re-elect churn test.
- **Verify:** full pass — `npm test`; CMS Recalculate + Sync + `git diff data/`
  clean of surprises; game smoke (buy Map → place → produce → sell item →
  sell token, all at derived numbers). **Tag `v0.6.0`**, bump the five version
  files together, rename `[Unreleased]`.
- **CHANGELOG**; commit.

---

## 5. Contract notes for whoever implements this

- **Where the sim reads and writes** (plan §16, one line each): reads authored
  intent (`sim.*`, `baseQty`, `variable`, `anchor`, `downcycle`, charges,
  skill, level, Map price/materials/pool membership, dials); writes derived
  (`config.cycleTimeMs`, `config.xp`, output `minQty`/`maxQty`/`chance`, item
  `value` + `valueSource`, recipe `durationMs`/`xp`, pool `weight`, Token
  scrap values). The game's readers are untouched — derived values land in
  today's shapes. The **one** stored derivation is the anchor election, living
  in `valueSource` (F4).
- **Charges are hand-typed and hours-first-displayed, never computed** (D-176,
  CMS-135). The old engine's charge writing (S2) dies in P5; nothing replaces it.
- **The eight shipped unlimited Tokens** (S6: 14 by the live field — the plan
  counted 8 from an earlier survey; trust the code count) are a *content*
  problem under CMS-131, handled by Warning rows here and by re-authoring
  later. This roadmap does not re-author content.
- **Enemy loot numbers are placeholders for a later combat balance** (CMS-128's
  cost line). P7's band check flags garbage; it does not fix it.
- **Passives, Buff/Manager/Market/Triggered, adjacency-buffed output**: out of
  v1, per the plan's closing list. The sim balances the unbuffed token. A
  passive source appears only as the deferred-scope Info row (Wind Trap rule).

## 6. Risks, named before the work

- **P5 is the load-bearing sitting** — a cutover that deletes nine engine
  files, migrates two data files, and rewires sync in one commit. Mitigation:
  P4 lands the replacement fully tested first, and P5's write-back targets are
  byte-shaped like today's data. If P5 runs long, the split point is "new
  engine wired + old engine deleted" (commit) / "data migration + sell fix"
  (commit) — both leave the tree green.
- **The 18-item / 39-token workspace is too small to stress the lever policy.**
  P6's real test arrives when the owner re-authors content. Expect refusal
  counts on shipped content to be high and uninteresting; expect the
  adversarial fixtures (P9) to be the honest coverage.
- **`useGlobalStore` is persisted in the browser** — a stale persisted v1 blob
  on the owner's machine will hit the P5 migration in real life, not just in
  tests. Verify the migration by actually opening the CMS with the old blob
  present before calling P5 done.
- **Comment drift** is this repo's chronic disease. Two stale doctrine comments
  are already scheduled for correction (S3's bypass rationale, S10's
  hero-speed denial); every phase that changes behaviour rewrites the comments
  above it, per rule §1.6.
