# Economic Simulator — Implementation Roadmap v1

> **Status:** v1.2. Authored 2026-08-28 as the build plan for the design in
> [`economic_simulator_plan_v1.md`](economic_simulator_plan_v1.md) (now v1.4, approved);
> **revised the same day by two review passes** (findings A1–A14 and B1–B11,
> ledgered in §7). The first pass re-verified every §2 claim against the tree and
> found: one wrong claim (S11 — `trueCost` *does* have CMS UI readers), one
> missing phase (the shipped corpus must be tagged before the sim can run on it —
> now P2.5, an owner sitting), one silent-data-loss hazard (stale persisted CMS
> workspaces would re-write deleted fields through sync — closed by strip-on-write
> in P5), and one player-facing gap (an `epic` Token would sell for 5g — closed in
> P2). The second pass surfaced **two genuine plan gaps, both ruled by the owner
> the same day and folded into the plan as v1.4**: support/deferred pool entries
> count neutral at their acquisition slice in the Map check (CMS-138), and the
> Guild Hall's scripted tutorial is exempt from the exactly-3 burst rule (CMS-129
> clarified). It also caught that **a Sync before P5 rewrites charges through the
> live old engine** — P2.5 therefore commits a workspace export instead of
> syncing, and Sync is off-limits until P5 lands (§6).
>
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
> `CHANGELOG.md` under `## [Unreleased]`. There are eleven phases (ten build
> sittings plus one owner-led content sitting) where the plan's §17 sketched
> seven: the plan's sittings 1 and 3 each split in two (§4 explains why at each
> split), the corpus-tagging sitting was found by the review pass (A2), and the
> decision transcription is its own Phase 0 per the kickoff brief.
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
   language. Do not quietly design around it. (Two places where this roadmap
   supplies an *implementation default* rather than a design ruling are marked
   as such inline — the interim `epic` sell row in P2 and the gold-pool-entry
   rule in P7 — each with the reasoning and an invitation to overrule.)
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
   "looks wrong" against today's content is not evidence of a bug. (Tagging the
   corpus in P2.5 and seeding intent from today's hand-authored outputs in P2
   are **not** calibration — they preserve authored content as authored intent;
   what the rule forbids is fitting the *curves, bands, weights and dials* to
   that content.)
6. **Comments in this codebase are not trustworthy** (Code Review Round 2: eight
   cases of fabricated rationale). Verify against code and tests, including
   against this document — and when a phase changes behaviour a comment
   describes, rewrite the comment in the same commit.

---

## 2. What the code actually says — the drift audit

Findings from reading the tree on 2026-08-28, re-verified by the v1.1 review
pass. Each is numbered so the phases can cite them.

