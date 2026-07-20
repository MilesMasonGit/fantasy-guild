# Card Mutators & Tokens — Implementation Roadmap v1

**Status:** Not started · **Created:** 2026-07-19 · **Baseline:** v0.3.0, 129/129 tests green

This is the authoritative implementation plan for the Card Mutator system.

**Read first, in this order:**
1. [`CLAUDE.md`](CLAUDE.md) — project ground rules and working practices.
2. [`status_effects_plan.md`](status_effects_plan.md) — the design. **§15 (Resolved Decisions)
   and §16 (Lexicon) are locked and override everything earlier in that document.**
3. This file — what to actually build, in what order.

> [!IMPORTANT]
> **§15 and §16 of the design doc are locked.** Do not re-litigate the math
> model, the duration model, Purify semantics, or terminology. If
> implementation reveals one of them is genuinely unworkable, **stop and raise
> it with the project owner** rather than quietly choosing something else.

---

## Implementation Status

Update this table as work lands. A phase is only ✅ when its smoke test has
actually been run, not merely when the code compiles.

| Phase | Name | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Reality check & scaffolding | ✅ Done & verified | `26580c8` | F1–F9 all re-verified 2026-07-19, none drifted. Tests 138/138. |
| 1 | Two-Bucket modifier engine | ✅ Done & verified | `56657d5` | F4 chain folded into one summed bucket. Tests 156/156. Verified in-game: untouched card = base time, +25% station buff → 3000ms → 2400ms. |
| 2 | Card tags | ⬜ Not started | — | |
| 3 | Token data model & lifecycle | ⬜ Not started | — | |
| 4 | ACTION cards & stamping | ⬜ Not started | — | Both targeting modes |
| 5 | Yield / Time / Cost axes | ⬜ Not started | — | |
| 6 | Failure states | ⬜ Not started | — | Includes an ordering bug fix |
| 7 | Combat axis (Hex) | ⬜ Not started | — | Routes into StatusEffectSystem |
| 8 | Area Anchor | ⬜ Not started | — | Proving ground for area-wide mode |
| 9 | Token UI & tooltips | ⬜ Not started | — | |
| 10 | Content catalog & counters | ⬜ Not started | — | |
| — | *Output conversion (Midas)* | 🔒 Cut from v1 | — | §15.8 |
| — | *Status Effect retrofit* | 🔒 Deferred | — | Separate roadmap, after this one |

Legend: ⬜ Not started · 🟡 In progress · ✅ Done & verified · 🔒 Deferred

---

## Architecture Findings (verified against the code 2026-07-19)

The design doc was written as if greenfield. It isn't. These findings were
confirmed by reading the source and **materially shape the plan** — read them
before writing code.

### F1 — Upcoming cards do not exist as objects

`LoopRunner._materializeCard()` ([LoopRunner.js:349](src/systems/loop/LoopRunner.js:349))
creates a card instance **at the moment the slot activates**, via
`CardFactory.createInstance(slot.templateId, …)`. Before that, an upcoming
card is just a `deckSlots[i]` entry holding a `templateId` and a `slotType`.

**Consequence:** tokens **cannot** be stamped onto card objects. They must be
stamped onto **slot indices**, and applied to the card when it materializes.
This is the single most important structural fact in this roadmap. The §15.5
"stamp immediately" decision still works — it just addresses slots, not cards.

### F2 — The cycle boundary already exists

`LoopRunner._advance()` ([LoopRunner.js:462](src/systems/loop/LoopRunner.js:462))
wraps `activeCardIndex` to 0 and sets area status to `'shuffling'`. That
wrap is the Cycle boundary where all tokens must be wiped (§15.3, §7).

### F3 — Tokens should not be serialized

§8 of the design says mid-Cycle abandonment resets the loop entirely and the
Hero respawns at the Guild Hall. Combined with the wipe-on-Cycle-reset rule,
**tokens never need to survive a save**. Follow the existing precedent in
[`AreaModifiers.js`](src/systems/loop/AreaModifiers.js): a runtime-only module
registry, deliberately outside `GameState`, rebuilt from nothing each Cycle.
This avoids touching `StateSchema` validation and save migration entirely.

### F4 — Current math is a multiplicative chain, not `Base × (1 + Σ)`

`StatProcessor.calculateWorkcycleStats()`
([StatProcessor.js:76](src/systems/cards/logic/StatProcessor.js:76)) computes:

