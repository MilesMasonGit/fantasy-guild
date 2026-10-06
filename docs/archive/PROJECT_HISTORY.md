# Fantasy Guild — Project History

Archive of the status/history sections that used to live in `CLAUDE.md`, moved
out on 2026-07-26 to keep that file short. This is reference material, not
instructions — it is a snapshot of what was true on the date each section says,
and it is **not kept up to date**. The roadmap docs it links to are the live
records.

---

## CMS Rework — 🟡 IN PROGRESS on `cms-rework` (from 2026-07-22)

The standalone content tool in [`cms/`](cms/) (React/Vite, port 5175) is being
reworked to catch up with the game and make authoring faster and sync safe.
**Before any work on the CMS — items, cards, areas, the balance engine, or the
`data/` sync — read, in order:**

1. [`cms_rework_concept.md`](cms_rework_concept.md) — the owner's vision and the
   reasoning behind each decision.
2. [`cms_rework_roadmap_v1.md`](cms_rework_roadmap_v1.md) — **the authoritative
   plan.** Implementation Status table, **25 Locked Decisions** (§2, they
   override the concept doc), 15 verified findings F1–F15, the card-type
   inference ruleset (§4), and 10 phases with smoke tests. **Start here.**

The governing principle (owner's words): **engine logic lives in the game; the
CMS provides content.** Definitions (skills, card types, tags, equip slots) flow
game → CMS; content flows CMS → game.

Progress: **Phases 0–3 complete and verified** on `cms-rework`. Phase 3 replaced
the destructive whole-file sync with a field-level merge + preview + staged
deletion, so **"Sync to Game" is now safe** — an unchanged import→sync is a
no-op, and edits write only the changed fields, preserving mutators, tokens,
`deckSlots` and card tags. (The earlier "don't sync" warning is lifted on this
branch.) Next: Phase 4 (unified card editor — UI-facing).

## Baseline: v0.3.1 (tagged 2026-07-21)

The Card Mutators & Tokens feature was merged into `main` and tagged
**`v0.3.1`**. `card-mutators` is now identical to `main` and is no longer the
working branch. (The previous baseline, `v0.3.0`, covered the Area Deck Loop
rework and the six code-review fix waves.)

- **`v0.3.0` and `v0.3.1` are permanent rollback points.** `git checkout v0.3.1`
  returns the code to this exact snapshot at any time.
- Baseline health at v0.3.1: **283/283 tests green**, `npm run build` clean.

Remaining backlogs: `rework_cleanup_todo.md`, `deck_loop_task_list.md`,
`ui_bugfix_tracker.md`, plus any code-review tickets still open in
`code_review_findings.md`.

## Hero Dock — ✅ COMPLETE on `hero-dock`, awaiting merge (2026-07-22)

The pop-out hero side drawer is gone, replaced by an always-visible bottom
**Hero Dock**. **All 10 phases (0–9) are done and verified in-game.**
325/325 tests, clean build. **Before doing any work on heroes, hero equipment,
the roster, or the dock, read:**

1. [`hero_dock_concept.md`](hero_dock_concept.md) — the owner's design vision.
2. [`hero_dock_roadmap_v1.md`](hero_dock_roadmap_v1.md) — the authoritative
   record: an Implementation Status table, **12 locked decisions** that
   override the concept doc where they disagree, architecture findings F1–F9
   (**F5 was overturned in Phase 8 — read its note**), and the per-phase smoke
   test results. **Start here.**

What changed, in short:
- Hero equipment went from 2 slots to **six** — Hand, Hand, Hat, Chest,
  Trinket, Trinket. Items declare a *category*; heroes hold *slot instances*.
  Combat's "the weapon" means the **primary** one: the first occupied hand.
- The **Bench is retired entirely.** The roster is the whole roster,
  `rosterLimit` caps it, and recruiting is refused at the cap rather than
  overflowing. Retirement is the only way to free a slot.
- The side drawer, `HeroInspection`, the Heroes bubble and the pre-rework
  `HeroIdentityStrip` + `components/hero/*` set are **deleted**. Hero actions
  live in the **Edit** modal on a pinned dock card.
- **Saves were broken deliberately** — `GAME_VERSION` is `0.4.0`. Do not write
  migration logic for older saves.

**Two known issues, both pre-existing and deliberately not fixed here** (each
has an owner decision waiting; see the roadmap's Phase 1 and Phase 2 notes):
- A weapon's damage is **counted twice** in `getHeroDamageRange`.
- Most of the equipment effect vocabulary is **wired to nothing** — only
  `damage`, `defense`, `accuracyBonus` and `resistance` reach the game. Check
  that table before authoring gear.
- Also: `retireHero` refuses when the payout doesn't beat the recruit cost, so
  a roster of low-level heroes can't retire anyone to make room. The Edit modal
  now explains this, but the rule itself may want revisiting.

## Card Mutators & Tokens — ✅ COMPLETE (merged to `main`, tagged v0.3.1)

**All 11 phases (0–10) are done.** One check is outstanding: a token badge has
never been *seen* rendering in the live game — see the note at the top of
`mutator_roadmap_v1.md` for the manual drag that closes it out. **Before doing
any work on mutators, tokens, status effects, or card tags, read:**

1. [`status_effects_plan.md`](status_effects_plan.md) — the design. **§15
   (Resolved Decisions) and §16 (Lexicon) are LOCKED** and override anything
   earlier in that document that contradicts them.
2. [`mutator_roadmap_v1.md`](mutator_roadmap_v1.md) — the authoritative
   implementation plan, with an Implementation Status table, verified
   architecture findings (F1–F9), 11 phases with smoke tests, and a session
   handoff prompt. **Start here.**

Key locked decisions: **Three-Bucket** math
`(Base + Σflat) × (Σmult) × (1 + Σpct)` everywhere — multipliers sum rather
than compound, and percentages sum as percentages and never inflate one
another (revised 2026-07-20 from an earlier Two-Bucket model); durations
counted in Cards, except DoTs which keep the 5s tick; Purify is a targeted
counter (Antidote→Poison), never a generic negative-stripper; **"Node" is
retired — the term is "Card"**.

Build order: Card Mutators first, Status Effect retrofit second. Tool Tiering
and the flat-vs-percentage combat stat conversion are explicitly deferred.

### Where it stands (2026-07-21)

Working: card tags, slot-stamped Tokens, the Three-Bucket math, the
yield/time/cost axes with hard floors, card failure states, enemy Hexes, the
Area Anchor, the "FAILED!" stamp, and a §14 token catalog with four Mutator
cards obtainable from packs. **286/286 tests, build clean.**

**Three things are open — see the Phase 9/10 rows and the callout note in
[`mutator_roadmap_v1.md`](mutator_roadmap_v1.md):**

1. **A token badge has never been seen rendering.** Everything upstream is
   verified and the badge data is unit-tested; what is missing is one
   arrangement — a Mutator placed *before* a matching card, with the loop then
   run past it. It could not be staged from an automated session because
   reordering deck slots needs a drag that cannot be simulated. **With a mouse
   this takes seconds** and is the check to run before Phase 9 is marked ✅.
2. **A Mutator in the LAST deck slot silently stamps nothing** — forward-only
   targeting leaves it nothing to mark, and "Add to Deck" fills the last empty
   slot, so the natural way to add one is the one way it does nothing. Needs a
   UX warning or an authoring rule. Logged as tracker #10.
3. **The reusable-vs-consumed split (§15.7)** is still undecided — the
   `consumeOnUse` plumbing exists but no Mutator opts in.

## Major Rework: Playmat → Area Deck Loop System — ✅ COMPLETE (2026-07-17)

**All phases (0–9) of this rework are implemented and verified.** The deck
loop is the only system; the old playmat/grid code, the `USE_DECK_LOOP`
feature flag, and their tests were deleted in the Phase 9 sweep.

**Before doing any work related to areas, cards, decks, or stations, read:**

1. [`playmat_rework_concept_v1.md`](playmat_rework_concept_v1.md) — the design vision (why we're doing this, what the end state looks like).
2. [`playmat_rework_roadmap_v3.md`](playmat_rework_roadmap_v3.md) — the authoritative implementation plan. This is the **current source of truth**; ignore `playmat_rework_roadmap.md` and `_v2.md` (earlier drafts, kept for history only).
   - Check the **Implementation Status** checklist near the top of this file first — it tracks which phase is in progress and what's already done.
   - **Appendix A-1** ("Gap-Analysis Decisions Log") records locked design decisions and why — check it before re-deriving a decision that's already been made.

### Ground rules for this rework
- All implementation work happens on the **`deck-loop-rework`** branch, not `main` or `overhaul-dev`.
- The rework is gated behind a `USE_DECK_LOOP` feature flag (added in Phase 0) — `main`/production must keep working with the flag off at every phase.
- **Save compatibility is intentionally broken** by this rework (locked decision) — old saves will refuse to load post-Phase-2, by design. Do not spend effort writing save-migration logic for the old schema.
- ~~There is a large, **unrelated, abandoned** set of uncommitted changes sitting in the working directory (an old 2D-grid-consolidation effort).~~ **Resolved 2026-07-07:** these were discarded with the project owner's approval during Phase 0 (§-1 pre-phase cleanup).

### Session Kickoff Prompt (historical)

> I'm resuming work on the Playmat → Area Deck Loop rework for this game. Before we do anything else, get oriented:
>
> 1. Read `CLAUDE.md` at the repo root — it has the ground rules and working practices for this project.
> 2. Read `playmat_rework_concept_v1.md` — the design vision for what we're building.
> 3. Read `playmat_rework_roadmap_v3.md` in full — this is the authoritative implementation plan. Pay particular attention to:
>    - The **Implementation Status** table near the top — tell me what phase we're actually on.
>    - **Appendix A-1** (Gap-Analysis Decisions Log) — these are locked decisions; don't re-litigate them.
> 4. Confirm you're on the `deck-loop-rework` branch.
> 5. Do a quick sanity check of the current codebase against what the roadmap assumes for the phase we're about to start — confirm the files the roadmap references still exist and look the way the roadmap describes. Flag anything that's drifted since the roadmap was written.
>
> Once you've done that, **stop and report back to me**: summarize what phase we're starting, what that phase involves, and any open questions or ambiguities you found — either in the roadmap itself or between the roadmap and the current code. I don't code myself, so explain anything technical in plain terms.
>
> **Do not write any code yet.** I want to confirm your understanding and answer any questions first. Once I give the go-ahead, implement that phase, then stop again before moving to the next one — verify against the phase's smoke test criteria before telling me it's done, and update the Implementation Status table when it's actually verified working.

## Code Review — ✅ COMPLETE (2026-07-17) → Fix Waves

The full 8-session codebase review is **done**: 53 tickets
(CR-001–CR-054), zero P0s, all filed in
[`code_review_findings.md`](archive/docs/code_review_findings.md). Its **FINAL
SYNTHESIS** section is the authoritative fix plan — six prioritized waves.
[`code_review_guide.md`](archive/docs/code_review_guide.md) is kept for methodology
history. Verdict: the rework is sound; the debt is overwhelmingly orphaned
pre-rework code, so fixing is mostly deletion plus small corrections.

### Ground rules for fix sessions
- Work stays on **`deck-loop-rework`**; one wave (or a coherent slice of
  one) per session; commit per ticket or small related groups.
- **Update ticket Status lines** in `code_review_findings.md` as you go
  (`Fixed (date, commit)`), never delete tickets.
- **Wave order matters**: CR-035 lands first (missing imports that crash
  once later waves re-wire mastery/projects); CR-053's engine tests land
  **before** Wave 4 (the big deletion sweep).
- Decisions already locked 2026-07-17: instant combat escape is
  intentional (CR-020); hero food/drink retired (CR-029); ALL features
  scale under banked time (CR-002/022/033); single active-area concept
  retired, per-area music deferred (CR-005); bank slot capacity is a
  real enforced limit (CR-039); Area Mastery shelved — dormant, §J
  (CR-036); Projects retired outright, Guild Hall upgrades are the
  replacement (CR-038).
- `tools/reachability.mjs` re-checks for unreachable files after
  deletions (`node tools/reachability.mjs`).

### Fix Session Kickoff Prompt (historical)

> I'm starting a code-review fix session. Get oriented first:
>
> 1. Read `CLAUDE.md` (this file) — ground rules for fix sessions.
> 2. Open `code_review_findings.md`: read the FINAL SYNTHESIS wave plan,
>    then the full ticket text for every ticket in the wave I name below
>    (follow their Related links too).
> 3. Confirm you're on `deck-loop-rework` with a clean working tree.
> 4. **Stop and report back**: list the wave's tickets in the order you'd
>    fix them, what each fix involves in plain language, and any conflicts
>    or open questions you see. I don't code — keep it plain.
>
> After my go-ahead: fix one ticket at a time, run the tests, verify
> UI-facing changes in the running game, update each ticket's Status line,
> and commit as you go. Stop and show me anything that turns out bigger
> than its ticket suggested rather than improvising.