| # | Finding | Consumed by |
| :--- | :--- | :--- |
| **S1** | **The old solver is live and wired.** `recalculateEconomy` (`cms/src/stores/useEntityStore.js:666`) runs `runFullBalance` (`cms/src/engine/balanceRunner.js`) — the struck CMS-109–116 engine: `valuePropagator`, `tokenSolver`, `xpSolver`, `chargeSolver`, `combatLootSolver`, with `anchorCalculator`, `evCalculator`, `velocityCalculator` behind them. Both the TopBar Recalculate button and `syncToGame` (`cms/src/engine/fileUtils.js:67`) call it. It cannot be deleted until the new engine can stand in for it. The import graph is closed: only `useEntityStore.js` imports into the set, and `connectivityAuditor.js` / `descriptionDictionary.js` import nothing *from* it (only from `utils/constants`), so those two survive the deletion untouched. `taskSolver.js` is imported by **nothing** — it has been dead reference code since the recipe rework, so deleting it carries no import risk. | P5, P6 |
| **S2** | **The old solver violates D-176 today.** `balanceRunner.js:124-141` computes and rewrites Token `charges` from Map ROI (the struck CMS-114). Retiring it is a correctness fix, not just a replacement. | P5 |
| **S3** | **The recipe-sync bypass is exactly as the handoff describes.** `cms/src/engine/recipeSync.js` flattens store `recipePools` past the economy pass, and `src/tests/RecipeSyncRoundTrip.test.js` pins the byte-identical round trip — *including* the nine EV fields. When the EV fields die (plan §16), that test is deliberately rewritten, not deleted: its new job is "authored intent survives sync byte-for-byte; derived fields are regenerated". | P5 |
| **S4** | **Every item sells for 1g — a live bug the plan's CMS-132 will fix in passing.** `CommerceSystem.getItemPrice` (`src/systems/economy/CommerceSystem.js:23`) reads `item.baseValue \|\| 1`, and no item in `data/items.json` carries `baseValue`. The items carry `value` (currently `null`), `trueCost` and `sellPrice` instead. Wiring the sell path to the derived `value` implements CMS-132 (Bank sells at full derived value) and fixes the bug in one move. `BankTab.jsx` prices its rows through the same `getItemPrice` (lines 461, 488), so the fix corrects the displayed prices too — a free verification surface. | P5 |
| **S5** | **Token scrap prices are a flat rarity table, not derived.** `TokenBank.sellValue` (`src/systems/board/TokenBank.js:202`) reads `SELL_VALUE[def.rarity]` — no per-Token scrap value exists in the game. The sim's Price pass writes Token scrap values (plan §4); the game must gain a reader for them. ⚠️ **(A1)** The table (`TokenBank.js:55`) has rows for four rarities only — `common: 5, uncommon: 15, rare: 40, mythic: 120` — and its documented fallback sends an unknown rarity to the *common* price. The moment `epic` exists (P2), an epic Token would sell for 5g. P2 closes this. | P2, P7 |
| **S6** | **The live charge pool is `uses`, not `charges`.** Tokens in `data/tokens.json` carry *both fields with different values* (the Recipe & Charges roadmap's P0 hazard, still unresolved); the runtime reads `uses` via `tokenStartingUses` (`src/config/registries/tokenRegistry.js:146-149`, literally `def.uses ?? null`). **(A5)** The CMS engine cannot import that helper — it reads the game's registry singleton, not the CMS store — so the sim gets a one-line `liveCharges(def)` mirroring those semantics, with a comment naming `tokenRegistry.js:146` as the source of truth, and **never reads `charges`**. 14 of 39 shipped Tokens are unlimited (`uses` null/absent). | P4, P7 |
| **S7** | **Burst code confirmed: 3–5 draws, no composition guarantee.** `BURST_MIN = 3` / `BURST_MAX = 5` (`Cartographer.js:56-57`), free weighted draws in `rollBurst` (`Cartographer.js:280`), comment claims "3–6 (D-167)". Both wrong under CMS-129. Existing tests: `src/tests/Cartographer.test.js`, `src/tests/MapBurst.test.js` — the latter asserts on `result.contents.length` and tray-fill counts (lines 51–71) and on burst variety (line 121), all of which move when the count pins at 3. | P1 |
| **S8** | **`TOKEN_RARITIES` is four tiers** (`src/config/registries/tokenConstants.js:85`), imported live by the CMS across the project boundary (CMS-5), with `src/tests/CMSBoundary.test.js` guarding the exports. Adding `epic` flows into the CMS dropdown with no CMS change. | P2 |
| **S9** | **The 30-second wall is `ContentRules.test.js` Rule 4** (lines 222–234): hard 10,000–30,000ms on every running Token's `config.cycleTimeMs`. | P2 |
| **S10** | **Worker speed is real and live**: `SKILL_SPEED_FACTOR = 0.005` (`src/config/FormulaRegistry.js:18`), applied at `BoardRunner.js:553`. ⚠️ The doctrine comment at the head of that same file (`BoardRunner.js:62-66`) still claims hero level does not affect speed — stale, and exactly the fabricated-rationale hazard. Fix the comment when first touching board systems. | P1 |
| **S11** | **Items' legacy value fields are *mostly* safe to migrate — corrected by the review pass (A3).** `sellPrice` on items.json is read by nothing (`QuestManager`'s `item.sellPrice` at line 380 reads its own hardcoded `RANDOM_ITEMS` array, not the registry). But `trueCost` has **three kinds of reader**: the old engine (dies at P5), `CMSBalanceEngine.test.js` (retired at P5), *and two live CMS displays* — `EntitySelect.jsx:112` and `GenerateModal.jsx:267` render `entity.trueCost` as a GP badge. P5 repoints both to `value` in the same commit that removes the field. Stale UI copy naming the old engine (`AuditPanel.jsx:95` "Phase 8 balance engine… trueCosts", `TopBar.jsx:94`) is rewritten then too. | P5 |
| **S12** | **Enemy pool entries are a paper shape today.** No shipped Map pool contains an enemy, raw-item **or gold** entry — all 18 shipped pool entries across the 7 Maps are `kind: "token"` — and `data/enemies.json` (4 enemies, `drops[]` with itemId/qty/chance) is **not loaded by the CMS store** — `recalculateEconomy` passes no enemies. The Map check (plan §7, CMS-128) needs a read path for enemies before it can value one; investigate at the start of P7, including how an enemy's charge count is expressed. **(A7)** `Cartographer.js:348` also accepts `kind: 'gold'`/`'currency'` pool entries, a shape the plan's F10 (raw items) doesn't mention — P7 rules it by extension. Every non-token entry path is therefore fixture-proven only, like the recipe rework's tool tiers. | P7 |
| **S13** | **Sim-engine tests live in the game's suite by precedent.** The CMS has no test runner of its own; `src/tests/CMSBalanceEngine.test.js` already tests CMS engine code across the boundary. New engine tests follow that pattern as `src/tests/EconSim*.test.js`. | P3–P9 |
| **S14** | **The dial store is `cms/src/stores/useGlobalStore.js`**, persisted (`fantasy-guild-cms-globals`, version 1, with a `migrate`). New dials mean a version bump and migration, not a silent shape change. Note the wrinkle: CMS-127's cost line says the Map pins and craft margin "ship unset and required", while the later CMS-137 ships every owner dial pre-set at the interviewed values and explicitly rejects blankness. **CMS-137 wins on shipped values** — transcribe both as written in P0, implement 137. | P5 |
| **S15** | **No shipped recipe outputs a Token** (CR2-199 confirmed — the 3 shipped recipes output items only), so the Token-output refusal (CMS-128) and the downcycle path (CMS-130) will be fixture-proven only. Named here so nobody mistakes fixture-proven for untested. | P4, P9 |
| **S16** | **(A4) The entity store is browser-persisted with no version field** — key `fantasy-guild-cms-v2`, `partialize` over items/tokens/maps/recipePools (`useEntityStore.js:738-752`). Consequence: after P5's data-file migration, the owner's browser still holds a workspace whose items carry `trueCost`/`sellPrice` and whose recipes carry the nine EV fields — and sync writes files **from the store**, so one Sync from a stale workspace would resurrect every deleted field. Closed in P5: the new engine's write-back **strips retired fields** (`trueCost`, `sellPrice`, the nine EV fields, `isPrimarySource`) on every run, so any stale workspace heals on its first Recalculate instead of poisoning `data/`. |P5 |
| **S17** | **(A6) Expected-quantity semantics live game-side already**: `expectedOutputQuantity(output)` = (min+max)/2 and `rollOutputQuantity` (uniform inclusive) in `tokenRegistry.js:224-238`. The sim's units/hour must agree with the runtime's expectation or every band is quietly wrong. P4 mirrors the arithmetic and pins agreement with a test importing the game helper. | P4 |
| **S18** | **(A8) XP write targets confirmed at the reader**: the runtime awards `io.xp ?? config.xp` (`BoardRunner.js:339`), where `io.xp` is the active recipe's `xp` (`RecipeResolver.js:197`). So P8 writes recipe `xp` and token `config.xp` — the fields already consumed. The Token's *top-level* `xp` field (present on shipped records) is dead at runtime: P8 flags it as a cleanup candidate and does **not** silently delete it. | P8 |
| **S19** | **(A2) The sim cannot run on today's content at all until it is tagged.** No shipped Token or Recipe carries `sim.tempo`/`sim.purpose` (the fields don't exist yet), and tagging is *authoring* — the owner's act, not the implementer's. Two consequences the v1 draft missed: the engine needs an explicit **untagged rule** (P3), and the plan needs an owner sitting to tag the corpus (P2.5) before P3's "review elections on real authoring" checkpoint means anything and before P5's every-item-has-a-valueSource assertion can be unconditional. | P2.5, P3, P5 |
| **S20** | **The downstream contract of `recalculateEconomy` is wider than the solver.** After `runFullBalance` it derives token types, composes descriptions (`composeTokenDescription(next, result.items, state.recipePools)`), runs `auditConnectivity(entities, result.refusals)` and publishes via `useSimulationStore.setAuditResults(…)` (7-argument shape, `useSimulationStore.js:28`). P5's runner must keep feeding all of that — `connectivityAuditor` and `descriptionDictionary` survive and must keep working. The description generator reads outputs and cycle time from today's derived shapes (`descriptionDictionary.js:75-88`), so it survives write-back unchanged — and per CMS-134 it must never *gain* Tempo/Purpose phrases. | P5 |
| **S21** | **(B1, ruled) Real pools are mostly not producers.** Across the 7 shipped Maps: 9 resource, 4 station, **4 buff, 1 context** entries — so the Map check meets support and deferred-kind entries immediately, and plan §7 (pre-v1.4) had no rule for them. **Owner ruling 23 / CMS-138:** they count neutral at their acquisition slice, with an Info row. Relatedly, 23 of 39 Tokens have `config: null` (context/buff/map/manager/market) — the cycled, taggable corpus is just **15 Tokens** (11 resource + 4 station), which right-sizes P2.5 and demands a *structural skip* distinct from the untagged rule (P3). | P2.5, P3, P7 |
| **S22** | **(B2, ruled) The Guild Hall tutorial delivers scripted single drops** — `GUILD_HALL_DROP_SEQUENCE` (`guildHallMaps.js:4`) is ten one-entry drops in fixed order, bypassing the weighted draw (`Cartographer.js:269-278`). **Owner ruling 24:** exempt from CMS-129; P1 leaves the branch alone and P7's check skips guild-hall maps. | P1, P7 |
| **S23** | **(B4) Enemy and gold pool entries have no authoring path, and enemy entries are runtime-broken.** `MapEditor.jsx:137-140` offers `token`/`item` kinds only; `Cartographer.js` handles `token` and `gold`/`currency`, and every *other* kind falls through to the item-sprite branch — an enemy entry would spawn a bogus item sprite. So P7's enemy and gold arms are future-proofing against the plan's shapes, fixture-proven only; building Map-editor authoring for them is **not** in this rework's scope. | P7 |
| **S24** | **(B3) A Sync before P5 is destructive.** `syncToGame` runs the live old engine, whose `chargeSolver` rewrites Token charges (S2) and whose `tokenSolver` re-tunes non-anchor yields — so any Sync between now and the P5 cutover mutates content through machinery already ruled wrong. P2.5 commits a **workspace export** instead of syncing; tags reach `data/` at P5's first new-engine Sync. Field-name asymmetries the engine must normalise at its edge (B5): tokens carry `config.skill` / `config.skillRequired` / `config.outputs`; recipes carry `skill` / `levelRequirement` / `outputs`; the recipe's cycle is `durationMs`, mapped to the runtime's `io.cycleTimeMs` at `RecipeResolver.js:196`. The TokenEditor authors **`uses`** (`TokenEditor.jsx:272-283`) — the correct live field — so the dead `charges` field is data cruft, not an authoring trap (B8). | P2.5, P4, P5 |

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
| Chance snapping prior art (10 → 5 → 1%) | `cms/src/engine/taskSolver.js` — port the snapping in P6, then delete the file (unimported today, S1) |
| Worker-speed formula in one place | `src/config/FormulaRegistry.js` (`SKILL_SPEED_FACTOR`) |
| Expected-yield arithmetic the runtime trusts | `expectedOutputQuantity` / `rollOutputQuantity`, `tokenRegistry.js:224-238` (S17) |
| Charge semantics (live pool, unlimited, starting uses) | `tokenStartingUses` (`tokenRegistry.js:146`), `usesRemaining`, `src/systems/board/Charges.js` |
| Burst tests to extend | `src/tests/Cartographer.test.js`, `src/tests/MapBurst.test.js` |
| Derived-not-typed item value already honoured in the editor | `ItemEditor.jsx` has no value input, by design (CMS-86) |
| XP threshold curve (for the XPH curve maths) | the game's `floor(l + 300·2^(l/7))/4` cumulative curve (plan §8) |