```js
effectiveMultiplier = localMult * areaMult * toolMult * masterySpeedMult;
```

So the conversion in Phase 1 is **bigger than "change one formula"** — there
are several independent multiplier sources being chained. Every one of them is
a caller that must be migrated into the multiplier bucket. Their resulting
numbers will change; per the Phase 1 note, that is acceptable and should not
be compensated for.

### F5 — Outputs are granted *before* inputs are consumed

In `WorkProcessor` ([WorkProcessor.js:72-83](src/systems/cards/logic/WorkProcessor.js:72)),
`LootSystem.handleTaskReward()` runs at step 5 and `consumeInputs()` at step 6.

**This is a latent bug the mutator work will expose.** §10 requires that a
Card lacking inputs produces *nothing*. Under the current order, a Card would
hand out loot and only then discover it can't pay. Phase 6 must introduce a
**pre-flight check before either step**.

### F6 — Cards can already apply Status Effects

`WorkProcessor` step 4b already handles an `applystatus` trait, including a
`purge: true` variant for Antidote-style cleansing. **The §4 "Hazard Model"
crossover is already built.** Do not rebuild it; extend it if needed.

### F7 — There is no `mutator` card type and no `tags` field

`CARD_TYPES` ([cardConstants.js:22](src/config/registries/cardConstants.js:22))
has task/recipe/combat/station/dungeon/quest/chest/blueprint/invasion/recruit/
pack/…/project. No mutator. Cards carry a single skill/subskill, and
`TARGET_CATEGORIES` ([constants.js](src/systems/effects/constants.js)) is a
flat single-valued list — insufficient for multi-tag matching (§15.4).

### F8 — Locked slots already exist

`DeckSlotManager` already supports locked slots via `slot.isLocked` and
`slot.hazard`, enforced in `getAvailableCardsForSlot`, `slotCard`, `unslotCard`
and `swapSlots` ([DeckSlotManager.js:91-203](src/systems/loop/DeckSlotManager.js:91)).

**Consequence:** the Phase 8 Area Anchor needs **no new locking machinery** —
slot 0 just needs `isLocked: true` in the Area Blueprint. This was flagged as a
possible prerequisite; it isn't.

### F9 — `PROJECT` card type is retired

Per `CLAUDE.md`, Projects were retired in favour of Guild Hall upgrades, but
`CARD_TYPES.PROJECT` and `template.isProject` branches still exist in
`WorkProcessor`. **Do not build on them.** Flag as separate cleanup; do not
fold into this work.

---

## Phase 0 — Reality check & scaffolding

**Goal:** confirm the findings above still hold, and land the inert scaffolding
everything else depends on.

1. Re-verify F1–F9 against the current code. If any has drifted, **stop and
   report** before proceeding — the plan depends on them.
2. Add `ACTION: 'action'` to `CARD_TYPES` (§15.16) — one type covering both
   Mutators that stamp Tokens and consumables that apply Status Effects. The
   card's **traits** distinguish them; do not add a subtype field.
3. Create `src/systems/effects/TokenRegistry.js` — a data-driven registry of
   token definitions, mirroring the shape and conventions of
   [`statusRegistry.js`](src/config/registries/statusRegistry.js). Empty of
   real content this phase; schema and doc comment only.
4. Create `src/tests/Mutators.test.js` with the baseline test scaffold.

**✅ Smoke test:** `npm test` still 129/129 (plus any new trivially-passing
tests). Game boots, deck loop runs unchanged. Nothing player-visible changed.

---

## Phase 1 — Two-Bucket modifier engine

> [!WARNING]
> **Highest-risk phase in this roadmap.** It touches every modifier consumer in
> the codebase. Budget a full session. Do not bundle anything else into it.
>
> **Balance drift is explicitly NOT a concern** [DECISION 2026-07-19]: all
> current content is test content. Do not spend time producing before/after
> comparison tables or retuning constants to preserve existing numbers. Correct
> math per §15.3 is the only goal.

**Goal:** convert `ModifierAggregator` from `Base × (1 + Σmods)` to
`(Base + Σadditive) × (Σmultipliers)` per §15.3.

1. Rewrite [`ModifierAggregator.js`](src/systems/effects/ModifierAggregator.js)
   with two buckets. Rules from §15.3:
   - Base sits **inside** the additive bucket.
   - Multiplier bucket defaults to **×1** when empty.
   - Multipliers **sum**, they do not compound (three ×2 → ×6, not ×8).
   - Negative multipliers are legal; final bucket **clamps at 0**.
