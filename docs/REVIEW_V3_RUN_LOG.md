# Code Review Round 3 — Autonomous Run Log

The director's running record while the owner is away (from 2026-09-28).
Rules of the run: `code_review_v3_master_plan.md` §10. Newest entries at the
bottom of the log. **Owner: start with "Questions waiting for you".**

---

## Questions waiting for you

> ✅ **ANSWERED 2026-09-30** in an owner interview. The rulings are in
> **`docs/review_v3/Z.md` §11**; they supersede the list below, which is kept
> for the record. Still open: the **shadow/outline choice** (the spike is
> measuring the owner's hard-silhouette idea) and the **owner's CMS to-do**
> (see the log).

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
| 2026-09-29 | **Z done: the review is complete.** `docs/review_v3/Z.md`: 179 tickets, 18 live P1s, 0 P0s; 12 fix waves; 35 de-duplicated owner questions (**Z §7 is now the master question list, ordered by what each answer unblocks; start there**). Verdict: healthy codebase; 165 FPS is blocked by, in order: sprite shadow filters, four drawing habits, engine hot paths, MatBoard re-rendering when goblins walk | merged `90a439e` |
| 2026-09-29 | **Fix-phase test baseline: 11 failures** = the 10 known + `AssetManager` "every sprite exists on disk", caused by the owner's uncommitted art moves (content still points at the old paths). Not a code problem; fixes are judged against 11 | — |
| 2026-09-29 | Wave 0a started, then stopped by a usage limit before any change | — |
| 2026-09-30 | **Owner: easy wins ON HOLD until the owner has answered the questions (interview in progress). Commit the new art.** Art committed; ore veins and Stone Outcrop repointed to the new vein art through the sprite list (no content edit); 38 new sprites registered. Verified in the running game (all resolve to real PNGs); tests unchanged at 11 | merged `24551cf` |
| 2026-09-30 | **Owner's CMS to-do** (content, so the owner does it in the CMS): set Wood Foundation → `token_foundation_wood`, Stone Foundation → `token_foundation_stone`, the Stone item → `item_stone`; **retire the Copper Rubble Token** (its art is gone; owner: "we'll just have copper veins"). Then Sync to Game. The sprite test's last failure clears when Copper Rubble goes | — |
| 2026-09-30 | **Owner interview done**: the top 16 were answered directly, recommendations stand for the rest; rulings in `Z.md` §11. The owner designed the shadow approach (hard solid-black pixel silhouettes, sharp coloured outlines instead of the glow); a spike is measuring it. Fix phase restarted by the owner | merged `cbaa58f` |
| 2026-09-30 | **Wave 0a merged**: tools (reachability/cycles comment stripping, eslint config, HUD counts MatBoard's own renders, FPS counter hides under the HUD) and **63 new safety tests**; **the 10 known failures are now marked expected**. Tests: **1 failed** (only Copper Rubble's missing art, which clears when the owner retires it) / 3803 passed / 27 skipped. Bench: **same work** on all 6 scenarios; timing was uniformly slower, but the director showed `main` is equally slow under the same load (the shadow spike is running), so it's machine load. Partial: CR3-551 3 of 7 ids (their rename changes the bench fingerprint; needs its own accepted commit), CR3-557 1 of 3 suites (waits for CR3-157) | merged `7bae263` |
| 2026-09-30 | **Owner: model tiers to save tokens.** `.claude/agents/runner.md` (Haiku, low), `builder.md` (Sonnet, medium), `engineer.md` (Opus, high); dispatch by tier from now on. In-flight agents finished on their own model | this commit |
| 2026-09-30 | **Shadow spike done** (`SPIKE_shadows.md`): the owner's idea (hard silhouette + outline images replacing the glow) = S2 ~155-158 fps vs ~92 today, as fast as every effect off. **Owner rulings: 2 px hard shadow, ONLY on dragged Tokens and floating loot (nothing resting gets a shadow); outlines green/white/red; outline thickness to be tried at 1 screen-px vs 1 art-px** (`Z.md` §11 addendum) | this commit |
| 2026-09-30 | **Wave 0b merged**: CR3-010 particle sleep, **CR3-100 new game saved complete (checked in the game)**, CR3-258 XP lookup 1000× faster, CR3-109 autosave 2-3× faster with byte-identical saves, CR3-302 inspecting a hero no longer redraws the mat, CR3-023 two import cycles removed, CR3-106 event-name guard, CR3-509, CR3-507, **CR3-005 a stuck station warns once**. Director verified: tests 1 failed (expected) / 3817 passed; bench same work, no timing regression (quiet machine) | merged |
| 2026-09-30 | **Wave 1 merged** (Sonnet builder): CR3-001 cached Token list, CR3-047 spawner census, CR3-158, CR3-031 explicit tick priorities, CR3-150/003 faster placement. **S2 p99 3.06 → 1.30 ms: the 1.5 ms engine target is MET.** S2 p50 1.29 → 0.38; S3 p99 74 → 31 ms (still the cliff: Wave 3); S4 worst arrival 56 → 15 ms; shrink 335 → 171 ms; micro push at 300 Tokens 40 → 6.5 ms. Same work on every scenario (incl. S4 positions); tests 1 failed (expected) / 3821 passed. Director re-verified, then **re-saved the bench baseline** at the new speeds so later fixes can't silently give them back (one worst-of-50 number was noise on the first check; it was ok on re-run) | merged |
| 2026-09-30 | Owner rulings: refused equip → flies back + short message; crash → small "Something went wrong here" panel with Reload, rest of the game keeps working (`Z.md` §11) | — |
| 2026-09-30 | **Wave 2a merged** (Sonnet builder): **CR3-300 dock HP bars update** (seen live: 100 → 37), CR3-450 clicks inside the Bank-side sheet no longer close it (the playmat still does), **CR3-451 upgrade panel Close works** (seen live), CR3-405 refused equip bounces back with a reason, **CR3-203 error boundaries** (mat, dock, drawers, Shop, root), CR3-457 Bank hero reorder, CR3-033 Settings (4 retired controls deleted, 9 disabled "coming soon"). 29 red-first tests. Director verified: tests 1 failed (expected) / 3850 passed; bench same work, no regression; **the game boots clean into S2 with the new boundaries** (106 Tokens, 8 dock heroes, no fallback; a console error was shown to be stale from mid-edit by its module timestamp). Not live-tested: real drags (needs the owner's hands, session C). Settings modal wouldn't open in the hidden preview pane (pre-existing rAF timing, not this change) | merged `dc92574` |
| 2026-09-30 | **Wave 2b merged** (Sonnet builder): **CR3-101 steady in-session clock** (`performance.now`, delta floored at 0; wall clock only for time away). Seen live: jumping the page's wall clock back 5 s or forward 1 h left game time advancing by real elapsed time and the Time Bank untouched. **CR3-402: the Shop slides aside** while a Shop item is over the mat and reopens over the drawer (live, real pointer events); **the mat is locked while the Bank is open** (no mat drag can start, the mat refuses drops; live-checked). Director verified: tests 1 failed (expected) / 3866 passed; bench same work, no regression; no stash left behind (the agent briefly used one to prove red-first, against the rules; nothing lost). **Wave 2 complete** | merged `5508960` |
| 2026-09-30 | Wave 3 (engine rebuild path) dispatched to an Opus engineer | — |
| 2026-10-01 | **Wave 3 merged** (Opus engineer; one usage-limit stop, resumed): CR3-004 buff-source index, CR3-250 no rebuild when a hero's worked Token is unchanged (a deliberate, better variant of the planned "point unchanged" test, which would have missed a buff), CR3-200 per-move neighbour cache (move journal), CR3-201 placement search allocation-free + failed searches remembered (new bench scenario **S7 "waiting for room": p99 29.6 → 3.6 ms**), CR3-254 loot sweeps skip piles the Bank can't take. CR3-103: close (no longer causes a miss). **S2 p99 1.23 → 0.76 ms (target 1.5 ✓); S3 p99 32 → 7.6 ms (target 4 ✗); S3 max 108 → 27; S5 p99 6.5 → 1.6; S4 worst arrival ~15 ms (target 8 ✗, a push-solver tail, CR3-152).** Same work on every scenario after every step. Director verified (tests 1 failed expected / 3882 passed; bench same work) and re-saved the baseline | merged |
| 2026-10-01 | **Remaining S3 miss**: R3's exact "rebuild the whole mat only when the set of board-wide buffs or their paid state changes" is within the owner's Q1 ruling (exact engine fixes allowed), so the director queues it as Wave 3b after the drawing batch. CR3-102's dedupe (a buff may apply a tick late) would need an owner ruling, so it's not taken | — |
| 2026-10-01 | **Wave 4 BUILT, HELD for the owner's look** on branch `draw/wave4` (Opus engineer): walkers by transform, one ring frame clock, ring writes only when visible, hero/enemy frames without React, beacon fix, memo set, bubble measuring, CSS charge floaters, reserved z bands (fixes the S3 draw-order clash), particle burst cap restored. **S2 ~121 → 148 FPS, within budget 53 → 83 %, mat commits 41 → 8/s, dock 34 → 0.7/s; S3 85 → 112 FPS** (dev, headless Chrome, owner's GPU). Tests 1 failed (expected) / 3919 passed; bench same work. **Look**: `docs/review_v3/WAVE4_LOOK.md` + `wave4_look/`. **Owner question W4-1**: walking heroes look slightly soft mid-glide (sub-pixel); (A) keep if invisible at normal size, (B) whole-pixel glide follow-up, (C) back to left/top | not merged |
| 2026-10-01 | Wave 5 (owner's shadow/outline design) dispatched to an Opus engineer, on `draw/wave5` built on top of `draw/wave4`, also held for the look | — |
| 2026-10-01 | **Wave 5 BUILT, HELD for the owner's look** (`draw/wave5`, on top of wave4): a generator (Vite plugin) makes black silhouettes + 1-px green/white/red outline rings from every sprite into git-ignored `public/_gen/sprite-fx/` (new art is covered automatically); no shadow at rest; hard 2-art-px shadow only when dragged and on floating loot; outlines replace the glow; Mat Tuner "Look" rows switch thickness (1 screen px default / 1 art px) and raised-shadow behaviour. **S2 147 → 163 FPS (at the screen's vsync ceiling), within budget 81 → 99 %, GPU busy 74 → 30 %; S3 110 → 147 FPS.** Tests 1 failed (expected) / 3961 passed; bench same work (director re-verified). **Look**: `docs/review_v3/WAVE5_LOOK.md` + `wave5_look/`. Owner questions: **W5-1 thickness** (A 1 screen px), **W5-2 shadow while raised** (A follows the sprite). Noted, not done: ~65 alert-icon glows and ~105 label text-shadows are the filters left | not merged |
| 2026-10-01 | **Wave 3b done** (Opus engineer, `fix/wave3b-engine`, `0442a04`): with a board-reach rule present, the whole mat rebuilds only when the board-reach rules or their paid state change; otherwise the neighbourhood plus a catch-up of layout changes. Rules whose filters read live state (charges, worked, carrying) keep whole-mat rebuilds. **S3 p99 7.2 → 1.9 ms (target 4: MET)**, S3 max 26 → 6. Every Token's buffs hash-identical at every tick on S2/S3/S5 against main; 16 red-first tests; 5 mutation checks | — |
| 2026-10-01 | **Owner looked at the drawing batch live** (folder switched to `draw/wave5`, dev server restarted): "looking great"; **no softness seen on walking sprites** (W4-1 closed: keep); bubbles smooth; strike rhythm good; **shadows excellent**; performance good. **Rulings: outlines edge-only (no diagonal "doubles"), 1 art pixel on the art grid**; **charge and spawn-cap rings glide (~0.8 s) when their count changes**; **raised shadow follows the sprite** (final) | — |
| 2026-10-01 | **Outline rework done** (Wave 5 engineer, resumed): 4-connected (edge-only) dilation on the art grid, exactly 1 art pixel, per frame cell on hero/enemy sheets; the screen-px variant and both Mat Tuner "Look" rows removed; **count rings glide over 800 ms** (CSS transition; nothing runs when idle; reduced-motion keeps the snap). Tests 1 failed (expected) / 3968 passed; bench same work. The dev server had crashed during image regeneration; the director restarted it | — |
| 2026-10-01 | **Owner: inside corners keep the elbow pixel (W5-3 = A); merge the drawing batch. Waves 4 + 5 merged** | merged `a9ccc3d` |
| 2026-10-01 | **Wave 3b merged** after an interleaved re-check under the same machine load: S3 p50 equal to main (~1.1 ms both; the earlier 1.25× was load), p99 2.5–3.0 vs main's 10–11 ms. Combined main: tests 1 failed (expected) / 3984 passed; same work. ⚠ **The bench baseline should be re-saved on a QUIET machine** (current timings are load-inflated) | merged `24f5ef1` |
| 2026-10-06 | Resumed after the weekly limit. **Wave 6 finished by the director** (the Opus engineer had stopped at its final checks): its 6 commits plus the unfinished CR3-309 / CR3-302 memo half, verified (tests 1 failed expected / 4041 passed; same work; build ok; the game boots clean into S2: 106 Tokens, 8 dock heroes, MatBoard ~2 own renders/s, no console errors). **Merged.** An unrelated Atlas edit to `StateSchema.js` was set aside during verification and restored byte-identical, left uncommitted with `data/items/maps.json` and two map PNGs (not review work) | merged `0bf90bf` |
| 2026-10-06 | **Doc cleanup from another session committed** at the owner's request: 97 pure moves into `docs/archive/` (each verified present) + GDD, crunch prep plan, triage report, atlas concept, test-scripts review | merged `eea33a8` |
| 2026-10-06 | **Session closed.** Executive summary: `docs/review_v3/SESSION_SUMMARY.md` | — |