---

## 4. Phases

Dependency spine: **P0 and P1 are independent openers** (do P0 first — it is the
kickoff brief's named first task). **P2 → P2.5 → P3 → P4 → P5 → P6 → P7 → P8 →
P9** is strict. P1 must land before P7 (the Map check reads the burst constants
live).

| # | Phase | One line | Depends on | Status |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | Decisions transcribed | CMS-117–137 into the log, in house style | — | **Done 2026-08-28.** All **22** decisions (CMS-117–**138**, not –137 as this row first said) transcribed into `cms_rework_v2_decisions.md` in house style, every *Rejected:* and *Cost:* clause carried; verified by an independent line-by-line read-back against plan §19. CMS-107 re-pointed at the landed numbers; **CMS-45** struck → CMS-119 and **CMS-54** struck → CMS-124, bodies preserved; `playmat_decisions.md`'s **D-167** amended (not struck) — superseded on size and composition only, its presentation half explicitly surviving. ⚠️ **CMS-127 and CMS-137 are both transcribed as written and still contradict each other on shipped dial values** (S14) — deliberate; **CMS-137 governs**. ⚠️ **Found, not fixed:** three passages in the decisions log (`:663`, `:733`, `:1432`) still assert "3–6 items per burst" as live fact and cite `Cartographer.js:47`; the real constants are at `:56-57` and have always produced **3–5**, so those sites are wrong about the shipped code independently of CMS-129. **Owner ruled 2026-08-28: P1 annotates them**, in the same commit that changes the real burst size. **P7's Map check must not read burst size from them.** |
| **P1** | Burst rules in the game | Exactly 3, first slot always a Token (CMS-129) | — | |
| **P2** | Vocabulary + intent schema | Tags authorable; `epic`; tempo bands; intent seeded; 30s rule relaxed | — | |
| **P2.5** | Tag the shipped corpus | **Owner sitting**: Tempo/Purpose/anchor on 39 Tokens + 3 recipes | P2 | |
| **P3** | Time + anchors, report-only | Passes 1–2, elections reviewable before anything writes | P2.5 | |
| **P4** | Pricing pass, engine-only | Pass 3 pure and tested, not yet wired | P3 | |
| **P5** | The cutover | Recalculate runs the new engine; old engine deleted; EV fields die; items sell right | P4 | |
| **P6** | Lever policy + refusals | Pass 4, audit cards, churn report | P5 | |
| **P7** | Map economics | Pass 5, derived weights, scrap, two-sided check, Map table | P5, P1 | |
| **P8** | XP + pacing | Pass 6 (well, §8): XP derivation, curves, "day in reach" | P5 | |
| **P9** | Polish + guards | Sticky-anchor UX, progression guard, adversarial set | P6–P8 | |

---

### P0 — Decisions transcribed (the kickoff's first implementation task)

**Docs only; no code.** One sitting.

- **`cms_rework_v2_decisions.md`**: append **CMS-117 through CMS-138** exactly as
  the plan's §19 states them (CMS-138 and CMS-129's tutorial-exemption
  clarification arrived with plan v1.4), in house style (claim first,
  *Rejected:*, *Cost:*, supersessions named). Re-point **CMS-107**'s note from
  "once the plan is approved" to the landed CMS-117+. Strike **CMS-45** in place
  with a pointer to CMS-119, and **CMS-54** with a pointer to CMS-124, per house
  style (struck-through, never deleted).