2. Migrate every caller. Known consumers: `StatProcessor` (workcycle + combat),
   `AreaModifiers`, `WorkProcessor`, hero/equipment aggregators. **Search for
   all of them — this list may be incomplete.**
3. Fold the F4 multiplicative chain (`localMult * areaMult * toolMult *
   masterySpeedMult`) into the multiplier bucket.
4. Add unit tests pinning the §15.3 rules explicitly: multipliers sum (three ×2
   → ×6), empty bucket defaults to ×1, negative multipliers clamp at 0.

**✅ Smoke test:** `npm test` green. Boot the game, run a full Cycle in a real
area with a station buff and an equipped tool active, and confirm work times
and yields are *sane* — not that they match the old values. Numbers moving is
expected and fine.

---

## Phase 2 — Card tags

**Goal:** every Card carries a `tags: []` array that mutators can match against.

1. Add `tags` to the card template schema and to `CardFactory.createInstance`.
2. **Auto-seed from existing data** (§15.4): derive initial tags from each
   card's skill/subskill so the catalog needs no hand-audit. A Fishing task
   should come out as `['Fishing']` with no authoring.
3. Hand-add flavour tags where they matter: `[Aquatic]`, `[Hazard]`,
   `[Social]`, `[Gathering]`. Keep this list small and documented in the
   registry — do not tag the whole catalog speculatively.
4. Tags are **case-normalised on read**. Pick one canonical casing and enforce
   it; do not let `'Fishing'` and `'fishing'` both circulate.

**✅ Smoke test:** unit tests asserting derived tags for a gathering card, a
processing card and a combat card. In-game, no visible change.

---

## Phase 3 — Token data model & lifecycle

**Goal:** tokens can be attached to deck slots, read back, and wiped.

1. Create `src/systems/effects/SlotTokens.js` — a runtime-only registry keyed
   by `areaId` → `slotIndex` → `Token[]`, explicitly **not** serialized (F3).
   Follow the `AreaModifiers.js` module pattern and copy its doc-comment style
   explaining *why* it isn't in `GameState`.
2. Token shape per §13 / §15.8, using §16 terminology:
   ```js
   { tokenId, sourceCardId, additive: {}, multiplier: {}, charges }
   ```
3. Wire the wipe into the Cycle boundary at `_advance()` (F2).
4. Apply tokens to the card in `_materializeCard()` (F1) — this is where a
   slot's tokens become a live card's modifiers.

**✅ Smoke test:** unit tests — attach tokens to a slot, materialize the card,
assert the modifiers landed; advance a full Cycle, assert tokens are gone.

---

## Phase 4 — ACTION cards & stamping

**Goal:** working a Mutator stamps Tokens onto the correct upcoming slots.

1. Mutator definitions with `target_tags` plus **either** a charge count or an
   area-wide flag (§15.14).
2. **Both targeting modes:**
   - **Charges** — walk the remaining slots in the current Cycle, stamp the
     first N whose tags match. **Surplus charges are wasted, never carried.**
   - **Area-wide** — stamp *every* matching slot remaining in the Cycle.
3. Both modes are **forward-only**: a Mutator never affects a slot already
   worked this Cycle.
4. A Mutator takes **normal Work Time** (§15.15) — it's just another Card, so
   `LoopRunner` should need no special-casing. If it does, that's a signal
   something is wrong; report it.
5. Acquisition (§15.7): basic mutators are permanent library cards, powerful
   ones are consumed on use. Wire **both paths**, but note that *which*
   specific mutators fall into which bucket is deferred to the content phase
   [DECISION 2026-07-19] — don't block on it.

**✅ Smoke test:** build a deck of `[Trawler] → [Fishing] → [Fishing] →
[Mining]`, work it, and confirm both Fishing slots get the token, the Mining
slot doesn't, and a third charge is silently wasted. Repeat with an area-wide
mutator and confirm it hits both Fishing slots regardless of charge count.
Verify in the running game, not just in tests.

---

## Phase 5 — Yield / Time / Cost axes

**Goal:** tokens actually change what a Card produces, costs, and takes.

