# Brief: Write the Implementation Roadmap for the 7×7 Playmat Rework

You are being asked to **plan an implementation, not to implement it.** Your deliverable is a roadmap document. Do not write game code during this task.

---

## 1. How to work with the owner

* **They don't code.** Explain everything in plain language — especially git, file layout and anything architectural. Say what a thing does and why, not just its name.
* **Ask, don't assume — as multiple choice.** When a decision isn't already made somewhere, stop and ask. Give labelled options with the trade-offs spelled out and your recommendation first. Never open-ended, never a guess.
* **Challenge them.** Point out contradictions with what's already decided, and gaps they haven't noticed. They have said repeatedly that this is the most valuable thing an agent does for them. Do not simply agree.
* **Verify before saying something is true.** The design documents contain claims about the codebase that were written from memory and are not all accurate. Check them.

---

## 2. Read these first, in this order

All in the repo root:

| Document | What it is |
| :--- | :--- |
| `playmat_grid_concept.md` | **Start here.** The board, Tokens, adjacency, the economy, Maps, combat. Settled at the mechanism level. §10 is the port inventory; §12 is open questions; §13 is risks. |
| `playmat_decisions.md` | **The reasoning behind every D-nn across all four specs, currently running to D-214.** This file exists to stop settled ground being re-litigated. Read it before proposing anything that touches a decision. |
| `playmat_ui_concept.md` | Layout, the tile, feedback, interaction. |
| `playmat_hero_concept.md` | What a hero is. **Mostly out of scope this pass — see §4.** |
| `playmat_skills_concept.md` | What a skill is. **Entirely out of scope this pass — see §4.** |

### ⚠️ Two documentation traps

1. **`docs/archive/` is misleadingly named.** The files called `playmat_rework_concept_v1.md` and `playmat_rework_roadmap_v1/v2/v3.md` document the **Area Deck Loop** — the system this rework *replaces*. They are not about the 7×7 playmat despite the filenames. **Do not read them as current design.** They are useful for exactly one thing: `playmat_rework_roadmap_v3.md` is the **house style** your roadmap should follow (see §6).
2. **Many other root-level docs are stale or superseded** — `skill_mapping_concept.md`, `loop_mechanics_concept.md`, `deck_loop_task_list.md`, `area_deck_rework_*` and others describe the outgoing system. `PROJECT_HISTORY.md` is background only.

---

## 3. What this pass delivers

**D-108's vertical slice: one Map's worth of content, progression stubbed.**

The design's own stated position is that *the most uncertain claim is that the board itself is enjoyable*, and that nothing downstream is worth authoring until that is tested. Plan accordingly.

**In scope:**

* The 7×7 board — 49 tiles, centre Guild Hall, 48 usable (D-1, D-106)
* Token placement, the Tray, the Token Bank and item Bank (D-86/D-107, D-137, D-138)
* Token execution — cycles, inputs, outputs, depletion (ported from the card model, D-79)
* Adjacency — the 8-neighbour rule, context-defined recipes, buffs (D-81, D-18/19/20, D-119/D-120)
* Heroes placed on Tokens, one per Token, displacement rules (D-57, D-111, D-134, D-143, D-147)
* **Combat, ported** — a hero dropped on an enemy Token starts the existing 7-stat fight (D-136, D-90)
* Loot sprites and collection (D-40/41/42, D-158)
* Managers (D-35, D-104, D-140, D-151)
* Maps and the Cartographer, at whatever depth the slice needs (D-98, D-142, D-155)
* **Content authoring as its own phase** — the card-by-card conversion pass (D-173) plus the first Map's kit, roughly 15 Token types, hand-authored (D-161)

**Out of scope, explicitly:**

* **The entire skills rework.** See §4.
* **The hero rework** — the six-slot sheet, the job tree, promotion, recruitment.
* **Minions** (D-206–D-212). Designed, not built.
* **The CMS rebuild** (D-109). Token content is hand-authored JSON this pass.
* **Hazards, events, invasions** — suspended.
* **Offline progress**, prestige, quests.

---

## 4. The skills and heroes decision — read this carefully

The owner paused skill and hero design mid-session. **`playmat_skills_concept.md` is design-ahead, not a build target.** Nothing in it — the six-slot sheet (D-180), the three combat skills (D-196), the three-layer list (D-205), D-192 through D-214 — is implemented this pass.

**Instead: port the existing 15-skill and hero systems as they are.** `src/config/registries/skillRegistry.js` stays. Heroes keep all 15 skills. Existing card data's `skillRequired` tags survive the card→Token conversion untouched. The owner will rework the list later.

**This does not violate D-66** ("the skill list is redesigned from scratch, not migrated"). It postpones it. **Say so explicitly in the roadmap**, or a future session will read the skills doc as a build target and start building it.

**Port fidelity is "only what the board forces."** Things with nothing left to attach to fall away because they have no consumer, not because you decided to cut them:

* **Energy** — the existing cost is 2 per card *draw*, and a board has no draws. It strands itself. (D-183 had already cut it by design.)
* **Hazard-avoidance traits** — no hazards exist on the board.
* **Item durability** — replaced by Token depletion (D-118), and `DurabilitySystem` retires.

Everything else — traits, rolled classes, current equipment slot count — **ships unchanged**. The roadmap should carry an explicit **deferred-decisions table** listing every settled hero/skill decision that is knowingly *not* being implemented, so none of it is silently lost.

---

## 5. Your first deliverable is a gap analysis, not the roadmap

`playmat_grid_concept.md` §10 asserts what survives, what rebuilds and what is deleted. **Those claims were written from design sessions, not from reading the code, and at least some are wrong.** The previous roadmap's gap analysis caught exactly this kind of drift — it cited a combat processor that nothing actually ticked.