- **`playmat_decisions.md:539`** ("D-167 — A Map burst yields 3–6 things"):
  annotate as superseded on burst size and composition by CMS-129. Annotate,
  don't rewrite history. D-167's *presentation* half (spectacle over volume)
  stands.
- Note the S14 wrinkle in the transcription commit message: CMS-127 and CMS-137
  are both transcribed as written; CMS-137 governs shipped dial values.
- **Verify:** read-back against plan §19 (22 decisions, none paraphrased into
  something weaker); `npm test` untouched and green. **CHANGELOG** entry; commit.

### P1 — Burst rules in the game (CMS-129) — consumes S7, S10

The plan filed this as its own game-side task; it is independent of everything
CMS-side and player-visible on day one.

- **Game half** (`src/systems/board/Cartographer.js`):
  - A burst is **exactly 3**: replace the `BURST_MIN`/`BURST_MAX` random count.
    Keep an exported constant the Map check can read live (plan §7) — e.g.
    `BURST_SIZE = 3` — rather than burying a literal.
  - **Slot one draws over the pool's `kind === 'token'` entries only**, weights
    renormalised among them; slots two and three stay free weighted draws over
    the whole pool. Gold and item entries can never satisfy the guarantee
    (S12) — only a real Token advances the supply line, which is the ruling's
    whole point. A pool with no Token entries falls back to three free draws
    (and P7's check will warn on such a pool; don't crash here).
  - Rewrite the "3–6 things (D-167)" comments to name CMS-129. Do not touch the
    Guild Hall scripted-sequence branch (`rollBurst`'s early return) — its
    single-drop tutorial pacing is **exempt by owner ruling 24 (S22)**; say so in
    the branch's comment so nobody later "fixes" it to three.
- **In passing (owner-routed 2026-08-28, found during P0):** three passages in
  `cms_rework_v2_decisions.md` assert **"3–6 items per burst"** as live fact and
  cite the constants at `Cartographer.js:47` — `:663-664` (inside CMS-48's
  arithmetic), `:733` (the Map authoring screen preamble) and `:1432` (the
  Phase 8 arithmetic preamble). ⚠️ **They are wrong about the shipped code
  independently of CMS-129:** the constants live at `:56-57` and have always
  produced **3–5**, never 3–6. Annotate all three in this phase's commit — the
  agent changing the constants is the one who knows their true values.
  Annotate, don't rewrite: the surrounding arithmetic is history and stays.
  P7 later builds the Map check over CMS-48's text, which is why this matters.
- **In passing** (S10): correct the stale `BoardRunner.js:62-66` doctrine
  comment — worker speed is live (`SKILL_SPEED_FACTOR`), Access is not the only
  hero effect anymore. Comment-only change, same commit, per rule §1.6.
- **Tests**: extend `MapBurst.test.js` / `Cartographer.test.js` — burst length
  is always 3 across seeded runs; first entry is always `kind: 'token'` on a
  mixed pool; renormalisation keeps relative Token weights among Token entries;
  token-less pool doesn't hang or crash. **Update the count-coupled
  assertions** (S7): `contents.length`, the tray-fill test at lines 51–71, and
  the variety probe at line 121 all assume 3–5 draws today.
- **Verify in game**: `npm run dev`, buy and open a Map, probe the burst via
  `window.Game`/`window.GameState` — 3 things, at least one Token, several runs.
- **CHANGELOG**; commit.

### P2 — Vocabulary and intent schema (plan sitting 1) — consumes S5, S8, S9

Content becomes taggable; the game's behaviour is unchanged (with one deliberate
exception: the epic sell row).

- **Game half:**
  - `src/config/registries/tokenConstants.js`: `epic` joins `TOKEN_RARITIES`
    between `rare` and `mythic`. The CMS dropdown picks it up via CMS-5 (S8);
    check `CMSBoundary.test.js` stays satisfied.
  - **(A1)** `TokenBank.js:55`: `SELL_VALUE` gains an `epic: 70` row —
    otherwise an epic Token sells at the common fallback of 5g the moment the
    tier exists. *Implementation default, not a design ruling:* 70 sits between
    rare 40 and mythic 120 and is interim only — P7's derived scrap values
    supersede this whole table. Say so in the comment; the owner can overrule
    the number without ceremony.
  - **New** `src/config/registries/tempoBands.js`: the §13.3 band table (four
    tempos, scaled ×(1 + level/70)), plus `bandFor(tempo, level)` and
    `isInBand(cycleMs, tempo, level)`. Game-side so the CMS imports it live
    (CMS-5) and `ContentRules` can read it — add it to the boundary guard.
  - `src/tests/ContentRules.test.js` Rule 4 relaxed (S9): a Token whose
    `sim.tempo` is authored is checked for **tempo-band membership at its
    required level**; a Token not yet tagged keeps the legacy 10–30s check.
    That split keeps the suite green through the tagging window (P2.5) instead
    of forcing a big-bang pass.
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
  - **(A9) Intent seeding, mechanical:** seed every existing output's intent
    from its authored numbers — `baseQty := {min: minQty, max: maxQty}`,
    `variable := chance < 100` — so P2.5's tagging sitting is *tags and anchor
    flags only*, not re-typing outputs. These numbers were hand-authored;
    carrying them into the intent fields is preservation, not calibration (rule
    §1.5). **(B7) Mechanism, concrete:** one normaliser function, applied in
    *both* load paths — as a `version: 1` + `migrate` on the entity store's
    persist config (currently versionless, S16), **and** inside `hydrate()`,
    because workspace imports (`importWorkspace`) bypass persist migrations
    entirely. Idempotent by construction (never overwrites an existing
    `baseQty`).