1. **Yield** — through the Two-Bucket engine into loot generation.
2. **Time** — into `card.currentTickTime` via `StatProcessor`.
3. **Input Cost** — into `consumeInputs()`.
4. **Hard floors** (§10): time never below the minimum threshold, cost never
   below 1 unit. Enforce these in **one** place, not at each call site.
5. **One shared bucket pair** (§15.12): hero Status Effects, card Tokens, gear
   and station buffs all feed the *same* buckets per axis. There is no separate
   hero stage. A strong Haste fully cancelling a Trawler's Time ×2 is the
   intended, accepted behaviour — do not add a guard against it.

**✅ Smoke test:** a Trawler-stamped Fishing card visibly takes ~2× as long and
yields ~2× the fish. Confirm the floors hold by stacking absurd amounts of
Haste against a Time penalty.

---

## Phase 6 — Failure states

**Goal:** Cards can fail, and failure costs the player time and tokens.

1. **Fix F5 first.** Introduce a pre-flight check that runs *before* both
   `handleTaskReward()` and `consumeInputs()`. This is a real bug fix and
   should be its own commit with its own test.
2. Failure conditions in scope (§15.9):
   - **Missing input resources** → full work time spent, no inputs consumed,
     no yield, **token still consumed**.
   - **Bank capacity overflow** → same. Wire the existing bank slot-capacity
     check (see `InventorySlotCap.test.js`) into the pre-flight.
3. **Out of scope:** Exhausted-style hard status lockouts, tool-tier checks.
4. **End of Work fires on failure too** (§16) — a failed Card is a full
   resolution that produces nothing, not a no-op.

**✅ Smoke test:** deliberately starve a Card of inputs and confirm: full time
elapses, nothing consumed, nothing produced, token gone. Then fill the bank
and confirm overflow fails the same way.

---

## Phase 7 — Combat axis (Hex)

**Goal:** Mutators can debuff enemies.

Per §15.13, a combat-targeting token does **not** get its own math axis. It
sits on the combat slot and, when that card materializes, applies real Status
Effects to the spawned enemy via the existing `StatusEffectSystem` — the same
path a weapon proc already uses.

1. Combat cards must carry tags (Phase 2) so they're visible to targeting.
2. Token declares which status IDs to apply and at what stack count.
3. Apply at materialization (F1), against the **enemy** entity, not the card.
4. Enemy statuses are already supported — this is Absolute Parity (§7). **Do
   not build a parallel enemy-debuff mechanism.** If the existing system can't
   express something, report it rather than working around it.

**✅ Smoke test:** work a Hex mutator, then reach the combat card, and confirm
the enemy spawns already Poisoned with the status placard visible, and that
the DoT actually ticks it down during the fight.

---

## Phase 8 — Area Anchor

**Goal:** an Area applies its global modifiers through a locked Mutator in slot
0, not through invisible per-area penalties (§7).

1. Area Blueprint support for a **locked slot 0** the player can't fill or
   remove.
2. The anchor is an ordinary ACTION card using **area-wide targeting**
   (Phase 4) — it should require no bespoke broadcast machinery.
3. This is the proving ground for area-wide mode. If the anchor needs
   special-casing beyond "locked slot", the area-wide implementation is
   probably wrong — report it.

> [!NOTE]
> **Do not retire `AreaModifiers.js` in this phase.** Migrating existing station
> passive buffs onto the token system is a sound end state but was explicitly
> kept out of this slice. Flag it as follow-up work.

**✅ Smoke test:** enter an area whose blueprint has an anchor, confirm the
Hero works it first, and confirm its effect visibly lands on every matching
Card in the deck for that Cycle and is gone the next Cycle.

---

## Phase 9 — Token UI & tooltips

**Goal:** the player can see and understand their combo.

