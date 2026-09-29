# Code Review Round 3 — Autonomous Run Log

The director's running record while the owner is away (from 2026-09-28).
Rules of the run: `code_review_v3_master_plan.md` §10. Newest entries at the
bottom of the log. **Owner: start with "Questions waiting for you".**

---

## Questions waiting for you

*(Parked items, each as multiple choice with a recommendation first. Nothing
here blocked the rest of the run.)*

1. **Four art folders were left out of Git LFS**: `public/assets/archive/`,
   `maybe/`, `heroes/animations/waste/` and `enemies/animal/anim/waste/` —
   54 files, under 1 MB, none referenced by code. Should they be versioned?
   - **(A) Recommended: leave them out** — they read as scratch or discarded art.
   - (B) Track them too (one `waste` zip needs Windows long paths switched on first).
   - (C) Delete them.

2. **From R8 (UI/UX consistency)**: 11 questions, full options in
   `docs/review_v3/R8.md` §6. Recommendations in brief:
   - **Q1 Settings (13 inert controls)**: delete the 4 naming retired things;
     "coming soon" for the 4 you already ruled on; disable the other 5 until wired.
   - **Q2 Closing rule**: Escape closes the top-most layer; click-outside only
     for light popups; drawers never close on a stray click.
   - **Q3 Close button**: the red pixel-art cancel icon everywhere.
   - **Q4 Tooltips**: one shared gold-bordered tooltip; plain browser tips only
     on icon buttons.
   - **Q5 Notifications**: a coloured edge per type, and "×3" for merged repeats.
   - **Q6 Sci-fi words** ("Protocol Settings", "SYSTEM BOOT", "neural sync"):
     replace with plain words.
   - **Q7 Text sizes in code**: rewrite them to what actually renders (no
     visible change).
   - **Q8 Two ways to hide notifications**: keep only "Collapse".
   - **Q9 Dev Tools tab in Settings**: keep it visible (the only way to turn
     Debug Mode on in a shipped build).
   - **Q10 LayoutSandbox**: leave untouched.
   - **Q11 Reordering heroes in the Bank panel**: wire it like the bottom dock.

3. **From R9 (vestiges, docs, build)**: 5 questions, full options in
   `docs/review_v3/R9.md` §10. Recommendations in brief:
   - **Q1 Rules text still says "tile"**: say "where this one stands" and "on
     the nearest / a random free spot"; the Nearby hint becomes "Tokens within
     reach of this one".
   - **Q2 Tile-name rename**: rename code names and event strings together in
     one slice.
   - **Q3 ~45 history docs**: move to `archive/docs/` with an index.
   - **Q4 `.agent/` folder**: keep the art workflows, fix two guides, archive
     the rest (including `add-item.md`, which would make an agent write content
     the CMS then wipes).
   - **Q5 Scrap art in builds**: keep `archive`/`maybe`/`waste` art out of the
     build and the preload list (ties to question 1).