- **Schema note:** intent fields are additive and optional; nothing reads them
  yet.
- **Tests:** band table sanity in a new `src/tests/EconSimTempo.test.js`
  (bands ordered Fast<Medium<Slow<Heavy at every level, scaling monotonic,
  membership function agrees with the table); ContentRules both branches
  (fixture: one tagged, one untagged token); seeding idempotence (running the
  migration twice changes nothing).
- **Verify:** CMS by hand — tag a token and a recipe, reload, tags persist;
  `epic` appears in the rarity dropdown; a pre-existing output shows its seeded
  `baseQty`. `npm test` green.
- **CHANGELOG**; commit.

### P2.5 — Tag the shipped corpus (owner sitting) — consumes S19, found by A2

**This is authoring, and it is the owner's.** The sitting is owner-led with the
assistant driving the CMS; budget it like a design session, not a build one.

- Tag the cycled corpus with Tempo, Purpose, and — where the plan's default
  election would pick wrongly — an explicit `anchor` flag. **(S21) That corpus
  is 15 Tokens** (11 resource + 4 station) **plus the 3 recipes** — the other
  23 Tokens are inert (`config: null`) or deferred kinds and take no sim tags.
  Rarity re-checks across all 39 are fair game (the `epic` tier now exists).
- The intent fields are already seeded (P2/A9), so this is judgment work only.
- Expected side-effect worth naming in advance: under the ranges-by-default
  ruling (CMS-136) the owner may widen fixed quantities to ranges as they go.
  Fine — that is exactly the authoring habit the ruling asks for.
- **Nothing derived changes** — the old engine ignores the new fields, the new
  engine doesn't exist yet. Zero behaviour risk.
- **Verify:** every *cycled* Token and every recipe carries `sim.tempo` and
  `sim.purpose` (a five-line probe in the CMS console, or a temporary check
  script); `npm test` green.
- **(S24) Do NOT press Sync.** Sync still runs the old engine, which rewrites
  charges (S2) and re-tunes non-anchor yields — a P2.5 Sync would mutate
  content through machinery already ruled wrong. Instead: **export the
  workspace** (`exportWorkspace` — the existing dated-JSON path) into
  `cms/backups/` and commit it, so the tagging work survives a cleared browser.
  The tags reach `data/` at P5's first new-engine Sync; until then they live in
  the store, which is where P3 and P4 read from. (Consequence, accepted: the
  ContentRules tagged branch stays dormant until P5 — shipped cycle times are
  all 10–30s today, so the legacy branch keeps covering them.)
- **CHANGELOG** ("content: shipped corpus tagged for the simulator"); commit.

### P3 — Time + anchors, report-only (plan sitting 2) — consumes S13, S19

The first two passes of the assembly line, with a read-only report — the
checkpoint where the developer reviews elections on real authoring **before
anything writes** (plan §17.2).

- **Engine half** — new directory `cms/src/engine/sim/`:
  - `tempoPass.js`: resolve every tagged Token/Recipe to a cycle time — middle
    of its band, snapped to whole seconds (plan §3.1); units/hour arithmetic
    including `speed(L) = 1 + 0.005 × L`, reading `SKILL_SPEED_FACTOR` from
    `FormulaRegistry.js` rather than duplicating the constant.
  - **(A10) The untagged rule, explicit:** a *cycled* entity without
    `sim.tempo` or `sim.purpose` is **skipped untouched** and files one Info
    row ("untagged — outside the economy pass"). An *item* whose every source
    is skipped is not priced and files the same row an orphan would, at Info
    severity during the transition. After P2.5 this path should fire on
    nothing shipped — but it is the rule that keeps every later phase green
    when the owner authors a new Token and recalculates before tagging it.
  - **(B11/S21) The structural skip, distinct from untagged:** a Token with no
    work cycle (`config: null`, or a deferred kind — 23 of 39 shipped) is not
    an economy producer and is skipped **silently** — no Info row. Untagged
    means "you forgot"; inert means "nothing to tag". Conflating them would
    bury every real row under 23 permanent Info entries.
  - **(S24) One field adapter at the engine's edge:** tokens speak
    `config.skill` / `config.skillRequired` / `config.outputs`, recipes speak
    `skill` / `levelRequirement` / `outputs`, and the recipe's cycle is
    `durationMs` (the runtime maps it to `io.cycleTimeMs` at
    `RecipeResolver.js:196`). Normalise once, in one module, so no pass ever
    branches on entity kind for a field name.
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
  deferred-only → Critical; the untagged rule (skip + Info, nothing mutated);
  cycle time = band middle, whole seconds.
- **Verify:** run the CMS on the real (now tagged) workspace, read the
  elections for all 18 items, sanity-check a handful by hand against the rule.
  This is the plan's named checkpoint — if the owner dislikes what the default
  rule elected, the remedy is anchor flags in the CMS (one more P2.5-style
  pass), not a rule change. `npm test` green.
- **CHANGELOG**; commit.

### P4 — Pricing pass, engine-only (first half of plan sitting 3) — consumes S6, S15, S17

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
  - **Charge resolution (S6/A5):** a `liveCharges(def)` helper — `def.uses ??
    null` — used by every scrap and lifetime calculation, comment pointing at
    `tokenRegistry.js:146`. The `charges` field is never read.
  - **Yield arithmetic (S17/A6):** expected quantity is (min+max)/2, matching
    `expectedOutputQuantity`; a test imports the game helper across the
    boundary and pins agreement on a spread of outputs, so the sim's units/hour
    can never quietly diverge from what the board actually rolls.
  - GPH curve: pinned points from plan §13.1, interpolated; purpose factors and
    craft margin read from a dials object (the store schema itself lands in P5 —
    P4 takes dials as a plain argument with §13.6/§14 defaults).