1. Token badges on card faces, including **face-down Upcoming cards** (§12
   anticipation rule — this is why F1's slot-based model matters).
2. Identical tokens condense into a numeric badge (`×50`) — §7.
3. **Tooltip tracing** (§12): show both the mathematical effect and its source
   — `+2 Yield from 'Trawler'`. This is the player's only tool for debugging a
   large stack; treat it as a feature, not a nicety.
4. Failure visuals (§12): bold **"Failed!"** stamp, grey progress bar, and
   Area Overview highlighting of failed Cards.

**✅ Smoke test:** stack 5+ tokens on one Card and confirm the UI stays
readable, the badge condenses, and every token traces to its source. Check the
Upcoming queue shows tokens before the card is drawn.

---

## Phase 10 — Content catalog & counters

**Goal:** ship the §14 catalog in final terminology.

Abundance, Trawler, Hex, Cursed, Dam. (Midas is cut — §15.8.) Plus the §15.6
**targeted counter** model: each curative declares the specific token/status
IDs it removes, mirroring the `immune_to` array in §13. There is no generic
"strip all negatives" — Purify is always a named counter to a named affliction.

This is also where the §15.7 **reusable-vs-consumed split** gets decided per
card, having been deliberately deferred from Phase 4 [DECISION 2026-07-19].
Expect to work through it with the project owner rather than deciding alone.

**✅ Smoke test:** play a full Cycle using each catalog token at least once.

---

## Conventions for this work

- **Branch:** start from `main`, branch named `card-mutators`. Merge back when
  done and verified.
- **Commit granularity:** one phase, or one coherent slice of a phase. Never
  bundle a phase with unrelated cleanup (`CLAUDE.md` ground rule).
- **Update the Implementation Status table** in this file at the end of every
  phase, before starting the next.
- **Record changes in [`CHANGELOG.md`](CHANGELOG.md)** under `## [Unreleased]`.
- **`npm test` must be green before every commit.** Baseline is 129/129.
- **Verify UI-facing phases in the running game** (`npm run dev`). The type
  checker passing is not verification. Report what you actually observed.
- **One phase per session where practical**, with a fresh session per phase.
- If something turns out substantially bigger than its phase suggests, **stop
  and report** rather than improvising a larger change.

## Settled — do not re-ask

These were open at drafting and have since been decided [2026-07-19]:

- **Balance drift** — not a concern. All content is test content. Don't build
  comparison tables or retune to preserve old numbers.
- **Midas / output conversion** — cut from v1 (§15.8).
- **Reusable vs consumed mutators** — deferred to Phase 10 content work. Build
  both paths in Phase 4; don't block on which cards use which.
- **"Node" terminology** — §1–§14 of the design doc were reworked to say
  "Card". No stale terminology remains.
- **Stat layering** — one shared bucket pair (§15.12).
- **Combat targeting** — in v1, via `StatusEffectSystem` (§15.13).
- **Targeting modes** — both charges and area-wide (§15.14).
- **Mutator work time** — normal Work Time (§15.15).
- **Card type** — `ACTION`, covering mutators and consumables (§15.16).

## Open questions

1. **Retiring `AreaModifiers.js`** — migrating station passive buffs onto the
   token system is the clean end state but was kept out of this slice. Raise
   as follow-up once Phase 8 proves the anchor works.
2. **`CARD_TYPES.PROJECT` cleanup** (F9) — orphaned, unrelated to this work.
   Flag separately; do not fold in.

---

## Handoff Prompt

*The project owner uses this to start each implementation session. If you're an
agent picking this up, follow it as written.*

> I'm implementing the Card Mutator system. Before writing any code, get oriented:
>
> 1. Read `CLAUDE.md` — project ground rules and working practices.
> 2. Read `status_effects_plan.md`, focusing on **§15 (Resolved Decisions)** and
>    **§16 (Lexicon)**. These are locked and override anything earlier in that
>    document that contradicts them.
> 3. Read `mutator_roadmap_v1.md` in full — the authoritative plan. Pay
>    particular attention to:
>    - The **Implementation Status** table — tell me which phase we're on.
>    - The **Architecture Findings (F1–F9)** — these were verified against real
>      code and shape the whole plan.
>    - The **Settled — do not re-ask** list. Those are closed.
> 4. Confirm you're on the `card-mutators` branch (or create it from `main` if
>    this is the first session) with a clean working tree.
> 5. **Sanity-check the findings.** Confirm F1–F9 still hold — particularly F1
>    (upcoming cards are not objects; tokens attach to slots) and F5 (outputs
>    are granted before inputs are consumed). If any has drifted since
>    2026-07-19, that changes the plan.
>
> Then **stop and report back**: what phase we're starting, what it involves in
> plain language, and any open questions or contradictions you found — either
> in the roadmap or between the roadmap and the current code. **I don't code
> myself, so explain anything technical in plain terms.**
>
> **Do not write any code yet.** Once I give the go-ahead, implement that phase,
> run its smoke test, update the Implementation Status table, commit, and stop
> before moving to the next one. If a phase turns out bigger than described,
> tell me rather than improvising.