**Before planning anything, verify §10 against the codebase and report the discrepancies.** Specifically:

* **§10.2 "Survives"** — the item Bank, the 7-stat combat engine, the status-effect engine, heroes and equipment, Guild Upgrades, the card schema and execution model, the nav bubble menu / drawers / inspection panel. Does each actually exist, work, and stand alone once the deck loop is gone?
* **§10.3 "Requires Rebuilding"** — the buff/modifier system. The claim is that `ModifierAggregator` and its Three-Bucket maths are keepable but `EFFECT_REACH`'s `loop`/`next_card` targeting must become "the 8 adjacent tiles", and that `LoopBuffs.js` and `AreaModifiers.js` both die. Verify.
* **The name collision.** `TokenRegistry.js`, `SlotTokens.js` and `TokenAxes.js` are an existing **card-mutator** system that stamps modifiers onto deck slot indices. It has nothing to do with the board Tokens this rework introduces. It most likely retires with the loop, freeing the name — but confirm, and if the concept is wanted, D-78 notes **Mark**, **Sigil** and **Condition** are free names.
* **The test suite.** 39 files, 563 tests, all currently passing. Audit which die with the deck loop, which port, and which cover code being kept. The owner needs to know their real regression coverage *before* deletion starts, because "tests green" becomes a hollow signal as suites vanish.

Report the gap analysis and let the owner react to it **before** you write the roadmap.

---

## 6. What the roadmap should look like

Follow the house style of `docs/archive/playmat_rework_roadmap_v3.md` — that structure worked well across a nine-phase build:

* **A locked-decisions note at the top**, stating what was settled in this revision.
* **An "Implementation Status" table near the top**, one row per phase, with a standing instruction to future sessions to check it first and update it as they go. Include date and branch/commit on completion.
* **Numbered phases** with a dependency diagram, each phase scoped to a coherent chunk of work.
* **Per-phase acceptance criteria.** The owner's standard, from `CLAUDE.md`: run `npm test`, and for anything visible on screen, run the game and actually exercise it — reporting *what was observed*, not that code was written.
* **A decisions log appendix** for calls made during planning.

Two constraints from `CLAUDE.md` that must appear in the roadmap:

* **Version numbers live in five files** and are bumped together: `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`. Current version is **0.4.2**.
* **Log changes in `CHANGELOG.md`** under `## [Unreleased]` as they land.

---

## 7. Build strategy — already decided

**Clean break on a long-lived branch. No feature flag.**

The previous rework used a `USE_DECK_LOOP` flag and paid for it: unwinding it cost 115 references across 37 files in a dedicated final phase. This rework replaces even more, so a flag would mean maintaining two entire games. Saves are wiped anyway (D-110 bumps the version gate and refuses older saves), so there is nothing to stay compatible with.

**Accepted cost, and the roadmap should acknowledge it:** there is no playable game until the slice works, and there is no flag-off regression test to catch collateral damage. Propose how to mitigate that — the test-suite audit in §5 is part of the answer.

**Branch:** design work currently lives on `rework/playmat-7x7-grid`, which is five commits ahead of `main` and contains everything `main` has. The implementation branch should descend from it (or from `main` after it is merged). Recommend one to the owner and explain the trade-off in plain language. Do not implement on `main`.

---

## 8. Known traps

* ⚠️ **The CMS's "Sync to Game" destroys unmodelled content** and must never be run against hand-authored Token data (D-109). The CMS rebuild is a separate, later project.
* ⚠️ **Combat pacing does not scale under time acceleration** (D-90). This was a survivable caveat when combat was an occasional card; combat is now permanent on the board. Any offline or fast-forward model has to address it deliberately.
* ⚠️ **D-127's first-come input allocation systematically starves deep chains** — a Token needing 1 Coal acts sooner than one needing 5, which inverts the pressure §6.2 intends. Flagged as risk 13, to be measured in the first balance pass.
* ⚠️ **D-213 downgraded D-51's supply-deadlock guarantee from structural to authored.** Because tool requirements on Resource Tokens are now per-Token, a player can hard-lock. The authoring rule that prevents it — every material needs at least one tool-free base Token — must survive into the content phase.
* **D-161 makes every Token's numbers hand-authored.** Roughly 60+ Tokens tuned individually, all in hand-edited JSON until the CMS exists. Risk 17. Watch the authoring cost during the first Map's content; if it is painful at 15 Tokens, say so.
* **Risk 7: visual clutter killed the previous spatial playmat.** The design asks for a worst-case full-board mock early — 48 Tokens with heroes, progress rings, alert marks and loot sprites together. Consider where that belongs in the phase order.

---

## 9. Rules of engagement

* **Flag and ask; never decide.** Anything not already in `playmat_decisions.md` comes back to the owner as a multiple-choice question. Anything that *contradicts* it gets flagged explicitly as a contradiction — do not quietly work around a locked decision.
* **Don't re-litigate the decisions log.** If you think something in it is wrong, say so plainly and say why, then let the owner rule. The log records what each call was chosen *against*, so read that before arguing.
* **Work in small slices.** The owner's stated preference: one coherent chunk per session, committed at the end, so there is always a clean rollback point.
* **Stay in scope.** If you spot something unrelated worth fixing, tell them — don't fold it into the current change.
* **Suggest commits; don't commit without asking.**

---

## 10. Useful numbers

| | |
| :--- | :--- |
| Board | 7×7 = 49 tiles, centre is Guild Hall, **48 usable** |
| Roster | 1 hero at start, ~8 at end |
| Cycle time | 10–30 seconds typical |
| Map burst | 3–6 items, single burst, consumed |
| Tray | ~15–20 slots |
| First build content | ~15 Token types |
| Current version | 0.4.2 |
| Test baseline | 39 files, 563 tests, all passing |