- **Tests** (`src/tests/EconSimPricing.test.js`): a worked single-output anchor
  (the brief's 540-units/hour example lands on a neighbour integer); a
  multi-output split fixture (Trout-Stream shape); a four-step chain showing
  margin compounding matches §6's ×1.75-at-15% arithmetic; downcycle cap holds
  and never anchors; cycle refusal fires and names both recipes; token-output
  refusal fires; the yield-agreement pin (A6); **idempotence** — running the
  pass twice on identical input is byte-identical (plan §11).
- **Verify:** `npm test` only — deliberately nothing player-visible yet.
- **CHANGELOG**; commit.

### P5 — The cutover (second half of plan sitting 3) — consumes S1, S2, S3, S4, S11, S14, S16, S20

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
  - **The downstream contract holds (S20):** the runner still derives token
    types, composes descriptions (same
    `composeTokenDescription(next, items, recipePools)` call), runs
    `auditConnectivity` with the new refusal list, and publishes through
    `useSimulationStore.setAuditResults` — adapt the refusal shape at the
    auditor's boundary, not by rewriting the auditor. `connectivityAuditor.js`
    and `descriptionDictionary.js` survive untouched (S1).
  - **Strip-on-write (S16/A4):** the write-back **deletes retired fields**
    wherever it finds them — `trueCost` and `sellPrice` on items, the nine EV
    fields and `isPrimarySource` on recipes — so a stale browser-persisted
    workspace (key `fantasy-guild-cms-v2`, no version) heals on its first
    Recalculate instead of resurrecting dead fields through Sync. This is the
    load-bearing half of the migration; the data-file edit below is just the
    first application of it.
  - **Old engine deleted** (S1, S2): `balanceRunner.js`, `valuePropagator.js`,
    `tokenSolver.js`, `xpSolver.js`, `chargeSolver.js`, `combatLootSolver.js`,
    `anchorCalculator.js`, `evCalculator.js`, `velocityCalculator.js`, and
    `mockBattle.js` (only `taskSolver` imports it). `taskSolver.js` **survives
    until P6** (its chance-snapping is ported there, then it dies — it is
    already unimported, so this is reference-keeping, not a dependency).
  - **CMS UI repoints (S11/A3):** `EntitySelect.jsx:112` and
    `GenerateModal.jsx:267` render `value` instead of `trueCost`; the stale
    "Phase 8 balance engine" copy in `AuditPanel.jsx:95` and `TopBar.jsx:94`
    rewritten to describe the new pass.
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
    added; `trueCost` and `sellPrice` removed (S11).
- **Game half** (S4): `CommerceSystem.getItemPrice` reads the item's derived
  `value` (fallback 1 for safety) — CMS-132's "Bank sells at full derived
  value", and the 1g-everything bug dies. `BankTab`'s displayed prices correct
  themselves through the same call.
- **Tests:** `CMSBalanceEngine.test.js` retired with the engine it tests;
  `RecipeSyncRoundTrip.test.js` **rewritten, not deleted** (S3): authored
  intent fields round-trip byte-identical, derived fields match a fresh solve,
  and **retired fields injected into the store do not reach the file** (the
  strip-on-write pin, A4). New `ContentRules` assertions (plan §16): every item
  has a `valueSource` (unconditional — the corpus is tagged, S19); derived
  fields match a fresh solve (the drift alarm). A CommerceSystem test: selling
  yields the derived value.
- **Verify end to end:** `npm test` green. CMS: **open with the real
  (pre-migration) browser workspace present** — the store must heal, not crash
  (S16); Recalculate on the real workspace, read the churn by eye, Sync,
  `git diff data/` and check the four files are sane (values integer, intent
  preserved, EV fields gone and *staying* gone after a second Sync). Game:
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
  `taskSolver.js` and `mockBattle.js`** if the latter outlived P5), then cycle
  time within band; one lever at a time; >3× refuses — except IPH quantity
  moves, uncapped but filing a Warning past 3×. Anchor integer residuals close
  through the same levers (plan §3.3). Purpose mismatch across an item's
  sources → standing Info row (F3). Training-loss cap on XPH non-anchor
  recipes (CMS-122).
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
  **(S23) Scope guard for that investigation:** enemy entries cannot be
  authored (the MapEditor offers token/item only) and would spawn as bogus
  item sprites at runtime — so P7 builds only the *check arm* against
  fixtures, per CMS-128; Map-editor authoring for enemy or gold entries, and
  the runtime burst handling an enemy drop would need, are separate future
  work, not this rework's.
- **Engine half** (`cms/src/engine/sim/mapPass.js`):
  - Derived **pool weights** from the global rarity table (CMS-124; §13.4
    values); `data/maps.json` entry `weight` becomes sim-written on sync.
  - **Scrap allocation**: aggregate first (Map cost × scrap ratio), allocated
    by `weight^(−premium)` (CMS-48/103); raw item entries contribute at item
    value and stand outside the allocation, item-heavy pools → Warning (F10);
    **(A7) gold entries likewise** — a `kind: 'gold'` entry contributes its
    face amount to *both* sides and stands outside the rarity allocation (it is
    literally cash; an *implementation default* extending F10's rule to the one
    entry kind the plan didn't name — flag it in the phase notes for the owner
    to overrule); **(S21, ruled) support and deferred-kind Token entries —
    context, buff, manager, market — count neutral at their acquisition slice
    with an Info row (CMS-138)**, which is what makes the check runnable on
    real pools at all (5 of 18 shipped entries are that shape); enemy entries
    valued at CMS-51 lifetime loot and band-checked against their slice
    (CMS-128); unlimited Token in an ordinary pool → Warning (CMS-131).
  - **Two-sided check**: expected burst scrap vs the scrap bound, expected
    productive value vs the return bound — pins interpolated over the Map's
    derived level (pool-share-weighted mean of entry requirements); slot-one
    Token renormalisation read from P1's live constants, never hardcoded 3.
    **Guild-hall maps are skipped** (owner ruling 24, S22) — scripted tutorial
    drops, not economy bursts. Violations are refusals with the §12 remedies;
    nothing auto-adjusts a Map.
  - Lifetime hours via `liveCharges` (S6); unlimited via the assumed-lifetime
    dial.
- **CMS half:** the Dashboard's **Map table** — one row per Map: derived level,
  cost, scrap side vs bound, productive side vs bound, pass/fail; computed pool
  shares on the Map screen; dial editors for the two pin-pairs, scrap ratio,
  premium, rarity weights. `MapEditor.jsx`'s weight column goes read-only-derived.