4. **From P2 (the benchmark)**: 3 questions, `docs/review_v3/P2.md` last section.
   - **Loot in the "realistic" scenario**: the bench assumes the player collects
     loot (auto-collect on), although the shipped default is off.
     **(A) Recommended: keep it on**, since a late-game player collects. (B) Use
     the shipped default. (C) Run both.
   - **The engine target** (1.5 ms at p99; today it's 3.2 ms).
     **(A) Recommended: keep 1.5 ms as the fix waves' goal.** (B) Relax it to
     3 ms. (C) Decide after the first fix wave.
   - **The computer's name in `bench/baseline.json`.**
     **(A) Recommended: keep it**, so a baseline says which machine it belongs to.
     (B) Drop it.

5. **From P3 (the in-game Perf HUD)**: 2 questions, `docs/review_v3/P3.md`.
   - **Should the HUD also work in a shipped build with Debug Mode on?**
     **(A) Recommended: no, dev builds only**; `npm run tauri:dev` already runs
     the real desktop app with it. (B) Yes, behind Debug Mode, so the exact
     player build can be measured, but the harness code ships to players (off).
   - **Certify frame rate on the dev build, or add a profiling build?** React's
     dev mode is slower than what players get, so dev numbers are pessimistic.
     **(A) Recommended: certify on the dev build and treat a near miss as
     "re-check".** (B) Add a small `build:perf` (a production build with
     profiling, never shipped) as its own ticket.

6. **From R1 (engine loop, clock, events)**: 4 questions, `docs/review_v3/R1.md` §8.
   - **Game time while playing**: **(A) Recommended: use a clock the PC can't
     move** (a monotonic timer) for time while the game is open, and the wall
     clock only for time away. Today, setting the PC clock back sends
     "negative time" through every system (CR3-101, confirmed by the director).
   - **A stalled station's warning**: **(A) Recommended: announce it once**, not
     10 times a second.
   - **Buff rebuilds**: **(A) Recommended: merge them to one per tick**; decide
     together with R2's findings.
   - **Unused clock pieces**: **(A) Recommended: remove them**, but keep the
     debug surface (`window.Game`) that testing depends on.

7. **From R3 (work, flags, rules)**: 3 questions, `docs/review_v3/R3.md` §7.
   - **Crafted Tokens with no charge count** (the Copper Woodaxe never wears
     out): **(A) Recommended: keep "no count = unlimited"**, but have the
     content check flag crafted/Shop Tokens that have none.
   - **Rule upkeep**: **(A) Recommended: let it also take matching loot from
     the mat, Bank first** (already open item 4 in the token-lifecycle feedback).
   - **Item rule moments**: **(A) Recommended: offer items only the two moments
     that actually fire** ("starting work", "engaging").

8. **From R4 (combat, heroes, effects, loot)**: 4 questions, `docs/review_v3/R4.md` §7.
   - **Kill loot and yield/double-loot/bonus rules**: **(A) Recommended: yes**,
     the same rules as station output.
   - **Timed effects' clock**: **(A) Recommended: game time**, like wounds and
     quest timers.
   - **Defeat clears timed effects too**: **(A) Recommended: yes**, and
     `Removes` should reach statuses too.
   - **The Wishing Well rewrites the Guild Hall on load** (wiping rules
     authored on the Hall): **(A) Recommended: keep its water separate.**

9. **From R7 (drag & drop, input)**: 4 questions, `docs/review_v3/R7.md` §7.
   - **Something let go over an open drawer** (today it lands on the mat
     hidden underneath, CR3-402): **(A) Recommended: it flies back, like any
     miss.** (B) Keep today's behaviour. (C) Drawers slide aside during mat drags.
   - **Keyboard access to ~150 mat Tokens**: **(A) Recommended: take them out
     of the Tab order** and drop the untrue "press space to drag" screen-reader
     text. (B) Build real keyboard dragging.
   - **Hover rings mid-drag**: **(A) Recommended: only the flags the Token
     would land in.**
   - **Escape during a drag**: **(A) Recommended: it only cancels the drag**
     (today it also closes the hero sheet and ends disallow mode).

10. **From R2 (board state, spatial physics)**: 2 questions, `docs/review_v3/R2.md` §8.
    - **Shrink speed target**: only the developer Mat Tuner can shrink the mat.
      **(A) Recommended: keep the 8 ms target for player actions only.**
    - **What a push moves** (today it separates every overlapping pair on the
      whole mat, CR3-151): **(A) Recommended: only the newcomer and whatever it
      pushes into.** It changes future pushes; saved layouts don't move.

11. **From R5 (UI ↔ engine boundary)**: 2 questions, `docs/review_v3/R5.md`.
    - **What the "MatBoard ≤ 1 re-render a second" target counts**: **(A)
      Recommended: MatBoard's own re-renders only**, with sprite animation
      frames given their own rule. (B) Every re-render inside the mat, as the
      HUD counts today.
    - **How UI components reach the engine**: **(A) Recommended: keep direct
      calls, with one new rule**: engine commands announce their own changes,
      and the UI never publishes engine events. (B) Route every command through
      one Commands module, best done later with the Stage 2 work.

13. **From R10 (expansion readiness, test coverage)**: 5 questions, `docs/review_v3/R10.md` §9.
    - **The 10 known test failures**: **(A) Recommended: mark them as expected
      failures in their test files**, so a new failure stands out automatically.
    - **Spike copies of the project**: **(A) Recommended: also link the CMS's
      packages into them**, so all tests run there.
    - **The benchmark fails when a speed fix changes the game's outcome**:
      **(A) Recommended: yes.** ⚠ The director is going ahead with this one
      before the fix waves, because it's tooling only and it is how "the game
      plays the same" gets proven. It's reversible; say so if you disagree.
    - **A one-sitting type-checking trial after the fix waves**: **(A) Recommended.**
    - **Hidden event errors in tests**: **(A) Recommended: count them first,
      then make new ones fail.**

14. **From R6 (drawing speed)**: 4 questions, `docs/review_v3/R6.md` §9.
    **Also: R6 §1 lists what to look at with your own eyes** (sprite crispness
    while walking, bubbles following walkers, ring smoothness, strike timing,
    limp pace, loot sparkles).
    - **Sprite shadows and glows are the frame-rate limit** (CR3-350). **(A)
      Recommended: keep the look, but draw shadows and glows as images
      instead of live filters.** (B) Remove them. (C) Keep them as they are and
      accept ~100–125 FPS on a busy mat.
    - **The cheap drawing fixes**: **(A) Recommended: the particle-canvas sleep
      now as an easy win (it changes nothing visible); the other four (walkers
      by transform, one ring clock, hero frames without React, the tutorial
      beacon) as one batch you look at before it merges.**
    - **Switching the mat to canvas drawing**: **(A) Recommended: don't decide
      now.** Do the cheap set and the shadow choice, let the engine fixes remove
      the 300-Token cliff, then measure a production build in session C.
    - **The particle burst cap** (dropped by mistake in `f8dcae0`): **(A)
      Recommended: restore it.**

12. **Uncommitted art in the main folder** (made 2026-09-29 12:00–12:50, not
    by the review): ~35 art files moved or renamed (ore, veins, foundations,
    planks). The art is now versioned in Git LFS, so this needs committing by
    whoever made it, and any content paths pointing at the old locations need
    updating through the CMS. **(A) Recommended: you (or your art session)
    commit it when finished; the review keeps its hands off.** (B) The director
    commits it as-is after checking nothing in the game points at a missing
    file.

---

## Log

| When (PDT) | What | Result |
|---|---|---|
| 2026-09-28 | Owner interview: director mode rules recorded (plan §10) | merged `a3228f7` |
| 2026-09-28 | Palette edits committed as-is (owner) | merged `10bca6a` |
| 2026-09-28 | **CR3-027: art under Git LFS** — 1,048 files; fresh worktree verified byte-identical; tests 10 known failures, unchanged | merged `5adc056` |
| 2026-09-28 | Wave 1 launched: P2 (bench build), R8, R9. All three stopped by a usage limit mid-run, then resumed with their context intact | — |
| 2026-09-28 | **R8 done** (UI/UX): 18 tickets, 1 P1 (CR3-450, a hero sheet that probably closes on the first click inside it). Director spot-checked CR3-451 and CR3-452: both hold | wave-1 commit |
| 2026-09-28 | **R9 done** (vestiges/docs/build): 16 tickets, no P1. Found the plan's §2.D stale and the real reason `nameRegistry` looks dead (a comment apostrophe fools the tool). Director spot-checked it: it holds | wave-1 commit |
| 2026-09-28 | **P2 done: `npm run bench` built.** Director re-took the baseline on a quiet machine; a compare re-run stays within 5 %. **S2 realistic p99 3.2 ms vs 1.5 target; S3 torture 68 ms (a cliff); push storm 60 ms vs 8.** Main causes: the Token list copied and sorted 47×/tick (CR3-001) and capped spawners retrying every tick (CR3-047). Memory is flat | merged `42181be` |
| 2026-09-28 | Wave 2 launched: P3 + R1–R4. All five stopped by a usage limit mid-run; resumed intact (two spike worktrees survived correctly) | — |
| 2026-09-28 | **P3 done: in-game Perf HUD** (`?stress=realistic`, `window.__perf.report()`, Copy report button). Director checked: game-source changes are dev-gated; the production `Profiler` is a pass-through. First reading (dev build, preview pane): **MatBoard re-renders ~40×/s at S2 vs a target of 1** | merged `f9af6ba` |
| 2026-09-28 | Wave 3 launched: R5 (UI↔engine), R6 (mat drawing), R7 (drag & input), each in its own browser tab | — |
| 2026-09-28 | Another usage-limit stop hit six agents; all resumed. Director confirmed `node_modules` intact after the spike cleanups | — |
| 2026-09-28 | **R1 done** (engine loop): 11 tickets, **2 P1 both confirmed by the director in code**: CR3-100, a new game's first save is written before the Guild Hall exists (a crash in the first 10 min leaves a dead slot); CR3-101, a PC clock change sends negative time through every system. Also measured: spawners are 53 % of the realistic tick; event batching is not worth bringing back; autosave is 0.7 ms | pending wave-2 commit |
| 2026-09-29 | Weekly limit hit; resumed after reset. R3 and R4 had finished writing just before | — |
| 2026-09-29 | **R4 done** (combat/effects/loot): 17 tickets, 1 P1: CR3-250, each kill triggers two whole-neighbourhood rebuilds (one for a hero who didn't move), 123–222 ms per kill on the torture board. Director confirmed it in code. R4 also caught a **director error**: P1 closed CR2-082 wrongly (the XP table is still unused, now CR3-258); corrected | pending commit |
| 2026-09-29 | **R3 done** (work/flags/rules): 7 tickets, 1 P1 (CR3-200: every enemy step empties the "who is near whom" cache). **Spikes for CR3-047 + CR3-004: S2 p99 4.6 → 2.2 ms, S3 p99 87 → 12 ms, identical game results**; adding CR3-200's fix would reach S2 p99 1.34 ms (under target). No error boundary anywhere yet (CR3-203) | merged `930d47c` |
| 2026-09-29 | **R7 done** (drag & input): 14 tickets, 1 P1: CR3-402, a Token or flag let go over an open drawer lands on the mat hidden underneath (director confirmed the code path; needs a hands-on check in session C). Every drop's legality is enforced in the engine, so round 2's worst failure shape is absent. Picking up and dropping likely re-renders all ~150 Tokens (CR3-400). 14 hands-on checks written for the owner | pending commit |
| 2026-09-29 | **R2 done** (board state, spatial): 9 tickets, 1 P1 (CR3-150 nudge search/shrink). **Spikes, identical positions checked by checksum: S2 p99 3.1 → 1.5 ms (at target), S4 worst arrival 56 → 13 ms, shrink 333 → 73 ms**. The Token-list cache (CR3-001) must reset only on add/remove; the director confirmed those are the only writers (`BoardState.js:209-229`). S4's refused drops are correct behaviour (FP-46); the scenario needs fixing (CR3-156). No leaks | merged `fbc1ebf` |
| 2026-09-29 | R10 launched (expansion readiness + the coverage plan for the fix waves) | — |
| 2026-09-29 | **R5 done** (UI↔engine): 12 tickets, 2 P1. **CR3-300: the dock HP bars go stale**, reproduced in the game (87/144 HP drawn at 35 %); director confirmed the selector pattern in `DockHeroFigure.jsx:75` and `HeroDockTab.jsx:70`. **The "~40 renders/s" is mostly hero sprite frames flipped through React (8 heroes × 8 fps)**; MatBoard's own full re-renders are 8.8/s, 90 % caused by enemy steps. `state_changed` is milder than feared. All 44 subscriptions paired; no rules enforced in the UI | merged `d75663f` |
| 2026-09-29 13:20 | Usage-limit stop hit R6 and R10; both resumed. **Found uncommitted art work in the main folder** (made 12:00–12:50 today: plank variants, ore and foundation art moved into new folders). Not made by any review agent; the director is leaving it untouched and will never stage it. See question 12 | — |
| 2026-09-29 | **R10 done** (expansion + coverage): 17 tickets, 0 P1. **Coverage plan: of the 15 P1 tickets, 0 are safe to fix blind, 12 need a test first, 3 need the owner's eyes; of 50 P2s, 14 are safe now.** The bench can't yet catch a speed fix that changes the game (CR3-550, now the first fix-phase job). The 10 known failures are all content drift or a retired premise. Several shipped-content gaps make some findings latent (no shipped aura, statuses or item rules yet) | merged `21119e5` |
| 2026-09-29 | Bench identical-results gate (CR3-550) + S4 scenario fix (CR3-156) launched, bench-only | — |
| 2026-09-29 | **R6 done** (drawing): 10 tickets, 1 P1. Measured in headless Chrome on the owner's GPU (dev build). **Filters are the frame-rate limit: S2 ~100–125 FPS with them, 164 FPS without (CR3-350).** The look-preserving cheap set takes S2 from ~99 to ~151 FPS and frames within budget from 38 % to 73 %. The web-page mat tops out around ~200 Tokens on this PC. Real bug: at 300 Tokens, 95 Tokens share one draw order (CR3-354). **All 10 review sessions are now done** | pending commit |
| 2026-09-29 | Z (fix plan) and C (certification checklist) launched in parallel | — |
| 2026-09-29 | **C done: `docs/review_v3/C.md`**, the owner's checklist: 9 setup steps + 27 checks (~25 min), optional bench run and 60-min soak; works through the desktop app (`npm run tauri:dev`). Two §4.4 rows can't be measured as written (the HUD counts the whole mat, CR3-356) and are marked so | merged `43d910f` |
| 2026-09-29 | **Bench identical-results gate done (CR3-550) + S4 fix (CR3-156).** `--compare` now exits 2 with "WORK CHANGED" if a change alters the game's outcome, separately from timing (exit 1). Proven: a 2 % enemy-stroll change → exit 2 naming the changed state; a code change that doesn't alter behaviour → "same"; a slowdown → exit 1. S4 now measures landing drops too (50/50 land). Timing stays noisy under load (re-run before believing a timing failure); the work check isn't affected by load | merged `2f6eba0` |