- **Game half** (S5): the sim's per-Token scrap value lands in token data;
  `TokenBank.sellValue` reads it, falling back to the `SELL_VALUE` table
  (including P2's interim `epic` row) for tokens that lack one — safety through
  the re-authoring window. Partial-charge proration (`copySellValue`) is
  untouched.
- **Tests** (`src/tests/EconSimMaps.test.js`): allocation sums exactly to the
  scrap budget; premium dial travel (0 = flat, 1 = hard inverse; 0.8 matches
  §13.4's column); burst expectation uses slot-one renormalisation and the live
  constant; item-heavy Warning; gold-entry arithmetic; support/deferred entries
  neutral at slice + Info row (CMS-138), on a fixture shaped like the real
  test-map pool; guild-hall maps skipped; unlimited-in-pool Warning; enemy band
  check on an S12 fixture; two-sided verdicts flip when a pin dial moves.
  Enemy, gold and raw-item entry kinds are fixture-proven (S12, S23) — say so
  in the test file header, per the recipe roadmap's precedent.
- **Verify:** CMS — Map table verdicts on the 7 shipped Maps read sensibly
  (they are placeholder content, so *refusals are expected* — what must be true
  is that each refusal's remedy line makes sense). Game — sell a rare token,
  price reflects derived scrap (probe).
- **CHANGELOG**; commit. *Criterion 5 demonstrable here.*

### P8 — XP + pacing (plan sitting 6) — consumes S18

- **Engine half** (`cms/src/engine/sim/xpPass.js`): XP per cycle = XPH curve ×
  purpose XP factor × cycle hours, rounded, min 1 (CMS-123); the XPH curve
  compounding at 7.5%/level from ~700, stored as pins like the GPH curve; the
  min-1 wobble documented in-code as accepted (F8). **Write targets are the
  fields the runtime reads (S18):** recipe `xp` and token `config.xp`
  (`BoardRunner.js:339` awards `io.xp ?? config.xp`). The Token's dead
  top-level `xp` field is left alone and flagged as a cleanup candidate — never
  deleted in passing (rule §1.6's spirit).
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
  rows (Common over ~a day; anything under ~10 minutes), all through
  `liveCharges` (S6).
- **Adversarial content set** (criterion 2's second half): a fixture workspace
  — a recipe cycle, an orphan item, a token-output recipe, a downcycle chain, a
  deferred-only item, an untagged token, an extreme-tag token, a token-less Map
  pool, an item-and-gold-heavy pool — run through the full pipeline in one
  test: terminates, refuses each correctly, stays idempotent (S15's and S12's
  fixture-proven paths all get their exercise here).
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
  in `valueSource` (F4). The write-back also *removes* what it has retired
  (strip-on-write, S16) — a field the schema no longer owns must not survive a
  round trip from any workspace, however old.
- **Charges are hand-typed and hours-first-displayed, never computed** (D-176,
  CMS-135). The old engine's charge writing (S2) dies in P5; nothing replaces
  it. The live pool is **`uses`** (S6): every sim read goes through
  `liveCharges(def)` = `def.uses ?? null`; the dead `charges` field on Token
  records is never read and is flagged as a cleanup candidate (its removal is a
  content migration for a later sitting, deliberately not bundled here —
  found, not fixed).
- **The eight shipped unlimited Tokens** (S6: 14 by the live field — the plan
  counted 8 from an earlier survey; trust the code count) are a *content*
  problem under CMS-131, handled by Warning rows here and by re-authoring
  later. This roadmap does not re-author content beyond P2.5's tags.
- **Enemy loot numbers are placeholders for a later combat balance** (CMS-128's
  cost line). P7's band check flags garbage; it does not fix it.
- **Passives, Buff/Manager/Market/Triggered, adjacency-buffed output**: out of
  v1, per the plan's closing list. The sim balances the unbuffed token. A
  passive source appears only as the deferred-scope Info row (Wind Trap rule);
  a deferred-kind *pool entry* is valued neutral at its slice (CMS-138).
- **The description generator stays tag-blind** (CMS-134): `composeTokenDescription`
  survives the cutover reading today's derived shapes (S20) and must never gain
  Tempo/Purpose phrasing — the tags are designer vocabulary, invisible to
  players even through generated text.

## 6. Risks, named before the work

- **P5 is the load-bearing sitting** — a cutover that deletes ten engine
  files, migrates two data files, and rewires sync in one commit. Mitigation:
  P4 lands the replacement fully tested first, and P5's write-back targets are
  byte-shaped like today's data. If P5 runs long, the split point is "new
  engine wired + old engine deleted" (commit) / "data migration + UI repoints
  + sell fix" (commit) — both leave the tree green.
- **⚠️ Sync is off-limits from now until P5 lands.** Every Sync runs the live
  old engine, which rewrites Token charges (S2) and re-tunes non-anchor yields —
  content mutation through machinery already ruled wrong. P0–P4 never need it
  (P2.5 commits a workspace export instead, S24). If a Sync happens anyway,
  recovery is git, exactly as R-18 documented for the empty-store case.
- **Stale persisted workspaces are the sneakiest data path.** Both stores
  persist in the browser (`fantasy-guild-cms-v2` unversioned,
  `fantasy-guild-cms-globals` v1), and sync writes files *from the store* —
  which is how deleted fields could come back from the dead (S16). P5's
  strip-on-write plus the with-stale-blob manual verification is the defence;
  do not skip that verification step because the tests pass.
- **The 18-item / 39-token workspace is too small to stress the lever policy.**
  P6's real test arrives when the owner authors new content. Expect refusal
  counts on shipped content to be high and uninteresting; expect the
  adversarial fixtures (P9) to be the honest coverage. Every non-token pool
  entry kind, the token-output refusal and the downcycle path are
  fixture-proven only (S12, S15) — first real authoring is where they meet
  content, exactly as the recipe rework's tool tiers did.
- **P2.5 is a scheduling dependency on a person.** Everything after P3 assumes
  a tagged corpus. If the owner wants to tag incrementally instead, the
  untagged rule (A10) keeps the pipeline green — but P5's "every item has a
  `valueSource`" assertion must then stay scoped to tagged sources until the
  corpus is done, and that scoping must be removed later, so prefer the single
  sitting.
- **Comment drift** is this repo's chronic disease. Three stale doctrine
  comments are already scheduled for correction (S3's bypass rationale, S10's
  hero-speed denial, S11's "Phase 8" UI copy); every phase that changes
  behaviour rewrites the comments above it, per rule §1.6.

---

## 7. Self-review findings ledger (v1 → v1.1)

What the review pass changed, in the plan's own §20 style — the attack was
"re-verify every claim against the tree, then hunt for what the phases assume
but never state".

| # | Finding | Disposition |
| :--- | :--- | :--- |
| A1 | `SELL_VALUE` has no `epic` row; the fallback prices unknown rarities at *common* — an epic Token would sell for 5g from the moment P2 adds the tier | Interim `epic: 70` row added to P2 (implementation default, superseded by P7's derived scrap) |
| A2 | **The v1 roadmap never scheduled tagging the corpus.** No shipped content carries `sim.*`; tagging is the owner's authoring act; P3's checkpoint and P5's assertions silently assumed it | New **P2.5** (owner sitting); dependency spine updated |
| A3 | S11 was **wrong**: `trueCost` has two live CMS UI readers (`EntitySelect.jsx:112`, `GenerateModal.jsx:267`), plus stale "Phase 8" copy in AuditPanel/TopBar | S11 corrected; repoints and copy rewrite added to P5 |
| A4 | **Silent-data-loss hazard**: the entity store persists unversioned in the browser and sync writes from the store — after P5's file migration, one Sync from a stale workspace would resurrect every deleted field | New S16; strip-on-write added to P5's engine, pinned by the rewritten round-trip test, verified manually against a real stale blob |
| A5 | "Read the live `uses` field" was stated but not implementable as written — the CMS engine can't import `tokenStartingUses` (it reads the game's registry singleton) | `liveCharges(def)` = `def.uses ?? null` specified in P4, cited to `tokenRegistry.js:146` |
| A6 | The sim's expected-yield arithmetic could quietly diverge from the runtime's (`expectedOutputQuantity`, `tokenRegistry.js:235`) | Agreement test importing the game helper added to P4 |
| A7 | Pool entries can be `kind: 'gold'` (`Cartographer.js:348`) — a shape the plan's F10 never names; also gold/item entries could have satisfied P1's Token guarantee as v1 worded it | P1 reworded (slot one draws `kind === 'token'` only); gold rule added to P7 as a flagged implementation default |
| A8 | P8's write targets were asserted, not verified | Verified at the reader: `io.xp ?? config.xp` (`BoardRunner.js:339`, `RecipeResolver.js:197`); the dead top-level token `xp` field named and protected from drive-by deletion |
| A9 | P2.5 as first conceived would have meant re-typing 39 Tokens' outputs into `baseQty` by hand | Mechanical intent seeding added to P2 (`baseQty` from minQty/maxQty, `variable` from chance<100, idempotent) |
| A10 | No phase said what the engine does with an **untagged** entity — the case every future authoring session hits between "create" and "tag" | The untagged rule specified in P3: skip untouched + one Info row |
| A11 | v1 said "delete `mockBattle.js` if nothing else holds it" — vague | Import graph verified (S1): only `taskSolver` imports it; both die by P6; `taskSolver` is already unimported |
| A12 | v1 named `auditConnectivity`/descriptions/`setAuditResults` in passing but didn't bind P5 to keeping them alive | S20 added; explicit contract line in P5 |
| A13 | MapBurst test updates were hand-waved ("will need changing") | The three count-coupled assertion sites enumerated in S7/P1 |
| A14 | D-167's location was "or wherever it is recorded" | Pinned: `playmat_decisions.md:539`; its presentation half explicitly survives |

**Second pass (v1.1 → v1.2)** — the attack was "what does each phase meet in the
data and the UI that neither the plan nor the first pass named":

| # | Finding | Disposition |
| :--- | :--- | :--- |
| B1 | **Genuine plan gap:** plan §7 defined productive value only for cycled Tokens, items and enemies — but 5 of 18 shipped pool entries are buffs or context tokens, so the Map check couldn't run on real Maps | **Ruled by the owner (plan ruling 23, CMS-138, plan v1.4):** neutral at acquisition slice + Info row; folded into P7 and S21 |
| B2 | **Genuine plan gap:** the Guild Hall tutorial delivers scripted single drops — the letter of CMS-129's "always exactly 3" would forbid it | **Ruled by the owner (plan ruling 24, plan v1.4):** exempt; P1 comments the branch, P7's check skips guild-hall maps (S22) |
| B3 | **A Sync before P5 mutates content** — the live old engine rewrites charges and re-tunes yields on every sync; v1.1's P2.5 said to Sync the tags in | P2.5 switched to a committed workspace export; a no-Sync-until-P5 warning added to §6 (S24) |
| B4 | Enemy pool entries are unauthorable (MapEditor: token/item only) **and runtime-broken** (unknown kinds spawn as item sprites); gold entries are unauthorable too | S23 added; P7 scoped to the check arm only, authoring explicitly out of scope |
| B5 | Field-name asymmetry between tokens (`config.skillRequired`, `config.outputs`) and recipes (`levelRequirement`, `outputs`) was nowhere stated | One-adapter rule added to P3's engine notes (S24) |
| B6 | P5/P8's recipe write target asserted, not verified | Verified at the reader: `RecipeResolver.js:196` maps `durationMs` → `io.cycleTimeMs` (S24) |
| B7 | A9's seeding said "run on load" — but workspace imports bypass persist migrations, so half the load paths would skip it | Mechanism pinned in P2: persist `version: 1` + migrate **and** the same normaliser in `hydrate()` |
| B8 | Whether the CMS authors the live `uses` field or the dead `charges` field was unchecked — an authoring trap if wrong | Verified: `TokenEditor.jsx:272-283` authors `uses`, the correct field; `charges` is data cruft only (S24) |
| B9 | Other test files use 30000ms values — possible hidden band walls beyond ContentRules | Checked: all are run-durations/fixture values, no band assertions; S9 stands as the only wall |
| B10 | The description generator could later leak Tempo/Purpose into player-visible text (CMS-134) | Guard line added to §5's contract notes; S20 extended |
| B11 | The v1.1 phases implied tagging and Info-rows across all 39 Tokens — but 23 are inert (`config: null`) or deferred kinds | P2.5 right-sized to the 15 cycled Tokens + 3 recipes; the silent *structural skip* distinguished from the untagged Info row in P3 (S21) |
